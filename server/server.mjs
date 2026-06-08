import { createServer } from 'http';
import { readFile, readdir, stat, access, mkdir, writeFile } from 'fs/promises';
import { createReadStream, watchFile, unwatchFile, openSync, readSync, closeSync, existsSync, statSync } from 'fs';
import { watch } from 'fs';
import { join, extname, resolve, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execFileSync } from 'child_process';
import { lookup } from 'dns/promises';
import { networkInterfaces } from 'os';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

function validatePathParam(name, value) {
  if (value == null) return true;
  if (value.includes('..') || value.includes('/') || value.includes('\\')) return false;
  return true;
}

// Strip XML-like tags from text for clean display (preview, history list)
// Removes <command-message>, <command-name>, <command-args>,
// <local-command-caveat>, <task-notification>, <system-reminder> etc.
function stripXmlTags(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/<command-message>\s*<command-name>[\s\S]*?<\/command-name>\s*<command-args>([\s\S]*?)<\/command-args>\s*<\/command-message>/g, '$1')
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
    .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<[^>]+>/g, '') // fallback: strip any remaining angle-bracket tags
    .trim();
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
        s.listen(port, '0.0.0.0', () => {
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
    const clean = stripXmlTags(firstUserMsg);
    return { sessionId, preview: clean.slice(0, 150) + (clean.length > 150 ? '...' : ''), size };
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
            const clean = stripXmlTags(text);
            if (!clean) { lineIndex++; continue; }
            const preview = clean.length > 150 ? clean.substring(0, 150) + '...' : clean;
            questions.push({ index: lineIndex, preview, text: clean });
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
async function handleRequest(req, res, token = null) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch {
    res.writeHead(400);
    res.end('Bad Request: malformed URL');
    return;
  }

  const path = url.pathname;
  const method = req.method;

  // Token validation — only for API (except lan-url) and WebSocket, not static files
  // Skip token check for localhost connections (same machine)
  const isLocalhost = req.socket && (req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1' || req.socket.remoteAddress === '::ffff:127.0.0.1');
  if (!isLocalhost && path.startsWith('/api/') && path !== '/api/lan-url' && token && url.searchParams.get('token') !== token) {
    res.writeHead(403);
    res.end('Forbidden: invalid or missing token');
    return;
  }

  // API routes
  if (path === '/api/lan-url') return jsonResponse(res, { url: lanUrl || null });
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
function setupWebSocket(server, token) {
  const wss = new WebSocketServer({ noServer: true });

  // Group WebSocket clients by "project:sessionId" for cross-device sync
  const sessionGroups = new Map();

  function addToGroup(key, ws) {
    const isNew = !sessionGroups.has(key);
    if (isNew) sessionGroups.set(key, new Set());
    sessionGroups.get(key).add(ws);
    return isNew;
  }

  function removeFromGroup(key, ws) {
    const group = sessionGroups.get(key);
    if (!group) return;
    group.delete(ws);
    if (group.size === 0) {
      sessionGroups.delete(key);
      stopWatching(key);
    }
  }

  // Broadcast event to all clients in the same session group (excluding sender)
  function broadcastToGroup(key, data, excludeWs) {
    const group = sessionGroups.get(key);
    if (!group) return;
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    for (const client of group) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  // ---- File watcher for CLI-to-Web realtime sync (R-052 ~ R-058) ----
  const watchers = new Map(); // groupKey -> { filePath, offset, buffer, watchFileRef, watchRef, paused }

  function getJsonlPath(groupKey) {
    const idx = groupKey.indexOf(':');
    if (idx === -1) return null;
    const project = groupKey.slice(0, idx);
    const sessionId = groupKey.slice(idx + 1);
    const resolved = resolve(PROJECTS_DIR, project, sessionId + '.jsonl');
    const root = resolve(PROJECTS_DIR);
    if (!resolved.startsWith(root + sep)) return null;
    return resolved;
  }

  function startWatching(groupKey) {
    if (watchers.has(groupKey)) return;
    const filePath = getJsonlPath(groupKey);
    if (!filePath) return;

    // Determine initial offset: start at end of file (don't replay history)
    let initialOffset = 0;
    try {
      initialOffset = statSync(filePath).size;
    } catch { /* file doesn't exist yet */ }

    const state = {
      filePath,
      offset: initialOffset,
      buffer: '',
      watchFileRef: null,
      watchRef: null,
      paused: false,
    };
    watchers.set(groupKey, state);

    // Layer 1: fs.watchFile — cross-platform stat polling (1s interval)
    state.watchFileRef = watchFile(filePath, { interval: 1000 }, (curr) => {
      if (state.paused) return;
      if (curr.size > state.offset) {
        readNewLines(groupKey);
      }
    });

    // Layer 2: fs.watch — event-driven, non-Windows only
    if (process.platform !== 'win32') {
      try {
        if (existsSync(filePath)) {
          state.watchRef = watch(filePath, (eventType) => {
            if (state.paused) return;
            if (eventType === 'change') {
              try {
                if (statSync(filePath).size > state.offset) readNewLines(groupKey);
              } catch { /* file may have been deleted */ }
            }
          });
        }
      } catch { /* fs.watch may fail on some filesystems */ }
    }

    console.log('[Watcher] Started:', groupKey, 'offset:', initialOffset);
  }

  function readNewLines(groupKey) {
    const state = watchers.get(groupKey);
    if (!state || state.paused) return;

    let fd;
    try {
      const currSize = statSync(state.filePath).size;

      // Handle truncation: file got smaller
      if (currSize < state.offset) {
        console.warn('[Watcher] File truncated, resetting offset:', state.filePath);
        state.offset = 0;
        state.buffer = '';
      }

      if (currSize <= state.offset) return;

      const bytesToRead = currSize - state.offset;
      const buf = Buffer.alloc(bytesToRead);
      fd = openSync(state.filePath, 'r');
      readSync(fd, buf, 0, bytesToRead, state.offset);
      state.offset = currSize;

      const newData = state.buffer + buf.toString('utf-8');
      const lines = newData.split('\n');
      state.buffer = lines.pop(); // incomplete trailing line

      if (lines.length > 0) {
        parseAndBroadcast(groupKey, lines);
      }
    } catch (e) {
      console.warn('[Watcher] Read error:', e.message);
    } finally {
      if (fd !== undefined) {
        try { closeSync(fd); } catch { /* ignore */ }
      }
    }
  }

  function parseAndBroadcast(groupKey, lines) {
    // Extract sessionId from groupKey ("project:sessionId")
    const idx = groupKey.indexOf(':');
    const sessionId = idx !== -1 ? groupKey.slice(idx + 1) : groupKey;

    for (const line of lines) {
      const event = parseJsonlLine(line);
      if (!event) continue;
      event._sessionId = sessionId;
      // broadcastToGroup sends to ALL clients when excludeWs is null/undefined
      broadcastToGroup(groupKey, event, null);
    }
  }

  function stopWatching(groupKey) {
    const state = watchers.get(groupKey);
    if (!state) return;
    if (state.watchFileRef) {
      try { unwatchFile(state.filePath, state.watchFileRef); } catch { /* ignore */ }
    }
    if (state.watchRef) {
      try { state.watchRef.close(); } catch { /* ignore */ }
    }
    watchers.delete(groupKey);
    console.log('[Watcher] Stopped:', groupKey);
  }

  function stopAllWatchers() {
    for (const key of watchers.keys()) {
      stopWatching(key);
    }
  }

  // Heartbeat: check all watchers for missed changes every 30s
  const watcherHeartbeat = setInterval(() => {
    for (const [groupKey, state] of watchers) {
      if (state.paused) continue;
      try {
        if (statSync(state.filePath).size > state.offset) {
          readNewLines(groupKey);
        }
      } catch { /* file may not exist */ }
    }
  }, 30000);

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname !== '/ws/chat') { socket.destroy(); return; }
      const wsLocalhost = request.socket.remoteAddress === '127.0.0.1' || request.socket.remoteAddress === '::1' || request.socket.remoteAddress === '::ffff:127.0.0.1';
      if (!wsLocalhost && token && url.searchParams.get('token') !== token) {
        socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const wsId = randomUUID();
    let wsGroupKey = null;  // Track which session group this client belongs to

    ws.on('message', async (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }

      // Handle join message: register in session group without spawning Claude
      // (sent on WebSocket connect to receive realtime CLI sync)
      if (data.type === 'join') {
        const { sessionId, project } = data;
        if (project && !validatePathParam('project', project)) return;
        if (sessionId && !validatePathParam('sessionId', sessionId)) return;
        if (project && sessionId) {
          const groupKey = project + ':' + sessionId;
          if (wsGroupKey !== groupKey) {
            if (wsGroupKey) removeFromGroup(wsGroupKey, ws);
            const isNewGroup = addToGroup(groupKey, ws);
            wsGroupKey = groupKey;
            if (isNewGroup) startWatching(groupKey);
          }
        }
        return;
      }

      const { text, sessionId, project } = data;
      if (!text) return;

      if (project && !validatePathParam('project', project)) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: 'Invalid project parameter' }));
        return;
      }
      if (sessionId && !validatePathParam('sessionId', sessionId)) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: 'Invalid sessionId parameter' }));
        return;
      }

      // → Register client in session group for realtime cross-device sync
      const groupKey = (project || 'default') + ':' + (sessionId || 'new');
      if (wsGroupKey !== groupKey) {
        if (wsGroupKey) removeFromGroup(wsGroupKey, ws);
        const isNewGroup = addToGroup(groupKey, ws);
        wsGroupKey = groupKey;
        // Start file watcher for CLI-to-Web sync when first client joins this session
        if (isNewGroup && project && sessionId) {
          startWatching(groupKey);
        }
      }

      // Resolve project path for correct CWD when spawning Claude
      let cwd = process.cwd();
      if (project) {
        try { cwd = await resolveProjectPath(project); } catch (e) { console.error('Failed to resolve project path for WebSocket:', project, e.message); }
      }

      // Pause file watcher during web-spawned Claude stream to avoid duplicate events
      // (the spawned process writes to JSONL AND streams directly via WS)
      if (watchers.has(groupKey)) {
        const wstate = watchers.get(groupKey);
        wstate.paused = true;
      }

      const args = ['-p', '--output-format', 'stream-json', '--input-format', 'stream-json', '--verbose'];
      if (sessionId) { args.push('--resume', sessionId); }

      const proc = spawn('claude', args, { cwd, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] });

      // Build user message JSON
      const userMsg = JSON.stringify({ type: 'user', message: { role: 'user', content: text } });
      proc.stdin.write(userMsg);
      proc.stdin.end();

      // → Stream stdout lines as WebSocket events — broadcast to ALL clients in the session group
      const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const evt = JSON.parse(line);
          if (!evt._sessionId) evt._sessionId = sessionId;
          const evtStr = JSON.stringify(evt);
          // Send to sender
          if (ws.readyState === WebSocket.OPEN) ws.send(evtStr);
          // Broadcast to other clients watching the same session
          broadcastToGroup(groupKey, evtStr, ws);
        } catch {
          if (ws.readyState === WebSocket.OPEN) ws.send(line);
          broadcastToGroup(groupKey, line, ws);
        }
      });
      rl.on('close', () => {
        const done = JSON.stringify({ type: 'done', _sessionId: sessionId });
        if (ws.readyState === WebSocket.OPEN) ws.send(done);
        broadcastToGroup(groupKey, done, ws);
      });

      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        // Resume file watcher: update offset to skip already-streamed messages, then unpause
        const wstate = watchers.get(groupKey);
        if (wstate && wstate.paused) {
          try {
            wstate.offset = statSync(wstate.filePath).size;
          } catch { /* file may not exist */ }
          wstate.paused = false;
        }

        if (code !== 0) {
          const errMsg = JSON.stringify({ type: 'error', message: 'Claude CLI exited with code ' + code + (stderr ? ' — ' + stderr.slice(0, 300) : ''), _sessionId: sessionId });
          if (ws.readyState === WebSocket.OPEN) ws.send(errMsg);
          broadcastToGroup(groupKey, errMsg, ws);
        }
      });
    });

    ws.on('close', () => {
      // Clean up: remove client from its session group
      if (wsGroupKey) removeFromGroup(wsGroupKey, ws);
    });
  });

  // Register graceful shutdown for file watchers
  const cleanupWatchers = () => {
    stopAllWatchers();
    clearInterval(watcherHeartbeat);
  };
  process.on('SIGINT', cleanupWatchers);
  process.on('SIGTERM', cleanupWatchers);
}

