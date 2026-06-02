# Test Cases Checklist

> Generated: 2026-06-01
> Source: /devflow:blueprint
> Linked Requirements: devflow/requirements.md (R-014 ~ R-018)

## TC-001: 标准 command-message 标签解析

**Status:** done
**Covers:** R-014 (命令消息 XML 解析)
**Type:** unit
**Steps:**
1. 构造标准格式字符串：`<command-message><command-name>devflow:clarify</command-name><command-args>帮我做一个网站</command-args></command-message>`
2. 调用解析函数
3. 断言返回 `{ name: 'devflow:clarify', args: '帮我做一个网站' }`

**Expected Result:** 正确提取 name 和 args，不含任何标签字符

---

## TC-002: 无命令标签的普通消息不受影响

**Status:** done
**Covers:** R-014 (命令消息 XML 解析)
**Type:** unit
**Steps:**
1. 传入纯文本：`你好，帮我看看这个 bug`
2. 调用解析函数
3. 断言返回 null

**Expected Result:** 普通消息返回 null，走原有 textContent 路径

---

## TC-003: 异常格式降级

**Status:** done
**Covers:** R-014 (命令消息 XML 解析)
**Type:** unit
**Steps:**
1. 传入残缺格式：`<command-message><command-name>test</command-name>`
2. 传入空标签：`<command-message></command-message>`
3. 传入乱序标签：`<command-args>xxx</command-args><command-name>yyy</command-name>`
4. 分别调用解析函数

**Expected Result:** 所有异常格式均返回 null 或触发降级显示原始文本

---

## TC-004: devflow 命令卡片渲染

**Status:** done
**Covers:** R-015 (命令卡片 DOM 渲染) + R-016 (命令卡片样式)
**Type:** manual
**Steps:**
1. 启动 Web 聊天服务
2. 执行 `/devflow:clarify 测试参数`
3. 观察聊天区用户消息

**Expected Result:** 显示为卡片样式，包含 "devflow:clarify" 命令名和 "测试参数" 参数文字，无 XML 标签可见；卡片使用 devflow 分组颜色（绿色系）

---

## TC-005: superpowers 命令卡片渲染

**Status:** done
**Covers:** R-015 (命令卡片 DOM 渲染) + R-016 (命令卡片样式)
**Type:** manual
**Steps:**
1. 执行 `/superpowers:brainstorming 测试 brainstorm`
2. 观察聊天区用户消息

**Expected Result:** 显示为卡片样式，使用 superpowers 分组颜色（区别于 devflow）

---

## TC-006: 未识别分组命令默认样式

**Status:** done
**Covers:** R-016 (命令卡片样式)
**Type:** manual
**Steps:**
1. 执行一个不在 devflow/superpowers 前缀下的命令（如有）
2. 或手动构造一个自定义前缀的 command-message

**Expected Result:** 卡片正常显示，使用默认/灰色样式

---

## TC-007: mermaid.js 加载与初始化

**Status:** done
**Covers:** R-017 (Mermaid.js CDN 引入)
**Type:** unit
**Steps:**
1. 页面加载完成后检查 `window.mermaid` 存在
2. 检查 `mermaid.getConfig()` 返回的主题和安全配置

**Expected Result:** mermaid 全局可用，theme 为 light/neutral，securityLevel 为 'antiscript'

---

## TC-008: mermaid flowchart 渲染

**Status:** done
**Covers:** R-018 (Mermaid 图表渲染集成)
**Type:** manual
**Steps:**
1. 发送一条会触发 AI 回复包含 ` ```mermaid ` flowchart 的消息
2. 等待 AI 回复完成

**Expected Result:** mermaid 代码块位置显示为可视化流程图 SVG，不是代码文本

---

## TC-009: mermaid 渲染失败降级

**Status:** done
**Covers:** R-018 (Mermaid 图表渲染集成)
**Type:** manual
**Steps:**
1. 构造一条包含非法 mermaid 语法的 ` ```mermaid ` 块的消息（如故意写错关键字）
2. 通过某种方式注入该消息到 renderAssistantHtml

**Expected Result:** 不显示空白，而是降级为普通代码块（可能带小字错误提示）

