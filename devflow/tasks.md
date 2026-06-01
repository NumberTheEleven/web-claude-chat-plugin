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

*Tracked by DevFlow. Do not edit manually.*
