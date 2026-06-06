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

---

## R-031: 移动端"历史"Tab 改为提问历史列表

**Priority:** P0
**Status:** done
**Description:** 将移动端"📋 历史"tab 从显示 `#sidebar`（会话列表）改为显示 `#toolPanel` 内的 `#historyList`（提问历史），点击条目切回聊天 tab 加载对应消息。
**Depends On:** none
**Acceptance Criteria:**
- [x] 移动端点击"📋 历史"tab 显示提问历史列表（非会话列表）
- [x] 历史条目显示内容与 PC 端 `#historyList` 一致
- [x] 点击历史条目后自动切回聊天 tab 并加载对应消息
- [x] 无历史记录时显示"暂无提问记录"占位文本

---

## R-032: 修复移动端底部 Tab Bar 定位异常

**Priority:** P0
**Status:** done
**Description:** 底部 `#mobileTabBar` 切换 tab 时始终固定在屏幕底部，不跳到顶部。排查并修复导致位置变化的根因。
**Depends On:** none
**Acceptance Criteria:**
- [x] 聊天/历史/待办三个 tab 切换时，tab bar 始终固定在视口底部
- [x] PC 端（≥769px）tab bar 仍隐藏不受影响
- [x] 键盘弹出/收起场景下 tab bar 行为正常

---

---

## R-033: 会话列表预览 XML 标签清洗

**Priority:** P0
**Status:** pending
**Description:** 侧边栏会话列表的预览文本和提问历史列表中，泄露了 `<command-message>`、`<local-command-caveat>`、`<command-name>` 等原始 XML 标签，需在服务端生成 preview 时剥离这些标签。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 会话列表（`/api/sessions`）返回的 preview 文本不含任何 XML 标签
- [ ] 提问历史（`/api/sessions/{id}/questions`）返回的 preview 文本不含任何 XML 标签
- [ ] `parseSessionFile()` 截取 preview 前先剥离 `<command-message>...<command-name>...<command-args>...` 结构
- [ ] `handleQuestions()` 的噪音过滤逻辑中增加 XML 标签清洗
- [ ] PC 端侧边栏 + H5 端历史 Tab 预览文本均干净可读
- [ ] 现有 18 server 测试 + 10 parser 测试全部通过

---

## R-034: 历史消息 command-message 渲染为命令卡片

**Priority:** P0
**Status:** pending
**Description:** 从服务端加载的历史聊天消息中，`<command-message>` 格式的用户消息当前以纯文本显示原始 XML，需确保所有 user 消息渲染路径都经过 `parseCommandMessage()` → `renderCommandCard()` 流程。
**Depends On:** R-014, R-015
**Acceptance Criteria:**
- [ ] `loadSessionHistory()` 加载的历史 user 消息中，含 `<command-message>` 的正确渲染为 `.command-card`
- [ ] `prependMessages()` 加载的更早历史消息同样走卡片渲染路径
- [ ] 实时发送的消息（已有功能）不受影响
- [ ] 解析失败的异常格式仍降级为纯文本显示
- [ ] PC 端 + H5 端历史消息区域均验证通过

---

## R-035: H5 待办 Tab 面板溢出修复

**Priority:** P0
**Status:** pending
**Description:** 移动端点击"✅ 待办"Tab 后，`#toolPanel` 内的非目标 section（提问历史）未隐藏，导致待办区和历史区同时显示。需补齐 CSS 规则使待办 Tab 只显示待办区域。
**Depends On:** R-020, R-022
**Acceptance Criteria:**
- [ ] H5 点击"✅ 待办"Tab 时，只显示"待办事项"section，不显示"提问历史"
- [ ] H5 点击"📋 历史"Tab 时行为不变（只显示提问历史）
- [ ] H5 点击"💬 聊天"Tab 时 toolPanel 隐藏不变
- [ ] PC 端（≥769px）右侧面板仍同时显示两个 section 不受影响
- [ ] 现有测试全部通过

---

## R-036: H5 移动端项目/会话管理入口

**Priority:** P1
**Status:** pending
**Description:** 当前 H5 底部只有 聊天/历史/待办 三个 Tab，无法切换项目目录或浏览/新建会话。需在移动端增加项目切换和会话管理能力。
**Depends On:** R-019, R-020
**Acceptance Criteria:**
- [ ] H5 端 Header 区域显示当前项目名+会话名，可点击展开选择器
- [ ] 可通过选择器切换到其他项目（触发页面导航 reload）
- [ ] 可通过选择器切换到其他已存在会话
- [ ] 可新建会话（清空当前对话状态）
- [ ] 选择器 UI 在 375px 屏幕宽度下操作友好（触摸目标 ≥44px）
- [ ] PC 端不受影响

---

## R-037: PC 会话列表搜索/筛选

