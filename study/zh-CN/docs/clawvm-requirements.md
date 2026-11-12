> 中文阅读版；原文路径：`docs/clawvm-requirements.md` · [英文原文](../../../docs/clawvm-requirements.md) · [阅读索引](../INDEX.md)
> 对应提交：`4fc989087b473aeeb6923f904fe7dba475345a73` · 原文 SHA-256：`9ff84a2ae36a36cb10b01a02a3c9cd8b1f2bb88b696aff33f2713245308652b6`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="requirements-clawvm-style-memory-management-for-pi"></a>
# 需求：面向 Pi 的 ClawVM 风格记忆管理

状态：未来 `pi-memory`/Pi 集成的需求草案。依据 ClawVM 论文及[相关阅读列表](research/05-agent-harness-memory-papers.md)，不表示所有要求都必须纳入 pi-memory v1。

<a id="1-purpose"></a>
## 1. 目的

定义在 Pi 中集成 **harness 管理的虚拟记忆**的要求：将持久智能体状态建模为具有最低保真度不变量的类型化页面；在 token 预算内选入提示词；在生命周期边界持久提交；以明确的故障及原因码审计。

从简单、有上限的 Markdown 注入，演进为可强制保证以下属性的记忆层：

- 重要状态跨越压缩、重置、重载和会话边界而保留。
- 捕获和召回由 harness 策略决定，不是模型的可选行为。
- 记忆写入经过校验、有明确作用域且不破坏已有数据。
- 召回和驱逐决策可观测、可回放。

<a id="2-terminology"></a>
## 2. 术语

| 术语 | 含义 |
|---|---|
| 页面 Page | 具有类型的智能体状态单元，作为整体被选择、驱逐、召回和回写。 |
| 页表 Page table | 页面、元数据、表示形式、脏状态、作用域和来源的持久索引。 |
| 表示 Representation | 页面可直接放入提示词的形式：full、compressed、structured 或 pointer。 |
| 最低保真度 | 仍能满足页面不变量的最低表示级别。 |
| 常驻集 | 为下一次模型调用选中的页面及其表示。 |
| 脏页 | 已有更新但尚未提交到持久存储的页面。 |
| 生命周期边界 | 上下文或扩展状态可能被销毁或改写的 Pi 事件：压缩、关闭、新会话、重载、切换、分叉、重置。 |
| 故障 Fault | 可观测的记忆管理失败或压力信号，带原因码记录。 |

<a id="3-requirement-levels"></a>
## 3. 要求级别

- **MUST（必须）：**ClawVM 风格实现的必要要求。
- **SHOULD（应当）：**强烈推荐，可在记录原因后延期。
- **MAY（可以）：**可选扩展点。

<a id="4-scope"></a>
## 4. 范围

<a id="in-scope"></a>
### 范围内

- 使用 Pi 生命周期钩子的扩展或 harness 集成。
- 全局与项目记忆作用域。
- 与现有 pi-memory Markdown 存储兼容。
- 类型化页面元数据和确定性提示词组装。
- 生命周期回写、校验、审计日志及故障报告。
- 记忆策略行为的单元和回放测试。

<a id="out-of-scope-for-the-first-implementation"></a>
### 首次实现不包含

- 模型训练或微调。
- 将向量数据库作为强制依赖。
- 用户不可检查的隐藏记忆。
- 未经归档自动删除用户或团队可见记忆。
- 替换用户编写的 AGENTS.md/CLAUDE.md 指令。

<a id="5-core-requirements-from-clawvm"></a>
## 5. 来自 ClawVM 的核心要求

| ClawVM 要求 | Pi 集成要求 |
|---|---|
| 不变量跨越破坏性边界 | 必须在压缩、重载、重置和会话重启后确定性恢复关键页面。 |
| 捕获与召回是策略 | 扩展/harness 必须决定指定状态何时捕获、何时召回，不得仅依赖模型记得搜索或写入。 |
| 持久性覆盖完整生命周期 | 在可能销毁唯一副本的生命周期边界之前，必须提交脏页或明确拒绝。 |
| 回写经过校验且非破坏性 | 写入必须检查 schema、作用域和来源，并保证追加/合并安全。 |
| 召回可观测 | 必须用原因码区分无匹配、拒绝、不可用、格式错误和后端错误。 |
| 驱逐考虑成本 | 页面选择应考虑重建已丢弃状态的成本，包括重复工具或文件操作。 |

<a id="6-storage-and-compatibility-requirements"></a>
## 6. 存储与兼容性要求

<a id="61-existing-markdown-memory"></a>
### 6.1 现有 Markdown 记忆

