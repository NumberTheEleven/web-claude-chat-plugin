# Test Cases Checklist

> Generated: 2026-06-01 (updated 2026-06-07)
> Source: /devflow:blueprint
> Linked Requirements: devflow/requirements.md (R-014 ~ R-018, R-052 ~ R-058)

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

---

## 移动端提问历史 + TabBar 定位修复 测试用例

### TC-030: 移动端"历史"Tab 显示提问历史列表

**Status:** done
**Covers:** R-031 (移动端"历史"Tab 改为提问历史列表)
**Type:** manual
**Steps:**
1. 移动端视口（≤768px）打开 web-chat，发送至少 2 条消息产生提问记录
2. 点击底部 "📋 历史" Tab
3. 观察显示内容

**Expected Result:** 显示提问历史条目列表（非会话列表），每条显示截断的提问预览文字；与 PC 端右侧面板 `#historyList` 内容一致

---

### TC-031: 移动端历史 Tab 无记录时显示占位

**Status:** done
**Covers:** R-031 (移动端"历史"Tab 改为提问历史列表)
**Type:** manual
**Steps:**
1. 移动端视口打开全新会话（无任何消息）
2. 点击 "📋 历史" Tab

**Expected Result:** 显示 "暂无提问记录" 占位文本

---

### TC-032: 移动端点击历史条目切回聊天并加载消息

**Status:** done
**Covers:** R-031 (移动端"历史"Tab 改为提问历史列表)
**Type:** manual
**Steps:**
1. 移动端视口，发送 3 条以上消息
2. 切换到 "📋 历史" Tab
3. 点击第 2 条历史记录
4. 观察页面变化

**Expected Result:** 自动切回 "💬 聊天" Tab（底部高亮切换），聊天区显示该条提问对应的 AI 回复消息

---

### TC-033: 移动端待办 Tab 行为不变

**Status:** done
**Covers:** R-031 (移动端"历史"Tab 改为提问历史列表) — 回归验证
**Type:** manual
**Steps:**
1. 移动端视口，点击 "✅ 待办" Tab
2. 观察显示内容

**Expected Result:** 待办面板正常全宽展示，待办列表和复选框交互正常（与修改前一致）

---

### TC-034: 底部 TabBar 切换时始终固定底部

**Status:** done
**Covers:** R-032 (修复移动端底部 Tab Bar 定位异常)
**Type:** manual
**Steps:**
1. 移动端视口打开 web-chat
2. 确认默认聊天 Tab 下 tab bar 在屏幕底部
3. 点击 "📋 历史" Tab → 观察 tab bar 位置
4. 点击 "✅ 待办" Tab → 观察 tab bar 位置
5. 点击 "💬 聊天" Tab → 观察 tab bar 位置

**Expected Result:** 所有切换过程中，tab bar 始终固定在视口底部，不跳到顶部或中间位置

---

### TC-035: PC 端 TabBar 隐藏不受影响

**Status:** done
**Covers:** R-032 (修复移动端底部 Tab Bar 定位异常) — 回归验证
**Type:** manual
**Steps:**
1. 桌面端（≥769px）打开 web-chat
2. 检查页面底部

**Expected Result:** 底部 Tab 栏不显示，三栏布局正常

---

### TC-036: 键盘弹出/收起下 TabBar 行为正常

**Status:** done
**Covers:** R-032 (修复移动端底部 Tab Bar 定位异常)
**Type:** manual
**Steps:**
1. 移动端视口（真机或模拟器），在聊天 Tab 点击输入框触发软键盘
2. 观察键盘弹出时 tab bar 位置
3. 收起键盘后观察 tab bar 位置
4. 切换到历史 Tab 后再点输入框触发键盘

**Expected Result:** 键盘弹出时 tab bar 被推到键盘上方或保持固定底部（取决于 OS 行为）；收起后回到正确位置；不出现跳到顶部的异常

---

---

## Windows 防火墙自动管理 测试用例

### TC-037: addFirewallRule 函数正确构造并执行 netsh 命令

