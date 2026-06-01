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

*Tracked by DevFlow. Do not edit manually.*
