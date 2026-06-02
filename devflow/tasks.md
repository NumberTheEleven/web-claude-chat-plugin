# Development Tasks

> Generated: 2026-05-30
> Source: /devflow:implement
> Based on: devflow/requirements.md, devflow/design.md

## T-001: server.mjs 安全与稳定性修复

**Status:** done
**Covers:** R-001, R-002, R-003, R-004, R-006
**Complexity:** low
**Files:** server/server.mjs
**Depends On:** none
**Description:** 在 server.mjs 中完成全部 P0 修复: 路径校验函数、URL/JSON 异常保护、WebSocket send 保护、catch 日志。

## T-002: 核心逻辑单元测试 (前端)

**Status:** done
**Covers:** R-005
**Complexity:** medium
**Files:** web/js/parser-utils.js, test/chat.test.js (新建), web/js/chat.js, web/index.html
**Depends On:** none
**Description:** 提取纯函数到 parser-utils.js，编写 node 测试用例覆盖表格/列表/引用/标题解析。

## T-003: 核心逻辑单元测试 (后端)

**Status:** done
**Covers:** R-005
**Complexity:** medium
**Files:** server/server.mjs, test/server.test.mjs (新建)
**Depends On:** T-001
**Description:** 导出 server.mjs 路由处理函数，编写 node --test 测试用例覆盖路由和参数验证。

## T-004: SLASH_COMMANDS 动态化

**Status:** done
**Covers:** R-007
**Complexity:** medium
**Files:** server/server.mjs, web/js/chat.js
**Depends On:** none
**Description:** 服务端新增 /api/commands 端点，前端 fetch 替代硬编码列表。

## T-005: parseContentBlocks 拆分

**Status:** done
**Covers:** R-008
**Complexity:** medium
**Files:** web/js/parser-utils.js
**Depends On:** T-002
**Description:** 将 parseContentBlocks 拆分为独立解析函数，每个 ≤30 行，通过 T-002 测试验证。

## T-006: CSS 清理与优化

**Status:** done
**Covers:** R-009, R-010, R-012, R-013
**Complexity:** low
**Files:** web/css/chat.css
**Depends On:** none
**Description:** 删除死 CSS、合并 .todo-items 选择器、移除 border-radius !important、扁平化选择器层级。

## T-007: console 日志清理

**Status:** done
**Covers:** R-011
**Complexity:** low
**Files:** web/js/chat.js, server/server.mjs
**Depends On:** none
**Description:** 移除 console.log，保留 console.error。

## T-008: 命令消息 XML 解析函数

**Status:** done
**Covers:** R-014
**Complexity:** low
**Files:** web/js/chat.js
**Depends On:** none
**Description:** 新增 `parseCommandMessage(text)` 函数，用正则从 `<command-message>` 标签中提取 command-name 和 command-args。返回 `{name, args}` 或 null（无标签/格式异常时）。

## T-009: 命令卡片 DOM 渲染

**Status:** done
**Covers:** R-015
**Complexity:** low
**Files:** web/js/chat.js
**Depends On:** T-008
**Description:** 修改 `addMessage('user', text)` ，当检测到命令消息时调用 `renderCommandCard(name, args, group)` 生成卡片 DOM 替代 textContent。新增 `renderCommandCard` 和 `getCommandGroup(name)` 函数。

## T-010: 命令卡片 CSS 样式

**Status:** done
**Covers:** R-016
**Complexity:** low
**Files:** web/css/chat.css
**Depends On:** T-009
**Description:** 编写 `.command-card` 样式：基础卡片 + devflow 组（绿色系）、superpowers 组（蓝紫色系）、默认组（灰色）。复用现有 CSS 变量，与 decision-card 风格统一。

## T-011: Mermaid.js CDN 引入与初始化