---

## TC-010: 同一消息多 mermaid 块独立渲染

**Status:** done
**Covers:** R-018 (Mermaid 图表渲染集成)
**Type:** manual
**Steps:**
1. 发送消息使 AI 回复中包含 2 个以上 ` ```mermaid ` 代码块
2. 等待渲染完成

**Expected Result:** 每个 mermaid 块都独立渲染为 SVG，互不干扰，顺序正确

---

---

## 移动端响应式适配 + QR码扫码 测试用例

### TC-011: 桌面端 CSS 断点以上布局不变

**Status:** done
**Covers:** R-019 (CSS 移动端断点), R-028 (桌面端零退化)
**Type:** manual
**Steps:**
1. 桌面 Chrome 窗口宽度 ≥1280px 打开 web-chat
2. 检查三栏布局（侧边栏 / 主聊天区 / 工具面板）
3. 检查底部 Tab 栏不显示
4. 发送消息、查看历史、切换会话、使用待办面板

**Expected Result:** 所有布局和功能与改造前完全一致，无任何视觉或功能退化

---

### TC-012: 移动端宽度触发单栏布局

**Status:** done
**Covers:** R-019 (CSS 移动端断点)
**Type:** manual
**Steps:**
1. Chrome DevTools 切换到移动端模式（如 iPhone 14, 390x844）
2. 打开 web-chat
3. 观察布局

**Expected Result:** 主聊天区占满全宽，侧边栏和工具面板默认隐藏，底部 Tab 栏可见，无横向滚动条

---

### TC-013: 中间宽度（769px~1280px）三栏布局保持

**Status:** done
**Covers:** R-019 (CSS 移动端断点), R-028 (桌面端零退化)
**Type:** manual
**Steps:**
1. Chrome 窗口宽度设为 900px
2. 打开 web-chat
3. 观察布局

**Expected Result:** 三栏布局正常显示，底部 Tab 栏不显示（≥769px 即为桌面模式）

---

### TC-014: 底部 Tab 栏聊天 Tab 默认激活

**Status:** done
**Covers:** R-020 (底部 Tab 导航栏)
**Type:** manual
**Steps:**
1. 移动端视口打开 web-chat
2. 观察底部 Tab 栏

**Expected Result:** 聊天 Tab 默认高亮激活，主聊天区可见

---

### TC-015: 底部 Tab 切换到历史面板

**Status:** done
**Covers:** R-020 (底部 Tab 导航栏), R-021 (移动端侧边栏)
**Type:** manual
**Steps:**
1. 移动端视口，点击底部 Tab 栏的 "历史"
2. 观察页面变化

**Expected Result:** 历史 Tab 高亮，主聊天区隐藏，侧边栏全宽显示，会话列表可滚动

---

### TC-016: 底部 Tab 切换到待办面板

**Status:** done
**Covers:** R-020 (底部 Tab 导航栏), R-022 (移动端工具面板)
**Type:** manual
**Steps:**
1. 移动端视口，点击底部 Tab 栏的 "待办"
2. 观察页面变化

**Expected Result:** 待办 Tab 高亮，主聊天区隐藏，工具面板全宽显示，待办复选框可点击

---

### TC-017: 历史 Tab 选会话后自动切回聊天

**Status:** done
**Covers:** R-021 (移动端侧边栏)
**Type:** manual
**Steps:**
1. 移动端视口，切换到历史 Tab
2. 点击一个会话
3. 观察页面变化

**Expected Result:** 自动切回聊天 Tab，聊天区显示所选会话的消息

---

### TC-018: 移动端发送消息

**Status:** done
**Covers:** R-023 (移动端输入区域)
**Type:** manual
**Steps:**
1. 移动端视口，在输入框输入文字
2. 点击发送按钮
3. 观察消息是否发送成功

**Expected Result:** 消息发送成功，AI 回复正常渲染（代码块、Markdown、Mermaid 等）

---

### TC-019: 移动端输入框固定底部 + 键盘适配

**Status:** done
**Covers:** R-023 (移动端输入区域)
**Type:** manual
**Steps:**
1. 移动端视口，点击输入框触发软键盘
2. 观察输入栏位置

**Expected Result:** 输入栏随键盘上移，始终在键盘上方可见，不被遮挡

---

### TC-020: 局域网 URL 输出

**Status:** done
**Covers:** R-026 (局域网访问 URL 输出)
**Type:** manual
**Steps:**
1. 启动 web-claude-chat 服务
2. 观察终端输出

**Expected Result:** 终端输出局域网 IP URL（如 `http://192.168.x.x:5xxxx/project/...`），手机同 WiFi 浏览器输入该 URL 可打开页面

