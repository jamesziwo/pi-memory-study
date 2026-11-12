> 中文阅读版；原文路径：`docs/research/README.md` · [英文原文](../../../../docs/research/README.md) · [阅读索引](../../INDEX.md)
> 对应提交：`8264fdabc7f6a9620daec04082012c2e6150c0f7` · 原文 SHA-256：`4e206eff9aabb7836e80b3455411b295357c2b1bc735ab80407ad73bafca1ef0`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="research-persistent-memory-extension-for-pi"></a>
# 研究：Pi 持久记忆扩展

目标是收集足够的已验证事实，用于设计一个**以 TypeScript 实现的 pi.dev 智能体持久记忆扩展**，遵循 Pi 的目录布局及全局/项目作用域约定。本文记录的是研究阶段，当时尚未编写设计文档或代码。

研究于 2026-06-11 进行，使用多智能体深度研究流程：5 个检索角度、18 个来源、90 条提取结论，对前 25 条通过三票小组进行对抗式验证；流程在验证和综合阶段触发会话限流，未完成的结论随后通过直接检查一手来源补充验证。

<a id="documents"></a>
## 文档

| 文件 | 内容 |
|---|---|
| [01-agent-memory-survey.md](01-agent-memory-survey.md) | 种子论文 arXiv 2512.13564：分类体系、写入策略陷阱和衰减机制 |
| [02-pi-extension-api.md](02-pi-extension-api.md) | Pi 扩展 API、生命周期事件、持久化原语、目录及作用域约定 |
| [03-prior-art.md](03-prior-art.md) | Claude Code 双层记忆、Codex/Cursor/Aider 约定、MemGPT/Mem0 经验 |
| [04-pi-api-details.md](04-pi-api-details.md) | 从完整 pi-mono 文档补齐 API 签名、压缩内部机制、打包和技能信息 |
| [05-agent-harness-memory-papers.md](05-agent-harness-memory-papers.md) | harness 管理记忆、检索控制、记忆基准和编排的 arXiv 阅读列表 |

<a id="synthesis--what-the-research-supports"></a>
## 综合结论：研究支持什么

1. **基于文件的 token 级 Markdown 记忆是合适形式。**文献中它占主导、研究充分，透明且可由用户编辑，也是扩展可实现的形式（01）。
2. **Pi 提供所需钩子：**`before_agent_start` 注入系统提示词记忆，`context` 在每次 LLM 调用前调整，`session_before_compact` 在有损压缩前写入，`session_shutdown` 最终刷新，`pi.registerTool` 注册显式 remember/recall 工具，`pi.registerCommand` 提供 `/memory` 命令（02）。
3. **跨会话存储由扩展负责。**Pi 内置 `pi.appendEntry` 和工具结果 details 仅在会话 JSONL 范围内持久化（02）。
4. **作用域约定：**全局 `~/.pi/agent/...`，项目 `.pi/...`；项目覆盖全局，项目资源受信任检查约束。项目记忆可放在仓库内 `.pi/memory/`（可与团队共享，但会提交智能体输出），或放在 `~/.pi/agent/` 下按项目路径区分的目录，如 Pi 的 sessions 和 Claude Code 的 `~/.claude/projects/<project>/memory/`（仅本机，不影响仓库）。这是当时最主要的未决设计问题（02、03）。
5. **最有先例支持的架构：**Claude Code 自动记忆采用小型、始终注入的 `MEMORY.md` 索引（有界，例如 200 行/25 KB），配合按需读取的主题文件；智能体写入的记忆与用户编写的 AGENTS.md 严格分开（03）。
6. **写入策略：**追加离散事实并去重，避免持续让 LLM 重写合并摘要，后者是早期 MemGPT/Mem0 已记录的语义漂移原因。需要剪枝时归档而非删除（01）。
7. **token 预算背景：**Pi 默认预留 16,384 token 用于响应，压缩后保留最近 20,000 token；注入记忆相对于这些预算应保持较小（02）。

<a id="resolution-of-open-questions-2026-06-11-after-gap-fill"></a>
## 未决问题的结论（2026-06-11，补充研究之后）

- **项目记忆位置：**用户决定使用仓库内 `.pi/memory/`，可与团队共享，遵循 `.pi/` 约定并受信任门控。
- **ExtensionAPI 签名：**已根据完整 pi-mono 文档记录在 `04-pi-api-details.md`。
- **技能：**Pi 实现 agentskills.io 标准；技能是静态、按需读取的能力文档，不是可写存储，不适合作为记忆载体（04）。
- **打包：**以 Pi 包交付，使用 package.json 中的 pi 清单及 pi-package 关键字；支持 `pi install git:`/`npm:`，加 `-l` 为项目本地安装（04）。
- **召回：**始终注入有上限的索引，主题文件由模型用内置 read 按需读取；v1 无需单独搜索工具。
- **现有方案缺口：**`03-prior-art.md` 已覆盖 Codex、Cursor、Aider 官方文档。

形成的设计见[设计说明](../design.md)。

<a id="verification-caveat"></a>
## 验证说明

流程的综合阶段及约 15 个验证智能体因会话限流失败，提示“resets 10pm UTC”。四条被标记为 killed 的 Pi API 结论，是因弃权而非反证被淘汰；随后直接读取 [pi-mono docs/extensions.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)，四条均得到确认，并在研究 02 中标为 **[doc-confirmed]**。
