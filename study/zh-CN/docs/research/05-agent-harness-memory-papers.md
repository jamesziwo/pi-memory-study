> 中文阅读版；原文路径：`docs/research/05-agent-harness-memory-papers.md` · [英文原文](../../../../docs/research/05-agent-harness-memory-papers.md) · [阅读索引](../../INDEX.md)
> 对应提交：`f648576f1912a64c9be754fe9e3882fdd1c24da8` · 原文 SHA-256：`c3767d751dd3e45d9814ae3e9e0779399adc477842a9c670ab4b4c508021511c`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="agent-harness-memory-systems--arxiv-reading-list"></a>
# 智能体 Harness 记忆系统：arXiv 阅读列表

记录于 2026-06-13，来自聚焦**智能体 harness、记忆系统、生命周期持久性、检索控制和评估**的 arXiv/网络文献扫描。本页是研究主题索引，尚不是设计承诺。论文信息与时间均按历史原文保留，未在本次翻译中重新验证。

<a id="highest-priority-papers-for-pi-memory"></a>
## pi-memory 最优先的论文

| 优先级 | 论文 | 对项目的意义 |
|---:|---|---|
| 1 | [ClawVM: Harness-Managed Virtual Memory for Stateful Tool-Using LLM Agents](https://arxiv.org/abs/2604.10352) | 将 harness 视为记忆驻留、持久化、生命周期回写和可审计性的执行约束点；与从有上限 Markdown 注入进一步强化 pi-memory 最直接相关。 |
| 2 | [M$^\star$: Every Task Deserves Its Own Memory Harness](https://arxiv.org/abs/2604.11811) | 将记忆定义为任务专属的可执行 harness 程序，包含 schema、存储逻辑和工作流指令，可用于未来页面 schema 和任务自适应记忆策略。 |
| 3 | [Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers](https://arxiv.org/abs/2603.07670) | 以写入—管理—读取循环组织的综述，从时间作用域、表示载体和控制策略分类，适合作为术语基线。 |
| 4 | [Externalization in LLM Agents: A Unified Review of Memory, Skills, Protocols and Harness Engineering](https://arxiv.org/abs/2604.08224) | 将记忆、技能、协议和 harness 工程视为外部认知基础设施，有助于把 pi-memory 定位为 harness 基础设施。 |
| 5 | [EvoMemBench: Benchmarking Agent Memory from a Self-Evolving Perspective](https://arxiv.org/abs/2605.18421) | 评估维度包括单次过程内与跨过程记忆、知识导向与执行导向内容，可用于未来测试和基准。 |
| 6 | [EvoArena: Tracking Memory Evolution for Robust LLM Agents in Dynamic Environments](https://arxiv.org/abs/2606.13681) | 引入基于补丁的记忆演化历史，与仅追加记忆、更新溯源和避免破坏性重写有关。 |

<a id="retrieval-and-memory-control-papers"></a>
## 检索与记忆控制论文

| 论文 | 需要关注的主要思想 |
|---|---|
| [Beyond RAG for Agent Memory: Retrieval by Decoupling and Aggregation](https://arxiv.org/abs/2602.02007) | 智能体记忆是有界、连贯的信息流，而非通用语料库；检索应避免冗余 top-k 片段，并通过层级保留前置上下文。 |
| [Memory is Reconstructed, Not Retrieved: Graph Memory for LLM Agents](https://arxiv.org/abs/2606.06036) | 在关联的 Cue–Tag–Content 图上主动重建记忆，而非静态地先检索再推理。 |
| [TA-Mem: Tool-Augmented Autonomous Memory Retrieval for LLM in Long-Term Conversational QA](https://arxiv.org/abs/2603.09297) | 在多索引记忆上使用工具增强的检索智能体，自适应选择查找或检索工具。 |
| [MemR$^3$: Memory Retrieval via Reflective Reasoning for LLM Agents](https://arxiv.org/abs/2512.20237) | 检索—反思—回答闭环控制器，跟踪证据缺口，可作为带原因码召回的参考。 |
| [AdMem: Advanced Memory for Task-solving Agents](https://arxiv.org/abs/2606.06787) | 结合语义、情节和程序记忆，以及 actor/memory/critic 智能体和基于奖励的剪枝、合并。 |

<a id="harness-and-orchestration-papers-adjacent-to-memory"></a>
## 与记忆相邻的 Harness 和编排论文

| 论文 | 需要关注的主要思想 |
|---|---|
| [Natural-Language Agent Harnesses](https://arxiv.org/abs/2603.25723) | 将高层 harness 控制逻辑外化为可编辑自然语言，由共用运行时执行。 |
| [From Model Scaling to System Scaling: Scaling the Harness in Agentic AI](https://arxiv.org/abs/2605.26112) | 认为智能体进步依赖可审计、持久、模块化、可验证的 harness，强调上下文治理、可信记忆和动态技能路由。 |
| [Affordance Agent Harness: Verification-Gated Skill Orchestration](https://arxiv.org/abs/2605.00663) | 带证据存储、情节先验、路由器、验证器及成本控制的闭环运行时，可借鉴其编排模式。 |
| [Self-Healing Agentic Orchestrators for Reliable Tool-Augmented Large Language Model Systems](https://arxiv.org/abs/2606.01416) | 在编排层从超时、参数格式错误、过时上下文、矛盾证据、重试循环和未验证输出中恢复，以提高可靠性。 |
| [The Evolution of Tool Use in LLM Agents: From Single-Tool Call to Multi-Tool Orchestration](https://arxiv.org/abs/2603.22862) | 广泛的工具编排综述，为将记忆视为长轨迹工具使用的一部分提供背景。 |
| [Observability-Driven Automatic Evolution of Coding-Agent Harnesses](https://arxiv.org/abs/2604.25850) | 根据可观测性信号演化 harness，与记忆故障日志及未来自我改进循环相关。 |

<a id="clawvm-requirements-to-preserve-for-design-work"></a>
## 设计中应保留的 ClawVM 要求

当 pi-memory 从简单 Markdown 注入演进为生命周期管理记忆时，ClawVM 的六项要求尤其相关：

1. **不变量跨越破坏性边界：**关键指令、约束、活跃计划和策略必须跨压缩、重置、重载保留。
2. **捕获和召回由策略决定：**harness 决定指定状态何时必须捕获和召回。
3. **持久性覆盖完整生命周期：**压缩、重置、保存、会话结束或任何可能销毁唯一副本的边界之前，提交脏状态。
4. **回写经过校验且不破坏数据：**更新需检查 schema、限定作用域、记录来源，并安全合并或追加。
5. **召回可观测：**区分无匹配、作用域拒绝、后端错误、查询格式错误和存储不可用，避免静默返回空。
6. **驱逐考虑成本：**保留决策考虑重建已丢弃状态的成本，包括重复工具调用。

<a id="design-implications-for-pi-memory"></a>
## 对 pi-memory 设计的启示

- 原研究当时认为 pi-memory 已实现具有全局/项目作用域和注入上限的文件持久 token 级记忆，但尚未实现类型化页面、保真度不变量、脏页跟踪、经过校验的回写、召回原因码或故障轨迹。此为历史状态，当前实现需对照源码。
- 受 ClawVM 启发的路线图可先在 MEMORY.md/主题文件之上增加轻量页表，再增加更复杂的检索。
- 最直接且低风险的改进包括：追加/合并约束、保存事实的显式作用域和来源元数据、生命周期刷新钩子，以及记忆读写的审计和故障日志。
