# Requirements Checklist

> Generated: 2026-06-01
> Source: /devflow:clarify → /devflow:breakdown

## R-014: 命令消息 XML 解析

**Priority:** P0
**Status:** done
**Description:** 在 `addMessage('user', text)` 中检测 `<command-message>` XML 标签，用正则解析出 `<command-name>` 和 `<command-args>` 内容，剥离原始标签。
**Depends On:** none
**Acceptance Criteria:**
- [x] 能正确解析 `<command-message><command-name>xxx</command-name><command-args>yyy</command-args></command-message>` 格式
- [x] 无命令标签的普通用户消息不受影响，仍走原有 `textContent` 路径
- [x] 解析失败时（格式异常）降级为显示原始文本

---

## R-015: 命令卡片 DOM 渲染

**Priority:** P0
**Status:** done
**Description:** 将解析出的命令名和参数渲染为卡片式 DOM 元素（`.command-card`），替代原有的 `bubble.textContent = text` 纯文本渲染。
**Depends On:** R-014
**Acceptance Criteria:**
- [x] 命令消息显示为独立卡片，包含命令名和参数内容
- [x] 卡片内不展示任何 XML 标签（`<command-message>` 等）
- [x] 卡片作为 `.msg.user .msg-bubble` 的子元素正常显示

---

## R-016: 命令卡片样式（分组着色）

**Priority:** P1
**Status:** done
**Description:** 为命令卡片编写 CSS 样式，按命令组（devflow / superpowers / 其他）分配不同颜色/图标，与现有 decision-card 风格统一。
**Depends On:** R-015
**Acceptance Criteria:**
- [x] devflow 组命令有统一的视觉标识（颜色/图标）
- [x] superpowers 组命令有统一但不同于 devflow 的视觉标识
- [x] 未识别分组的命令使用默认样式
- [x] 卡片圆角、阴影、字体与现有 UI 风格一致

---

## R-017: Mermaid.js CDN 引入

**Priority:** P0
**Status:** done
**Description:** 在 `index.html` 中通过 `<script>` 标签引入 mermaid.js CDN，并初始化 mermaid 配置（主题、安全级别等）。
**Depends On:** none
**Acceptance Criteria:**
- [x] 页面加载后 `window.mermaid` 可用
- [x] mermaid 主题配置为 light/neutral 以匹配当前 UI 浅色风格
- [x] securityLevel 设为 'antiscript'（安全模式）

---

## R-018: Mermaid 图表渲染集成

**Priority:** P0
**Status:** done
**Description:** 在 `renderCodeBlock(lang, code)` 中增加 `lang === 'mermaid'` 分支，调用 `mermaid.render()` 将代码渲染为 SVG 并嵌入页面。
**Depends On:** R-017
**Acceptance Criteria:**
- [x] ` ```mermaid ` 代码块不再显示为代码文本，而是渲染为 SVG 流程图
- [x] 渲染失败的 mermaid 代码降级显示为原始代码块（带错误提示）
- [x] 多个 mermaid 块在同一消息中各自独立渲染，互不干扰
- [x] 异步渲染完成后图表自动插入正确位置

---

## R-019: CSS 移动端基础断点与布局切换

**Priority:** P0
**Status:** done
**Description:** 添加 `@media (max-width: 768px)` 断点，移动端三栏 → 单栏垂直堆叠，侧边栏和工具面板默认隐藏。
**Depends On:** none
**Acceptance Criteria:**
- [x] `@media (max-width: 768px)` 断点生效，移动端三栏变单栏
- [x] 主聊天区 (#mainArea) 在移动端占满全宽
- [x] 侧边栏 (#sidebar) 和工具面板 (#toolPanel) 在移动端默认隐藏
- [x] 无横向滚动条，内容不溢出

---

## R-020: 底部 Tab 导航栏

**Priority:** P0
**Status:** done
**Description:** 移动端底部固定 Tab 栏，包含聊天/历史/待办三 Tab，图标 + 激活态指示，控制面板切换。
**Depends On:** R-019
**Acceptance Criteria:**
- [x] 移动端底部出现固定 Tab 栏，包含 聊天 / 历史 / 待办 三项
- [x] 当前激活 Tab 有视觉高亮指示
- [x] 点击 Tab 正确切换 #mainArea / #sidebar / #toolPanel 的可见性
- [x] Tab 栏不遮挡输入框

---

## R-021: 移动端侧边栏（历史会话）

**Priority:** P0
**Status:** done
**Description:** 点击历史 Tab 时侧边栏全宽展示，会话列表可滚动，选会话后自动切回聊天 Tab。
**Depends On:** R-019, R-020
**Acceptance Criteria:**
- [x] 切换到历史 Tab 时，侧边栏全宽显示
- [x] 会话列表可滑动，最近会话和更早会话分组正常折叠
- [x] 选择会话后自动切回聊天 Tab

---

## R-022: 移动端工具面板（待办）

**Priority:** P0
**Status:** done
**Description:** 点击待办 Tab 时工具面板全宽展示，待办列表和复选框交互正常。
**Depends On:** R-019, R-020
**Acceptance Criteria:**
- [x] 切换到待办 Tab 时，工具面板全宽显示
- [x] 待办列表、复选框交互正常

---

## R-023: 移动端输入区域固定底部 + 键盘适配

**Priority:** P0
**Status:** done
**Description:** 输入栏固定在视口底部，safe-area-inset 处理，发送按钮触摸友好尺寸，键盘弹出适配。
**Depends On:** R-019
**Acceptance Criteria:**
- [x] 输入栏固定在视口底部，不受页面滚动影响
- [x] iOS Safari safe-area-inset-bottom 正确留白
- [x] 发送按钮最小触摸尺寸 44x44px
- [x] 软键盘弹出时输入栏能保持在键盘上方

---

---

## R-026: 局域网访问 URL 输出

**Priority:** P0
**Status:** done
**Description:** Server 绑定 0.0.0.0，启动后输出局域网 IP URL，手机同 WiFi 可访问。
**Depends On:** none
**Acceptance Criteria:**
- [x] Server 绑定 `0.0.0.0` 而非 `127.0.0.1`
- [x] 启动日志输出局域网 IP URL（如 `http://192.168.x.x:5xxxx/project/...`）
- [x] 手机同 WiFi 下可通过该 URL 访问

