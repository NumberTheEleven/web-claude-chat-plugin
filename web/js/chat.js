// ====== URL-based project routing ======
const urlParams = new URLSearchParams(window.location.search);
const AUTH_TOKEN = urlParams.get('token') || '';

function apiUrl(path) {
  if (!AUTH_TOKEN) return path;
  const sep = path.includes('?') ? '&' : '?';
  return path + sep + 'token=' + encodeURIComponent(AUTH_TOKEN);
}

function getProjectFromUrl() {
  const match = window.location.pathname.match(/^\/project\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function projectStorageKey(base) {
  return (state.project || 'default') + ':' + base;
}

// ====== State ======
const state = {
  ws: null,
  sessionId: null,
  project: null,
  processing: false,
  sequenceBuffer: [],
  tagDetailsEl: {},
  currentTagRow: null,
  sessionNames: {},
  todos: [],
  sessionStatus: {},
  // Question-index-based navigation
  oldestQuestionIndex: null,    // index of the oldest question currently displayed
  questions: [],                // loaded questions for right panel {index, preview, text}
  questionsTotal: 0,
  questionsHasMore: false,
  _metaWrapper: null,
  pendingSession: false
};

// Tool icons map
const TOOL_ICONS = {
  Read: '\u{1F4C4}', Write: '\u{270F}', Edit: '\u{270F}',
  Bash: '\u{1F4BB}', Grep: '\u{1F50D}', Glob: '\u{1F4C2}',
  WebFetch: '\u{1F310}', WebSearch: '\u{1F50E}', Task: '\u{1F3F7}',
  Agent: '\u{1F916}', NotebookEdit: '\u{1F4D3}', LSP: '\u{1F4E1}'
};

// ====== DOM refs ======
const messagesEl = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sessionDisplay = document.getElementById('sessionDisplay');
const projectPicker = document.getElementById('projectPicker');
const sessionList = document.getElementById('sessionList');
const newSessionBtn = document.getElementById('newSessionBtn');
const todoList = document.getElementById('todoList');
const todoInput = document.getElementById('todoInput');
const todoAddBtn = document.getElementById('todoAddBtn');
const statusBar = document.getElementById('statusBar');
const cmdDropdown = document.getElementById('cmdDropdown');
const historyList = document.getElementById('historyList');
const mobileTabBar = document.getElementById('mobileTabBar');
const appEl = document.getElementById('app');

let SLASH_COMMANDS = [];

async function loadCommands() {
  try {
    const resp = await fetch(apiUrl('/api/commands'));
    if (resp.ok) {
      SLASH_COMMANDS = await resp.json();
    }
  } catch {
    console.error('Failed to load slash commands');
  }
}

// Call on init
loadCommands();

// Initialize mermaid (loaded via CDN)
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'antiscript',
    fontFamily: 'inherit'
  });
}

// Parse <command-message> XML tags from user message text
// Returns { name, args } or null if not a command message
function parseCommandMessage(text) {
  const match = text.match(/<command-message>\s*<command-name>([\s\S]*?)<\/command-name>\s*<command-args>([\s\S]*?)<\/command-args>\s*<\/command-message>/);
  if (!match) return null;
  return { name: match[1].trim(), args: match[2].trim() };
}

function getCommandGroup(name) {
  if (name.startsWith('devflow:')) return 'devflow';
  if (name.startsWith('superpowers:')) return 'superpowers';
  return 'default';
}

function renderCommandCard(name, args, group) {
  const card = document.createElement('div');
  card.className = `command-card ${group}`;

  const label = document.createElement('span');
  label.className = 'cmd-label';
  label.textContent = '/' + name;

  const body = document.createElement('span');
  body.className = 'cmd-args';
  body.textContent = args;

  card.appendChild(label);
  card.appendChild(body);
  return card;
}

const GROUP_PRIORITY = { 'devflow': 0, 'superpowers': 1 };

function cmdDropdownVisible() {
  return !cmdDropdown.classList.contains('hidden');
}

function autoResizeTextarea() {
  const style = getComputedStyle(userInput);
  const lineH = parseFloat(style.lineHeight);
  const padTop = parseFloat(style.paddingTop);
  const padBottom = parseFloat(style.paddingBottom);
  const maxH = lineH * 10 + padTop + padBottom;
  userInput.style.height = 'auto';
  const newH = Math.min(userInput.scrollHeight, maxH);
  userInput.style.height = newH + 'px';
  userInput.style.overflowY = userInput.scrollHeight > maxH ? 'auto' : 'hidden';
}

function validSessionId(id) {
  if (!id || id === 'undefined' || id === 'null') return null;
  return id;
}

function formatDuration(ms) {
  if (ms == null) return '';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (hours > 0) parts.push(hours + '小时');
  if (minutes > 0) parts.push(minutes + '分钟');
  if (seconds > 0 || parts.length === 0) parts.push(seconds + '秒');
  return parts.join(' ');
}

// ====== Project picker ======
async function loadProjects() {
  try {
    const res = await fetch(apiUrl('/api/projects'));
    const projects = await res.json();
    projectPicker.innerHTML = '';
    if (projects.length === 0) {
      projectPicker.innerHTML = '<option value="">无项目</option>';
      return;
    }

    // Resolve project: URL path first, fallback to default
    const urlProject = getProjectFromUrl();
    if (urlProject) {
      state.project = urlProject;
    } else if (!state.project && projects.length > 0) {
      state.project = projects[0].name;
    }

    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.path;
      if (p.name === state.project) opt.selected = true;
      projectPicker.appendChild(opt);
    });

    // Now that project is resolved, load session from project-scoped storage
    state.sessionId = validSessionId(localStorage.getItem(projectStorageKey('session')));
    loadTodos();
    renderTodos();
    updateSessionDisplay();
  } catch (e) {
    console.error('Failed to load projects', e);
    projectPicker.innerHTML = '<option value="">加载失败</option>';
  }
}

projectPicker.addEventListener('change', () => {
  const newProject = projectPicker.value;
  if (newProject !== state.project) {
    // Navigate to new project URL — triggers page reload with new path
    window.location.href = '/project/' + encodeURIComponent(newProject) + '/';
  }
});

// ====== Session list sidebar ======
async function loadSessionNames() {
  try {
    const res = await fetch(apiUrl(`/api/sessions/names?project=${encodeURIComponent(state.project)}`));
    state.sessionNames = await res.json();
  } catch (e) {
    console.error('Failed to load session names', e);
  }
}

