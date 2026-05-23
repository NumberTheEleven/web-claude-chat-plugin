# UI 重设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面重设计 claude-chat 浏览器端 UI：三栏布局、同类折叠标签、完成条带、蓝绿渐变方角设计语言。

**Architecture:** 在现有 HTML/CSS/JS 上增量修改。HTML 新增 `#toolPanel` 右面板，CSS 全局替换设计变量和圆角为方角+装饰条，JS 引入 `sequenceBuffer` 机制实现同类块折叠标签渲染和问题历史导航。

**Tech Stack:** Vanilla HTML/CSS/JS, Node.js backend (unchanged)

---

## File Changes Summary

| File | Nature of change |
|------|------------------|
| `web/index.html` | `#todoSticky` 从 `#mainArea` 移至新 `#toolPanel` |
| `web/css/chat.css` | 全局变量、方角、装饰条、面板、标签、完成条带、历史 |
| `web/js/chat.js` | 序列缓冲→折叠标签、完成条带、历史导航、高亮闪烁 |

---

### Task 1: HTML — 三栏布局 + 右工具面板

**Files:**
- Modify: `web/index.html:33-65`

- [ ] **Step 1: 重构 HTML 结构**

将 `#todoSticky` 从 `#mainArea` 移出，改为 `#toolPanel` 右面板，放在 `#mainArea` 之后、`</div><!-- #app -->` 之前。

```html
  <!-- Main -->
  <div id="mainArea">
    <!-- Header -->
    <header id="header">
      <span class="session-id" id="sessionDisplay">新会话</span>
    </header>

    <!-- Messages -->
    <main id="messages"></main>

    <!-- Status Bar -->
    <div id="statusBar" class="status-bar status-idle">
      <span class="status-dot"></span>
      <span class="status-text">就绪</span>
    </div>

    <!-- Input -->
    <footer id="inputArea">
      <div id="cmdDropdown" class="cmd-dropdown hidden"></div>
      <textarea id="userInput" rows="2" placeholder="输入消息... (Enter 发送, Shift+Enter 换行)" autofocus></textarea>
      <button id="sendBtn" title="发送 (Enter)">发送</button>
    </footer>
  </div>

  <!-- Right Tool Panel -->
  <aside id="toolPanel">
    <div class="panel-section">
      <div class="panel-section-title">待办事项</div>
      <div class="todo-items" id="todoList"></div>
      <div class="todo-add-row">
        <input type="text" id="todoInput" class="todo-input" placeholder="添加待办..." autocomplete="off">
        <button id="todoAddBtn" class="btn-todo-add">+</button>
      </div>
    </div>
    <div class="panel-section panel-section-history">
      <div class="panel-section-title">提问历史</div>
      <div class="history-list" id="historyList">
        <div class="history-empty">暂无提问记录</div>
      </div>
    </div>
  </aside>

</div>
```

完整文件变为：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Chat</title>
<link rel="stylesheet" href="/css/chat.css">
</head>
<body>
<div id="app">
  <!-- Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <span class="logo">Claude Chat</span>
    </div>

    <div class="sidebar-section">
      <label class="sidebar-label">项目目录</label>
      <select id="projectPicker" title="选择项目目录">
        <option value="">加载中...</option>
      </select>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label-row">
        <span class="sidebar-label">会话列表</span>
        <button id="newSessionBtn" class="btn-new-session" title="新建会话">+</button>
      </div>
      <div id="sessionList" class="session-list"></div>
    </div>
  </aside>

  <!-- Main -->
  <div id="mainArea">
    <header id="header">
      <span class="session-id" id="sessionDisplay">新会话</span>
    </header>
    <main id="messages"></main>
    <div id="statusBar" class="status-bar status-idle">
      <span class="status-dot"></span>
      <span class="status-text">就绪</span>
    </div>
    <footer id="inputArea">
      <div id="cmdDropdown" class="cmd-dropdown hidden"></div>
      <textarea id="userInput" rows="2" placeholder="输入消息... (Enter 发送, Shift+Enter 换行)" autofocus></textarea>
      <button id="sendBtn" title="发送 (Enter)">发送</button>
    </footer>
  </div>

  <!-- Right Tool Panel -->
  <aside id="toolPanel">
    <div class="panel-section">
      <div class="panel-section-title">待办事项</div>
      <div class="todo-items" id="todoList"></div>
      <div class="todo-add-row">
        <input type="text" id="todoInput" class="todo-input" placeholder="添加待办..." autocomplete="off">
        <button id="todoAddBtn" class="btn-todo-add">+</button>
      </div>
    </div>
    <div class="panel-section panel-section-history">
      <div class="panel-section-title">提问历史</div>
      <div class="history-list" id="historyList">
        <div class="history-empty">暂无提问记录</div>
      </div>
    </div>
  </aside>

