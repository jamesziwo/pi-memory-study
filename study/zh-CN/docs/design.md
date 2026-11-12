> 中文阅读版；原文路径：`docs/design.md` · [英文原文](../../../docs/design.md) · [阅读索引](../INDEX.md)
> 对应提交：`8264fdabc7f6a9620daec04082012c2e6150c0f7` · 原文 SHA-256：`8c8401a11a15b8a868fb738b64ce8f1656a3110f54cc29d38f6c21551e149a51`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="pi-memory--design"></a>
# pi-memory — 设计

这是一个 Pi 扩展，为智能体提供跨会话的**持久化、基于文件的记忆**，分为全局（用户）作用域和**保存在仓库中**的项目作用域。使用 TypeScript，基于 Pi 的 `ExtensionAPI` 编写。

设计依据来自 `docs/research/`。原文声明所有引用事实均已对照一手来源验证，溯源信息见[研究索引](research/README.md)。本译文保留原文陈述，不代表重新进行了外部事实核验。

<a id="1-goals"></a>
## 1. 目标

- 智能体跨会话积累长期有效的经验，包括纠正、构建命令、决策和偏好，无需用户手工记录。
- 记忆使用纯 Markdown，透明、可编辑、可比较差异；这是文献认为占主导且最实用的 token 级记忆形式（研究 01）。
- 严格遵循 Pi 约定：全局资源位于 `~/.pi/agent/`，项目资源位于 `.pi/`；仅信任项目时采用项目资源，项目配置补充或覆盖全局配置（研究 02）。
- 每次会话的 token 成本有界且可预测。
- 与用户编写的 `AGENTS.md` 并存，绝不替换它或向其中写入记忆。

**v1 不包含：**向量或嵌入搜索、自动由 LLM 合并摘要（研究 01 记录了语义漂移问题）、自动衰减、跨机器同步、MCP 服务器。

<a id="2-storage-layout"></a>
## 2. 存储布局

采用两个作用域，与 Pi 设置作用域对应：全局 `~/.pi/agent/settings.json` 和项目 `.pi/settings.json`。

```
~/.pi/agent/memory/            # GLOBAL: this user, all projects, machine-local
├── MEMORY.md                  # index — injected every session (capped)
├── <topic>.md                 # detail files — read on demand
└── archive/                   # stale content moved here, never deleted

<repo>/.pi/memory/             # PROJECT: in-repo, committed, shared with the team
├── MEMORY.md
├── <topic>.md
└── archive/
```

设计选择及理由：

- **索引加主题文件**（Claude Code 自动记忆模式，研究 03）：`MEMORY.md` 是会话开始时加载的简明索引；主题文件存储细节，由 Pi 内置 `read` 工具按需读取。这样限制了注入 token，而总记忆容量不受索引上限限制。
- **项目记忆存入仓库**（用户决定）。接受并说明其后果：记忆通过版本控制与团队共享，会出现在 diff/PR 中，写入时需考虑这些读者。注入前言会提醒智能体这一点。希望保持私有的用户可将 `.pi/memory/` 加入 gitignore。
- **归档优于删除**：研究 01 指出，激进剪枝会抹去低频但关键的知识。过时内容移入从不注入的 `archive/`。
- 目录在**首次写入时才创建**，启动时不创建；在任意目录运行 Pi 不应到处留下 `.pi/memory/`。
- **条目格式**：`MEMORY.md` 以 `##` 主题标题分组，每条事实一个列表项。超出单行容量的事实移入主题文件，留下单行指针，例如 `- [Build quirks](build.md) — sccache breaks -Werror`。v1 不使用 frontmatter 或 schema；重点是离散、明确的知识单元，结构优先服务人类阅读。

<a id="3-read-path-injection"></a>
## 3. 读取路径：注入

使用 **`before_agent_start`** 钩子。每次用户提示都会触发，系统提示词变更可在多个扩展间串联（研究 04）。

```ts
pi.on("before_agent_start", async (event, ctx) => {
  const block = buildMemoryBlock(ctx); // global index + project index (if trusted), capped
  if (!block) return;
  return { systemPrompt: event.systemPrompt + "\n\n" + block };
});
```

- **顺序：**前言 → 全局索引 → 项目索引。更具体的作用域放在后面，符合 Pi 的项目覆盖全局语义及 Claude Code 的加载顺序（研究 02、03）。
- **上限：**每个作用域取 `MEMORY.md` 前 **200 行或 8 KiB**，先达到哪个就按哪个截断。作为比较，Claude Code 的单作用域上限为 200 行/25 KB，Codex 的全部指令文件上限为 32 KiB（研究 03）。超出部分不注入；`/memory` 会警告超限文件。
- **信任：**仅当 `ctx.isProjectTrusted()` 返回 true 时读取项目索引（研究 04）。不可信目录只使用全局记忆，前言完全省略项目部分。
- 每次 `before_agent_start` 都重新读取文件，并使用 mtime 缓存；用户编辑在下次提示时生效，无需 `/reload`。文件未变时生成块逐字节稳定，有利于提示词缓存（Aider 的经验，研究 03）。
- 通过 `systemPrompt` 注入，使记忆不进入消息日志，并自动跨越上下文压缩：每轮重新附加。可与 Claude Code 在 `/compact` 后重新注入 CLAUDE.md 对照（研究 03）。

