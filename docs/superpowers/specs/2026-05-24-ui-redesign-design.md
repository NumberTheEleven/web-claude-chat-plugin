# UI 重设计规格文档

## 概述

对 claude-chat 浏览器端 UI 进行全面重设计，包含：右侧工具面板、消息同类折叠标签、完成条带、以及全局蓝绿渐变方角设计语言。

## 一、三栏布局重构

### 现状
- `#sidebar` (280px, 左侧) + `#mainArea` (flex:1)
- `#todoSticky` 使用 `position:absolute` 悬浮在 `#mainArea` 内部右上角
- `#messages` 用 `padding-right:290px` 避让悬浮便签

### 目标
- 新增 `#toolPanel` (220px, 右侧)，与 `#sidebar` 对称
- `#todoSticky` 移入 `#toolPanel`，去除 absolute 定位
- 去除 `#messages` 的 `padding-right` 特殊处理
- `#toolPanel` 与 `#mainArea` 之间用 `border-left: 1px solid` 分隔

### HTML 结构
```html
<div id="app">
  <div id="sidebar">...</div>
  <div id="mainArea">
    <div id="header">...</div>
    <div id="messages">...</div>
    <div id="statusBar">...</div>
    <div id="inputArea">...</div>
    <div id="cmdDropdown">...</div>
  </div>
  <div id="toolPanel">
    <!-- todo 区块 -->
    <!-- history 区块 -->
  </div>
</div>
```

## 二、右侧工具面板

### 待办事项区块
- 从 `#todoSticky` 迁移，保留现有功能逻辑
- CSS 调整为面板内嵌样式（无旋转、无漂浮阴影）
- 每项左侧用渐变装饰条（3px solid）
- 新增按钮在列表底部，带渐变文字颜色

### 提问历史区块（新增）
- 遍历页面中所有 `.msg.user` 元素收集文本
- 显示规则：截取前 20 字，不超 2 行，超出显示省略号
- 点击行为：
  1. 目标消息 `scrollIntoView({behavior:'smooth'})`
  2. 添加临时高亮 class（如 `highlight-flash`），2 秒后自动移除
- 当前会话的问题高亮显示
- 会话切换时刷新历史列表

## 三、消息同类折叠标签

### 规则
- **连续同类型块合并**为一个折叠标签，不同类型产生独立标签
- 思考块 → 标签显示 `🤔 思考过程 (N条)`
- 工具调用块 → 标签显示 `🔧 工具调用 (N次)`
- 如果只有 1 条，不显示数字，也不折叠（直接展示内容）
- 遇到不同类就新建标签（如：思考→工具→思考 产生 3 个标签）
- **文件变更不折叠**，每个文件单独一行

### 标签行为
- 标签在横排内排列（`display:flex; gap:8px; flex-wrap:wrap`）
- 标签之间用 `▸` 分隔符
- 每个标签可点击展开/折叠：
  - 展开后下方显示每条详情的列表
  - 详情的每项左侧用对应类型颜色的装饰条（思考=蓝色，工具=绿色）
- 折叠状态只显示标签本身

### 渲染示例
```
[用户消息]
┌─🤔 思考过程 (2条)──▸──🔧 工具调用 (3次)─┐
│ 展开后:                                 │
│  🤔 第1次思考: ...                       │
│  🤔 第2次思考: ...                       │
│  🔧 第1次调用: Read src/foo.ts           │
│  🔧 第2次调用: Write src/bar.ts          │
│  🔧 第3次调用: Grep "pattern"            │
└─────────────────────────────────────────┘
[助手回复]
📝 src/components/Dashboard.tsx +45 -12
📝 src/types/dashboard.ts +18 -3
```

## 四、完成条带

### 外观
- 渐变背景：`linear-gradient(135deg, rgba(37,99,235,0.12), rgba(5,182,162,0.12))`
- 方角（`border-radius:0`）
- 横跨聊天区全宽
- 内部横向排列：图标 + 文字 + 分隔线 + 时间

### 内容
- 图标：✅
- "本轮完成" 或 "N轮对话"
- 时间格式转换：
  - `>= 3600000ms` → "X小时"
  - `>= 60000ms` → "X分钟"
  - `>= 1000ms` → "X秒"
  - `< 1000ms` → 显示秒（如 "0秒"）
  - 组合示例："1小时 30分钟"、"45秒"、"2分钟 15秒"

### 渲染位置
- 在每次助手回复完整结束后（即下一个用户消息之前，或最后一条消息之后）

## 五、全局颜色系统

### 主色调
- 渐变：`linear-gradient(135deg, #2563eb 0%, #05b6a2 100%)`
- CSS 变量：
  - `--accent: #2563eb` （柔蓝）
  - `--accent-green: #05b6a2` （碧绿）
  - `--gradient-primary: linear-gradient(135deg, #2563eb 0%, #05b6a2 100%)`

### 应用范围
- 会话列表选中项左侧装饰条
- 消息框左侧装饰条（用户蓝 / 助手绿）
- 可折叠标签计数 badge
- 输入框聚焦边框
- 按钮 hover 效果
- 完成条带背景

## 六、方角设计语言

### 全局改动
- 所有 `border-radius` 统一为 `0`
- 涉及：消息框、输入框、面板、按钮、下拉菜单、标签、提示框

### 装饰条
- 在方框的左侧或右侧添加纵向薄条（3px solid）
- 颜色使用主题渐变中的蓝色或绿色
- 用途：
  - 消息框左侧：区分用户（蓝色）/ 助手（绿色）
  - 面板项左侧：功能标识
  - 会话选中项左侧：状态标识

## 七、文件范围

| 文件 | 改动 |
|------|------|
| `web/index.html` | 新增 `#toolPanel`，移除 `#todoSticky` 的 absolute 包装 |
| `web/css/chat.css` | 全局颜色变量、方角、装饰条、面板样式、折叠标签、完成条带 |
| `web/js/chat.js` | 消息渲染逻辑重构（折叠标签）、提问历史、完成条带、滚动+高亮 |

## 八、不变项

- Node.js 后端 `server.mjs` 无改动
- WebSocket 通信逻辑无改动
- 会话管理 / 项目路由 / 斜杠命令补全无改动