</div>

<script src="/js/chat.js"></script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add web/index.html
git commit -m "refactor: restructure HTML to three-column layout with right tool panel"
```

---

### Task 2: CSS — 全局设计变量 + 方角语言

**Files:**
- Modify: `web/css/chat.css:1-21`

- [ ] **Step 1: 替换 CSS 变量**

```css
:root {
  --bg: #0d1117;
  --card-bg: #0a0e14;
  --text: #c9d1d9;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --border: #21262d;
  --accent: #2563eb;
  --accent-green: #05b6a2;
  --accent-light: rgba(37,99,235,0.08);
  --accent-text: #58a6ff;
  --gradient: linear-gradient(135deg, #2563eb 0%, #05b6a2 100%);
  --green-bg: rgba(5,182,162,0.08);
  --green-text: #05b6a2;
  --amber-bg: rgba(210,153,34,0.08);
  --amber-border: #d29922;
  --amber-text: #d29922;
  --red-bg: rgba(248,81,73,0.08);
  --red-text: #f85149;
  --radius: 0px;
  --radius-sm: 0px;
  --shadow: none;
  --sidebar-w: 280px;
  --toolpanel-w: 220px;
}
```

- [ ] **Step 2: 全局方角覆盖 + 装饰条基础类**

在 `* { margin: 0; ... }` 之后添加：

```css
/* ====== Global square-corner overrides ====== */
input, textarea, select, button,
.msg-bubble, .session-item, .tool-group,
.diff-block, .decision-card, .file-changes,
.code-block, .md-table-wrap, .cmd-dropdown,
.cmd-item, .todo-item, .todo-checkbox,
.todo-input, .btn-todo-add, .btn-new-session,
.session-rename-input {
  border-radius: 0 !important;
}

/* Decoration bar: thin vertical bar on the left edge */
.bar-left {
  border-left: 3px solid var(--accent);
}
.bar-left-green {
  border-left: 3px solid var(--accent-green);
}
```

- [ ] **Step 3: 提交**

```bash
git add web/css/chat.css
git commit -m "style: apply global dark theme, gradient accent, square corners"
```

---

### Task 3: CSS — 右工具面板样式

**Files:**
- Modify: `web/css/chat.css` (append)

- [ ] **Step 1: 添加面板样式**

在文件末尾追加：

```css
/* ====== Right Tool Panel ====== */
#toolPanel {
  width: var(--toolpanel-w);
  min-width: var(--toolpanel-w);
  background: var(--card-bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

.panel-section {
  padding: 10px 10px 6px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.panel-section-history {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.panel-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
```

- [ ] **Step 2: 移除旧 sticky note CSS**

删除 `.sticky-note` 及 `#mainArea { position: relative; }` 相关样式。同时将 `#messages { padding-right: 290px; }` 改为 `padding-right: 20px;` 或直接删除 `padding-right`。

- [ ] **Step 3: 调整 todo 为面板内嵌样式**

修改 `.todo-items` 样式以适应面板：

```css
/* Override for panel-embedded todo */
.todo-items {
  padding: 0;
  gap: 2px;
  max-height: 260px;
  overflow-y: auto;
}

.todo-add-row {
  padding: 6px 0 0;
  border-top: none;
  background: transparent;
}

.todo-input {
  background: var(--bg);
  color: var(--text);
}
```

- [ ] **Step 4: 提交**

```bash
git add web/css/chat.css
git commit -m "style: add right tool panel styles, remove sticky note CSS"
```

---

### Task 4: CSS — 内联标签行 (inline tag row) + 完成条带 + 历史列表 + 高亮闪烁

**Files:**
- Modify: `web/css/chat.css` (append)

- [ ] **Step 1: 添加全部新样式**

在文件末尾追加：

```css
/* ====== Inline Tag Row ====== */
.inline-tag-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px 0;
  margin: 2px 0;
}

.inline-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s;
}
.inline-tag:hover { border-color: var(--accent); }
.inline-tag.expanded { border-color: var(--accent); }

.inline-tag .tag-icon { font-size: 12px; }
.inline-tag .tag-label { color: var(--text-muted); }
.inline-tag .tag-count {
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: var(--gradient);
}

.tag-separator {
  color: var(--border);
  font-size: 10px;
  flex-shrink: 0;
}

/* Tag expanded detail list */
.inline-tag-detail {
  width: 100%;
  margin: 4px 0 4px 12px;
  padding: 6px 10px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  display: none;
}
.inline-tag-detail.visible { display: block; }

.tag-detail-item {
  padding: 4px 0;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.tag-detail-item:last-child { border-bottom: none; }
.tag-detail-item:hover { color: var(--text-secondary); }

.tag-detail-item .detail-index {
  font-size: 10px;
  color: var(--text-muted);
  margin-right: 6px;
}
.tag-detail-item .detail-summary {
  color: var(--text-secondary);
  font-size: 11px;
}
.tag-detail-item .detail-full {
  display: none;
  margin-top: 4px;
  padding: 6px 8px;
  background: var(--bg);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}
.tag-detail-item.expanded .detail-full { display: block; }
.tag-detail-item.expanded .detail-summary { display: none; }

/* Detail bar colors */
.tag-detail-item.type-thinking { border-left: 3px solid var(--accent); padding-left: 8px; }
.tag-detail-item.type-tool { border-left: 3px solid var(--accent-green); padding-left: 8px; }

/* ====== Completion Bar ====== */
.completion-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
  padding: 8px 14px;
  background: linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(5,182,162,0.1) 100%);
  border: 1px solid rgba(37,99,235,0.2);
  font-size: 12px;
  color: var(--text-secondary);
}
.completion-bar .comp-icon { font-size: 14px; }
.completion-bar .comp-divider { flex: 1; height: 1px; background: rgba(37,99,235,0.2); }
.completion-bar .comp-stat { white-space: nowrap; }
.completion-bar .comp-sep { color: var(--text-muted); margin: 0 4px; }

/* ====== History List ====== */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.history-empty {
  padding: 12px 8px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}
.history-item {
  padding: 5px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 1.5;
  max-height: 3em;
  overflow: hidden;
  position: relative;
}
.history-item:not(.history-empty):hover {
  background: var(--accent-light);
  color: var(--accent-text);
}

/* ====== Highlight Flash ====== */
@keyframes highlightFlash {
  0%, 25% { background: rgba(37,99,235,0.18); }
  100% { background: transparent; }
}
.msg.user.highlight-flash {
  animation: highlightFlash 2s ease-out;
}
```

- [ ] **Step 2: 提交**

```bash
git add web/css/chat.css
git commit -m "style: add inline tag row, completion bar, history list, highlight flash CSS"
```

---

### Task 5: JS — DOM 引用 + 帮助函数

**Files:**
- Modify: `web/js/chat.js` (near top, DOM refs section)

- [ ] **Step 1: 添加新 DOM 引用和帮助函数**

在 `const cmdDropdown = ...` 之后添加：

```javascript
const historyList = document.getElementById('historyList');
```

在 `validSessionId` 之后添加时间格式化函数：

```javascript
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
```

- [ ] **Step 2: 提交**

```bash
git add web/js/chat.js
git commit -m "feat: add historyList DOM ref and formatDuration helper"
```

---

### Task 6: JS — 序列缓冲重构 + 内联标签渲染

**Files:**
- Modify: `web/js/chat.js` (state object, handleAssistantEvent, flush functions)

这是核心改动。将现有的 `thinkingBuffer`/`stageBuffer` 双缓冲替换为统一的 `sequenceBuffer`，在 flush 时把连续的同类块渲染为折叠标签。

- [ ] **Step 1: 修改 state 对象**

将：
```javascript
  stageBuffer: [],
  liveGroupEl: null,
  liveBodyEl: null,
  thinkingBuffer: [],
  thinkingGroupEl: null,
```

替换为：
```javascript
  sequenceBuffer: [],     // [{type:'thinking', blocks:[text,...]}, {type:'tool_use', blocks:[tool,...]}]
  tagDetailsEl: {},       // tagId -> detail DOM element (for live updates)
  currentTagRow: null,    // DOM ref for current inline tag row
```

- [ ] **Step 2: 重写 handleAssistantEvent**

```javascript
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
```

- [ ] **Step 3: 实现 appendSequenceBlock**

```javascript
function appendSequenceBlock(type, data) {
  const last = state.sequenceBuffer.length > 0
    ? state.sequenceBuffer[state.sequenceBuffer.length - 1]
    : null;

  if (last && last.type === type) {
    last.blocks.push(data);
    // Update live tag count
    updateLiveTagRow();
  } else {
    state.sequenceBuffer.push({ type: type, blocks: [data] });
    renderLiveTagRow();
  }
}
```

- [ ] **Step 4: 实现 renderLiveTagRow 和 updateLiveTagRow**

```javascript
function renderLiveTagRow() {
  // Remove existing live row if present
  if (state.currentTagRow) {
    state.currentTagRow.remove();
    state.currentTagRow = null;
    state.tagDetailsEl = {};
  }

  const row = document.createElement('div');
  row.className = 'inline-tag-row';
  row.id = 'liveTagRow';

  state.tagDetailsEl = {};
  const detailsContainer = document.createElement('div');
  detailsContainer.style.width = '100%';

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
    const tagId = 'liveTag-' + i;

    if (entry.type === 'thinking') {
      tag.innerHTML = `<span class="tag-icon">\u{1F4AD}</span><span class="tag-label">思考过程</span><span class="tag-count">${entry.blocks.length}条</span>`;
    } else {
      tag.innerHTML = `<span class="tag-icon">\u{1F527}</span><span class="tag-label">工具调用</span><span class="tag-count">${entry.blocks.length}次</span>`;
    }

    // Detail section
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

  state.currentTagRow = row;
  insertBeforeProcessing(row);
  insertBeforeProcessing(detailsContainer);
}

function updateLiveTagRow() {
  if (!state.currentTagRow) {
    renderLiveTagRow();
    return;
  }

  // Update tag counts and detail content
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

    // Refresh detail items
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
```

- [ ] **Step 5: 实现 flushSequenceBuffer（含文件变更提取）**

```javascript
function flushSequenceBuffer() {
  if (state.sequenceBuffer.length === 0) return;

  // Collect all tool_use blocks for file changes
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

  // Remove live IDs so tags become static (persist in DOM)
  if (state.currentTagRow) {
    state.currentTagRow.removeAttribute('id');
    state.currentTagRow = null;
  }
  for (const [tagId, refs] of Object.entries(state.tagDetailsEl)) {
    refs.detail.removeAttribute('id');
  }
  state.tagDetailsEl = {};
  state.sequenceBuffer = [];

  // Render file changes as separate lines after the tag row
  if (modifiedFiles.length > 0) {
    for (const file of modifiedFiles) {
      const fcDiv = document.createElement('div');
      fcDiv.className = 'msg assistant';
      fcDiv.style.alignSelf = 'stretch';
      fcDiv.style.maxWidth = '85%';
      fcDiv.innerHTML = `<div class="file-changes"><span class="fc-file">\u{1F4DD} ${escapeHtml(file.replace(/^.*[\\/]/, ''))}</span></div>`;
      insertBeforeProcessing(fcDiv);
    }
  }
}
```

- [ ] **Step 6: 同步更新所有引用旧 buffer 的代码**

在以下位置将旧的 `state.thinkingBuffer`/`state.stageBuffer`/`state.thinkingGroupEl`/`state.liveGroupEl`/`state.liveBodyEl` 替换为新的 `state.sequenceBuffer`/`state.currentTagRow`/`state.tagDetailsEl`：

1. `switchSession()` — 重置 state
2. `newSessionBtn` click handler — 重置 state
3. `sendMessage()` — 重置 state
4. `loadSessionHistory()` — history mode: 构建 sequenceBuffer 并调用 flush

#### loadSessionHistory 重写：

```javascript
async function loadSessionHistory(sessionId) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages?project=${encodeURIComponent(state.project)}`);
    const messages = await res.json();
    for (const msg of messages) {
      if (!msg.blocks) continue;
      if (msg.role === 'user') {
        flushSequenceBuffer();
        for (const block of msg.blocks) {
          if (block.type === 'text' && block.text) {
            addMessage('user', block.text);
            break;
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
  } catch (e) {
    console.error('Failed to load session history', e);
    addMessage('error', '加载历史消息失败');
  }
}
```

- [ ] **Step 7: 提交**

```bash
git add web/js/chat.js
git commit -m "refactor: replace dual buffer with unified sequenceBuffer for inline tag rendering"
```

---

### Task 7: JS — 完成条带渲染

**Files:**
- Modify: `web/js/chat.js` (handleEvent result case)

- [ ] **Step 1: 修改 result 事件处理**

将 `handleEvent` 中 `case 'result':` 块中的：
```javascript
addMessage('result', `完成 · ${event.num_turns || 1} 轮 · ${event.duration_ms || 0}ms`);
```

替换为：
```javascript
if (event.subtype === 'success') {
  renderCompletionBar(event.num_turns || 1, event.duration_ms || 0);
}
```

同时删除旧的 `.msg.result` 相关 addMessage 对 type='result' 的使用。

- [ ] **Step 2: 实现 renderCompletionBar**

```javascript
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
```

- [ ] **Step 3: 提交**

```bash
git add web/js/chat.js
git commit -m "feat: render completion bar with formatted duration instead of result message"
```

---

### Task 8: JS — 提问历史 + 滚动高亮

**Files:**
- Modify: `web/js/chat.js` (new function + hook into message rendering)

- [ ] **Step 1: 实现 refreshHistory**

```javascript
function refreshHistory() {
  historyList.innerHTML = '';
  const userMsgs = messagesEl.querySelectorAll('.msg.user');
  if (userMsgs.length === 0) {
    historyList.innerHTML = '<div class="history-empty">暂无提问记录</div>';
    return;
  }
  userMsgs.forEach((msgEl, idx) => {
    const text = msgEl.textContent.trim();
    const truncated = text.length > 20 ? text.substring(0, 20) + '...' : text;
    const item = document.createElement('div');
    item.className = 'history-item';
    item.title = text;
    item.textContent = truncated;

    item.addEventListener('click', () => {
      // Smooth scroll to target message
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      msgEl.classList.remove('highlight-flash');
      void msgEl.offsetWidth; // reflow
      msgEl.classList.add('highlight-flash');
      setTimeout(() => msgEl.classList.remove('highlight-flash'), 2000);
    });

    historyList.appendChild(item);
  });
}
```

- [ ] **Step 2: 在消息添加/历史加载后调用 refreshHistory**

- 在 `addMessage('user', ...)` 调用之后添加 `refreshHistory();`
- 在 `loadSessionHistory` 完成后（所有消息渲染完）添加 `refreshHistory();`
- 在 `switchSession` 加载完历史后添加 `refreshHistory();`
- 在 `newSessionBtn` 清空消息后添加 `refreshHistory();`

具体来说，在 `addMessage` 函数中 `insertBeforeProcessing(div)` 之前添加：

```javascript
if (type === 'user') {
  // Schedule refresh after DOM update
  setTimeout(refreshHistory, 0);
}
```

- [ ] **Step 3: 提交**

```bash
git add web/js/chat.js
git commit -m "feat: add question history list with scroll-to and highlight flash"
```

---

### Task 9: JS — 清理旧代码 + 统一改造

**Files:**
- Modify: `web/js/chat.js`

- [ ] **Step 1: 删除旧的 thinking group / tool group 渲染函数**

删除以下不再需要的函数：
- `createLiveThinkingGroup`
- `updateLiveThinkingGroup`
- `flushThinkingGroup`
- `renderThinkingGroup`
- `createLiveToolGroup`
- `appendLiveTool`
- `finalizeLiveGroup`
- `flushToolGroup`

- [ ] **Step 2: 同步更新 switchSession 和 sendMessage**

确保这些函数中的 state 重置使用新的 `sequenceBuffer`/`currentTagRow`/`tagDetailsEl`：

```javascript
// In switchSession, newSessionBtn, sendMessage:
state.sequenceBuffer = [];
state.tagDetailsEl = {};
state.currentTagRow = null;
```

- [ ] **Step 3: 更新 addMessage 的 type='thinking' 分支**

删除 `addMessage` 中的 `else if (type === 'thinking')` 分支（因为 thinking 现在通过 sequenceBuffer 渲染）。

- [ ] **Step 4: 提交**

```bash
git add web/js/chat.js
git commit -m "refactor: remove old thinking/tool group functions, clean up addMessage"
```

---

### Task 10: 构建验证 + 浏览器冒烟测试

- [ ] **Step 1: 重启服务器**

```bash
taskkill /F /IM node.exe 2>$null
Start-Sleep 1
cd D:\codingProjects\web-claude-chat-plugin\server
Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "server.mjs"
Start-Sleep 3
$port = Get-Content "$env:USERPROFILE\.claude\tmp\claude-chat.port"
Start-Process "http://localhost:$port/"
```

- [ ] **Step 2: 验证清单**
  1. 页面打开，三栏布局正常（左侧栏 + 聊天区 + 右侧面板）
  2. 右侧面板有待办事项和提问历史两个区块
  3. 添加待办事项正常，勾选/删除正常
  4. 发送消息后，思考和工具调用显示为内联折叠标签
  5. 点击标签可展开详文
  6. 完成后出现完成条带（显示轮数和时间）
  7. 提问历史列表随用户消息更新
  8. 点击历史项滚动到对应位置并闪烁高亮
  9. 斜杠命令补全正常
  10. 切换会话正常，历史加载正常

- [ ] **Step 3: 提交（如有修正）**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```

---

### Task 11: 最终验证 + 推送到远程

- [ ] **Step 1: 使用 Playwright 做快速截图验证**

- [ ] **Step 2: 推送到 GitHub**

```bash
git push origin master
```