- 必须兼容现有 pi-memory 存储：全局 `~/.pi/agent/memory/`，项目 `<repo>/.pi/memory/`。
- MEMORY.md 必须保持人类可读、用户可编辑。
- 主题文件必须仍是可由普通 Pi 文件工具读取的 Markdown。
- 扩展不得写入 AGENTS.md、CLAUDE.md 或其他用户编写的指令文件。

<a id="62-machine-readable-sidecars"></a>
### 6.2 机器可读辅助文件

ClawVM 风格实现应为每个作用域增加机器可读辅助文件，例如：

```text
.pi/memory/
├── MEMORY.md
├── <topic>.md
├── archive/
├── page-table.jsonl        # typed page metadata and representation pointers
├── writeback-journal.jsonl # staged/validated/rejected commits
└── traces/
    └── YYYY-MM-DD.jsonl    # prompt assembly and fault decisions
```

其中 page-table 保存类型化页面元数据及表示指针，writeback-journal 记录暂存、校验或拒绝的提交，traces 保存提示词组装和故障决策。

- 辅助文件应尽可能确定、逐行组织且便于比较差异。
- 必须能通过重建或校验元数据，容忍用户手工编辑 Markdown。
- 项目辅助文件必须可安全提交：不含秘密，不含隐藏本地路径，除非明确限定为本地作用域。
- 损坏时必须平稳降级为仅 Markdown 行为，同时产生可观测故障。

<a id="7-page-model-requirements"></a>
## 7. 页面模型要求

每个页面至少必须包含：

