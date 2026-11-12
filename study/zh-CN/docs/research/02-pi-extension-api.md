> 中文阅读版；原文路径：`docs/research/02-pi-extension-api.md` · [英文原文](../../../../docs/research/02-pi-extension-api.md) · [阅读索引](../../INDEX.md)
> 对应提交：`f648576f1912a64c9be754fe9e3882fdd1c24da8` · 原文 SHA-256：`6e3214a19ab93c7fe0f9ca2c9ed544497695af8b91f3cc44ab459904bfd8a641`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="pi-pidev--badlogicpi-mono--extension-api-and-directory-conventions"></a>
# Pi（pi.dev / badlogic/pi-mono）：扩展 API 与目录约定

> 原文状态：标为 **[verified]** 的结论已在研究流程中通过 2–0/3–0 投票的对抗式验证；**[doc-confirmed]** 表示 2026-06-11 直接获取引用的一手文档后独立确认。原文称本页无未验证结论；这些是历史研究状态，本次未重新核验。

一手来源：

- [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- [packages/coding-agent/docs/extensions.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)
- [packages/coding-agent/docs/settings.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md)
- [packages/coding-agent/examples/extensions/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/README.md)

<a id="extension-shape"></a>
## 扩展形式

**[verified]** Pi 扩展是 TypeScript 模块，**默认导出一个接收 ExtensionAPI 对象的工厂函数**，该类型从 `@earendil-works/pi-coding-agent` 导入：

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", /* ... */ });
  pi.registerCommand("stats", { /* ... */ });
  pi.on("tool_call", async (event, ctx) => { /* ... */ });
}
```

**[doc-confirmed]** 工厂可以同步或异步。返回 Promise 时，Pi 会等待它完成再继续启动，因此异步初始化先于 session_start、resources_discover 和提供方注册完成。

**[verified]** 明确支持的扩展能力包括：自定义工具、斜杠命令、快捷键、事件处理器、UI 组件、自定义压缩或摘要、权限门控、子智能体和替换内置工具。

<a id="lifecycle-events"></a>
## 生命周期事件

**[doc-confirmed]** extensions.md 中的完整事件列表：

`project_trust`、`session_start`、`resources_discover`、`session_before_switch`、`session_before_fork`、`session_before_compact`、`session_compact`、`session_shutdown`、`before_agent_start`、`agent_start`、`agent_end`、`turn_start`、`turn_end`、`message_start`、`message_update`、`message_end`、`tool_execution_start`、`tool_execution_update`、`tool_execution_end`、`context`、`before_provider_request`、`after_provider_response`、`model_select`、`thinking_level_select`、`tool_call`、`tool_result`、`user_bash`、`input`。

与记忆扩展最相关的事件：

| 事件 | 可实现的行为 |
|---|---|
| session_start | 原因为 startup、reload、new、resume 或 fork；可加载或重建记忆状态。**[doc-confirmed]** |
| before_agent_start | 接收可在扩展间串联的 event.systemPrompt；返回 `{ systemPrompt: event.systemPrompt + "..." }` 可追加记忆或指令。**[doc-confirmed]** |
| context | 每次 LLM 调用前触发，通过返回 `{ messages: filtered }` 非破坏性修改消息，是逐调用记忆注入点。**[doc-confirmed]** |
| session_before_compact / session_compact | 可返回 `{ cancel: true }`，或通过 compaction 属性提供自定义摘要；有损压缩前是自然的记忆写入点。**[doc-confirmed]** |
| tool_call / tool_result | tool_call 处理器可返回 `{ block: true, reason: "..." }`；观察活动以学习值得保存的事实。**[doc-confirmed]** |
| session_shutdown | 会话结束时刷新记忆。**[doc-confirmed]** |

**[verified]** 已交付示例包括 custom-compaction.ts（完全自定义对话压缩摘要）和 trigger-compact.ts（超过 100k token 时通过程序触发压缩，并增加 `/trigger-compact` 命令）。

<a id="state-persistence-primitives"></a>
## 状态持久化原语

**[doc-confirmed]** pi.appendEntry() 可持久化扩展状态，但不参与 LLM 上下文，例如 `pi.appendEntry("my-state", { count: 42 })`。恢复时在 session_start 遍历会话条目，从 entry.data 重建。

**[verified]** 工具驱动状态的文档模式是将数据放入工具结果 details 字段，持久化到会话 JSONL，支持安全分叉；在 session_start 通过 ctx.sessionManager.getBranch() 重建。

**关键结论：**两者均为**会话作用域**，存储在会话 JSONL。跨会话记忆需要自己的磁盘存储，这正是本扩展补齐的部分。

**[verified]** 会话以 JSONL 自动保存在 `~/.pi/agent/sessions/`，按工作目录组织，使用 id/parentId 树结构支持分支。内置压缩会丢失上下文细节，但完整历史仍保留在 JSONL。

**[verified]** pi.sendMessage() 注入自定义消息而不触发 LLM；pi.sendUserMessage() 发送真实用户消息。

<a id="directory-layout--scoping-the-conventions-to-respect"></a>
## 目录布局与作用域约定

<a id="settings--exactly-two-scopes"></a>
### 设置：恰好两个作用域

**[verified]**

| 文件 | 作用域 |
|---|---|
| `~/.pi/agent/settings.json` | 全局，覆盖全部项目 |
| `.pi/settings.json` | 项目，覆盖全局；嵌套对象合并而非整体替换 |

<a id="resource-discovery"></a>
### 资源发现

**[verified / doc-confirmed]**

| 资源 | 全局 | 项目 |
|---|---|---|
| 自动发现扩展 | `~/.pi/agent/extensions/*.ts`、`~/.pi/agent/extensions/*/index.ts` | `.pi/extensions/*.ts`、`.pi/extensions/*/index.ts` |
| npm 包 | `~/.pi/agent/npm/` | `.pi/npm/`，通过 pi install -l |
| Git 包 | `~/.pi/agent/git/` | `.pi/git/`，通过 pi install -l |

- **[verified]** 设置中的资源数组包括 extensions、skills、prompts、themes、packages。全局设置的路径相对 `~/.pi/agent` 解析，项目设置相对 `.pi` 解析；支持绝对路径和 `~`。数组支持 glob、`!pattern` 排除、`+path` 强制包含、`-path` 强制排除。
- **[verified]** 用 `pi install npm:<pkg>` 或 `pi install git:<url>` 安装；package.json 无 pi 清单时，自动发现 extensions/、skills/、prompts/、themes/ 等约定目录。
- **[verified]** 单次加载使用 `pi --extension path/to/ext.ts`。

<a id="trust-model"></a>
### 信任模型

**[verified / doc-confirmed]** 项目 `.pi/` 资源受信任提示保护，决定记录在 `~/.pi/agent/trust.json`。信任项目后，Pi 才可加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失项目包并执行项目扩展；项目扩展仅在项目可信后加载。

<a id="existing-persistent-instruction-mechanism-must-coexist-with-it"></a>
### 现有持久指令机制：必须与之并存

**[verified]** Pi 启动时已从以下位置加载 AGENTS.md 或 CLAUDE.md：

1. 全局 `~/.pi/agent/AGENTS.md`。
2. 从 cwd 向上的父目录。
3. 当前目录。

所有匹配文件会拼接；可用 `--no-context-files` 禁用。

<a id="compaction-settings-token-budget-context"></a>
### 压缩设置与 token 预算背景

**[verified]**

| 设置 | 默认值 | 含义 |
|---|---|---|
| compaction.enabled | true | 自动压缩开关 |
| compaction.reserveTokens | 16384 | 为 LLM 响应预留的 token |
| compaction.keepRecentTokens | 20000 | 不做摘要而保留的近期 token |

<a id="design-relevant-takeaways"></a>
## 对设计的启示

1. **沿用作用域模式：**全局 `~/.pi/agent/<thing>`，项目 `.pi/<thing>`；项目扩展或覆盖全局，并受信任门控。项目记忆也可放在 `~/.pi/agent/` 下按项目路径区分的目录，类似会话；这是当时待决定的设计选择。
2. **注入点：**before_agent_start 注入系统提示词记忆，context 做逐调用调整。
3. **写入点：**session_before_compact 捕获有损压缩前的信息，session_shutdown 最终保存，或通过 pi.registerTool 注册显式 remember 工具。
4. **跨会话存储由本扩展负责：**appendEntry/details 仅限会话 JSONL。
5. **不与 AGENTS.md 冲突：**它是用户指令渠道；记忆应是独立、由智能体维护的存储，与 Claude Code 的划分相同，见 [03-prior-art.md](03-prior-art.md)。