**Priority:** P1
**Status:** pending
**Description:** 当项目会话数量增多时，侧边栏会话列表缺乏搜索能力。需增加搜索框支持按关键词筛选会话。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 侧边栏"会话列表"标题旁出现搜索图标/输入框
- [ ] 输入关键词后实时过滤会话列表（匹配 preview 文本和自定义名称）
- [ ] 无匹配结果时显示"无匹配会话"提示
- [ ] 清空搜索框后恢复完整列表
- [ ] 搜索框不影响现有分组（今天/昨天/本周/更早）结构
- [ ] H5 端如实现会话入口（R-036）同样具备搜索能力

---

## R-038: PC 右侧工具面板优化

**Priority:** P1
**Status:** pending
**Description:** 右侧工具面板宽度 220px，待办和提问历史各占一半，内容少时空间浪费。需优化面板布局提升空间利用率。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 方案选定后实施（Tab 切换 / 可折叠 / 其他方案）
- [ ] 待办和提问历史不再同时平分空间
- [ ] 面板交互流畅，无明显布局跳动
- [ ] PC 端验证通过；H5 端 Tab 模式不受影响

---

## R-039: Favicon 图标添加

**Priority:** P1
**Status:** pending
**Description:** 当前浏览器请求 `/favicon.ico` 返回 404，标签页显示默认图标。需创建并配置 favicon。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 创建 SVG 或 PNG 格式 favicon（建议为对话气泡风格图标）
- [ ] `index.html` `<head>` 中添加 `<link rel="icon">` 引用
- [ ] 服务端 `serveStatic` 能正确返回 favicon 文件
- [ ] 浏览器控制台不再报 favicon 404 错误
- [ ] 标签页显示自定义图标

---

## R-040: H5 Header 信息增强

**Priority:** P2
**Status:** pending
**Description:** 移动端 header 仅显示 session ID 前 8 位（如 `2657ac1e...`），用户难以识别当前上下文。需优先展示有意义的标识信息。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 有自定义会话名时，Header 显示完整会话名（截断适配屏幕宽度）
- [ ] 无自定义名时，显示 session ID 短码（保持现状作为 fallback）
- [ ] 建议增加项目名前缀，格式如 `web-claude-chat · 探索优化`
- [ ] Header 文字在 375px 屏幕不换行、不溢出
- [ ] PC 端 Header 同步优化（可选）

---

## R-041: 提问历史条目截断策略优化

**Priority:** P2
**Status:** pending
**Description:** 右侧提问历史列表截断为 20 字符 + `...`，但很多条目前 20 字是相同的 XML 标签前缀（如 `<command-message>dev...`），区分度极低。需优化截断前处理。
**Depends On:** R-033
**Acceptance Criteria:**
- [ ] 截断前先剥离 `<command-message>...<command-name>` 等 XML 标签
- [ ] 从有语义的正文内容开始计算 20 字符截断
- [ ] 截断后的条目文本具有足够区分度
- [ ] PC 端右侧面板 + H5 历史 Tab 均生效

---

## R-042: 新建会话引导提示

**Priority:** P2
**Status:** pending
**Description:** 点击"+"新建会话后，输入框获得焦点但用户可能不清楚已进入新会话模式。需增加视觉反馈引导。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 新建会话时在消息区顶部显示临时提示条（如 "✨ 新会话已创建，发送消息开始对话"）
- [ ] 提示条 2~3 秒后自动淡出消失
- [ ] 提示条样式与现有 UI 风格统一（使用 --accent-green 配色）
- [ ] 提示条不阻塞用户立即开始输入
- [ ] PC 端 + H5 端均有此提示

---

## R-043: H5 键盘弹出时 Tab Bar 自适应隐藏

**Priority:** P2
**Status:** pending
**Description:** iOS Safari 键盘弹出时底部 Tab Bar 可能被遮挡或产生布局跳动。需监听键盘状态动态调整 Tab Bar 可见性。
**Depends On:** R-020, R-023
**Acceptance Criteria:**
- [ ] 检测到软键盘弹出时（visualViewport 高度缩小 >100px），自动隐藏 `#mobileTabBar`
- [ ] 键盘收起后恢复显示 `#mobileTabBar`
- [ ] 隐藏/显示过渡平滑（CSS transition），无闪烁
- [ ] Android Chrome 同样生效
- [ ] PC 端不受影响（Tab Bar 本身 display:none）

---

## R-044: 服务器启动时自动添加防火墙入站规则

**Priority:** P0
**Status:** done
**Description:** 服务器启动并绑定端口后，调用 `netsh advfirewall firewall` 添加一条入站规则，允许 TCP 流量到当前动态端口（50000-60000）。规则名称统一使用固定前缀以便识别和管理。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 服务器 `listen()` 成功后，执行 `netsh` 添加允许 TCP 入站规则
- [ ] 规则名称格式为 `"Claude Chat Server (port:xxxxx)"`，便于识别
- [ ] 规则仅允许当前监听端口，不开放其他端口
- [ ] 仅 Windows 平台执行（通过 `process.platform === 'win32'` 判断）
- [ ] 添加成功后 `console.log` 输出确认信息

---