<a id="injected-block-sketch"></a>
### 注入块示意

下方保留原始 Markdown 提示词示例。其含义是：说明全局与项目记忆路径、按需读取主题文件；用 `edit`/`write` 保存长期事实；先查索引去重，删除错误条目、归档仅仅过时的内容，保持索引简短；项目记忆面向团队，不写秘密，也不重复仓库已有信息。此示例仅供阅读，不是在当前会话中执行的指令。

```markdown
## Persistent memory

You have file-based persistent memory, separate from AGENTS.md (which is user-authored — never write memory there).

- Global memory (this user, all projects): ~/.pi/agent/memory/
- Project memory (committed to the repo, shared with the team): .pi/memory/

Each scope has a MEMORY.md index (shown below) plus topic files you can read with `read` when relevant.

When you learn something durable — a correction from the user, a build/test command, a
non-obvious constraint, a decision and its rationale — save it by editing the appropriate
MEMORY.md or topic file with `edit`/`write`. Rules:
- Check the index first: update an existing entry rather than adding a duplicate.
- Delete entries that turn out to be wrong; move merely-stale content to archive/.
- Keep MEMORY.md a concise index (one line per fact); put detail in topic files.
- Project memory is read by your teammates: factual, professional, no secrets.
- Don't save what the repo already records (code, git history, AGENTS.md).

### Global MEMORY.md
<contents…>

### Project MEMORY.md  (.pi/memory/MEMORY.md)
<contents…>
```

<a id="4-write-path-built-in-file-tools-not-a-custom-tool"></a>
## 4. 写入路径：内置文件工具

智能体在上述前言引导下，使用 Pi 内置 `edit`/`write` 写入记忆。v1 不增加自定义 `memory` 工具。

理由：

- 项目记忆在仓库内，全局记忆有稳定绝对路径；内置工具已支持两者，并提供 diff 渲染、并行写入保护（内部 `withFileMutationQueue`）和完整工具日志可见性。
- 这也是 Claude Code 已采用的方式（研究 03）：智能体用标准文件工具维护自己的 Markdown。
- 结构化工具会增加 schema、渲染、会话恢复兼容性（`prepareArguments`）及截断义务（研究 04），却没有 v1 收益。若前言引导不可靠，v2 再考虑。

**追加离散事实，不做摘要合并：**前言不会要求模型从头重写整个索引。不断由 LLM 重新摘要，是早期 MemGPT/Mem0 已记录的漂移问题（研究 01）。编辑应保持局部：新增或修正一个列表项，或将一节移入归档。

<a id="5-user-surface-memory-command"></a>
## 5. 用户入口：`/memory` 命令

通过 `pi.registerCommand("memory", …)` 注册，在 TUI 和 RPC 中均可使用，对话框由 `ctx.hasUI` 保护。

- `/memory`：显示两个作用域的文件列表、各文件大小、注入与截断字节数、页表辅助文件状态、信任状态及可供用户打开的绝对路径。
- `/memory pages`：预览可从当前 `MEMORY.md` 派生的 ClawVM 风格类型化页面，并显示 `page-table.jsonl` 是否存在及通过校验。
- `/memory verify`：从当前 `MEMORY.md` 重建 `page-table.jsonl`。这是第一层轻量 ClawVM 风格元数据，Markdown 仍是权威来源。
- `/memory remember global|project <text>`：在 `writeback-journal.jsonl` 中暂存仅追加的记忆写入。
- `/memory flush`：校验并提交待处理回写，重建页表。
- `/memory faults`、`/memory traces`、`/memory trace <id>`：查看驻留或回写故障及决策轨迹。
- `/memory off | on`：切换当前会话的注入开关，仅修改内存标志，不写文件。
- 另注册 `pi.registerFlag("no-memory", { type: "boolean", default: false })`，允许启动时禁用注入。

其余操作刻意留给用户在编辑器中管理文件。

<a id="6-lifecycle--edge-cases"></a>
## 6. 生命周期与边界情况

