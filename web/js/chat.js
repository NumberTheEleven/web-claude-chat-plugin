// ====== URL-based project routing ======
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
  _metaWrapper: null
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

const SLASH_COMMANDS = [
  { cmd: '/superpowers:brainstorming', desc: '头脑风暴，将想法转化为设计文档' },
  { cmd: '/superpowers:writing-plans', desc: '编写详细实施计划' },
  { cmd: '/superpowers:subagent-driven-development', desc: '子代理驱动开发执行计划' },
  { cmd: '/superpowers:executing-plans', desc: '批量执行开发计划' },
  { cmd: '/superpowers:finishing-a-development-branch', desc: '完成开发分支收尾' },
  { cmd: '/superpowers:requesting-code-review', desc: '请求代码审查' },
  { cmd: '/superpowers:test-driven-development', desc: '测试驱动开发' },
  { cmd: '/superpowers:using-git-worktrees', desc: '使用 Git Worktree 隔离工作区' },
  { cmd: '/superpowers:using-superpowers', desc: 'Superpowers 使用指南' },
];

function cmdDropdownVisible() {
  return !cmdDropdown.classList.contains('hidden');
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
    const res = await fetch('/api/projects');
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
    const res = await fetch(`/api/sessions/names?project=${encodeURIComponent(state.project)}`);
    state.sessionNames = await res.json();
  } catch (e) {
    console.error('Failed to load session names', e);
  }
}

