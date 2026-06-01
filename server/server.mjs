import { createServer } from 'http';
import { readFile, readdir, stat, access, mkdir, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { lookup } from 'dns/promises';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

function validatePathParam(name, value) {
  if (value == null) return true;
  if (value.includes('..') || value.includes('/') || value.includes('\\')) return false;
  return true;
}

// ---- Config ----
const PORT_RANGE_START = 50000;
const PORT_RANGE_END = 60000;
const __dirname = import.meta.dirname;
const WEB_DIR = join(__dirname, '..', 'web');
const PROJECTS_DIR = join(process.env.USERPROFILE || '~', '.claude', 'projects');
const PORT_FILE = join(process.env.USERPROFILE || '~', '.claude', 'tmp', 'claude-chat.port');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---- Dynamic port ----
async function findFreePort() {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    try {
      const s = createServer();
      await new Promise((resolve, reject) => {
        s.on('error', reject);
        s.listen(port, '127.0.0.1', () => {
          s.close(() => resolve());
        });
      });
      return port;
    } catch { /* port in use, try next */ }
  }
  throw new Error('No free port in range ' + PORT_RANGE_START + '-' + PORT_RANGE_END);
}

// ---- Helpers ----
function projectKey(names) { return names.replaceAll(':', '-').replaceAll('\\', '-').replaceAll('/', '-'); }

const _pathCache = new Map();

async function resolveProjectPath(encoded) {
  if (!encoded) return encoded;
  if (_pathCache.has(encoded)) return _pathCache.get(encoded);

  // Check metadata cache on disk
  const projectDir = join(PROJECTS_DIR, encoded);
  const meta = await loadSessionMeta(projectDir);
  if (meta._path) {
    _pathCache.set(encoded, meta._path);
    return meta._path;
  }

  let resolved;
  if (/^[A-Za-z]--/.test(encoded)) {
    resolved = await resolveWindowsPath(encoded.charAt(0), encoded.substring(3));
  } else {
    resolved = decodeSimple(encoded);
  }
  if (!resolved) resolved = decodeSimple(encoded);

  // Cache both in-memory and on disk
  _pathCache.set(encoded, resolved);
  meta._path = resolved;
  try { await saveSessionMeta(projectDir, meta); } catch (e) { console.error('Failed to persist session meta cache:', e.message); }
  return resolved;
}

function decodeSimple(encoded) {
  if (/^[A-Za-z]--/.test(encoded)) {
    return encoded.charAt(0) + ':\\' + encoded.substring(3).replaceAll('-', '\\');
  }
  return encoded.replaceAll('-', '\\');
}

async function resolveWindowsPath(drive, rest) {
  const parts = rest.split('-');
  const result = await tryPathSegments(drive + ':\\', parts, 0);
  return result;
}

async function tryPathSegments(base, parts, idx) {
  if (idx >= parts.length) return base;
  for (let end = parts.length - 1; end >= idx; end--) {
    const segment = parts.slice(idx, end + 1).join('-');
    const candidate = base + (base.endsWith('\\') ? '' : '\\') + segment;
    try {
      await access(candidate);
      const result = await tryPathSegments(candidate, parts, end + 1);
      if (result) return result;
    } catch {}
  }
  return null;
}

async function parseSessionFile(filePath, sessionId) {
  try {
    const size = (await stat(filePath)).size;
    let firstUserMsg = '';
    const rl = createInterface({ input: createReadStream(filePath, 'utf-8'), crlfDelay: Infinity });
    for await (const line of rl) {
      try {
        const node = JSON.parse(line);
        const msg = node.message;
        if (msg && msg.role === 'user') {
          const content = msg.content;
          if (typeof content === 'string') { firstUserMsg = content; break; }
          if (Array.isArray(content)) {
            for (const b of content) {
              if (b.text) { firstUserMsg = b.text; break; }
            }
            if (firstUserMsg) break;
          }
        }
      } catch {}
    }
    rl.close();
    if (!firstUserMsg) return null;
    return { sessionId, preview: firstUserMsg.slice(0, 150) + (firstUserMsg.length > 150 ? '...' : ''), size };
  } catch { return null; }
}