async function saveSessionName(sessionId, name) {
  try {
    await fetch(apiUrl(`/api/sessions/${sessionId}/name?project=${encodeURIComponent(state.project)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    });
    if (name) {
      state.sessionNames[sessionId] = name;
    } else {
      delete state.sessionNames[sessionId];
    }
  } catch (e) {
    console.error('Failed to save session name', e);
  }
}

async function refreshSessionList() {
  await loadSessionNames();
  try {
    const res = await fetch(apiUrl(`/api/sessions?project=${encodeURIComponent(state.project)}`));
    const sessions = await res.json();
    sessionList.innerHTML = '';

    // Render pending session placeholder at top
    if (state.pendingSession) {
      const pendingDiv = document.createElement('div');
      pendingDiv.className = 'session-item pending' + (state.sessionId ? '' : ' active');
      pendingDiv.dataset.pending = 'true';

      const preview = document.createElement('div');
      preview.className = 'session-item-preview';
      preview.textContent = '新会话';

      pendingDiv.appendChild(preview);
      pendingDiv.addEventListener('click', () => {
        sessionList.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
        pendingDiv.classList.add('active');
        state.sessionId = null;
        localStorage.removeItem(projectStorageKey('session'));
        clearChatUI();
      });
      sessionList.appendChild(pendingDiv);
    }

    if (sessions.length === 0) {
      if (!state.pendingSession) {
        sessionList.innerHTML = '<div style="padding:8px 12px;color:var(--text-muted);font-size:12px;">暂无会话</div>';
      }
      return;
    }

    // Group by time period
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart - 86400000);
    const weekStart = new Date(todayStart - 6 * 86400000);

    const groups = [
      { label: '今天', sessions: [] },
      { label: '昨天', sessions: [] },
      { label: '本周', sessions: [] },
      { label: '更早', sessions: [] }
    ];

    for (const s of sessions) {
      const d = new Date(s.lastModified);
      if (d >= todayStart) groups[0].sessions.push(s);
      else if (d >= yesterdayStart) groups[1].sessions.push(s);
      else if (d >= weekStart) groups[2].sessions.push(s);
      else groups[3].sessions.push(s);
    }

    for (const group of groups) {
      if (group.sessions.length === 0) continue;
      const sep = document.createElement('div');
      sep.className = 'session-time-separator';
      sep.textContent = group.label;
      sessionList.appendChild(sep);

      group.sessions.forEach(s => {
        const div = document.createElement('div');
        div.className = 'session-item';
        div.dataset.sessionId = s.sessionId;
        if (s.sessionId === state.sessionId) div.classList.add('active');

        const displayName = s.customName || state.sessionNames[s.sessionId] || s.preview || '(空)';
        const isCustom = !!(s.customName || state.sessionNames[s.sessionId]);

        const preview = document.createElement('div');
        preview.className = 'session-item-preview';
        preview.textContent = displayName;
        if (isCustom) preview.classList.add('custom-named');

        const idSpan = document.createElement('div');
        idSpan.className = 'session-item-id';
        idSpan.textContent = s.sessionId.substring(0, 8);

        div.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          startRename(div, s.sessionId);
        });

        div.appendChild(preview);
        div.appendChild(idSpan);
        div.addEventListener('click', () => switchSession(s.sessionId));
        sessionList.appendChild(div);
      });
    }
  } catch (e) {
    console.error('Failed to load sessions', e);
    sessionList.innerHTML = '<div style="padding:8px 12px;color:var(--red-text);font-size:12px;">加载失败</div>';
  }
}

function startRename(sessionItem, sessionId) {
  const previewEl = sessionItem.querySelector('.session-item-preview');
  const currentName = state.sessionNames[sessionId] || previewEl.textContent;
  const isCustom = !!state.sessionNames[sessionId];

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-rename-input';
  input.value = isCustom ? currentName : '';
  input.placeholder = currentName;

  const finish = async (save) => {
    const newName = input.value.trim();
    previewEl.textContent = newName || currentName;
    previewEl.style.display = '';
    input.remove();

    if (save && newName !== (isCustom ? currentName : '')) {
      if (newName) {
        previewEl.classList.add('custom-named');
      } else {
        previewEl.classList.remove('custom-named');
      }
      await saveSessionName(sessionId, newName);
      if (sessionId === state.sessionId) updateSessionDisplay();
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));

  previewEl.style.display = 'none';
  sessionItem.insertBefore(input, previewEl.nextSibling);
  input.focus();
  input.select();
}

async function switchSession(sessionId) {
  if (sessionId === state.sessionId) return;
  state.sessionId = sessionId;
  localStorage.setItem(projectStorageKey('session'), sessionId);
  updateSessionDisplay();
  messagesEl.innerHTML = '';
  state.processing = false;
  sendBtn.disabled = false;
  state.sequenceBuffer = [];
  state.tagDetailsEl = {};
  state.currentTagRow = null;
  state._metaWrapper = null;
  state.oldestQuestionIndex = null;
  state.questions = [];
  state.questionsTotal = 0;
  state.questionsHasMore = false;

  sessionList.querySelectorAll('.session-item').forEach(el => {
    el.classList.toggle('active', el.dataset.sessionId === sessionId);
  });

  // Restore per-session status indicator
  const saved = state.sessionStatus[sessionId];
  setStatus(saved || 'idle');

  // Auto-switch to chat tab on mobile
  switchToMobileTab('chat');

  const targetId = sessionId;
  addProcessing();
  loadQuestions(10).then(() => {
    if (state.sessionId !== targetId) { removeProcessing(); return; }
    const fromIndex = state.questions.length >= 2
      ? state.questions[1].index
      : (state.questions.length === 1 ? state.questions[0].index : 0);
    messagesEl.innerHTML = '';
    loadSessionHistory(targetId, fromIndex).then(() => {
      if (state.sessionId !== targetId) return;
      removeProcessing();
      addMessage('system', `已切换到会话 ${targetId.substring(0, 8)}...`);
    });
  });
}

function clearChatUI() {
  messagesEl.innerHTML = '';
  state.processing = false;
  sendBtn.disabled = false;
  state.sequenceBuffer = [];
  state.tagDetailsEl = {};
  state.currentTagRow = null;
  state._metaWrapper = null;
  state.oldestQuestionIndex = null;
  state.questions = [];
  state.questionsTotal = 0;
  state.questionsHasMore = false;
  showEmptyState();
  refreshHistory();
  updateSessionDisplay();
}

newSessionBtn.addEventListener('click', () => {
  if (state.pendingSession) {
    state.sessionId = null;
    localStorage.removeItem(projectStorageKey('session'));
    clearChatUI();
    sessionList.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    const pendingEl = sessionList.querySelector('.session-item.pending');
    if (pendingEl) pendingEl.classList.add('active');
    return;
  }
  state.pendingSession = true;
  state.sessionId = null;
  localStorage.removeItem(projectStorageKey('session'));
  clearChatUI();
  refreshSessionList();
});

async function loadQuestions(limit = 10, before = null) {
  try {
    let url = `/api/sessions/${state.sessionId}/questions?project=${encodeURIComponent(state.project)}&limit=${limit}`;
    if (before != null) url += `&before=${before}`;

    const res = await fetch(apiUrl(url));
    const data = await res.json();
    const questions = data.questions || [];

    if (before != null) {
      state.questions = [...state.questions, ...questions];
    } else {
      state.questions = questions;
    }
    state.questionsTotal = data.total || 0;
    state.questionsHasMore = data.hasMore || false;

    refreshHistory();
  } catch (e) {
    console.error('Failed to load questions', e);
  }
}

let _questionsLoading = false;

async function loadMoreQuestions() {
  if (!state.questionsHasMore || _questionsLoading) return;
  _questionsLoading = true;
  try {
    const oldestQuestion = state.questions[state.questions.length - 1];
    const before = oldestQuestion ? oldestQuestion.index : null;
    await loadQuestions(10, before);
  } finally {
    _questionsLoading = false;
  }
}

function jumpToQuestion(index) {
  const targetId = (state._jumpSerial = (state._jumpSerial || 0) + 1);

  // Step 1: Expand view to include the target if it's older than current range
  const oldest = state.oldestQuestionIndex;
  if (oldest != null && index < oldest) {
    const url = `/api/sessions/${state.sessionId}/messages?project=${encodeURIComponent(state.project)}&fromIndex=${index}&toIndex=${oldest}`;
    fetch(apiUrl(url)).then(res => res.json()).then(data => {
      if (state._jumpSerial !== targetId) return;
      prependMessages(data.messages || data);
      state.oldestQuestionIndex = index;
      // Step 2: Smooth scroll to target
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = messagesEl.querySelector(`.msg.user[data-line-index="${index}"]`);
          if (target) {
            const targetY = target.getBoundingClientRect().top - messagesEl.getBoundingClientRect().top + messagesEl.scrollTop;
            smoothScrollTo(messagesEl, Math.max(0, targetY - 60), 500);
          }
        });
      });
    }).catch(() => {});
  } else {
    // Target already in view — just scroll
    requestAnimationFrame(() => {
      const target = messagesEl.querySelector(`.msg.user[data-line-index="${index}"]`);
      if (target) {
        const targetY = target.getBoundingClientRect().top - messagesEl.getBoundingClientRect().top + messagesEl.scrollTop;
        smoothScrollTo(messagesEl, Math.max(0, targetY - 60), 500);
      }
    });
  }
}

function prependMessages(messages) {
  const prevHeight = messagesEl.scrollHeight;
  const prevTop = messagesEl.scrollTop;
  state._loadingHistory = true;

  const fragment = document.createDocumentFragment();
  for (const msg of messages) {
    if (!msg.blocks) continue;
    if (msg.role === 'user') {
      const hasText = msg.blocks.some(b => b.type === 'text' && b.text);
      if (hasText) {
        for (const block of msg.blocks) {
          if (block.type === 'text' && block.text) {
            const el = makeMessageElement('user', block.text);
            if (msg.lineIndex != null) el.setAttribute('data-line-index', msg.lineIndex);
            fragment.appendChild(el);
            break;
          }
        }
      }
    } else if (msg.role === 'assistant') {
      for (const block of msg.blocks) {
        // Only text blocks for prepended history (no sequence buffer for old content)
        if (block.type === 'text') {
          fragment.appendChild(makeMessageElement('assistant', block.text));
        }
      }
    }
  }

  const firstChild = messagesEl.firstChild;
  messagesEl.insertBefore(fragment, firstChild);

  // Maintain scroll position: offset by the added height
  messagesEl.scrollTop = prevTop + (messagesEl.scrollHeight - prevHeight);
  state._loadingHistory = false;
}

function makeMessageElement(type, text) {
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (type === 'assistant') {
    bubble.innerHTML = renderAssistantHtml(text);
    renderMermaidBlocks(bubble);
  } else {
    const cmd = parseCommandMessage(text);
    if (cmd) {
      bubble.appendChild(renderCommandCard(cmd.name, cmd.args, getCommandGroup(cmd.name)));
    } else {
      bubble.textContent = text;
    }
  }
  div.appendChild(bubble);
  return div;
}

function smoothScrollTo(el, targetY, duration) {
  const startY = el.scrollTop;
  const distance = targetY - startY;
  if (Math.abs(distance) < 4) return;
  const startTime = performance.now();
  const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    el.scrollTop = startY + distance * easeInOutCubic(progress);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function loadSessionHistory(sessionId, fromIndex = null) {
  try {
    let url = `/api/sessions/${sessionId}/messages?project=${encodeURIComponent(state.project)}`;
    if (fromIndex != null) url += `&fromIndex=${fromIndex}`;

    const res = await fetch(apiUrl(url));
    const data = await res.json();
    const messages = data.messages || data;

    state.oldestQuestionIndex = fromIndex;
    state._loadingHistory = true;

    for (const msg of messages) {
      if (!msg.blocks) continue;
      if (msg.role === 'user') {
        const hasText = msg.blocks.some(b => b.type === 'text' && b.text);
        if (hasText) {
          flushSequenceBuffer();
          for (const block of msg.blocks) {
            if (block.type === 'text' && block.text) {
              const el = addMessage('user', block.text);
              if (msg.lineIndex != null) el.setAttribute('data-line-index', msg.lineIndex);
              break;
            }
          }
        }
      } else if (msg.role === 'assistant') {
        for (const block of msg.blocks) {
          switch (block.type) {
            case 'thinking':
              appendSequenceBlock('thinking', block.thinking || '(思考中)');
              break;
            case 'text':
              flushSequenceBuffer();
              addMessage('assistant', block.text);
              break;
            case 'tool_use':
              appendSequenceBlock('tool_use', block);
              break;
          }
        }
      }
    }
    flushSequenceBuffer();
    state._loadingHistory = false;

    if (messages.length > 0) {
      setStatus('done');
    }

    refreshHistory();
  } catch (e) {
    state._loadingHistory = false;
    console.error('Failed to load session history', e);
    addMessage('error', '加载历史消息失败');
  }
}

// ====== WebSocket ======

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  let wsUrl = `${protocol}//${location.host}/ws/chat`;
  if (AUTH_TOKEN) wsUrl += '?token=' + encodeURIComponent(AUTH_TOKEN);
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    const saved = state.sessionId ? state.sessionStatus[state.sessionId] : null;
    setStatus(saved || 'idle');
    updateSessionDisplay();
    if (state.sessionId) loadQuestions();
  };

  state.ws.onmessage = (event) => {
    try {
      handleEvent(JSON.parse(event.data));
    } catch (e) {
      console.error('JSON parse error, raw data:', event.data.substring(0, 200));
      addMessage('error', '消息解析错误');
    }
  };

  state.ws.onclose = () => {
    setTimeout(connect, 2000);
  };

  state.ws.onerror = (err) => {
    console.error('WebSocket error', err);
  };
}

function updateSessionDisplay() {
  if (state.sessionId) {
    const customName = state.sessionNames[state.sessionId];
    if (customName) {
      sessionDisplay.textContent = customName;
      sessionDisplay.title = state.sessionId;
    } else {
      sessionDisplay.textContent = state.sessionId.substring(0, 8) + '...';
      sessionDisplay.title = state.sessionId;
    }
  } else {
    sessionDisplay.textContent = '新会话';
    sessionDisplay.title = '';
  }
}

// ====== Send message ======
function sendMessage() {
  const text = userInput.value.trim();
  if (!text || state.processing) return;

  addMessage('user', text);
  userInput.value = '';
  autoResizeTextarea();
  state.processing = true;
  sendBtn.disabled = true;
  setStatus('processing');
  state.sequenceBuffer = [];
  state.tagDetailsEl = {};
  state.currentTagRow = null;
  state._metaWrapper = null;

  addProcessing();

  const watchdog = setTimeout(() => {
    if (state.processing) {
      flushSequenceBuffer();
      removeProcessing();
      state.processing = false;
      sendBtn.disabled = false;
      setStatus('idle');
      userInput.focus();
      console.warn('Watchdog: auto-recovered button after timeout');
    }
  }, 180000);

  const payload = JSON.stringify({
    text: text,
    sessionId: state.sessionId,
    project: state.project
  });

  if (state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(payload);
  } else {
    addMessage('error', 'WebSocket 未连接，正在重连...');
    connect();
    setTimeout(() => {
      if (state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(payload);
      }
    }, 1500);
  }
}

// ====== Event handler ======
function handleEvent(event) {
  // Drop events belonging to a different session (stale stream after switch)
  if (event._sessionId && state.sessionId && event._sessionId !== state.sessionId) {
    return;
  }

  const type = event.type;

  try {
    switch (type) {
      case 'system':
        if (event.session_id) {
          if (!state.sessionId) {
            if (state.pendingSession) {
              state.pendingSession = false;
            }
            state.sessionId = event.session_id;
            localStorage.setItem(projectStorageKey('session'), event.sessionId);
            updateSessionDisplay();
            refreshSessionList();
            loadQuestions();
          }
        }
        break;

      case 'assistant':
        handleAssistantEvent(event);
        break;

      case 'processing':
        break;

      case 'result':
        flushSequenceBuffer();
        stopProcessing();
        setStatus('done');
        setTimeout(() => { if (!state.processing) setStatus('idle'); }, 1500);
        if (event.subtype === 'success') {
          renderCompletionBar(event.num_turns || 1, event.duration_ms || 0);
        }
        break;

      case 'error':
        flushSequenceBuffer();
        stopProcessing();
        setStatus('error');
        setTimeout(() => { if (!state.processing) setStatus('idle'); }, 2000);
        addMessage('error', event.message || '未知错误');
        break;

      case 'done':
        flushSequenceBuffer();
        stopProcessing();
        setStatus('idle');
        refreshSessionList();
        break;
    }
  } catch (e) {
    console.error('handleEvent error for type:', type, e);
    flushSequenceBuffer();
    stopProcessing();
  }
}

function stopProcessing() {
  removeProcessing();
  state.processing = false;
  sendBtn.disabled = false;
  setStatus('idle');
  userInput.focus();
}

function handleAssistantEvent(event) {
  if (!event.message || !event.message.content) return;

  for (const block of event.message.content) {
    switch (block.type) {
      case 'thinking':
        setStatus('thinking');
        appendSequenceBlock('thinking', block.thinking || '(思考中)');
        break;
      case 'text':
        setStatus('streaming');
        flushSequenceBuffer();
        addMessage('assistant', block.text);
        break;
      case 'tool_use':
        setStatus('tool_run');
        appendSequenceBlock('tool_use', block);
        break;
    }
  }
}

function appendSequenceBlock(type, data) {
  const last = state.sequenceBuffer.length > 0
    ? state.sequenceBuffer[state.sequenceBuffer.length - 1]
    : null;

  if (last && last.type === type) {
    last.blocks.push(data);
    updateLiveTagRow();
  } else {
    state.sequenceBuffer.push({ type: type, blocks: [data] });
    renderLiveTagRow();
  }
}

function renderLiveTagRow() {
  // Remove old wrapper (row + details container) when rebuilding
  if (state._metaWrapper) {
    state._metaWrapper.remove();
    state._metaWrapper = null;
  }
  state.currentTagRow = null;
  state.tagDetailsEl = {};

  // Wrapper keeps the row + detail containers as one flex child in #messages,
  // preventing orphaned nodes and double gap.
  const wrapper = document.createElement('div');
  wrapper.className = 'meta-wrapper';

  const row = document.createElement('div');
  row.className = 'inline-tag-row';
  row.id = 'liveTagRow';

  const detailsContainer = document.createElement('div');
  detailsContainer.className = 'meta-details';

  for (let i = 0; i < state.sequenceBuffer.length; i++) {
    const entry = state.sequenceBuffer[i];
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'tag-separator';
      sep.textContent = '▸';
      row.appendChild(sep);
    }

    const tag = document.createElement('span');
    tag.className = 'inline-tag';
    tag.dataset.tagType = entry.type;
    const tagId = 'liveTag-' + i;

    if (entry.type === 'thinking') {
      tag.innerHTML = '<span class="tag-icon">\u{1F4AD}</span><span class="tag-label">思考过程</span><span class="tag-count">' + entry.blocks.length + '条</span>';
    } else {
      tag.innerHTML = '<span class="tag-icon">\u{1F527}</span><span class="tag-label">工具调用</span><span class="tag-count">' + entry.blocks.length + '次</span>';
    }

    const detail = document.createElement('div');
    detail.className = 'inline-tag-detail';
    detail.id = tagId + '-detail';
    populateDetailItems(detail, entry);

    tag.addEventListener('click', () => {
      tag.classList.toggle('expanded');
      detail.classList.toggle('visible');
    });

    row.appendChild(tag);
    state.tagDetailsEl[tagId] = { tag: tag, detail: detail, entry: entry };
    detailsContainer.appendChild(detail);
  }

  wrapper.appendChild(row);
  wrapper.appendChild(detailsContainer);
  state.currentTagRow = row;
  state._metaWrapper = wrapper;
  insertBeforeProcessing(wrapper);
}

function updateLiveTagRow() {
  if (!state.currentTagRow) {
    renderLiveTagRow();
    return;
  }

  for (let i = 0; i < state.sequenceBuffer.length; i++) {
    const entry = state.sequenceBuffer[i];
    const tagId = 'liveTag-' + i;
    const refs = state.tagDetailsEl[tagId];
    if (!refs) { renderLiveTagRow(); return; }

    const countEl = refs.tag.querySelector('.tag-count');
    if (countEl) {
      countEl.textContent = entry.type === 'thinking'
        ? entry.blocks.length + '条'
        : entry.blocks.length + '次';
    }

    refs.detail.innerHTML = '';
    populateDetailItems(refs.detail, entry);
  }
}

function populateDetailItems(container, entry) {
  entry.blocks.forEach((block, idx) => {
    const item = document.createElement('div');
    item.className = 'tag-detail-item ' + (entry.type === 'thinking' ? 'type-thinking' : 'type-tool');

    const idxSpan = document.createElement('span');
    idxSpan.className = 'detail-index';
    idxSpan.textContent = '#' + (idx + 1);

    const summary = document.createElement('span');
    summary.className = 'detail-summary';

    if (entry.type === 'thinking') {
      summary.textContent = generateThinkingSummary(block);
      const full = document.createElement('div');
      full.className = 'detail-full';
      full.textContent = block;
      item.appendChild(idxSpan);
      item.appendChild(summary);
      item.appendChild(full);
    } else {
      const icon = TOOL_ICONS[block.name] || '\u{1F527}';
      const detail = getToolDetail(block);
      summary.textContent = icon + ' ' + block.name + ' ' + detail;
      item.appendChild(idxSpan);
      item.appendChild(summary);
    }

    item.addEventListener('click', () => {
      item.classList.toggle('expanded');
    });

    container.appendChild(item);
  });
}

function flushSequenceBuffer() {
  if (state.sequenceBuffer.length === 0) return;

  const allTools = [];
  const modifiedFiles = [];
  for (const entry of state.sequenceBuffer) {
    if (entry.type === 'tool_use') {
      for (const tool of entry.blocks) {
        allTools.push(tool);
        if ((tool.name === 'Write' || tool.name === 'Edit') && tool.input && tool.input.file_path) {
          modifiedFiles.push(tool.input.file_path);
        }
      }
    }
  }

  if (state.currentTagRow) {
    state.currentTagRow.removeAttribute('id');
    state.currentTagRow = null;
  }
  if (state._metaWrapper) {
    state._metaWrapper.removeAttribute('id');
    state._metaWrapper = null;
  }
  for (const refs of Object.values(state.tagDetailsEl)) {
    refs.detail.removeAttribute('id');
  }
  state.tagDetailsEl = {};
  state.sequenceBuffer = [];

  if (modifiedFiles.length > 0) {
    for (const file of modifiedFiles) {
      const fcDiv = document.createElement('div');
      fcDiv.className = 'msg assistant';
      fcDiv.style.alignSelf = 'stretch';
      fcDiv.style.maxWidth = '85%';
      fcDiv.innerHTML = '<div class="file-changes"><span class="fc-file">\u{1F4DD} ' + escapeHtml(file.replace(/^.*[\\/]/, '')) + '</span></div>';
      insertBeforeProcessing(fcDiv);
    }
  }
}






function getToolDetail(tool) {
  if (!tool.input) return '';
  const input = tool.input;
  switch (tool.name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      if (input.file_path) {
        const short = input.file_path.replace(/^.*[\\/]/, '');
        return short;
      }
      return '';
    case 'Bash':
      if (input.command) {
        const cmd = input.command.length > 60 ? input.command.substring(0, 60) + '...' : input.command;
        return cmd;
      }
      return '';
    case 'Grep':
      return input.pattern || '';
    case 'Glob':
      return input.pattern || '';
    case 'WebFetch':
      if (input.url) {
        try { return new URL(input.url).hostname; } catch (e) { return input.url.substring(0, 40); }
      }
      return '';
    default:
      return '';
  }
}





// ====== Message rendering ======
function insertBeforeProcessing(el) {
  const proc = document.getElementById('processingIndicator');
  if (proc) {
    messagesEl.insertBefore(el, proc);
  } else {
    messagesEl.appendChild(el);
  }
  if (!state._loadingHistory) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function addMessage(type, text) {
  const empty = messagesEl.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `msg ${type}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const ts = document.createElement('div');
  ts.className = 'msg-ts';
  ts.textContent = formatTimestamp(new Date());
  bubble.appendChild(ts);

  if (type === 'assistant') {
    bubble.insertAdjacentHTML('beforeend', renderAssistantHtml(text));
    renderMermaidBlocks(bubble);
  } else if (type === 'user') {
    const cmd = parseCommandMessage(text);
    if (cmd) {
      bubble.appendChild(renderCommandCard(cmd.name, cmd.args, getCommandGroup(cmd.name)));
    } else {
      bubble.appendChild(document.createTextNode(text));
    }
  } else {
    bubble.appendChild(document.createTextNode(text));
  }
  div.appendChild(bubble);

  if (type === 'user') {
    setTimeout(refreshHistory, 0);
  }

  insertBeforeProcessing(div);
  return div;
}

function addProcessing() {
  const empty = messagesEl.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'processing';
  div.id = 'processingIndicator';
  div.innerHTML = '<span>思考中</span><div class="dots"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function removeProcessing() {
  const el = document.getElementById('processingIndicator');
  if (el) el.remove();
}

function setStatus(status) {
  statusBar.className = 'status-bar status-' + status;
  const textEl = statusBar.querySelector('.status-text');
  switch (status) {
    case 'idle': textEl.textContent = '就绪'; break;
    case 'connecting': textEl.textContent = '连接中...'; break;
    case 'processing': textEl.textContent = '执行中...'; break;
    case 'thinking': textEl.textContent = '思考中...'; break;
    case 'streaming': textEl.textContent = '输出中...'; break;
    case 'tool_run': textEl.textContent = '工具调用中...'; break;
    case 'waiting': textEl.textContent = '等待输入...'; break;
    case 'error': textEl.textContent = '错误'; break;
    case 'done': textEl.textContent = '完成'; break;
  }
  if (state.sessionId) {
    state.sessionStatus[state.sessionId] = status;
  }
}

// ====== Assistant HTML renderer ======
function renderAssistantHtml(text) {
  const segments = parseSegments(text);

  let html = '';
  for (const seg of segments) {
    switch (seg.type) {
      case 'diff':
        html += renderDiffBlock(seg.content);
        break;
      case 'decision':
        html += `<div class="decision-card"><span class="decision-label">决策</span>${simpleMarkdownInline(seg.content)}</div>`;
        break;
      case 'table':
        html += renderTable(seg);
        break;
      case 'code':
        html += renderCodeBlock(seg.lang, seg.content);
        break;
      case 'ulist':
        html += renderList('ul', seg.items);
        break;
      case 'olist':
        html += renderList('ol', seg.items);
        break;
      case 'blockquote':
        html += `<blockquote class="md-blockquote">${simpleMarkdownInline(seg.content)}</blockquote>`;
        break;
      case 'heading':
        html += renderHeading(seg.level, seg.content);
        break;
      default:
        html += simpleMarkdownInline(seg.content);
    }
  }
  return html;
}

function parseSegments(text) {
  // Step 1: Extract fenced code blocks (diff and non-diff)
  const segments = [];
  const fencePattern = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fencePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.substring(lastIndex, match.index);
      segments.push(...splitDecisions(before));
    }
    const lang = match[1] || '';
    const content = match[2];
    if (lang === 'diff') {
      segments.push({ type: 'diff', content: content });
    } else {
      segments.push({ type: 'code', lang: lang, content: content });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(...splitDecisions(text.substring(lastIndex)));
  }

  // Step 2: Within each text segment, detect block-level elements (tables, lists, etc.)
  return segments.flatMap(seg => {
    if (seg.type !== 'text') return [seg];
    return parseContentBlocks(seg.content);
  });
}

// splitDecisions, parseContentBlocks, findNextNonEmpty, parseTable — moved to js/parser-utils.js

function renderTable(seg) {
  let html = '<div class="md-table-wrap"><table class="md-table">';
  html += '<thead><tr>';
  for (const h of seg.header) {
    html += `<th>${simpleMarkdownInline(h)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of seg.rows) {
    html += '<tr>';
    for (let i = 0; i < seg.header.length; i++) {
      html += `<td>${simpleMarkdownInline(row[i] || '')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function renderCodeBlock(lang, code) {
  if (lang === 'mermaid') {
    const id = 'mmd-' + Math.random().toString(36).substring(2, 8);
    return `<div class="mermaid-block" id="${id}"><div class="code-header"><span class="code-lang">mermaid</span></div><div class="mermaid-placeholder" data-id="${id}">${escapeHtml(code)}</div></div>`;
  }
  const id = 'code-' + Math.random().toString(36).substring(2, 8);
  const lines = code.split('\n');
  const lineCount = lines.length;
  const isLong = lineCount > 20;
  const langLabel = lang || 'text';

  let html = `<div class="code-block${isLong ? ' code-collapsed' : ''}" id="${id}">`;
  html += `<div class="code-header">`;
  html += `<span class="code-lang">${escapeHtml(langLabel)}</span>`;
  html += `<span class="code-actions">`;
  html += `<button class="code-copy-btn" onclick="window.copyCode('${id}')" title="复制">📋</button>`;
  html += `</span>`;
  html += `</div>`;
  html += `<pre class="code-body"><code>${escapeHtml(code)}</code></pre>`;
  if (isLong) {
    html += `<div class="code-expand" onclick="document.getElementById('${id}').classList.toggle('code-collapsed')">展开全部 (${lineCount} 行) ▼</div>`;
  }
  html += '</div>';
  return html;
}

async function renderMermaidBlocks(container) {
  if (typeof mermaid === 'undefined') return;
  const placeholders = container.querySelectorAll('.mermaid-placeholder');
  for (const ph of placeholders) {
    const blockId = ph.dataset.id;
    const code = ph.textContent;
    try {
      const { svg } = await mermaid.render('mmd-svg-' + blockId, code);
      const wrapper = document.getElementById(blockId);
      if (wrapper) {
        wrapper.classList.add('mermaid-rendered');
        wrapper.innerHTML = '<div class="mermaid-svg">' + svg + '</div>';
      }
    } catch (e) {
      const wrapper = document.getElementById(blockId);
      if (wrapper) {
        wrapper.innerHTML = '<div class="code-header"><span class="code-lang">mermaid</span><span style="color:#e53e3e;font-size:11px">渲染失败</span></div><pre class="code-body"><code>' + escapeHtml(code) + '</code></pre>';
        wrapper.classList.add('code-block');
      }
    }
  }
}

// Expose copyCode globally for inline onclick handler
window.copyCode = function(blockId) {
  const block = document.getElementById(blockId);
  if (!block) return;
  const code = block.querySelector('code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(() => {
    const btn = block.querySelector('.code-copy-btn');
    if (btn) {
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = '📋'; }, 1500);
    }
  }).catch(() => {});
};

function renderList(tag, items) {
  let html = `<${tag} class="md-list">`;
  for (const item of items) {
    html += `<li>${simpleMarkdownInline(item)}</li>`;
  }
  html += `</${tag}>`;
  return html;
}

function renderHeading(level, content) {
  const tag = 'h' + Math.min(level + 1, 6);
  return `<${tag} class="md-heading">${simpleMarkdownInline(content)}</${tag}>`;
}

function renderDiffBlock(diffText) {
  const id = 'diff-' + Math.random().toString(36).substring(2, 8);
  const lines = diffText.split('\n');
  let added = 0, removed = 0;
  const highlighted = lines.map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) { added++; return `<span class="diff-add">${escapeHtml(line)}</span>`; }
    if (line.startsWith('-') && !line.startsWith('---')) { removed++; return `<span class="diff-del">${escapeHtml(line)}</span>`; }
    if (line.startsWith('@@')) return `<span class="diff-hdr">${escapeHtml(line)}</span>`;
    return escapeHtml(line);
  }).join('\n');

  // Find file name from the diff header
  let fileName = '';
  const fileMatch = diffText.match(/^\+\+\+ [ab]\/(.+)$/m) || diffText.match(/^--- [ab]\/(.+)$/m);
  if (fileMatch) fileName = fileMatch[1];

  return `<div class="diff-block" id="${id}">
    <div class="diff-header" onclick="document.getElementById('${id}').classList.toggle('expanded')">
      <span class="arrow">▶</span>
      <span>${escapeHtml(fileName || 'diff')}</span>
      <span style="color:var(--green-text);margin-left:8px;">+${added}</span>
      <span style="color:var(--red-text);">-${removed}</span>
    </div>
    <div class="diff-body">${highlighted}</div>
  </div>`;
}

// ====== Parsing/utility functions (moved to js/parser-utils.js) ======
// splitDecisions, parseContentBlocks, findNextNonEmpty, parseTable,
// simpleMarkdownInline, generateThinkingSummary, escapeHtml
// are now defined in parser-utils.js (loaded before this script)

// Simple inline markdown (no block-level parsing) — moved to parser-utils.js

function renderCompletionBar(numTurns, durationMs) {
  const bar = document.createElement('div');
  bar.className = 'msg assistant completion-bar';
  bar.style.alignSelf = 'stretch';
  bar.style.maxWidth = '100%';
  bar.innerHTML =
    '<span class="comp-icon">✅</span>' +
    '<span>本轮完成</span>' +
    '<span class="comp-divider"></span>' +
    '<span class="comp-stat">' + numTurns + '轮对话</span>' +
    '<span class="comp-sep">·</span>' +
    '<span class="comp-stat">' + formatDuration(durationMs) + '</span>';
  insertBeforeProcessing(bar);
}

// ====== Slash command autocomplete ======
function selectCommand(cmd) {
  const before = userInput.value.substring(0, userInput.selectionStart);
  const after = userInput.value.substring(userInput.selectionStart);
  const newBefore = before.replace(/\/\S*$/, cmd + ' ');
  userInput.value = newBefore + after;
  const newCursor = newBefore.length;
  userInput.selectionStart = newCursor;
  userInput.selectionEnd = newCursor;
  cmdDropdown.classList.add('hidden');
  userInput.focus();
}

function getSelectedIndex() {
  const items = cmdDropdown.querySelectorAll('.cmd-item');
  for (let i = 0; i < items.length; i++) {
    if (items[i].classList.contains('selected')) return i;
  }
  return -1;
}

function moveSelection(delta) {
  const items = cmdDropdown.querySelectorAll('.cmd-item');
  if (items.length === 0) return;
  const idx = getSelectedIndex();
  items.forEach(it => it.classList.remove('selected'));
  const newIdx = ((idx + delta) % items.length + items.length) % items.length;
  items[newIdx].classList.add('selected');
  items[newIdx].scrollIntoView({ block: 'nearest' });
}

userInput.addEventListener('input', () => {
  autoResizeTextarea();
  const text = userInput.value;
  const cursorPos = userInput.selectionStart;
  const beforeCursor = text.substring(0, cursorPos);
  const slashMatch = beforeCursor.match(/\/(\S*)$/);

  if (!slashMatch) {
    cmdDropdown.classList.add('hidden');
    return;
  }

  const query = slashMatch[1].toLowerCase();
  let matches = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().includes(query));
  matches.sort((a, b) => (GROUP_PRIORITY[a.group] ?? 99) - (GROUP_PRIORITY[b.group] ?? 99));

  if (matches.length === 0) {
    cmdDropdown.classList.add('hidden');
    return;
  }

  cmdDropdown.innerHTML = '';
  matches.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'cmd-item' + (i === 0 ? ' selected' : '');
    item.innerHTML = `<span class="cmd-name">${c.cmd}</span><span class="cmd-desc">${c.desc}</span>`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectCommand(c.cmd);
    });
    cmdDropdown.appendChild(item);
  });
  cmdDropdown.classList.remove('hidden');
});

userInput.addEventListener('blur', () => {
  setTimeout(() => cmdDropdown.classList.add('hidden'), 150);
});

// ====== Event listeners ======
userInput.addEventListener('keydown', (e) => {
  if (cmdDropdownVisible()) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); return; }
    if (e.key === 'Escape') { e.preventDefault(); cmdDropdown.classList.add('hidden'); return; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      const items = cmdDropdown.querySelectorAll('.cmd-item');
      const idx = getSelectedIndex();
      if (idx >= 0 && items[idx]) {
        e.preventDefault();
        const cmd = items[idx].querySelector('.cmd-name').textContent;
        selectCommand(cmd);
        return;
      }
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// ====== Global keyboard handlers ======
document.addEventListener('keydown', (e) => {
  // Prevent Alt from triggering browser menu bar (steals focus from input)
  if (e.key === 'Alt') {
    e.preventDefault();
  }

  // Enter focuses the chat input when focus is elsewhere
  if (e.key === 'Enter' && !e.shiftKey) {
    const active = document.activeElement;
    if (active !== userInput && active !== sendBtn) {
      const tag = active.tagName;
      const isOtherTextInput = (tag === 'INPUT' && active.type === 'text') ||
                               tag === 'TEXTAREA' ||
                               active.isContentEditable;
      if (!isOtherTextInput) {
        e.preventDefault();
        userInput.focus();
      }
    }
  }
});

// ====== Empty state ======
function showEmptyState() {
  messagesEl.innerHTML = `
    <div class="empty-state">
      <span class="icon">&#x1F4AC;</span>
      <p>输入消息开始对话</p>
      <p style="font-size:12px;opacity:0.6;">Enter 发送 · Shift+Enter 换行</p>
    </div>
  `;
}

// ====== Todo panel ======
function loadTodos() {
  try {
    state.todos = JSON.parse(localStorage.getItem(projectStorageKey('todos')) || '[]');
  } catch (e) { state.todos = []; }
}
function saveTodos() {
  localStorage.setItem(projectStorageKey('todos'), JSON.stringify(state.todos));
}
function renderTodos() {
  todoList.innerHTML = '';
  const active = state.todos.filter(t => !t.done);
  const done = state.todos.filter(t => t.done);
  const sorted = [...active, ...done];

  if (sorted.length === 0) {
    todoList.innerHTML = '<div class="todo-empty">暂无待办事项<br>在下方输入框中添加</div>';
    return;
  }

  sorted.forEach(t => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (t.done ? ' done' : '');
    item.dataset.todoId = t.id;

    const cb = document.createElement('div');
    cb.className = 'todo-checkbox' + (t.done ? ' checked' : '');
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTodo(t.id);
    });

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = t.text;
    text.title = '点击切换完成状态';
    text.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTodo(t.id);
    });

    const del = document.createElement('button');
    del.className = 'btn-todo-delete';
    del.textContent = '×';
    del.title = '删除';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteTodo(t.id); });

    item.appendChild(cb);
    item.appendChild(text);
    item.appendChild(del);
    todoList.appendChild(item);
  });
}

function addTodo(text) {
  text = text.trim();
  if (!text) return;
  state.todos.unshift({ id: Date.now(), text, done: false });
  saveTodos();
  renderTodos();
}

function toggleTodo(id) {
  const t = state.todos.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  saveTodos();

  // Incremental DOM update — do NOT rebuild entire list (fixes checkbox closing bug)
  const item = todoList.querySelector(`[data-todo-id="${id}"]`);
  if (!item) { renderTodos(); return; }
  const cb = item.querySelector('.todo-checkbox');
  if (t.done) {
    item.classList.add('done');
    cb.classList.add('checked');
  } else {
    item.classList.remove('done');
    cb.classList.remove('checked');
  }
  // Re-sort: move done items to bottom
  const activeItems = todoList.querySelectorAll('.todo-item:not(.done)');
  const doneItems = todoList.querySelectorAll('.todo-item.done');
  if (t.done && activeItems.length === 0 && doneItems.length > 0) {
    // Item was last active, move it to end
    todoList.appendChild(item);
  } else if (!t.done && activeItems.length === 1 && doneItems.length > 0) {
    // Item became first active, move before first done item
    const firstDone = doneItems[0];
    if (firstDone !== item) todoList.insertBefore(item, firstDone);
  }
}

function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  saveTodos();
  const item = todoList.querySelector(`[data-todo-id="${id}"]`);
  if (item) item.remove();
  if (todoList.querySelectorAll('.todo-item').length === 0) {
    todoList.innerHTML = '<div class="todo-empty">暂无待办事项<br>在下方输入框中添加</div>';
  }
}

todoAddBtn.addEventListener('click', () => {
  addTodo(todoInput.value);
  todoInput.value = '';
  todoInput.focus();
});
todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTodo(todoInput.value);
    todoInput.value = '';
  }
});

// ====== Question history ======
function refreshHistory() {
  historyList.innerHTML = '';

  if (state.questions.length === 0) {
    historyList.innerHTML = '<div class="history-empty">暂无提问记录</div>';
    return;
  }

  state.questions.forEach((q) => {
    const truncated = q.preview.length > 20 ? q.preview.substring(0, 20) + '...' : q.preview;
    const item = document.createElement('div');
    item.className = 'history-item';
    item.title = q.preview;
    item.textContent = truncated;

    item.addEventListener('click', () => {
      historyList.querySelectorAll('.history-item').forEach(el => el.classList.remove('history-active'));
      item.classList.add('history-active');
      jumpToQuestion(q.index);
    });

    if (q.index === state.oldestQuestionIndex) {
      item.classList.add('history-active');
    }

    historyList.appendChild(item);
  });

  if (state.questionsHasMore) {
    const moreBtn = document.createElement('div');
    moreBtn.className = 'history-load-more';
    moreBtn.textContent = `加载更多提问 (已加载 ${state.questions.length} / ${state.questionsTotal})`;
    moreBtn.addEventListener('click', loadMoreQuestions);
    historyList.appendChild(moreBtn);
  }
}

// ====== Mobile Tab Bar ======
if (mobileTabBar) {
  mobileTabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    switchToMobileTab(tab);
  });
}

function switchToMobileTab(tab) {
  if (mobileTabBar) {
    mobileTabBar.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
  }
  appEl.classList.remove('mobile-tab-history', 'mobile-tab-todos');
  if (tab === 'history') {
    appEl.classList.add('mobile-tab-history');
    refreshSessionList();
  } else if (tab === 'todos') {
    appEl.classList.add('mobile-tab-todos');
  }
  // 'chat' tab = default (no extra class)
}

// ====== Keyboard adaptation for mobile ======
if (window.visualViewport) {
  const vv = window.visualViewport;
  const adjustInputForKeyboard = () => {
    const keyboardHeight = window.innerHeight - vv.height;
    if (keyboardHeight > 100) {
      document.body.style.setProperty('--keyboard-height', keyboardHeight + 'px');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      document.body.style.setProperty('--keyboard-height', '0px');
    }
  };
  vv.addEventListener('resize', adjustInputForKeyboard);
  vv.addEventListener('scroll', adjustInputForKeyboard);
}

// ====== QR Code Generator (pure Canvas API, zero dependencies) ======
function generateQRCode(text, canvas) {
  // QR version 6, byte mode, L-level error correction (ECL)
  // Max data capacity for version 6 byte mode L: 106 bytes
  const V = 6;
  const SIZE = 21 + (V - 1) * 4; // 41 modules

  // --- GF(256) arithmetic ---
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      EXP[i + 255] = x;
      LOG[x] = i;
      x = (x << 1) ^ ((x & 0x80) ? 0x11d : 0);
    }
    LOG[1] = 0;
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function gfPolyMul(p1, p2) {
    const out = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        out[i + j] ^= gfMul(p1[i], p2[j]);
      }
    }
    return out;
  }

  function rsGeneratorPoly(nsym) {
    let g = new Uint8Array([1]);
    for (let i = 0; i < nsym; i++) {
      g = gfPolyMul(g, new Uint8Array([1, EXP[i]]));
    }
    return g;
  }

  function rsEncode(data, nsym) {
    const gen = rsGeneratorPoly(nsym);
    const res = new Uint8Array(data.length + nsym);
    res.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    res.set(data);
    return res;
  }

  // --- Data encoding ---
  const dataBytes = new TextEncoder().encode(text);
  if (dataBytes.length > 106) {
    canvas.getContext('2d').fillText('URL too long', 10, 20);
    return;
  }
  const charCount = dataBytes.length;

  // Byte mode encoding: mode indicator (0100) + count (8 bits) + data bytes
  const dataBits = [];
  dataBits.push(0, 1, 0, 0); // 0100 = byte mode
  for (let i = 7; i >= 0; i--) dataBits.push((charCount >> i) & 1);
  for (const b of dataBytes) {
    for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1);
  }

  // Terminator (up to 4 zeros)
  const totalCodewords = 172; // Version 6 total codewords (L)
  const ecCodewords = 18;     // Version 6 EC codewords (L)
  const dataCodewords = totalCodewords - ecCodewords; // 154
  const requiredBits = dataCodewords * 8;
  const termBits = Math.min(4, requiredBits - dataBits.length);
  for (let i = 0; i < termBits; i++) dataBits.push(0);

  // Pad to byte
  while (dataBits.length % 8 !== 0) dataBits.push(0);

  // Pad bytes (0xEC, 0x11 alternating)
  const padBytes = [0xEC, 0x11];
  let pi = 0;
  while (dataBits.length < requiredBits) {
    const b = padBytes[pi % 2];
    for (let i = 7; i >= 0; i--) dataBits.push((b >> i) & 1);
    pi++;
  }

  // Convert bits to bytes
  const msgPoly = new Uint8Array(dataCodewords);
  for (let i = 0; i < dataCodewords; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | dataBits[i * 8 + j];
    msgPoly[i] = v;
  }

  // RS encode
  const full = rsEncode(msgPoly, ecCodewords);

  // --- Matrix construction ---
  const matrix = new Uint8Array(SIZE * SIZE);
  matrix.fill(0xff); // 0xff = unknown (will be set to 0 or 1)

  // Finder patterns
  function placeFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const v = (r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))) ? 1 : 0;
        matrix[rr * SIZE + cc] = v;
      }
    }
  }
  placeFinder(0, 0);
  placeFinder(0, SIZE - 7);
  placeFinder(SIZE - 7, 0);

  // Timing patterns
  for (let i = 8; i < SIZE - 8; i++) {
    matrix[6 * SIZE + i] = i % 2 === 0 ? 1 : 0;
    matrix[i * SIZE + 6] = i % 2 === 0 ? 1 : 0;
  }

  // Dark module
  matrix[(SIZE - 8) * SIZE + 8] = 1;

  // Alignment pattern for version 6 (center at 6, 34)
  const alignCenters = [6, 34];
  for (const ar of alignCenters) {
    for (const ac of alignCenters) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === 34 && false) ||
          !(ar === 6 && ac === 34) && !(ar === 34 && ac === 6)) {
        // Place all except those overlapping finders
        let overlaps = false;
        // Check overlap with finder at top-left
        if (ar - 2 < 8 && ac - 2 < 8) overlaps = true;
        // Check overlap with finder at top-right
        if (ar - 2 < 8 && ac + 2 >= SIZE - 8) overlaps = true;
        // Check overlap with finder at bottom-left
        if (ar + 2 >= SIZE - 8 && ac - 2 < 8) overlaps = true;
        if (!overlaps) {
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              const rr = ar + r, cc = ac + c;
              if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
              const v = (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) ? 1 : 0;
              matrix[rr * SIZE + cc] = v;
            }
          }
        }
      }
    }
  }

  // Format info and version info will be placed after mask selection
  // Place data modules
  const dataModuleBits = [];
  for (let i = 0; i < full.length; i++) {
    for (let j = 7; j >= 0; j--) dataModuleBits.push((full[i] >> j) & 1);
  }

  // Module placement order (zigzag upward/downward alternating)
  let bitIdx = 0;
  let upward = true;
  for (let col = SIZE - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing pattern column
    const rows = upward
      ? Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i)
      : Array.from({ length: SIZE }, (_, i) => i);
    for (const row of rows) {
      for (let c = col; c >= col - 1 && c >= 0; c--) {
        if (c >= SIZE) continue;
        if (matrix[row * SIZE + c] === 0xff) {
          matrix[row * SIZE + c] = bitIdx < dataModuleBits.length ? dataModuleBits[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }

  // Reserve format info areas
  function reserveFormatAreas() {
    for (let i = 0; i <= 8; i++) {
      if (matrix[i * SIZE + 8] === 0xff) matrix[i * SIZE + 8] = 0;
      if (i < 9 && matrix[8 * SIZE + i] === 0xff) matrix[8 * SIZE + i] = 0;
    }
    for (let i = 0; i <= 7; i++) {
      if (matrix[(SIZE - 1 - i) * SIZE + 8] === 0xff) matrix[(SIZE - 1 - i) * SIZE + 8] = 0;
      if (i < 8 && matrix[8 * SIZE + (SIZE - 1 - i)] === 0xff) matrix[8 * SIZE + (SIZE - 1 - i)] = 0;
    }
  }
  reserveFormatAreas();

  // --- Mask pattern evaluation ---
  const formatInfo = 0x5412; // ECL=L, mask=2
  // We'll just use mask 2 which works well
  const maskPattern = 2;

  // Apply mask
  function maskFn(r, c) {
    switch (maskPattern) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
    return false;
  }

  // Apply mask to data modules (skip function patterns)
  const reserved = new Set();
  // Mark finders, timing, etc. as reserved
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      // Simple heuristic: any non-0xff value was placed by function patterns
      // But we changed 0xff to 0 for data, so check original finder areas
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= SIZE - 8) || (r >= SIZE - 8 && c <= 8)) reserved.add(r * SIZE + c);
      if (r === 6 || c === 6) reserved.add(r * SIZE + c);
    }
  }

  // Re-fill data modules (they were set to 0 by reserveFormatAreas)
  // Actually, let me simplify: just re-do the data placement with mask applied
  bitIdx = 0;
  for (let col = SIZE - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5;
    for (let row = SIZE - 1; row >= 0; row--) {
      for (let c = col; c >= col - 1; c--) {
        if (c < 0 || c >= SIZE) continue;
        if (matrix[row * SIZE + c] === 0xff) {
          if (bitIdx < dataModuleBits.length) {
            let bit = dataModuleBits[bitIdx++];
            if (maskFn(row, c)) bit ^= 1;
            matrix[row * SIZE + c] = bit;
          } else {
            matrix[row * SIZE + c] = maskFn(row, c) ? 1 : 0;
          }
        }
      }
    }
  }

  // Place format info bits
  function placeFormatInfo(info) {
    const bits = [];
    for (let i = 14; i >= 0; i--) bits.push((info >> i) & 1);
    // Top-left
    let bi = 0;
    for (let i = 0; i <= 5; i++) { matrix[i * SIZE + 8] = bits[bi++]; }
    matrix[7 * SIZE + 8] = bits[bi++];
    matrix[8 * SIZE + 8] = bits[bi++];
    matrix[8 * SIZE + 7] = bits[bi++];
    for (let i = 5; i >= 0; i--) { matrix[8 * SIZE + i] = bits[bi++]; }
    // Top-right + bottom-left
    bi = 0;
    for (let i = SIZE - 1; i >= SIZE - 7; i--) { matrix[8 * SIZE + i] = bits[bi++]; }
    for (let i = 0; i <= 7; i++) { matrix[(SIZE - 1 - i) * SIZE + 8] = bits[bi++]; }
  }
  placeFormatInfo(formatInfo);

  // --- Draw to canvas ---
  const moduleSize = Math.floor(Math.min(canvas.width, canvas.height) / (SIZE + 8));
  const offsetX = Math.floor((canvas.width - SIZE * moduleSize) / 2);
  const offsetY = Math.floor((canvas.height - SIZE * moduleSize) / 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e293b';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (matrix[r * SIZE + c]) {
        ctx.fillRect(offsetX + c * moduleSize, offsetY + r * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

function renderQRCode() {
  // Only show on desktop
  if (window.innerWidth < 769) return;

  let qrContainer = document.getElementById('qrCodeContainer');
  if (!qrContainer) {
    qrContainer = document.createElement('div');
    qrContainer.id = 'qrCodeContainer';
    qrContainer.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:50;background:white;padding:10px;border:1px solid var(--border, #e2e8f0);box-shadow:0 2px 8px rgba(0,0,0,0.1);cursor:pointer;';
    qrContainer.title = '手机扫码访问';
    document.body.appendChild(qrContainer);
  }

  const lanUrl = window.location.origin + window.location.pathname;
  const size = 150;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  generateQRCode(lanUrl, canvas);

  const label = document.createElement('div');
  label.textContent = '📱 扫码访问';
  label.style.cssText = 'text-align:center;font-size:11px;color:#64748b;margin-top:4px;';

  qrContainer.innerHTML = '';
  qrContainer.appendChild(canvas);
  qrContainer.appendChild(label);
}

// ====== Init ======
showEmptyState();
loadProjects().then(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const targetSession = urlParams.get('session');
  if (targetSession && validSessionId(targetSession)) {
    state.sessionId = targetSession;
    localStorage.setItem(projectStorageKey('session'), targetSession);
  }
  refreshSessionList();

  if (state.sessionId) {
    updateSessionDisplay();
    addProcessing();
    loadQuestions(10).then(() => {
      const fromIndex = state.questions.length >= 2
        ? state.questions[1].index
        : (state.questions.length === 1 ? state.questions[0].index : 0);
      messagesEl.innerHTML = '';
      loadSessionHistory(state.sessionId, fromIndex).then(() => {
        removeProcessing();
      });
    });
  }
});
connect();

// Render QR code on desktop; re-render on resize
renderQRCode();
window.addEventListener('resize', () => {
  const qr = document.getElementById('qrCodeContainer');
  if (window.innerWidth < 769 && qr) {
    qr.style.display = 'none';
  } else if (window.innerWidth >= 769) {
    if (qr) qr.style.display = '';
    renderQRCode();
  }
});