async function saveSessionName(sessionId, name) {
  try {
    await fetch(`/api/sessions/${sessionId}/name?project=${encodeURIComponent(state.project)}`, {
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
    const res = await fetch(`/api/sessions?project=${encodeURIComponent(state.project)}`);
    const sessions = await res.json();
    sessionList.innerHTML = '';
    if (sessions.length === 0) {
      sessionList.innerHTML = '<div style="padding:8px 12px;color:var(--text-muted);font-size:12px;">暂无会话</div>';
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

newSessionBtn.addEventListener('click', () => {
  state.sessionId = null;
  localStorage.removeItem(projectStorageKey('session'));
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
  showEmptyState();
  refreshHistory();
  sessionList.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
});

async function loadQuestions(limit = 10, before = null) {
  try {
    let url = `/api/sessions/${state.sessionId}/questions?project=${encodeURIComponent(state.project)}&limit=${limit}`;
    if (before != null) url += `&before=${before}`;

    const res = await fetch(url);
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
    fetch(url).then(res => res.json()).then(data => {
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
  } else {
    bubble.textContent = text;
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

    const res = await fetch(url);
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
  const wsUrl = `${protocol}//${location.host}/ws/chat`;
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log('WebSocket connected');
    const saved = state.sessionId ? state.sessionStatus[state.sessionId] : null;
    setStatus(saved || 'idle');
    updateSessionDisplay();
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
    console.log('WebSocket disconnected, reconnecting in 2s...');
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
  console.log('CC event:', type, event.subtype || '');

  try {
    switch (type) {
      case 'system':
        if (event.session_id) {
          if (!state.sessionId) {
            state.sessionId = event.session_id;
            localStorage.setItem(projectStorageKey('session'), event.sessionId);
            updateSessionDisplay();
            refreshSessionList();
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

function addMessage(type, text) {
  const empty = messagesEl.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `msg ${type}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (type === 'assistant') {
    bubble.innerHTML = renderAssistantHtml(text);
  } else {
    bubble.textContent = text;
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

function splitDecisions(text) {
  // Detect decision paragraphs: lines starting with decision indicators
  const decisionPatterns = [
    /^(I'll|I will|Let me|Let's)\s/,
    /^(The best|The right|The correct)\s/,
    /^(I recommend|I suggest|I propose)\s/,
    /^(The plan is|The approach is|We'll use)\s/,
    /^(I've decided|My decision|We should)\s/,
  ];

  const segments = [];
  const lines = text.split('\n');
  let currentText = '';
  let currentDecision = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if this line starts a decision
    let isDecision = false;
    for (const pat of decisionPatterns) {
      if (pat.test(line.trim())) {
        isDecision = true;
        break;
      }
    }

    if (isDecision && currentDecision === '') {
      // Start of a decision paragraph
      if (currentText) {
        segments.push({ type: 'text', content: currentText });
        currentText = '';
      }
      currentDecision = line;
    } else if (isDecision && currentDecision) {
      currentDecision += '\n' + line;
    } else if (!isDecision && currentDecision) {
      // Continue decision paragraph if it's not an empty line
      if (line.trim() === '') {
        segments.push({ type: 'decision', content: currentDecision });
        currentDecision = '';
        currentText += '\n' + line;
      } else if (currentDecision.split('\n').length <= 3) {
        currentDecision += '\n' + line;
      } else {
        segments.push({ type: 'decision', content: currentDecision });
        currentDecision = '';
        currentText += line + '\n';
      }
    } else {
      currentText += (currentText ? '\n' : '') + line;
    }
  }

  if (currentDecision) {
    segments.push({ type: 'decision', content: currentDecision });
  }
  if (currentText) {
    segments.push({ type: 'text', content: currentText });
  }

  return segments;
}

function parseContentBlocks(text) {
  const segments = [];
  const lines = text.split('\n');
  let i = 0;
  let buf = [];

  const flushText = () => {
    if (buf.length > 0) {
      segments.push({ type: 'text', content: buf.join('\n') });
      buf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Table: starts with | and next non-empty line is |---|---|
    if (/^\|.*\|$/.test(line.trim())) {
      const nextNonEmpty = findNextNonEmpty(lines, i + 1);
      if (nextNonEmpty !== -1 && /^\|[\s\-:|]+\|$/.test(lines[nextNonEmpty].trim())) {
        flushText();
        const tableLines = [line];
        i++;
        while (i < lines.length) {
          if (i === nextNonEmpty) {
            tableLines.push(lines[i]);
          } else if (/^\|.*\|$/.test(lines[i].trim())) {
            tableLines.push(lines[i]);
          } else if (lines[i].trim() === '') {
            break;
          }
          i++;
        }
        segments.push(...parseTable(tableLines));
        continue;
      }
    }

    // Unordered list: - or * followed by space
    if (/^[\-\*]\s/.test(line)) {
      flushText();
      const items = [];
      while (i < lines.length && /^[\-\*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*]\s+/, ''));
        i++;
      }
      segments.push({ type: 'ulist', items: items });
      continue;
    }

    // Ordered list: number followed by dot and space
    if (/^\d+\.\s/.test(line)) {
      flushText();
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      segments.push({ type: 'olist', items: items });
      continue;
    }

    // Blockquote: >
    if (line.startsWith('>')) {
      flushText();
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      segments.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // Heading: ## or ###
    const headingMatch = line.match(/^(#{2,4})\s+(.+)/);
    if (headingMatch) {
      flushText();
      segments.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    buf.push(line);
    i++;
  }

  flushText();
  return segments;
}

function findNextNonEmpty(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() !== '') return i;
  }
  return -1;
}

function parseTable(lines) {
  if (lines.length < 2) return [{ type: 'text', content: lines.join('\n') }];

  const parseRow = (row) => {
    return row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  };

  const header = parseRow(lines[0]);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    if (/^\|.*\|$/.test(lines[i].trim())) {
      rows.push(parseRow(lines[i]));
    } else {
      const remaining = lines.slice(i).join('\n');
      return [{ type: 'table', header: header, rows: rows }, { type: 'text', content: remaining }];
    }
  }
  return [{ type: 'table', header: header, rows: rows }];
}

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

// Simple inline markdown (no block-level parsing)
function simpleMarkdownInline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--accent-light);padding:1px 5px;border-radius:3px;font-size:13px;">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

function generateThinkingSummary(text) {
  if (!text) return '(思考中)';
  // Take first meaningful sentence, max ~80 chars
  const cleaned = text.replace(/^[\s\n]+/, '');
  const firstLine = cleaned.split('\n')[0];
  if (firstLine.length <= 80) return firstLine || '(思考中)';
  // Truncate at last complete word under 80 chars
  const truncated = firstLine.substring(0, 80);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
  const text = userInput.value;
  const cursorPos = userInput.selectionStart;
  const beforeCursor = text.substring(0, cursorPos);
  const slashMatch = beforeCursor.match(/\/(\S*)$/);

  if (!slashMatch) {
    cmdDropdown.classList.add('hidden');
    return;
  }

  const query = slashMatch[1].toLowerCase();
  const matches = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().includes(query));

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