// ---- Utility: parse a single JSONL line to a WS event (exported for testing) ----
function parseJsonlLine(line) {
  if (!line || !line.trim()) return null;
  try {
    const node = JSON.parse(line);
    const msg = node.message;

    if (!msg) {
      // Result events (no message wrapper in JSONL)
      if (node.type === 'result') {
        return {
          type: 'result',
          subtype: node.subtype,
          num_turns: node.num_turns,
          duration_ms: node.duration_ms,
        };
      }

      // System events (no message wrapper in JSONL)
      if (node.type === 'system') {
        return {
          type: 'system',
          session_id: node.session_id,
          ...(node.model ? { model: node.model } : {}),
        };
      }

      // Legacy format: role/content at top level
      if (node.role === 'user') {
        const text = typeof node.content === 'string' ? node.content
          : (Array.isArray(node.content) ? node.content.map(b => b.text || '').join(' ') : '');
        return { type: 'user', message: { role: 'user', content: text } };
      }
      if (node.role === 'assistant') {
        return { type: 'assistant', message: node };
      }
      return null;
    }

    // Standard stream-json format: { message: { role, content: [...] } }
    const role = msg.role;
    if (!role) return null;

    if (role === 'user') {
      const text = typeof msg.content === 'string' ? msg.content
        : (Array.isArray(msg.content) ? msg.content.map(b => b.text || '').join(' ') : '');
      return { type: 'user', message: { role: 'user', content: text } };
    }

    if (role === 'assistant') {
      return { type: 'assistant', message: msg };
    }

    // System events (init, session_id)
    if (node.type === 'system' || msg.type === 'system') {
      return {
        type: 'system',
        session_id: node.session_id || msg.session_id,
        ...(node.model ? { model: node.model } : {}),
      };
    }

    // Result events
    if (node.type === 'result') {
      return {
        type: 'result',
        subtype: node.subtype,
        num_turns: node.num_turns,
        duration_ms: node.duration_ms,
      };
    }

    // Generic fallback
    return { type: role, message: msg };
  } catch {
    // JSON parse failed — skip silently (malformed/incomplete line)
    return null;
  }
}

