> 中文阅读版；原文路径：`docs/research/01-agent-memory-survey.md` · [英文原文](../../../../docs/research/01-agent-memory-survey.md) · [阅读索引](../../INDEX.md)
> 对应提交：`f648576f1912a64c9be754fe9e3882fdd1c24da8` · 原文 SHA-256：`e80fed29999b38ec0b77c8c875a350bf9dc27b3ba8d40291e360c261e4ece95b`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="agent-memory-research-arxiv-251213564-memory-in-the-age-of-ai-agents-a-survey"></a>
# 智能体记忆研究：arXiv 2512.13564《AI 智能体时代的记忆：综述》

> 原文状态：下列结论均已针对所引一手来源通过对抗式验证，验证投票为 3–0 或 2–0，无反驳。该状态属于原研究记录，本次仅翻译。

<a id="what-the-paper-is"></a>
## 论文性质

- **这是综述与分类论文，不是系统论文。**它没有提出自己的新记忆架构，也没有报告原创基准数据。对本项目的价值在于分类体系及对现有系统的刻画。[论文摘要](https://arxiv.org/abs/2512.13564)
  > 译文：本工作旨在提供智能体记忆研究的最新全景。首先界定智能体记忆的范围，并将其与 LLM 记忆、检索增强生成（RAG）和上下文工程等相关概念区分。
- 论文题为 Memory in the Age of AI Agents: A Survey，作者 Yuyang Hu 及另外 46 位合作者；v1 发布于 2025-12-15，v2 于 2026-01-13。[PDF](https://arxiv.org/pdf/2512.13564)
- 官方配套论文列表为 GitHub 上的 [Shichun-Liu/Agent-Memory-Paper-List](https://github.com/Shichun-Liu/Agent-Memory-Paper-List)。

<a id="the-three-axis-taxonomy"></a>
## 三轴分类体系

| 维度 | 类别 | 含义 |
|---|---|---|
| **形式**：记忆由什么承载 | token 级、参数化、潜在状态 | 显式离散文本单元、模型权重、隐藏状态 |
| **功能**：记忆用于什么 | 事实性、经验性、工作记忆 | 知识、习得技能或洞见、活跃上下文管理 |
| **动态过程**：记忆如何演化 | 形成、演化、检索 | 提取 → 整合与遗忘 → 访问策略 |

> 译文：从形式看，智能体记忆主要有 token 级、参数化和潜在记忆三种实现；从功能看，进一步区分事实性、经验性和工作记忆；从动态过程看，分析记忆随时间如何形成、演化和检索。

<a id="findings-directly-relevant-to-a-pi-memory-extension"></a>
## 与 Pi 记忆扩展直接相关的发现

<a id="1-token-level-file-based-memory-is-the-dominant-best-studied-form"></a>
### 1. token 级、基于文件的记忆占主导且研究最充分

> 译文：token 级记忆将信息保存为持久、离散、可从外部访问和检查的单元。由于这些单元是显式的，通常透明、容易编辑且便于解释。它也是最常见、现有研究最多的记忆形式。

**启示：**基于 Markdown 文件的设计，与 CLAUDE.md/AGENTS.md 或 Claude Code 自动记忆目录类似，得到文献支持，并天然具备透明性和可编辑性。扩展也只能采用 token 级形式，因为无法修改模型权重或隐藏状态。

<a id="2-naive-llm-summary-merging-on-write-drifts-over-time"></a>
### 2. 写入时朴素地用 LLM 合并摘要会逐渐漂移

> 译文：早期 MemGPT（Packer 等，2023a）和 Mem0（Chhikara 等，2025）在适当时机直接将新片段与现有摘要合并，仅依赖 LLM 自身的摘要能力；但受模型能力限制，经常出现不一致或语义漂移。

后续系统通过外部冗余过滤器（例如基于 DeBERTa）或经强化学习训练的摘要器缓解此问题，例如使用 PPO 的 Mem1 和使用 GRPO 的 MemAgent。

**启示：**优先采用**离散事实的追加与去重**，避免持续重写一个合并摘要块。确需合并或重写时，应降低频率并保留离散来源记录。

<a id="3-forgettingdecay-mechanisms-come-in-three-named-families"></a>
### 3. 遗忘与衰减有三类机制

> 译文：遗忘机制可分为基于时间、基于频率和由重要性驱动的遗忘，分别对应创建时间、检索活动和综合语义价值评估。

- **时间：**MemGPT 在上下文溢出时驱逐最早消息；MAICC 对权重做软衰减。
- **频率：**XMem 使用 LFU；MemOS 使用带归档的 LRU，原文描述为“移除长期未使用条目，同时归档高度活跃条目”；KARMA 使用计数布隆过滤器。
- **重要性：**综合语义价值评估。

综述警告：**过于激进的剪枝会抹去罕见但关键的知识。**

**启示：**如果扩展确实需要剪枝，应优先归档到冷文件而非删除，并倾向保留低频却支撑关键行为的事实。

<a id="sources"></a>
## 来源

| URL | 质量 |
|---|---|
| https://arxiv.org/abs/2512.13564 | 一手来源 |
| https://arxiv.org/pdf/2512.13564 | 一手来源 |
| https://github.com/Shichun-Liu/Agent-Memory-Paper-List | 一手来源，官方配套列表 |
| https://huggingface.co/papers/2512.13564 | 二手来源 |
| https://www.alphaxiv.org/overview/2512.13564 | 二手来源 |
| https://arxiviq.substack.com/p/memory-in-the-age-of-ai-agents | 博客，未验证，仅作背景 |