async function handleQuestions(res, sessionId, project, searchParams) {
  if (!validatePathParam('project', project)) return jsonResponse(res, { error: 'Invalid parameter' }, 400);
  if (!validatePathParam('sessionId', sessionId)) return jsonResponse(res, { error: 'Invalid parameter' }, 400);
  const projectDir = join(PROJECTS_DIR, project || projectKey(process.cwd()));
  const file = join(projectDir, sessionId + '.jsonl');
  const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit')) || 10, 100));
  const beforeParam = searchParams.get('before');
  const before = beforeParam != null ? parseInt(beforeParam) : -1;

  const questions = [];
  let lineIndex = 0;

  try {
    const rl = createInterface({ input: createReadStream(file, 'utf-8'), crlfDelay: Infinity });
    for await (const line of rl) {
      try {
        const node = JSON.parse(line);
        const msg = node.message;
        if (msg && msg.role === 'user') {
          const content = msg.content;
          let text = '';
          if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content)) {
            for (const b of content) {
              if (b.text) { text = b.text; break; }
            }
          }
          if (text) {
            // Skip resume noise and internal system notifications
            const t = text.trim();
            if (t === 'Continue from where you left off.' || t === 'No response requested.') { lineIndex++; continue; }
            if (t.startsWith('<task-notification>') || t.startsWith('<local-command-caveat>')) { lineIndex++; continue; }
            if (t.startsWith('Base directory for this skill:')) { lineIndex++; continue; }
            const preview = text.length > 150 ? text.substring(0, 150) + '...' : text;
            questions.push({ index: lineIndex, preview, text });
          }
        }
      } catch {}
      lineIndex++;
    }
    rl.close();
  } catch { return jsonResponse(res, { questions: [], total: 0, hasMore: false }); }

  // questions are file-ordered (oldest first). Reverse for newest-first.
  questions.reverse();

  const total = questions.length;

  // Pagination: return questions before the given index
  let filtered = questions;
  if (before >= 0) {
    filtered = questions.filter(q => q.index < before);
  }

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  jsonResponse(res, { questions: page, total, hasMore });
}

async function loadSessionMeta(projectDir) {
  const file = join(projectDir, '_session_meta.json');
  try {
    return JSON.parse(await readFile(file, 'utf-8'));
  } catch { return {}; }
}

async function saveSessionMeta(projectDir, meta) {
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, '_session_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  readFile(filePath).then(data => {
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  }).catch(() => {
    res.writeHead(404);
    res.end('Not found');
  });
}

// ---- API Handlers ----
async function handleProjects(res) {
  const projects = [];
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const encoded = e.name;
      let sessionCount = 0;
      try {
        const files = await readdir(join(PROJECTS_DIR, encoded));
        sessionCount = files.filter(f => f.endsWith('.jsonl')).length;
      } catch (e) { console.error('Failed to read project dir:', encoded, e.message); }
      if (sessionCount === 0) continue;
      const path = await resolveProjectPath(encoded);
      projects.push({ name: encoded, path, sessionCount });
    }
  } catch (e) { console.error('Failed to list projects:', e.message); }
  projects.sort((a, b) => b.sessionCount - a.sessionCount);
  jsonResponse(res, projects);
}

async function handleSessions(res, project) {
  if (!validatePathParam('project', project)) return jsonResponse(res, { error: 'Invalid parameter' }, 400);
  const projectDir = join(PROJECTS_DIR, project || projectKey(process.cwd()));
  const sessions = [];
  try {
    const files = await readdir(projectDir);
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const sid = f.replace('.jsonl', '');
      const info = await parseSessionFile(join(projectDir, f), sid);
      if (info) {
        const { mtimeMs } = await stat(join(projectDir, f));
        info.lastModified = mtimeMs;
        sessions.push(info);
      }
    }
  } catch (e) { console.error('Failed to read session dir:', projectDir, e.message); return jsonResponse(res, sessions); }
  sessions.sort((a, b) => b.lastModified - a.lastModified);
  const result = sessions.slice(0, 50);
  const meta = await loadSessionMeta(projectDir);
  for (const s of result) {
    if (meta[s.sessionId]) s.customName = meta[s.sessionId];
  }
  jsonResponse(res, result);
}