// ---- Exports for testing ----
export { handleRequest, validatePathParam, getLanAddress, isVirtualIp, addFirewallRule, removeFirewallRule, _setFirewallExecutor, _resetFirewallExecutor, parseJsonlLine };

// Known virtual/VPN network ranges that phones on a real LAN cannot reach
// - 172.16-31.x: Docker, WSL1, VPN
// - 192.168.65.x / 192.168.68.x: WSL2 vEthernet (Windows host side)
// - 169.254.x.x: Link-local (zeroconf, not routable across devices)
function isVirtualIp(addr) {
  return /^172\.(1[6-9]|2\d|3[01])\./.test(addr)      // Docker/WSL1/VPN
      || /^192\.168\.(65|68)\.\d+$/.test(addr)           // WSL2 vEthernet
      || /^169\.254\.\d+\.\d+$/.test(addr);               // Link-local
}

function getLanAddress() {
  const ifaces = networkInterfaces();
  // Prefer non-virtual IPs (real LAN that phones can actually reach)
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidates.push({ addr: iface.address, name });
      }
    }
  }
  const realLan = candidates.find(c => !isVirtualIp(c.addr));
  return (realLan || candidates[0] || {}).addr || null;
}

// ---- Windows Firewall Rule Management ----

// Test hook: override executor for unit testing
let _execFile = execFileSync;
function _setFirewallExecutor(fn) { _execFile = fn; }
function _resetFirewallExecutor() { _execFile = execFileSync; }

