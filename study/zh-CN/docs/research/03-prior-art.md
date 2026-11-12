> 中文阅读版；原文路径：`docs/research/03-prior-art.md` · [英文原文](../../../../docs/research/03-prior-art.md) · [阅读索引](../../INDEX.md)
> 对应提交：`f648576f1912a64c9be754fe9e3882fdd1c24da8` · 原文 SHA-256：`3ce046d0b46c3f1e86574c4b3d8eba365b37734fe3c6ac744739fc23cb031476`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="prior-art-persistent-memory-in-coding-agents--clis"></a>
# 现有方案：编程智能体与 CLI 的持久记忆

> 原文状态：Claude Code 部分依据 2026-06-11 获取的[官方记忆文档](https://code.claude.com/docs/en/memory)；MemGPT/Mem0 描述来自已验证综述，见 [01-agent-memory-survey.md](01-agent-memory-survey.md)。“未验证线索”来自研究流程，但未通过对抗式验证，只应视为线索。本页是历史资料译文，不能作为当前产品能力保证。

<a id="claude-code-most-directly-comparable-design"></a>
## Claude Code：最直接可比的设计

Claude Code 将持久化分为**两个互补系统**，均在会话开始时加载：

| 维度 | CLAUDE.md 文件 | 自动记忆 |
|---|---|---|
| 写入者 | 用户 | 智能体 |
| 内容 | 指令和规则 | 经验与模式 |
| 作用域 | 项目、用户、组织 | 按仓库，多个 worktree 共享 |
| 加载 | 每次会话完整加载 | 每次会话仅加载索引前 200 行或 25 KB |

<a id="instruction-files-user-authored"></a>
### 用户编写的指令文件

- 作用域及加载顺序从宽到具体：托管策略（Linux 为 `/etc/claude-code/CLAUDE.md`）→ 用户 `~/.claude/CLAUDE.md` → 项目 `./CLAUDE.md` 或 `./.claude/CLAUDE.md` → 本地 `./CLAUDE.local.md`（加入 gitignore）。
- 从 cwd 向上查找并拼接，最靠近根的先读，靠近 cwd 的后读；读取子目录文件时，按需加载对应 CLAUDE.md。
- 支持 `@path/to/file` 导入，最深四层；`.claude/rules/*.md` 用于模块化规则，可通过 frontmatter 的 paths glob 按路径限定，只在涉及匹配文件时加载。
- 建议每个文件少于 200 行，指令明确且可验证；规则冲突时可能任意选取。

<a id="auto-memory-agent-authored--the-closest-analog-to-this-project"></a>
### 智能体编写的自动记忆：最接近本项目的机制

- 存储在 `~/.claude/projects/<project>/memory/`；project 根据 Git 仓库确定，所有 worktree 共用目录；非 Git 环境用项目根路径。仅存本机，可通过 autoMemoryDirectory 配置，项目级设置受信任门控。
- 布局是 MEMORY.md 索引及 debugging.md、api-conventions.md 等主题文件。
- 会话开始只注入 MEMORY.md 前 200 行/25 KB。**主题文件启动时不加载**，由智能体用普通文件工具按需读取。
- 智能体决定值得保存的内容；全部为用户可通过 `/memory` 审计或编辑的纯 Markdown。开关为 autoMemoryEnabled 或 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`。
- 压缩后会重新从磁盘读取项目根 CLAUDE.md 并注入。

**值得借鉴的设计：**

1. 用户指令与智能体记忆严格分离。
2. 极小的常驻索引加按需主题文件，使 token 成本有界、总记忆容量可扩展。
3. 按项目区分并保存在用户全局目录，不影响仓库，也不需要决定提交或 gitignore；由存储位置处理信任。
4. 纯 Markdown 透明、可审计、用户可编辑，符合综述中的 token 级记忆优势。

<a id="memgpt--mem0--letta-verified-via-the-survey"></a>
## MemGPT / Mem0 / Letta：经综述验证

- 早期 MemGPT 和 Mem0 仅用 LLM 摘要能力将新信息合并到既有摘要，经常产生不一致或语义漂移；这是应避免的主要失败模式，见研究 01 的第 2 项。
- MemGPT 在上下文溢出时驱逐最早消息，属于基于时间的遗忘；MemOS 使用带归档的 LRU。这些是明确命名的衰减选项。

<a id="codex-cli-official-docs-fetched-2026-06-11"></a>
## Codex CLI：2026-06-11 获取的官方文档

来源：[AGENTS.md 指南](https://developers.openai.com/codex/guides/agents-md)，经 [openai/codex docs/agents_md.md](https://github.com/openai/codex/blob/main/docs/agents_md.md) 获取。

- 每次会话构建一次指令链：全局 `~/.codex/AGENTS.override.md`，否则 `~/.codex/AGENTS.md`；再从 Git 根向下到 cwd，每层优先 AGENTS.override.md，其次 AGENTS.md，再次可配置的回退文件名。每层一个文件，按根到子目录拼接，较近指令覆盖先前指导。
- 默认总上限 32 KiB，由 config.toml 的 project_doc_max_bytes 控制；跳过空文件。
- 原研究认为当时核心产品没有智能体写入的自动记忆，持久上下文仅为用户指令文件。此为历史结论。

<a id="cursor-official-docs-fetched-2026-06-11"></a>
## Cursor：2026-06-11 获取的官方文档

来源：[Cursor 规则文档](https://cursor.com/docs/context/rules)。

- **项目规则：**`.cursor/rules/*.mdc`，纳入版本控制。frontmatter 的 alwaysApply、description、globs 驱动四种应用方式：始终、智能体按描述决定、文件 glob 匹配、手工 @ 引用。按 glob 限定与 Claude Code 路径规则思想相同。
- **用户规则：**在 Cursor Settings 设置，全局适用于所有项目。
- **AGENTS.md：**支持项目根和子目录，操作对应目录文件时应用。
- **团队规则：**Team/Enterprise 支持，优先级为团队 → 项目 → 用户。
- 原研究获取的规则文档未包含自动生成 Memories 功能，应视为未验证或可能弃用。

<a id="aider-official-docs-fetched-2026-06-11"></a>
## Aider：2026-06-11 获取的官方文档

来源：[Aider 约定文档](https://aider.chat/docs/usage/conventions.html)。

- 约定是用户编写的 Markdown，例如 CONVENTIONS.md，以 `aider --read CONVENTIONS.md` 或 `/read CONVENTIONS.md` 只读加载；启用提示词缓存时可缓存。
- 通过项目 `.aider.conf.yml` 持久配置 `read: CONVENTIONS.md` 或文件列表。
- 原研究认为当时没有智能体写入的记忆；值得借鉴的是**只读加载记忆，使其保持提示词缓存友好**。

<a id="cross-tool-summary"></a>
## 跨工具总结

原研究认为主要编程智能体都收敛到**纯 Markdown 指令文件，按全局 → 项目 → 子目录拼接**。当时仅 Claude Code 提供智能体自动记忆，其有上限常驻索引、按需主题文件及仓库外存储最直接可借鉴。Codex 的 32 KiB 硬上限和 Aider 的只读、缓存友好加载，是实际 token 预算方面的经验。

<a id="unverified-leads-not-load-bearing"></a>
## 未验证线索：不作为设计依据

- mem0/Codex 集成博客：https://mem0.ai/blog/how-memory-works-in-codex-cli ，https://codex.danielvaughan.com/2026/05/01/codex-cli-memories-persistent-context-session-memory-ecosystem/
- **Mem0 与 Letta 比较：**https://vectorize.io/articles/mem0-vs-letta ，供应商博客。
- **编程智能体记忆基准：**https://www.developersdigest.tech/blog/agent-memory-benchmarks-not-enough 和 https://medium.com/@mrsandelin/the-first-controlled-benchmark-of-ai-memory-in-coding-agents-8e0bb776d39e ，均为博客，基准结论未验证。
- **agentmemory：**https://github.com/rohitg00/agentmemory ，记忆库或 MCP 服务器，API 和成熟度未检查。