| 问题 | 处理 |
|---|---|
| 会话分叉、`/resume`、`/new`、`/reload` | 扩展在提示之间无状态，每次 `before_agent_start` 重新读文件，无需在 `session_start` 重建。不使用 `pi.appendEntry` 保存状态，因为会话级持久化不适合作为跨会话记忆层（研究 02）。 |
| 上下文压缩 | v1 不拦截。每轮重新附加到系统提示词，因此记忆可跨越压缩；观察 `session_before_compact` 可作为 v2 写入触发器，见路线图。 |
| 不可信项目 | 项目作用域完全不启用：不读取、不在前言提及，也不创建。 |
| `print`、`rpc`、`json` 模式 | 注入行为一致，不依赖 UI；`/memory` 通过 `ctx.hasUI` 平稳降级。 |
| 文件缺失或为空 | 全局和项目均无记忆时，仅注入前言，让智能体知道可以保存记忆；两个上限均可配置。 |
| 索引超限 | 注入时硬截断；`/memory` 显示警告；前言要求索引保持简洁。 |
| 并发 Pi 会话 | 内置文件工具在单会话内串行化每个文件的修改；接受跨会话竞争：普通文件最后写入者生效，项目作用域冲突由 Git 解决。 |

<a id="7-configuration"></a>
## 7. 配置

每个记忆目录可有 `config.json`，项目键覆盖全局键，与 Pi 设置合并语义一致。

```json
{
  "enabled": true,
  "maxInjectLines": 200,
  "maxInjectBytes": 8192,
  "pageTableInjection": true,
  "maxMemoryTokens": 4096,
  "traceEnabled": true,
  "strictWriteback": true
}
```

不依赖 Pi 的 `settings.json`，因为扩展没有文档化 API 读取任意设置键。

<a id="8-repository--packaging"></a>
## 8. 仓库与打包

以 **Pi 包**交付（研究 04）：

```
pi-memory/
├── package.json
├── src/
│   ├── index.ts            # default-export factory: wires events, command, flag, lifecycle flush
│   ├── storage.ts          # scope resolution, config, capped reads, mtime cache
│   ├── inject.ts           # legacy preamble + capped block assembly
│   ├── resident-inject.ts  # ClawVM-style resident-set prompt rendering
│   ├── memory-domain.ts    # page/fidelity/fault domain vocabulary
│   ├── page-table.ts       # page-table JSONL sidecar store
│   ├── residency.ts        # deterministic resident-set selection policy
│   ├── trace.ts            # bounded JSONL decision/fault traces
│   ├── writeback.ts        # staged writeback journal and flush
│   └── command.ts          # /memory commands
├── docs/
│   ├── design.md
│   └── research/
└── test/
```

上方源码职责依次为：入口事件和生命周期、存储与缓存、旧版注入、常驻集渲染、领域类型、页表、驻留选择、轨迹、回写及命令。代码树中的原始说明保留英文以便对照。

`package.json` 的关键配置：

```json
{
  "name": "pi-memory",
  "keywords": ["pi-package"],
  "pi": { "extensions": ["./src/index.ts"] },
  "peerDependencies": { "@earendil-works/pi-coding-agent": "*" }
}
```

- Pi 已捆绑的模块（`@earendil-works/pi-coding-agent`、`typebox` 等）以 `"*"` 放入 `peerDependencies`，不再次打包（研究 04）。v1 无其他运行时依赖，仅使用 Node 内置模块；扩展通过 jiti 运行，无构建步骤。
- 安装：`pi install git:github.com/<user>/pi-memory` 为全局安装；加 `-l` 则为项目安装，通过 `.pi/settings.json` 与团队共享。开发使用 `pi -e ./src/index.ts`；放入扩展目录后可用 `/reload` 迭代。

<a id="9-testing"></a>
## 9. 测试

- 单元测试：存储的上限、mtime 缓存、延迟创建、信任门控及块组装，都是基于小型文件系统接口的纯函数，可用临时目录测试。
- 集成测试：在预置 `.pi/memory/` 的夹具仓库运行 `pi -p "what do you remember about this project?"`，断言成功召回；预置纠正信息，断言发生 `MEMORY.md` 编辑。
- 手动测试：运行 `pi -e ./src/index.ts`，然后检查 `/memory`、保存与召回往返，以及不可信目录行为。

<a id="10-roadmap-post-v1"></a>
## 10. v1 之后的路线图

1. **带原因码的召回控制器：**确定性的 `RecallResult` API 和 `/memory recall <query>`，区分 `ok`、`no_match`、`denied`、`malformed`、`unavailable`、`backend_error`。
2. **压缩时捕获：**观察 `session_before_compact`，通过 `serializeConversation()` 和低成本模型分析 `preparation.messagesToSummarize`，提出待暂存的回写操作。
3. **主题文件页面协调：**将链接的主题文件解析为指针或结构化页面，使大型流程和证据在需要前可留在提示词之外。
4. **`MEMORY.local.md`：**加入 gitignore 的个人项目笔记，对应 `CLAUDE.local.md`、`.aider.conf.yml` 的使用场景。
5. **衰减元数据：**逐条记录最后确认日期，提供 `/memory stale` 列表；仅依据频率和时间提出建议，绝不自动删除（研究 01）。
6. **跨 harness 导入：**为从 Claude Code 迁移的用户，只读导入 `~/.claude/projects/<project>/memory/`。