async function handleSessionMessages(res, sessionId, project, searchParams) {
  if (!validatePathParam('project', project)) return jsonResponse(res, { error: 'Invalid parameter' }, 400);
  if (!validatePathParam('sessionId', sessionId)) return jsonResponse(res, { error: 'Invalid parameter' }, 400);
  const projectDir = join(PROJECTS_DIR, project || projectKey(process.cwd()));
  const file = join(projectDir, sessionId + '.jsonl');
  const fromParam = searchParams.get('fromIndex');
  const fromIndex = fromParam != null ? Math.max(0, parseInt(fromParam)) : null;
  const toParam = searchParams.get('toIndex');
  const toIndex = toParam != null ? parseInt(toParam) : null;

  const messages = [];
  let lineIndex = 0;

  try {
    const rl = createInterface({ input: createReadStream(file, 'utf-8'), crlfDelay: Infinity });
    for await (const line of rl) {
      // Skip lines before fromIndex
      if (fromIndex != null && lineIndex < fromIndex) { lineIndex++; continue; }
      // Stop at toIndex (exclusive)
      if (toIndex != null && lineIndex >= toIndex) break;

      try {
        const node = JSON.parse(line);
        const msg = node.message;
        if (!msg) { lineIndex++; continue; }
        const role = msg.role || '';
        const content = msg.content;
        if (!content) { lineIndex++; continue; }
        const blocks = [];
        if (Array.isArray(content)) {
          for (const b of content) {
            const out = {};
            if (b.type) out.type = b.type;
            if (b.thinking) out.thinking = b.thinking;
            if (b.text) out.text = b.text;
            if (b.name) out.name = b.name;
            if (Object.keys(out).length > 0) blocks.push(out);
          }
        } else if (typeof content === 'string') {
          blocks.push({ type: 'text', text: content });
        }
        if (blocks.length === 0) { lineIndex++; continue; }
        // skip resume noise and internal system notifications
        const firstBlock = blocks[0];
        if (firstBlock.type === 'text') {
          const t = (firstBlock.text || '').trim();
          if (t === 'Continue from where you left off.' || t === 'No response requested.') { lineIndex++; continue; }
          if (t.startsWith('<task-notification>') || t.startsWith('<local-command-caveat>')) { lineIndex++; continue; }
          if (t.startsWith('Base directory for this skill:')) { lineIndex++; continue; }
        }
        messages.push({ role, blocks, lineIndex });
      } catch (e) { console.error('Malformed JSON line in session file:', file, 'line', lineIndex, e.message); }
      lineIndex++;
    }
    rl.close();
  } catch (e) { console.error('Failed to read session file:', file, e.message); return jsonResponse(res, { messages: [], total: 0 }); }

  jsonResponse(res, { messages, total: messages.length });
}

async function handleSessionNames(res, project, method, sessionId, body) {
  if (!validatePathParam('project', project)) return jsonResponse(res, { error: 'Invalid parameter' }, 400);
  if (!validatePathParam('sessionId', sessionId)) return jsonResponse(res, { error: 'Invalid parameter' }, 400);
  const projectDir = join(PROJECTS_DIR, project || projectKey(process.cwd()));
  let meta = await loadSessionMeta(projectDir);
  if (method === 'PUT' && sessionId) {
    const name = (body.name || '').trim();
    if (name) meta[sessionId] = name;
    else delete meta[sessionId];
    await saveSessionMeta(projectDir, meta);
  } else if (method === 'DELETE' && sessionId) {
    delete meta[sessionId];
    await saveSessionMeta(projectDir, meta);
  }
  jsonResponse(res, meta);
}