function firewallRuleName(port) {
  return 'Claude Chat Server (port:' + port + ')';
}

function addFirewallRule(port) {
  if (process.platform !== 'win32') return;
  const name = firewallRuleName(port);
  // 1) Delete any leftover rule from a previous crashed process (ignore errors)
  try {
    _execFile('netsh', ['advfirewall', 'firewall', 'delete', 'rule', 'name=' + name], { stdio: 'ignore' });
  } catch { /* rule didn't exist — safe to ignore */ }
  // 2) Add the new inbound rule
  try {
    _execFile('netsh', [
      'advfirewall', 'firewall', 'add', 'rule',
      'name=' + name, 'dir=in', 'action=allow', 'protocol=TCP', 'localport=' + port
    ], { stdio: 'ignore' });
    console.log('[Firewall] Rule added: ' + name);
  } catch {
    const manualCmd = 'netsh advfirewall firewall add rule name="' + name
      + '" dir=in action=allow protocol=TCP localport=' + port;
    console.warn('[Firewall] ⚠️ 无法自动添加防火墙规则（可能需要管理员权限）。');
    console.warn('[Firewall] 手机扫码可能无法连接。请尝试以下操作之一：');
    console.warn('[Firewall]   1. 以管理员身份重新启动本程序');
    console.warn('[Firewall]   2. 手动执行: ' + manualCmd);
  }
}

