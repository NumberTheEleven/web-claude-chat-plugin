# Requirements Checklist

> Generated: 2026-06-01
> Source: /devflow:clarify → /devflow:breakdown

## R-014: 命令消息 XML 解析

**Priority:** P0
**Status:** done
**Description:** 在 `addMessage('user', text)` 中检测 `<command-message>` XML 标签，用正则解析出 `<command-name>` 和 `<command-args>` 内容，剥离原始标签。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 能正确解析 `<command-message><command-name>xxx</command-name><command-args>yyy</command-args></command-message>` 格式
- [ ] 无命令标签的普通用户消息不受影响，仍走原有 `textContent` 路径
- [ ] 解析失败时（格式异常）降级为显示原始文本

---

## R-015: 命令卡片 DOM 渲染

**Priority:** P0
**Status:** done
**Description:** 将解析出的命令名和参数渲染为卡片式 DOM 元素（`.command-card`），替代原有的 `bubble.textContent = text` 纯文本渲染。
**Depends On:** R-014
**Acceptance Criteria:**
- [ ] 命令消息显示为独立卡片，包含命令名和参数内容
- [ ] 卡片内不展示任何 XML 标签（`<command-message>` 等）
- [ ] 卡片作为 `.msg.user .msg-bubble` 的子元素正常显示

---

## R-016: 命令卡片样式（分组着色）

**Priority:** P1
**Status:** done
**Description:** 为命令卡片编写 CSS 样式，按命令组（devflow / superpowers / 其他）分配不同颜色/图标，与现有 decision-card 风格统一。
**Depends On:** R-015
**Acceptance Criteria:**
- [ ] devflow 组命令有统一的视觉标识（颜色/图标）
- [ ] superpowers 组命令有统一但不同于 devflow 的视觉标识
- [ ] 未识别分组的命令使用默认样式
- [ ] 卡片圆角、阴影、字体与现有 UI 风格一致

---

## R-017: Mermaid.js CDN 引入

**Priority:** P0
**Status:** done
**Description:** 在 `index.html` 中通过 `<script>` 标签引入 mermaid.js CDN，并初始化 mermaid 配置（主题、安全级别等）。
**Depends On:** none
**Acceptance Criteria:**
- [ ] 页面加载后 `window.mermaid` 可用
- [ ] mermaid 主题配置为 light/neutral 以匹配当前 UI 浅色风格
- [ ] securityLevel 设为 'antiscript'（安全模式）

---

## R-018: Mermaid 图表渲染集成

**Priority:** P0
**Status:** done
**Description:** 在 `renderCodeBlock(lang, code)` 中增加 `lang === 'mermaid'` 分支，调用 `mermaid.render()` 将代码渲染为 SVG 并嵌入页面。
**Depends On:** R-017
**Acceptance Criteria:**
- [ ] ` ```mermaid ` 代码块不再显示为代码文本，而是渲染为 SVG 流程图
- [ ] 渲染失败的 mermaid 代码降级显示为原始代码块（带错误提示）
- [ ] 多个 mermaid 块在同一消息中各自独立渲染，互不干扰
- [ ] 异步渲染完成后图表自动插入正确位置

---

*Tracked by DevFlow. Do not edit manually.*