```ts
interface MemoryPage {
  id: string;                       // stable across sessions
  type: PageType;
  scope: "global" | "project" | "session" | "local";
  title: string;
  provenance: Provenance[];
  minFidelity: "pointer" | "structured" | "compressed" | "full";
  representations: Partial<Record<Fidelity, PageRepresentation>>;
  pins: PinClass[];
  tokenEstimate: Partial<Record<Fidelity, number>>;
  recomputeCost?: number;
  dirty: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

<a id="71-page-types"></a>
### 7.1 页面类型

至少支持以下类型：

| 类型 | 示例 | 最低保真度建议 |
|---|---|---|
| bootstrap_policy | 记忆规则、必需协议、压缩后启动指令 | structured 或 full |
| constraint | 用户或项目硬约束、安全规则、始终/禁止要求 | structured |
| plan | 活跃目标、当前步骤、未解决 TODO | 活跃时 structured |
| preference | 用户偏好、项目约定 | pointer 或 structured |
| evidence | 工具输出、文件读取、命令结果、引用来源 | 可解析时 pointer，否则 structured |
| conversation_segment | 对话记录范围或摘要 | pointer |
| decision | 长期决策及理由 | structured |
| procedure | 可复用工作流、构建/测试协议、检查表 | structured |

可以增加领域专用页面类型。

<a id="72-provenance"></a>
### 7.2 来源

页面必须记录足以审计和重建的来源信息：来源种类（用户消息、助手消息、工具调用/结果、文件路径、URL、手工编辑、导入记忆）；可用时的时间戳和会话 ID；作用域和信任上下文；文件路径、行范围、会话条目 ID 或 URL 等来源指针。

<a id="8-representation-requirements"></a>
## 8. 表示形式要求

每个页面应支持最多四种表示：

| 保真度 | 描述 | 要求 |
|---|---|---|
| full | 原文或近似原文 | token 允许时，约束和证据应具有此表示。 |
| compressed | 有损但人类可读的摘要 | 应保留引用和来源指针。 |
| structured | 足以满足不变量的类型化字段 | 固定约束、活跃计划、决策和流程必须具有此表示。 |
| pointer | 可解析句柄及最少元数据 | 必须足以恢复或检查完整状态。 |

表示应在页面创建或更新时生成，不应在 token 压力下组装提示词时才生成。提示词组装不得要求调用 LLM。

<a id="9-prompt-assembly-and-residency-requirements"></a>
## 9. 提示词组装与驻留要求

<a id="91-hooking-into-pi"></a>
### 9.1 接入 Pi

- 必须通过提示词或上下文钩子注入记忆，不得破坏性修改用户消息。
- before_agent_start 可以提供稳定的基线记忆或启动文本。
- 页面选择依赖当前消息、工具可用性或 token 压力时，应使用 context 进行逐调用常驻集选择。
- 可用时，应使用 ctx.getContextUsage() 或等价上下文元数据确定记忆预算。

<a id="92-budgeting"></a>
### 9.2 预算

- 必须为系统提示词、工具 schema、用户内容和模型输出预留空间。
- 记忆预算必须由配置限定上限。
- 最低必需常驻集放不下时，必须记录 invariant_pressure 或 pinned_invariant_miss，不得静默丢弃固定状态。

<a id="93-selection-policy"></a>
### 9.3 选择策略

相同输入必须产生确定的提示词组装结果。算法应遵循：

1. 按最低保真度装入全部硬固定页。
2. 按最低保真度装入本轮显式要求的页面。
3. 按每个额外 token 带来的效用排列可选升级。
4. 保持不变量且不超预算地执行升级。
5. 输出包含已选页、遗漏页、token 估算和原因的决策轨迹。

效用应考虑固定类别、页面类型、本轮需求、近期程度、作用域具体程度、脏页/活跃状态、重建成本及检索置信度。

<a id="10-capture-and-writeback-requirements"></a>
## 10. 捕获与回写要求

<a id="101-capture-triggers"></a>
### 10.1 捕获触发点

必须支持用户或模型显式请求写入记忆；也应在以下 Pi 生命周期点捕获或暂存候选更新：

| 事件 | 要求 |
|---|---|
| session_before_compact | 应从即将被摘要或丢弃的消息暂存记忆更新。 |
| session_compact | 应确认压缩后必需启动页和约束页仍可用。 |
| session_before_switch | 应在切换会话前刷新脏页。 |
| session_before_fork | 应标记哪些脏页/会话页随新分支分叉。 |
| session_shutdown | 必须尝试最终脏页提交。 |
| session_start | 必须重载或重建页表，并报告损坏或缺失的存储。 |

<a id="102-writeback-protocol"></a>
### 10.2 回写协议

提交前必须先暂存并校验：

1. **暂存**类型化操作：append、merge、set_with_version、archive 或 reject。
2. **校验** schema、作用域、信任、来源、无秘密策略和非破坏性语义。
3. 按确定性合并规则**提交**。
4. 将接受及拒绝的更新和原因码写入**日志**。

除非用户明确授权，必须拒绝对记忆存储进行破坏性的整文件覆盖。

<a id="103-dirty-page-handling"></a>
### 10.3 脏页处理

- 不得静默丢弃脏页。
- 生命周期关闭时，每个脏页必须处于以下状态之一：已提交、已归档、带原因拒绝，或仍脏且附有错误故障。
- 被拒绝的更新必须仍可从日志中检查。

<a id="11-recall-requirements"></a>
## 11. 召回要求

召回 API 和内部查找必须返回结构化结果：

```ts
interface RecallResult {
  status: "ok" | "no_match" | "denied" | "malformed" | "unavailable" | "backend_error";
  pages: MemoryPage[];
  reason: string;
  traceId: string;
}
```

- 空召回不得含义不明。
- 作用域拒绝必须能与无匹配区分。
- 后端/文件错误必须能通过 `/memory` 状态或日志让智能体或用户看见。
- ctx.isProjectTrusted() 为 false 时，必须禁用项目记忆召回。

<a id="12-fault-and-audit-requirements"></a>
## 12. 故障与审计要求

至少必须记录以下可观测故障：

| 故障 | 含义 |
|---|---|
| pinned_invariant_miss | 必需页面缺失或低于最低保真度。 |
| post_compaction_bootstrap_loss | 压缩后必需启动/策略页缺失。 |
| flush_miss | 破坏性边界前脏页未提交。 |
| silent_recall | 后端拒绝或报错，但查找结果否则会表现为空。 |
| writeback_rejected | 暂存写入未通过校验。 |
| sidecar_corrupt | 页表、日志或轨迹无法解析或校验。 |
| duplicate_tool_signature | 先前证据页本应可用，却重复执行等价的高成本工具调用。 |
| refetch | 驱逐后不得不重新获取文件、URL 或工具证据。 |
| invariant_pressure | 最低常驻集超过 token 预算。 |

决策轨迹应包含：轨迹 ID、会话 ID、事件名、时间戳；记忆预算和 token 估算；选中页面 ID 和保真度；遗漏页面 ID 及原因；生命周期回写决策；故障 ID 和原因码。

<a id="13-commands-and-user-surface"></a>
## 13. 命令与用户入口

`/memory` 必须继续显示当前记忆状态。ClawVM 风格实现应扩展为：

- `/memory pages`：列出页面、类型、作用域、保真度、脏状态和 token 估算。
- `/memory faults`：显示最近故障和被拒绝的写入。
- `/memory trace <id>`：检查提示词组装或回写轨迹。
- `/memory verify`：对照 Markdown 重建或校验辅助文件。
- `/memory flush`：手工提交或检查脏页。
- `/memory off|on`：保留现有注入开关行为。

全部命令输出必须能在非 TUI 模式下平稳降级。

<a id="14-configuration-requirements"></a>
## 14. 配置要求

配置应通过现有记忆 config.json 支持按作用域覆盖。推荐键：

```json
{
  "enabled": true,
  "maxInjectLines": 200,
  "maxInjectBytes": 8192,
  "pageTableEnabled": true,
  "maxMemoryTokens": 4096,
  "traceEnabled": true,
  "captureOnCompact": true,
  "captureOnShutdown": true,
  "strictWriteback": true
}
```

- 无效配置必须被忽略并产生警告或故障，不得使启动崩溃。
- 项目配置只能在可信项目中生效。
- 安全默认值必须避免将秘密写入项目记忆。

<a id="15-security-privacy-and-trust-requirements"></a>
## 15. 安全、隐私与信任要求

- 项目记忆必须保持信任门控。
- 必须指示智能体不将秘密、凭据、私有 token 或敏感个人数据写入项目记忆。
- 来源信息应避免将本机绝对路径泄露到已提交项目记忆；应使用仓库相对路径，或仅在有意共享时保留。
- 全局记忆可以包含用户偏好，但仍应避免秘密。
- 项目作用域内被拒绝或暂存的日志条目，必须可安全提交，否则放在仅本地的区域。

<a id="16-concurrency-and-integrity-requirements"></a>
## 16. 并发与完整性要求

- 写入必须逐文件原子化。
- 修改文件的扩展工具必须使用 Pi 文件修改队列或等价串行化机制。
- 应尽可能用版本或校验和检测跨会话写入冲突。
- 必须容忍两次提示之间的手工编辑。
- 应能从 Markdown 和日志重建页面元数据。

<a id="17-performance-requirements"></a>
## 17. 性能要求

- 提示词组装必须确定且在本地完成；热路径不调用网络或模型。
- 页面选择应对候选页数量具有线性或近线性复杂度。
- 辅助文件解析应按 mtime/大小缓存，与现有 MEMORY.md 缓存方式一致。
- 对典型记忆存储，新增组装开销应以低于一毫秒为目标。
- 轨迹日志必须有界或支持轮转。

<a id="18-testing-and-acceptance-criteria"></a>
## 18. 测试与验收标准

<a id="181-unit-tests"></a>
### 18.1 单元测试

- 页面 schema 校验。
- 保真度排序及不变量检查。
- 确定性常驻集选择。
- token 预算压力行为。
- 回写校验和拒绝。
- 召回原因码。
- 配置合并和信任门控。
- 从 Markdown 重建辅助文件。

<a id="182-lifecycle-tests"></a>
### 18.2 生命周期测试

模拟 Pi 事件并断言：脏页在 session_shutdown 前被提交或拒绝；压缩不丢失启动/约束页；不可信项目不加载项目记忆；`/memory off` 停止注入但不删除记忆；辅助文件损坏时回退到 Markdown 并显示故障。

<a id="183-replay-tests"></a>
### 18.3 回放测试

为以下场景构造确定性轨迹：大量证据的工具使用；中断与会话切换；脏写后重置/重载；多会话冲突；带固定页的紧张 token 预算。

验收目标：最低必需常驻集能放入配置预算时，轨迹中没有策略可控故障。

<a id="19-suggested-implementation-phases"></a>
## 19. 建议实现阶段

<a id="phase-1--page-metadata-without-changing-ux"></a>
### 阶段 1：不改变用户体验的页面元数据

- 为现有 MEMORY.md 条目增加页表辅助文件。
- 增加页面 ID、类型、作用域、来源和脏状态。
- 增加 `/memory pages` 和 `/memory verify`。
- 保留当前注入的 Markdown 块。

<a id="phase-2--deterministic-resident-set-selection"></a>
### 阶段 2：确定性常驻集选择

- 在 maxMemoryTokens 内逐调用选择页面。
- 支持 structured/pointer 表示。
- 输出决策轨迹和不变量压力故障。

<a id="phase-3--lifecycle-writeback"></a>
### 阶段 3：生命周期回写

- 在压缩或关闭时暂存更新。
- 校验追加/合并操作。
- 增加回写日志及拒绝更新报告。

<a id="phase-4--recall-controller-and-cost-aware-eviction"></a>
### 阶段 4：召回控制器与考虑成本的驱逐

- 增加带原因码的召回 API。
- 跟踪证据/工具调用页及重复/重新获取故障。
- 将重建成本纳入选择。

<a id="phase-5--evaluation-harness"></a>
### 阶段 5：评估框架

- 增加轨迹回放夹具及基于预期正确结果的比较。
- 测量 token 用量、策略可控故障和提示词组装开销。

<a id="20-open-questions"></a>
## 20. 未决问题

1. 项目辅助文件是否默认提交，还是部分轨迹/日志仅保留本地？
2. session 是否应成为一等页面作用域，还是仅会话状态继续放在 Pi 会话 JSONL？
3. 现有 Markdown 列表项最先支持哪种结构化表示？
4. 压缩时捕获应先提出更新供智能体批准，还是自动提交已校验事实？
5. 哪些职责属于 pi-memory 包，哪些属于 Pi 核心提示词组装？