function removeFirewallRule(port) {
  if (process.platform !== 'win32') return;
  const name = firewallRuleName(port);
  try {
    _execFile('netsh', ['advfirewall', 'firewall', 'delete', 'rule', 'name=' + name], { stdio: 'ignore' });
    console.log('[Firewall] Rule removed: ' + name);
  } catch {
    // Silently ignore — rule may already be gone
  }
}

// LAN URL shared with API endpoint (set after server starts)
let lanUrl = null;

// ---- Start ----
async function main() {
  const port = await findFreePort();
  const AUTH_TOKEN = randomUUID();
  const server = createServer((req, res) => handleRequest(req, res, AUTH_TOKEN));
  setupWebSocket(server, AUTH_TOKEN);

  server.listen(port, '0.0.0.0', async () => {
    const lanIp = getLanAddress();
    console.log('claude-chat running on port ' + port);

    // Add Windows firewall rule for this port
    addFirewallRule(port);

    if (lanIp) {
      if (isVirtualIp(lanIp)) {
        console.warn('[LAN] Warning: address ' + lanIp + ' appears to be a virtual/WSL2 network.');
        console.warn('[LAN] Phone scanning QR code may NOT be able to reach this address.');
        console.warn('[LAN] Check that your PC has a real LAN/WiFi IP in a different subnet.');
      }
      lanUrl = 'http://' + lanIp + ':' + port + '/?token=' + AUTH_TOKEN;
      console.log('LAN: ' + lanUrl);
    } else {
      console.warn('[LAN] No LAN IP found. Phone access via QR code will not work.');
      console.warn('[LAN] Available non-loopback interfaces: check os.networkInterfaces() output');
    }
    // Write port file
    await mkdir(join(process.env.USERPROFILE, '.claude', 'tmp'), { recursive: true });
    await writeFile(PORT_FILE, String(port), 'utf-8');
  });

  // Clean up firewall rule and file watchers on graceful shutdown
  const cleanup = () => { removeFirewallRule(port); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Only start the server when executed directly (not when imported for tests)
const runningDirectly = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (runningDirectly) {
  main().catch(err => { console.error(err); process.exit(1); });
}