## R-045: 服务器关闭时自动删除防火墙规则

**Priority:** P0
**Status:** done
**Description:** 服务器进程收到 SIGINT/SIGTERM 等退出信号时，在退出前自动删除启动时添加的防火墙规则。
**Depends On:** R-044
**Acceptance Criteria:**
- [ ] 注册 `process.on('exit'/'SIGINT'/'SIGTERM')` 事件处理
- [ ] 退出前执行 `netsh` 删除对应的防火墙规则
- [ ] 规则删除后 `console.log` 输出确认信息
- [ ] 不影响已有的 graceful shutdown 逻辑

---

## R-046: 处理规则已存在的情况（异常退出残留）

**Priority:** P0
**Status:** done
**Description:** 上次进程异常退出（崩溃/强杀）未清理防火墙规则时，重新启动应先尝试删除同端口残留规则，再添加新规则，避免 `netsh` 报错。
**Depends On:** R-044
**Acceptance Criteria:**
- [ ] 添加规则前，先尝试 `netsh delete` 同名规则（忽略"不存在"错误）
- [ ] 添加规则后 `netsh` 返回成功（exitCode === 0）
- [ ] 连续重启多次不会产生重复规则

---

## R-047: 权限不足时给出清晰错误提示

**Priority:** P0
**Status:** done
**Description:** `netsh` 修改防火墙规则需要管理员权限。当权限不足时（exitCode !== 0），输出明确的错误信息和手动操作指引，不阻塞服务器启动。
**Depends On:** R-044
**Acceptance Criteria:**
- [ ] `netsh` 返回非零 exitCode 时，`console.warn` 输出中文错误提示
- [ ] 提示中包含手动添加规则的完整 `netsh` 命令示例
- [ ] 提示建议"以管理员身份运行"
- [ ] 防火墙添加失败不阻塞服务器启动（服务器仍然正常运行）

---

## R-048: 防火墙规则管理单元测试

**Priority:** P1
**Status:** done
**Description:** 为防火墙规则添加/删除/清理逻辑编写测试用例，确保核心逻辑正确。
**Depends On:** R-044, R-045, R-046, R-047
**Acceptance Criteria:**
- [ ] 测试 `addFirewallRule()` 函数正确构造并执行 `netsh` 命令
- [ ] 测试 `removeFirewallRule()` 函数正确构造并执行 `netsh` 命令
- [ ] 测试非 Windows 平台跳过防火墙操作
- [ ] 测试 `netsh` 返回错误时的错误处理逻辑
- [ ] 现有 18 server 测试 + 10 parser 测试仍全部通过

---

## R-049: 移动端输入区域底部预留 Tab Bar 空间

**Priority:** P0
**Status:** done
**Description:** 修复 `#inputArea` 和 `#mainArea` 的底部布局，使输入框视觉区域不被固定定位的 Tab Bar（56px）遮挡。
**Depends On:** none
**Acceptance Criteria:**
- [ ] `#inputArea` 的视觉底部边框/背景在 Tab Bar 上方完整可见
- [ ] 输入框和发送按钮不被 Tab Bar 遮挡
- [ ] 聊天消息列表底部不被 Tab Bar 遮挡（滚动到底时最后一条消息可见）
- [ ] 桌面端（≥769px）不受影响
- [ ] 历史/待办 Tab 布局不受影响

---

## R-050: QR 码 URL 包含当前项目路径和会话 ID

**Priority:** P0
**Status:** done
**Description:** `renderQRCode()` 生成 QR 码时，URL 从 `http://IP:port/?token=xxx` 改为 `http://IP:port/project/<encoded-project>/?session=<sessionId>&token=<token>`，使手机扫码后自动进入当前项目和会话。
**Depends On:** none
**Acceptance Criteria:**
- [ ] QR 码 URL 包含 `/project/<encoded-project>/` 路径
- [ ] QR 码 URL 包含 `?session=<sessionId>` 参数
- [ ] QR 码 URL 包含 `&token=<token>` 参数（认证不丢失）
- [ ] 手机扫码后自动加载对应项目的会话历史
- [ ] 无 session 时（新会话状态），URL 不含 session 参数，手机端进入默认空状态

---

## R-051: 移动端 Header 显示项目名和会话名

**Priority:** P0
**Status:** done
**Description:** 移动端 Header 区域显示当前项目的短名称 + 会话名（或 session ID 短码），让用户一目了然知道连接的是哪个项目。
**Depends On:** none
**Acceptance Criteria:**
- [ ] Header 显示项目短名（路径最后一段，如 "web-claude-chat-plugin"）
- [ ] 有自定义会话名时显示完整名称，无则显示 session ID 前 8 位
- [ ] 格式如 `web-claude-chat-plugin · 2657ac1e...`
- [ ] 文字在 375px 屏幕宽度下不换行溢出（text-overflow: ellipsis）
- [ ] 桌面端 Header 不受影响

---

*Tracked by DevFlow. Do not edit manually.*