---

## R-027: 触摸交互适配

**Priority:** P1
**Status:** done
**Description:** 斜杠命令下拉触摸选择、代码块展开折叠触摸友好、长按复制、滚动区 momentum 滚动。
**Depends On:** R-019
**Acceptance Criteria:**
- [x] 斜杠命令下拉菜单选项可手指点击选择
- [x] 代码块展开/折叠按钮触摸区域足够大（≥44px）
- [x] 代码块支持长按复制
- [x] 消息列表、侧边栏等滚动区有 momentum 滚动效果

---

## R-029: 桌面端 QR 码扫码访问

**Priority:** P0
**Status:** done
**Description:** 桌面端页面展示 QR 码，包含局域网访问 URL，手机扫码直接打开聊天页面，无需手动输入网址。
**Depends On:** R-026
**Acceptance Criteria:**
- [x] 桌面端页面上显示 QR 码（如页面顶部或侧边栏底部）
- [x] QR 码内容为当前页面的局域网 URL
- [x] 手机扫码后可直接打开聊天页面
- [x] 桌面端隐藏侧边栏时 QR 码仍可访问（或放在主区域）

---

## R-028: 桌面端零退化验证

**Priority:** P0
**Status:** done
**Description:** 所有改动不影响桌面 Chrome/Firefox 布局和功能，底部 Tab 栏桌面端不显示。
**Depends On:** R-019, R-020, R-021, R-022, R-023, R-026, R-027, R-029
**Acceptance Criteria:**
- [x] 桌面 Chrome ≥1280px 宽度：三栏布局、所有功能与改造前一致
- [x] 桌面 Firefox：同上
- [x] 底部 Tab 栏在桌面端不显示

---

---

## R-030: Token 认证加固

**Priority:** P0
**Status:** done
**Description:** Server 启动时生成随机 Token，嵌入 LAN URL。所有 HTTP 请求和 WebSocket 连接必须携带有效 Token，不匹配返回 403。
**Depends On:** R-026
**Acceptance Criteria:**
- [x] Server 启动时生成 randomUUID() 作为 AUTH_TOKEN
- [x] LAN URL 输出格式：`http://192.168.x.x:5xxxx/?token=xxx`
- [x] 所有请求（HTTP + WebSocket）Token 不匹配时返回 403
- [x] 前端自动从 URL searchParams 读取 token 并附加到所有 API/WebSocket 请求
- [x] QR 码内 URL 自动包含 token（读取 `window.location.search`）
- [x] 桌面端零退化：现有测试全部通过（18 server + 10 parser）

---

*Tracked by DevFlow. Do not edit manually.*