---

### TC-021: QR 码扫码访问

**Status:** done
**Covers:** R-029 (QR 码扫码访问)
**Type:** manual
**Steps:**
1. 桌面端打开 web-chat
2. 找到页面上的 QR 码
3. 手机打开相机 / 微信扫一扫，扫描 QR 码
4. 手机浏览器打开链接

**Expected Result:** QR 码可见，扫码后手机浏览器成功打开聊天页面

---

### TC-022: 斜杠命令触摸选择

**Status:** done
**Covers:** R-027 (触摸交互适配)
**Type:** manual
**Steps:**
1. 移动端视口，在输入框输入 `/`
2. 斜杠命令下拉菜单弹出
3. 手指点击一个命令

**Expected Result:** 命令被选中填入输入框，下拉关闭

---

### TC-023: 代码块展开折叠触摸

**Status:** done
**Covers:** R-027 (触摸交互适配)
**Type:** manual
**Steps:**
1. 移动端视口，找到一条包含长代码块的 AI 回复
2. 手指点击展开/折叠按钮
3. 手指长按代码块区域

**Expected Result:** 展开/折叠按钮正常响应（触摸区域 ≥44px），长按触发文本选择（浏览器默认复制行为）

---

### TC-024: 移动端滚动流畅性

**Status:** done
**Covers:** R-027 (触摸交互适配)
**Type:** manual
**Steps:**
1. 移动端视口，聊天消息较多时滑动消息列表
2. 切换到历史 Tab，滑动会话列表

**Expected Result:** 滚动流畅，有 momentum 惯性效果，无卡顿

---

### TC-025: 桌面端 Firefox 兼容性

**Status:** done
**Covers:** R-028 (桌面端零退化)
**Type:** manual
**Steps:**
1. 桌面 Firefox 打开 web-chat
2. 验证三栏布局
3. 发送消息、查看历史、使用斜杠命令

**Expected Result:** 功能和布局与 Chrome 一致，无退化

---

### Token 认证测试用例

### TC-026: Server 生成 Token 并嵌入 LAN URL

**Status:** done
**Covers:** R-030 (Token 认证加固)
**Type:** manual
**Steps:**
1. 启动 web-claude-chat 服务
2. 观察终端输出

**Expected Result:** LAN URL 格式为 `http://192.168.x.x:5xxxx/?token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

### TC-027: 无 Token 访问返回 403

**Status:** done
**Covers:** R-030 (Token 认证加固)
**Type:** manual
**Steps:**
1. 启动服务，获取 LAN URL
2. 浏览器访问不带 token 参数的 URL（如 `http://192.168.x.x:5xxxx/`）

**Expected Result:** 页面显示 "Forbidden: invalid or missing token" 或 403 错误

---

### TC-028: 有效 Token 正常访问

**Status:** done
**Covers:** R-030 (Token 认证加固)
**Type:** manual
**Steps:**
1. 浏览器访问带 token 的完整 URL
2. 页面正常加载
3. 发送消息、切换会话、使用待办面板

**Expected Result:** 所有功能正常，API 请求和 WebSocket 连接均携带 token

---

### TC-029: QR 码包含 Token

**Status:** done
**Covers:** R-030 (Token 认证加固), R-029 (QR 码扫码访问)
**Type:** manual
**Steps:**
1. 桌面端打开 web-chat（带 token 的 URL）
2. 查看 QR 码内容

**Expected Result:** QR 码指向的 URL 包含 token 参数，扫码后无需手动输入 token

---

*Tracked by DevFlow. Do not edit manually.*