**Status:** done
**Covers:** R-044 (服务器启动时自动添加防火墙入站规则)
**Type:** unit
**Steps:**
1. Mock `child_process.execSync`，记录调用参数
2. 设置 `process.platform = 'win32'`
3. 调用 `addFirewallRule(50123)`
4. 断言 `execSync` 被调用，参数包含 `netsh advfirewall firewall add rule name="Claude Chat Server (port:50123)" dir=in action=allow protocol=TCP localport=50123`

**Expected Result:** netsh 命令参数格式正确，包含正确的规则名、方向、动作、协议和端口

---

### TC-038: removeFirewallRule 函数正确构造并执行 netsh 命令

**Status:** done
**Covers:** R-045 (服务器关闭时自动删除防火墙规则)
**Type:** unit
**Steps:**
1. Mock `child_process.execSync`
2. 设置 `process.platform = 'win32'`
3. 调用 `removeFirewallRule(50123)`
4. 断言 `execSync` 被调用，参数包含 `netsh advfirewall firewall delete rule name="Claude Chat Server (port:50123)"`

**Expected Result:** netsh delete 命令参数格式正确，按规则名精确匹配

---

### TC-039: 非 Windows 平台跳过防火墙操作

**Status:** done
**Covers:** R-044 (防火墙入站规则)
**Type:** unit
**Steps:**
1. Mock `child_process.execSync`
2. 设置 `process.platform = 'darwin'`
3. 调用 `addFirewallRule(50123)` 和 `removeFirewallRule(50123)`
4. 断言 `execSync` 未被调用

**Expected Result:** 非 Windows 平台不执行任何 netsh 命令，函数静默返回

---

### TC-040: netsh 返回错误时输出提示且不阻塞

**Status:** done
**Covers:** R-047 (权限不足时给出清晰错误提示)
**Type:** unit
**Steps:**
1. Mock `child_process.execSync` 抛出异常（模拟权限不足）
2. Mock `console.warn`
3. 调用 `addFirewallRule(50123)`
4. 断言函数未抛出异常
5. 断言 `console.warn` 被调用，输出包含"管理员"和"netsh"关键词

**Expected Result:** 函数捕获异常，输出中文错误提示（含手动命令示例），不抛出错误，不阻塞调用方

---

### TC-041: 残留规则清理（先 delete 后 add）

**Status:** done
**Covers:** R-046 (处理规则已存在的情况)
**Type:** unit
**Steps:**
1. Mock `child_process.execSync`，记录所有调用顺序
2. 调用 `addFirewallRule(50123)`（内部先 delete 再 add）
3. 断言第一次调用是 `delete rule`，第二次是 `add rule`
4. Mock delete 抛异常（规则不存在），add 成功

**Expected Result:** 函数先尝试删除旧规则（忽略不存在错误），再添加新规则，整体成功

---

### TC-042: 服务器启动集成测试 — 防火墙规则自动添加

**Status:** done
**Covers:** R-044, R-046 (启动时添加 + 残留清理)
**Type:** integration
**Steps:**
1. 以管理员权限启动 `node server/server.mjs`
2. 观察终端输出
3. 执行 `netsh advfirewall firewall show rule name="Claude Chat Server (port:xxxxx)"` 查看规则

**Expected Result:** 终端输出 `[Firewall] Rule added: ...`，netsh 查询确认规则存在且端口正确

---

### TC-043: 服务器退出集成测试 — 防火墙规则自动清理

**Status:** done
**Covers:** R-045 (关闭时删除规则)
**Type:** integration
**Steps:**
1. 启动服务器，确认防火墙规则已添加
2. 按 Ctrl+C 发送 SIGINT
3. 观察终端输出
4. 执行 `netsh advfirewall firewall show rule name="Claude Chat Server (port:xxxxx)"` 确认规则

**Expected Result:** 终端输出 `[Firewall] Rule removed: ...`，netsh 查询确认规则已被删除

---

### TC-044: 手机扫码端到端测试

**Status:** pending
**Covers:** R-044 ~ R-047 (防火墙全流程)
**Type:** e2e
**Steps:**
1. 以管理员权限启动服务器
2. 桌面端打开 web-chat，确认 QR 码显示
3. 手机扫码，手机浏览器打开链接
4. 在手机上发送消息，确认 AI 回复正常

**Expected Result:** 手机扫码后页面正常加载，WebSocket 连接成功，可正常发送/接收消息