// ---- Route Dispatch ----
async function handleRequest(req, res) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch {
    res.writeHead(400);
    res.end('Bad Request: malformed URL');
    return;
  }
  const path = url.pathname;
  const method = req.method;

  // API routes
  if (path === '/api/projects') return handleProjects(res);
  if (path === '/api/commands') {
    const commands = [
      { cmd: '/devflow:clarify', group: 'devflow', desc: '需求澄清，将模糊想法转化为清晰需求' },
      { cmd: '/devflow:breakdown', group: 'devflow', desc: '需求拆解，转化为可跟踪的编号清单' },
      { cmd: '/devflow:blueprint', group: 'devflow', desc: '方案蓝图，从需求清单生成技术方案' },
      { cmd: '/devflow:discover', group: 'devflow', desc: '项目扫描，发现优化机会和改善方向' },
      { cmd: '/devflow:implement', group: 'devflow', desc: '执行实施，按蓝图编写代码' },
      { cmd: '/devflow:verify', group: 'devflow', desc: '验证收尾，检查代码质量和部署就绪' },
      { cmd: '/superpowers:brainstorming', group: 'superpowers', desc: '头脑风暴，将想法转化为设计文档' },
      { cmd: '/superpowers:writing-plans', group: 'superpowers', desc: '编写详细实施计划' },
      { cmd: '/superpowers:subagent-driven-development', group: 'superpowers', desc: '子代理驱动开发执行计划' },
      { cmd: '/superpowers:executing-plans', group: 'superpowers', desc: '批量执行开发计划' },
      { cmd: '/superpowers:finishing-a-development-branch', group: 'superpowers', desc: '完成开发分支收尾' },
      { cmd: '/superpowers:requesting-code-review', group: 'superpowers', desc: '请求代码审查' },
      { cmd: '/superpowers:test-driven-development', group: 'superpowers', desc: '测试驱动开发' },
      { cmd: '/superpowers:using-git-worktrees', group: 'superpowers', desc: '使用 Git Worktree 隔离工作区' },
      { cmd: '/superpowers:using-superpowers', group: 'superpowers', desc: 'Superpowers 使用指南' },
    ];
    return jsonResponse(res, commands);
  }
  if (path === '/api/sessions') return handleSessions(res, url.searchParams.get('project') || '');
  if (path.startsWith('/api/sessions/')) {
    const parts = path.split('/');
    const idx = parts.indexOf('sessions');
    if (parts[idx + 1] === 'names') return handleSessionNames(res, url.searchParams.get('project') || '', method);
    if (parts[idx + 1] === 'messages') return res.writeHead(400) && res.end();
    if (path.endsWith('/questions')) {
      const sessionId = parts[idx + 1];
      return handleQuestions(res, sessionId, url.searchParams.get('project') || '', url.searchParams);
    }
    if (path.endsWith('/messages')) {
      const sessionId = parts[idx + 1];
      return handleSessionMessages(res, sessionId, url.searchParams.get('project') || '', url.searchParams);
    }
    if (path.endsWith('/name') || path.endsWith('/names')) {
      const sessionId = parts[idx + 1];
      if (method === 'PUT') {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        return req.on('end', async () => {
          let body;
          try {
            body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
          } catch {
            return jsonResponse(res, { error: 'Invalid JSON' }, 400);
          }
          return handleSessionNames(res, url.searchParams.get('project') || '', method, sessionId, body);
        });
      }
      return handleSessionNames(res, url.searchParams.get('project') || '', method, sessionId);
    }
  }

  // Static files
  if (!path.startsWith('/api/')) {
    // SPA fallback: /project/** without dots -> index.html
    if (path.startsWith('/project/') && !path.includes('.')) {
      return serveStatic(res, join(WEB_DIR, 'index.html'));
    }
    const filePath = path === '/' ? join(WEB_DIR, 'index.html') : join(WEB_DIR, path.replace(/^\//, ''));
    return serveStatic(res, filePath);
  }

  res.writeHead(404);
  res.end('Not found');
}

// ---- WebSocket ----
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws/chat' });

  wss.on('connection', (ws) => {
    const wsId = randomUUID();
    
    ws.on('message', async (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }
      const { text, sessionId, project } = data;
      if (!text) return;

      // Resolve project path for correct CWD when spawning Claude
      let cwd = process.cwd();
      if (project) {
        try { cwd = await resolveProjectPath(project); } catch (e) { console.error('Failed to resolve project path for WebSocket:', project, e.message); }
      }

      const args = ['-p', '--output-format', 'stream-json', '--input-format', 'stream-json', '--verbose'];
      if (sessionId) { args.push('--resume', sessionId); }

      const proc = spawn('claude', args, { cwd, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] });

      // Build user message JSON
      const userMsg = JSON.stringify({ type: 'user', message: { role: 'user', content: text } });
      proc.stdin.write(userMsg);
      proc.stdin.end();

      // Stream stdout lines as WebSocket events
      const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const evt = JSON.parse(line);
          if (!evt._sessionId) evt._sessionId = sessionId;
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(evt));
        } catch { if (ws.readyState === WebSocket.OPEN) ws.send(line); }
      });
      rl.on('close', () => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'done', _sessionId: sessionId })); });

      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: 'Claude CLI exited with code ' + code + (stderr ? ' — ' + stderr.slice(0, 300) : ''), _sessionId: sessionId }));
        }
      });
    });

    ws.on('close', () => {});
  });
}

// ---- Exports for testing ----
export { handleRequest, validatePathParam };

// ---- Start ----
async function main() {
  const port = await findFreePort();
  const server = createServer(handleRequest);
  setupWebSocket(server);

  server.listen(port, '127.0.0.1', async () => {
    console.log('claude-chat running on port ' + port);
    // Write port file
    await mkdir(join(process.env.USERPROFILE, '.claude', 'tmp'), { recursive: true });
    await writeFile(PORT_FILE, String(port), 'utf-8');
  });
}

// Only start the server when executed directly (not when imported for tests)
const runningDirectly = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (runningDirectly) {
  main().catch(err => { console.error(err); process.exit(1); });
}
