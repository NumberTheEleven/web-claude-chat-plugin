# Design Specification

> Generated: 2026-06-01
> Source: /devflow:blueprint
> Based on: devflow/requirements.md (R-014 ~ R-018)

## Business Process Flow

用户发送命令消息 → 解析XML标签 → 渲染命令卡片；AI回复含mermaid代码块 → 调用mermaid.js渲染SVG图表。

```mermaid
flowchart TD
    subgraph 用户操作
        A[用户在输入框执行斜杠命令] --> B{消息包含 command 标签?}
    end

    subgraph 命令卡片渲染流程 R-014~R-016
        B -->|是| C[正则解析 command-name + command-args]
        C --> D{解析成功?}
        D -->|是| E[按命令组匹配颜色/图标]
        E --> F[渲染为 command-card 卡片DOM]
        D -->|失败| G[降级显示原始文本]
        B -->|否| H[走原有普通用户消息路径]
    end

    subgraph AI回复渲染流程 R-017~R-018
        I[AI 回复到达] --> J[parseSegments 解析分段]
        J --> K{检测到 mermaid 代码块?}
        K -->|是| L[调用 mermaid.render 异步渲染SVG]
        L --> M{渲染成功?}
        M -->|是| N[插入 SVG 图表到消息中]
        M -->|失败| O[降级显示代码块 + 错误提示]
        K -->|否| P[走原有 renderCodeBlock 路径]
    end

    style 命令卡片渲染流程 fill:#e8f5e9,stroke:#4caf50
    style AI回复渲染流程 fill:#e3f2fd,stroke:#2196f3
```

## Scope & Boundaries

### In Scope
- 用户消息中 `<command-message>` XML 标签的解析与卡片式渲染
- 命令卡片的分组着色样式（devflow / superpowers / 默认）
- mermaid.js CDN 引入与初始化配置
- ` ```mermaid ` 代码块的 SVG 渲染替换代码块展示
- mermaid 渲染失败的降级处理

### Out of Scope (Non-Goals)
- 后端修改（所有适配在前端完成）
- 引入其他 markdown 库（marked / markdown-it 等）
- Mermaid 图表的点击放大、导出、编辑功能
- 命令的交互能力（可点击跳转等）
- 暗色模式切换（当前 UI 仅浅色主题）

## Technical Standards

- **编码规范：** 与现有 chat.js 风格一致 — 函数式、无框架、原生 DOM 操作
- **架构约束：** 不引入构建工具，不改变现有 parseSegments 管道结构；mermaid 作为唯一外部依赖通过 CDN 引入
- **技术选型：** mermaid.js v11.x（CDN: cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js）
- **性能要求：** mermaid 初始化不阻塞页面首屏；每个 mermaid 块异步独立渲染，单个失败不影响其他块

## Design Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| 正则解析 XML 标签而非 DOMParser | 消息内容是字符串而非 HTML 片段，正则更轻量 | DOMParser 需要先将字符串包装为 HTML，过度工程 |
| 在 addMessage 中拦截 user 类型 | 单一入口，不影响 assistant/system/error 等其他类型 | 在 renderAssistantHtml 中处理 — 但命令标签只出现在 user 消息中 |
| mermaid.render 异步 + 占位符替换 | mermaid.render 返回 Promise，需要先占位后替换 | 同步阻塞等待 — 会冻结 UI |
| securityLevel: 'antiscript' | 防止 mermaid 注入恶意脚本 | 'loose' 安全性不足；'strict' 可能限制合法语法 |
| 命令分组用前缀匹配（devflow: / superpowers:） | SLASH_COMMANDS 数据源已有 cmd 字段带前缀 | 维护单独的分组映射表 — 多余的数据结构 |
| CSS 变量复用现有主题色 | 保持视觉一致性，减少新增颜色值 | 全新配色 — 与现有 decision-card / tag-row 风格割裂 |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| mermaid CDN 加载失败或超时 | 所有 mermaid 图表无法渲染 | try/catch 包裹 mermaid.render()，降级为代码块显示 |
| `<command-message>` 格式变化（后端升级） | 正则解析失效，显示原始标签 | 解析失败时降级为 textContent 显示原始文本 |
| mermaid 语法错误导致渲染异常 | 该图表区域空白 | catch 后显示原始代码 + 小字错误提示 |
| 大型 flowchart 渲染耗时 | 消息区短暂闪烁/空白 | 保留 code-block 外壳作为 loading 骨架屏 |

---
*Tracked by DevFlow. Do not edit manually.*