---

### TC-045: 现有测试回归

**Status:** done
**Covers:** R-048 (防火墙规则管理单元测试)
**Type:** unit
**Steps:**
1. 执行 `node --test test/server.test.mjs`
2. 观察测试结果

**Expected Result:** 现有 18 server 测试 + 10 parser 测试全部通过，无退化

---

## 移动端体验优化：Tab Bar 遮挡修复 + QR 码参数完善 + Header 项目名显示 测试用例

### TC-046: 移动端输入框不被 Tab Bar 遮挡

**Status:** done
**Covers:** R-049 (移动端输入区域底部预留 Tab Bar 空间)
**Type:** manual
**Steps:**
1. Chrome DevTools 切换到移动端模式（如 iPhone 14, 390x844）
2. 打开 web-chat，进入聊天 Tab
3. 观察输入框和发送按钮的位置
4. 截图对比输入框底部与 Tab Bar 顶部的距离

**Expected Result:** 输入框和发送按钮完整可见，底部边框/背景在 Tab Bar 上方，不被 Tab Bar 遮挡

---

### TC-047: 移动端消息列表底部不被遮挡

**Status:** done
**Covers:** R-049 (移动端输入区域底部预留 Tab Bar 空间)
**Type:** manual
**Steps:**
1. 移动端视口打开 web-chat，进入一个有至少 20 条消息的会话
2. 滚动消息列表到最底部
3. 观察最后一条消息的位置

**Expected Result:** 最后一条消息完整可见，不被输入框或 Tab Bar 遮挡

---

### TC-048: 桌面端布局不受影响（≥769px）

**Status:** done
**Covers:** R-049 (移动端输入区域底部预留 Tab Bar 空间) — 回归验证
**Type:** manual
**Steps:**
1. 桌面 Chrome 窗口宽度 ≥1280px 打开 web-chat
2. 检查三栏布局（侧边栏 / 主聊天区 / 工具面板）
3. 检查输入框位置和样式
4. 发送消息、查看历史、切换会话、使用待办面板

**Expected Result:** 所有布局和功能与改造前完全一致，无任何视觉或功能退化

---

### TC-049: 历史/待办 Tab 布局不受影响

**Status:** done
**Covers:** R-049 (移动端输入区域底部预留 Tab Bar 空间) — 回归验证
**Type:** manual
**Steps:**
1. 移动端视口打开 web-chat
2. 切换到历史 Tab，观察布局
3. 切换到待办 Tab，观察布局
4. 切回聊天 Tab，确认输入框位置正常

**Expected Result:** 历史/待办 Tab 的布局与修改前一致，聊天 Tab 输入框位置正确

---

### TC-050: iOS Safari 兼容性

**Status:** done
**Covers:** R-049 (移动端输入区域底部预留 Tab Bar 空间)
**Type:** manual
**Steps:**
1. 真机 iOS Safari 打开 web-chat
2. 检查输入框位置
3. 点击输入框触发软键盘
4. 观察键盘弹出/收起时输入框和 Tab Bar 的行为

**Expected Result:** 输入框不被遮挡，键盘弹出时布局正常，`safe-area-inset-bottom` 生效

---

### TC-051: QR 码 URL 包含项目路径

**Status:** done
**Covers:** R-050 (QR 码 URL 包含当前项目路径和会话 ID)
**Type:** manual
**Steps:**
1. 桌面端打开 web-chat，进入一个项目（如 `web-claude-chat-plugin`）
2. 查看右下角 QR 码
3. 使用浏览器开发者工具或扫码工具查看 QR 码内容

**Expected Result:** QR 码 URL 包含 `/project/<encoded-project>/` 路径，如 `http://192.168.x.x:5xxxx/project/web-claude-chat-plugin/`

---

### TC-052: QR 码 URL 包含会话 ID

**Status:** done
**Covers:** R-050 (QR 码 URL 包含当前项目路径和会话 ID)
**Type:** manual
**Steps:**
1. 桌面端打开 web-chat，选择一个已有会话
2. 查看 QR 码内容
3. 确认 URL 中包含 `session=<sessionId>` 参数

**Expected Result:** QR 码 URL 包含 `?session=<sessionId>&token=<token>` 参数，sessionId 与当前会话一致