**Status:** done
**Covers:** R-017
**Complexity:** low
**Files:** web/index.html, web/js/chat.js
**Depends On:** none
**Description:** 在 index.html 引入 mermaid.js CDN script。在 chat.js 中调用 `mermaid.initialize({theme:'neutral', securityLevel:'antiscript'})`。

## T-012: Mermaid 渲染集成

**Status:** done
**Covers:** R-018
**Complexity:** medium
**Files:** web/js/chat.js, web/css/chat.css
**Depends On:** T-011
**Description:** 在 `renderCodeBlock(lang, code)` 中增加 `lang === 'mermaid'` 分支：先渲染 code-block 占位骨架屏，再异步调用 `mermaid.render()` 生成 SVG 替换占位符。失败时降级为原始代码块。

---

## T-013: server.mjs 绑定 0.0.0.0 + 局域网 URL 输出

**Status:** done
**Covers:** R-026
**Complexity:** low
**Files:** server/server.mjs
**Depends On:** none
**Description:** Server 绑定 0.0.0.0 而非 127.0.0.1，启动后自动获取局域网 IP 并输出 URL。

## T-014: CSS 移动端基础断点与布局切换

**Status:** done
**Covers:** R-019
**Complexity:** medium
**Files:** web/css/chat.css
**Depends On:** none
**Description:** 添加 @media (max-width: 768px) 断点，三栏变单栏垂直堆叠，侧边栏和工具面板默认隐藏，body overflow 处理。

## T-015: 底部 Tab 栏 HTML + JS 切换逻辑

**Status:** done
**Covers:** R-020, R-021, R-022
**Complexity:** medium
**Files:** web/index.html, web/js/chat.js
**Depends On:** T-014
**Description:** HTML 添加底部 Tab 栏 DOM（聊天/历史/待办）。JS 实现 Tab 切换逻辑，选会话后自动切回聊天 Tab。

## T-016: 移动端输入区域固定底部 + 键盘适配

**Status:** done
**Covers:** R-023
**Complexity:** low
**Files:** web/css/chat.css, web/js/chat.js
**Depends On:** T-014
**Description:** 输入栏固定视口底部，safe-area-inset 处理，发送按钮最小触摸尺寸 44px，键盘弹出适配。

## T-017: 移动端触摸交互适配 + 样式收尾

**Status:** done
**Covers:** R-021, R-022, R-027
**Complexity:** low
**Files:** web/css/chat.css, web/js/chat.js
**Depends On:** T-014, T-015
**Description:** 斜杠命令下拉触摸选择、代码块触摸优化（展开折叠≥44px、长按复制）、滚动区 momentum 样式。侧边栏/工具面板移动端全宽样式收尾。

## T-018: QR 码生成（纯前端 Canvas API）

**Status:** done
**Covers:** R-029
**Complexity:** medium
**Files:** web/js/chat.js, web/css/chat.css
**Depends On:** T-013
**Description:** 桌面端页面展示 QR 码，包含局域网 URL。纯前端 Canvas API 实现，零外部依赖。

## T-019: 桌面端零退化验证 + 最终收尾

**Status:** done
**Covers:** R-028
**Complexity:** low
**Files:** 全部
**Depends On:** T-013, T-014, T-015, T-016, T-017, T-018
**Description:** 验证桌面 Chrome/Firefox ≥1280px 所有功能与改造前一致。CSS 动画和过渡在移动端适配。最终代码审查。现有测试全部通过。

## T-020: Token 认证加固

**Status:** done
**Covers:** R-026 (扩展)
**Complexity:** low
**Files:** server/server.mjs, web/js/chat.js
**Depends On:** T-013
**Description:** Server 启动时生成 randomUUID 作为 AUTH_TOKEN，嵌入 LAN URL 输出。所有 HTTP 请求和 WebSocket 连接需验证 token 参数（token 不匹配返回 403）。前端从 URL params 读取 token 并自动附加到所有 fetch/WebSocket 请求。

---

*Tracked by DevFlow. Do not edit manually.*