---

### TC-053: 手机扫码后自动加载项目和会话历史

**Status:** done
**Covers:** R-050 (QR 码 URL 包含当前项目路径和会话 ID)
**Type:** manual
**Steps:**
1. 桌面端打开 web-chat，进入一个有历史消息的会话
2. 手机扫码打开链接
3. 观察手机端页面加载情况

**Expected Result:** 手机端自动进入对应项目和会话，显示完整的历史消息，无需手动选择

---

### TC-054: 无 session 时 QR 码 URL 不含 session 参数

**Status:** done
**Covers:** R-050 (QR 码 URL 包含当前项目路径和会话 ID)
**Type:** manual
**Steps:**
1. 桌面端打开 web-chat，新建一个空会话（无任何消息）
2. 查看 QR 码内容
3. 手机扫码打开链接

**Expected Result:** QR 码 URL 不含 `session` 参数，手机端进入空状态，显示"暂无消息"提示

---

### TC-055: QR 码 URL 包含 Token 参数

**Status:** done
**Covers:** R-050 (QR 码 URL 包含当前项目路径和会话 ID), R-030 (Token 认证加固)
**Type:** manual
**Steps:**
1. 桌面端打开 web-chat
2. 查看 QR 码内容
3. 确认 URL 中包含 `token=<token>` 参数

**Expected Result:** QR 码 URL 包含 token 参数，手机扫码后无需手动输入 token 即可访问

---

### TC-056: 移动端 Header 显示项目名

**Status:** done
**Covers:** R-051 (移动端 Header 显示项目名和会话名)
**Type:** manual
**Steps:**
1. 移动端视口打开 web-chat，进入项目 `web-claude-chat-plugin`
2. 观察页面顶部 Header 区域

**Expected Result:** Header 显示项目短名 `web-claude-chat-plugin`（路径最后一段）

---

### TC-057: 移动端 Header 显示会话名或 Session ID

**Status:** done
**Covers:** R-051 (移动端 Header 显示项目名和会话名)
**Type:** manual
**Steps:**
1. 移动端视口打开 web-chat
2. 进入一个有自定义名称的会话，观察 Header
3. 进入一个无自定义名称的会话，观察 Header

**Expected Result:** 有自定义名时显示完整名称；无自定义名时显示 session ID 前 8 位（如 `2657ac1e...`）

---

### TC-058: 移动端 Header 格式正确

**Status:** done
**Covers:** R-051 (移动端 Header 显示项目名和会话名)
**Type:** manual
**Steps:**
1. 移动端视口打开 web-chat，进入一个会话
2. 观察 Header 文字格式

**Expected Result:** Header 格式为 `项目名 · 会话名`（如 `web-claude-chat-plugin · 2657ac1e...`），中间用 ` · ` 分隔

---

### TC-059: 移动端 Header 文字不溢出（375px 屏幕）

**Status:** done
**Covers:** R-051 (移动端 Header 显示项目名和会话名)
**Type:** manual
**Steps:**
1. Chrome DevTools 切换到 375px 宽度（iPhone SE）
2. 打开 web-chat，进入一个项目名和会话名都较长的会话
3. 观察 Header 文字

**Expected Result:** Header 文字不换行、不溢出，超长部分用 `text-overflow: ellipsis` 截断显示

---

### TC-060: 桌面端 Header 不受影响

**Status:** done
**Covers:** R-051 (移动端 Header 显示项目名和会话名) — 回归验证
**Type:** manual
**Steps:**
1. 桌面端（≥769px）打开 web-chat
2. 观察 Header 区域

**Expected Result:** 桌面端 Header 显示内容与修改前一致，不显示项目名+会话名格式

---

## CLI → Web 实时同步 测试用例

### TC-061: JSONL 行解析 → WS 事件转换（标准格式）

**Status:** done
**Covers:** R-055 (新增消息实时广播)
**Type:** unit
**Steps:**
1. 构造标准 JSONL 行：`{"message": {"role": "assistant", "content": [{"type": "text", "text": "你好"}]}}`
2. 调用事件转换函数
3. 断言返回 WS 事件包含 `type: "assistant"`, `message.content[0].type: "text"`, `message.content[0].text: "你好"`
4. 断言事件包含正确的 `_sessionId` 标记

**Expected Result:** JSONL 行正确解析为与 `claude -p --output-format stream-json` 兼容的 WS 事件格式

---

### TC-062: JSONL 行解析降级（旧版/异常格式）

**Status:** done
**Covers:** R-055 (新增消息实时广播)
**Type:** unit
**Steps:**
1. 传入旧版格式行：`{"role": "user", "content": "hello"}`（无 message 包裹层）
2. 传入破损 JSON：`{"message": {"role": "assistant", "content": [`（截断）
3. 分别调用事件转换函数

**Expected Result:** 旧版格式降级为 `{type: "text", content: "hello"}` 发送；破损 JSON 记录 `console.warn` 并跳过（返回 null）

---

### TC-063: 文件偏移量跟踪 — 正常增量读取

**Status:** pending
**Covers:** R-053 (文件位置跟踪)
**Type:** unit
**Steps:**
1. 模拟文件从 0 字节增长到 100 字节
2. 调用读取函数，offset=0，读取到 100 字节
3. 断言 offset 更新为 100
4. 模拟文件再次增长到 250 字节
5. 调用读取函数，仅读取 100~250 范围的字节
6. 断言 offset 更新为 250

**Expected Result:** 每次读取后 offset 正确更新；读取范围精确为 (oldOffset, newSize]

---

### TC-064: 文件被 truncate 时重置 offset

**Status:** pending
**Covers:** R-053 (文件位置跟踪)
**Type:** unit
**Steps:**
1. 初始 offset=500，buffer=""
2. 模拟文件 stat.size 变为 200（小于 offset）
3. 调用读取函数
4. 断言 offset 重置为 200，buffer 清空，触发 `console.warn`

**Expected Result:** 检测到 truncate 时安全重置，不读取负范围，不清空警告日志

---

### TC-065: 不完整行 buffer 处理

**Status:** pending
**Covers:** R-054 (处理文件写入不完整)
**Type:** unit
**Steps:**
1. 初始 buffer=""，offset=0
2. 写入 "line1\nline2_partial"（无结尾换行）
3. 断言返回完整行 ["line1"]，buffer 更新为 "line2_partial"
4. 追加写入 "ial_continued\nline3\n"
5. 断言返回 ["line2_partialial_continued", "line3"]，buffer 清空

**Expected Result:** 完整行按 `\n` 分割返回；不完整尾部保留在 buffer；下次读取时正确拼接

---

### TC-066: Web-spawned claude 期间暂停文件监听

**Status:** pending
**Covers:** R-055 (去重机制)
**Type:** unit
**Steps:**
1. 模拟 web 客户端发送消息，spawn `claude` 子进程
2. 断言该 session 的 watcher pause flag 设为 true
3. 模拟文件变更，调用读取函数
4. 断言读取被跳过（直接 return，不广播）
5. 模拟 proc.on('close') 触发
6. 断言 pause flag 恢复为 false，offset 更新为当前文件大小

**Expected Result:** web 发起消息期间文件监听暂停，避免双重发送；子进程结束后恢复监听

---

### TC-067: 非 Windows 平台 fs.watch 叠加加速

**Status:** pending
**Covers:** R-056 (多层监听保障)
**Type:** unit
**Steps:**
1. Mock `process.platform = 'darwin'`
2. 创建 session watcher
3. 断言同时调用了 `fs.watchFile` 和 `fs.watch`
4. Mock `process.platform = 'win32'`
5. 创建 session watcher
6. 断言仅调用了 `fs.watchFile`，未调用 `fs.watch`

**Expected Result:** macOS/Linux 使用双重监听；Windows 仅使用 `fs.watchFile`

---

### TC-068: Web 端渲染来自广播的 assistant 事件

**Status:** pending
**Covers:** R-057 (Web 端正确渲染流式事件)
**Type:** manual
**Steps:**
1. 打开 web-chat 到某个 session
2. 通过服务端模拟发送 WS 事件（或使用浏览器控制台手动 dispatch）：
   - `{type: "system", session_id: "xxx"}`
   - `{type: "assistant", message: {content: [{type: "thinking", thinking: "思考中..."}]}}`
   - `{type: "assistant", message: {content: [{type: "text", text: "你好，这是回复"}]}}`
   - `{type: "result", subtype: "success", num_turns: 1, duration_ms: 1234}`
3. 观察页面渲染

**Expected Result:** thinking 显示为内联标签行，text 显示为消息气泡，result 显示为完成状态栏，与 web 端自己发消息的渲染一致

---

### TC-069: 多客户端同时接收 CLI 消息

**Status:** pending
**Covers:** R-055 (广播) + R-057 (渲染)
**Type:** manual
**Steps:**
1. 桌面浏览器打开 web-chat 进入 session A
2. 手机扫码打开同一 session A
3. 在 CLI 中执行 `claude --resume <sessionA_id> -p "介绍一下你自己"`
4. 观察桌面端和手机端页面

**Expected Result:** 桌面端和手机端几乎同时（<1s 差异）开始显示流式响应，包括 thinking → text → result 完整流程

---

### TC-070: Web 端发消息不被文件广播重复

**Status:** pending
**Covers:** R-055 (去重) + R-057 (去重渲染)
**Type:** manual
**Steps:**
1. 桌面浏览器打开 web-chat 进入 session，手机也打开同一 session
2. 桌面端发送消息 "你好"
3. 观察桌面端和手机端聊天区

**Expected Result:** 桌面端不显示重复消息（去重生效）；手机端正常显示 1 条 AI 回复；两个客户端消息数和内容一致

---

### TC-071: 最后一个客户端断开时停止监听

**Status:** pending
**Covers:** R-058 (清理机制)
**Type:** unit
**Steps:**
1. 创建 session watcher（模拟客户端加入）
2. 第二个客户端加入同一 session group
3. 第一个客户端断开
4. 断言 watcher 仍在运行（group 非空）
5. 第二个客户端断开
6. 断言 `fs.unwatchFile` 被调用，polling timer 清除，watcher state 从 Map 中移除

**Expected Result:** 仅当 group 为空时才停止监听；单客户端断开不影响共享 session 的 watcher

---

### TC-072: 服务端 SIGINT 时清理所有 watcher

**Status:** pending
**Covers:** R-058 (清理机制)
**Type:** integration
**Steps:**
1. 启动服务端，两个不同 session 各有一个客户端连接
2. 确认两个 session 的 watcher 都在运行
3. 发送 SIGINT（Ctrl+C）
4. 断言所有 `fs.unwatchFile` 被调用，所有 timer 被清除

**Expected Result:** 服务端优雅退出时释放所有文件监听资源

---

### TC-073: CLI → Web 端到端同步

**Status:** pending
**Covers:** R-052 ~ R-057 (全流程)
**Type:** e2e
**Steps:**
1. 启动 web-claude-chat 服务
2. 桌面浏览器打开 web-chat，进入 session A
3. 在另一个终端中执行 `claude --resume <sessionA_id> -p "请用中文回答：1+1等于几？"`
4. 观察 web 页面是否实时显示 CLI 对话的流式响应
5. 检查 thinking / text / result 是否完整展示
6. 检查响应时间（从 CLI 开始输出到 web 开始显示应在 3s 内）

**Expected Result:** web 端在 3 秒内开始显示流式响应，内容完整（thinking → text → result），与 CLI 输出一致

---

### TC-074: 快速连续 10+ 轮对话不丢消息

**Status:** pending
**Covers:** R-052 ~ R-055 (不丢消息)
**Type:** e2e
**Steps:**
1. 桌面浏览器打开 web-chat 进入 session A
2. 在 CLI 中快速连续执行 10 次 `claude --resume <sessionA_id> -p "简短回复：第N次对话"`
3. 等待所有对话完成
4. 统计 web 端显示的消息轮次

**Expected Result:** web 端显示完整的 10 轮对话，无遗漏（可刷新页面后 check JSONL 行数与 web 显示消息数一致）

---

### TC-075: 现有测试回归

**Status:** done
**Covers:** R-052 ~ R-058 (全流程回归)
**Type:** unit
**Steps:**
1. 执行 `node --test test/server.test.mjs`
2. 观察测试结果

**Expected Result:** 现有全部测试通过，无退化

---

*Tracked by DevFlow. Do not edit manually.*
