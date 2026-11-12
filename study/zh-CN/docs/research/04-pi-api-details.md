> 中文阅读版；原文路径：`docs/research/04-pi-api-details.md` · [英文原文](../../../../docs/research/04-pi-api-details.md) · [阅读索引](../../INDEX.md)
> 对应提交：`f648576f1912a64c9be754fe9e3882fdd1c24da8` · 原文 SHA-256：`63f2c99fe16cc4010d041392b4c9be621dac3b7ebfaa0c55f13bf538e9bc6c18`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="pi-api-details-gap-fill-read-directly-from-pi-mono-docs-2026-06-11"></a>
# Pi API 细节：2026-06-11 直接阅读 pi-mono 文档后的补充

完整一手来源来自 badlogic/pi-mono 的 packages/coding-agent/docs/：extensions.md（2,656 行）、skills.md、packages.md、compaction.md、session-format.md。本页只记录研究 02 尚未覆盖而设计需要的信息。

<a id="extension-runtime-facts"></a>
## 扩展运行时事实

- 扩展通过 **jiti** 加载，TypeScript 无需编译步骤。可使用 node:fs、node:path 等 Node 内置模块；扩展所在或父目录有 package.json 且已安装 node_modules 时，可使用 npm 依赖。
- 扩展可导入已捆绑模块：`@earendil-works/pi-coding-agent` 提供类型和辅助函数；typebox 提供工具 schema；`@earendil-works/pi-ai` 提供 StringEnum，为兼容 Google API，应使用它替代字面量 Type.Union；`@earendil-works/pi-tui` 用于自定义渲染。分发包导入这些模块时，应以 `"*"` 声明 peerDependencies，不得重复捆绑。
- 自动发现目录中的扩展（全局或项目 extensions/）可用 `/reload` 热重载；`pi -e ./path.ts` 用于快速测试。
- `/new`、`/resume`、分叉及 `/reload` 时，Pi 发出 session_shutdown、销毁扩展实例、重新加载，再发出带对应原因的 session_start。内存状态必须在 session_start 重建。

<a id="before_agent_start-memory-injection-point"></a>
## before_agent_start：记忆注入点

```ts
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt, event.images
  // event.systemPrompt — chained across extensions
  // event.systemPromptOptions — structured prompt inputs:
  //   .contextFiles (loaded AGENTS.md files), .skills, .selectedTools,
  //   .customPrompt, .appendSystemPrompt, .promptGuidelines, .cwd
  return {
    message: { customType: "my-ext", content: "...", display: true }, // persistent message, sent to LLM
    systemPrompt: event.systemPrompt + "\n\n...",                      // per-turn system prompt change
  };
});
```

此事件**每次用户提示**触发，而非每个会话仅一次。systemPromptOptions.contextFiles 可查看已经加载的 AGENTS.md，以便去重；其他结构化字段包含 skills、selectedTools、customPrompt、appendSystemPrompt、promptGuidelines、cwd。系统提示词变更仅作用于本轮，并在扩展间串联；示例中的 message 则持久化到会话并发送给 LLM。

<a id="tool-registration-details"></a>
## 工具注册细节

- registerTool 接受 promptSnippet，在系统提示词 Available tools 中形成单行条目；promptGuidelines 在工具启用期间追加到 Guidelines，每个列表项必须明确提到工具名。
- execute(toolCallId, params, signal, onUpdate, ctx) 返回 `{ content, details }`；通过抛错报告错误。details 持久化到会话并用于重建状态。
- 修改文件的工具必须用 withFileMutationQueue(absolutePath, fn) 包装完整读改写流程；工具默认并行执行，未排队写入可能丢失。
- 工具**必须截断输出**；内置上限 50 KB/2000 行，导出 truncateHead、truncateTail、DEFAULT_MAX_BYTES、DEFAULT_MAX_LINES 等辅助项。
- 可选 prepareArguments(args) 在校验前执行，用于 schema 改动后恢复旧会话的兼容适配。

<a id="commands-context-misc-api"></a>
## 命令、上下文及其他 API

- registerCommand(name, { description, handler(args, ctx), getArgumentCompletions })；处理器获得 ExtensionCommandContext，额外提供 waitForIdle()、newSession()、fork()、switchSession()、reload()、getSystemPromptOptions()。
- ctx.isProjectTrusted() 用于控制是否采用项目配置。
- ctx.cwd、ctx.hasUI、ctx.mode（tui/rpc/json/print）、ctx.ui.notify/confirm/select/input、ctx.ui.setStatus/setWidget。
- ctx.getContextUsage() 返回当前 token 用量；ctx.compact({ customInstructions, onComplete, onError }) 触发压缩。
- pi.appendEntry(customType, data) 在会话 JSONL 中生成 type 为 custom 的 CustomEntry，不进入 LLM 上下文；pi.sendMessage({customType, content, display}, {deliverAs}) 生成进入上下文的 CustomMessageEntry。
- pi.exec(cmd, args, opts)、扩展间事件总线 pi.events、pi.registerShortcut、pi.registerFlag(name, {type, default}) 及 pi.getFlag()。

<a id="compaction-internals-from-compactionmd"></a>
## 压缩内部机制：来自 compaction.md

- 触发条件是 contextTokens > contextWindow - reserveTokens，默认 reserveTokens 为 16,384；切分点保留约 keepRecentTokens（默认 20,000）的近期消息，并按轮次边界切分。
- session_before_compact 载荷包括 preparation.messagesToSummarize、turnPrefixMessages、previousSummary、fileOps、tokensBefore、firstKeptEntryId、settings，另有 branchEntries 和 signal。
- convertToLlm() 与 serializeConversation() 将 AgentMessage[] 转为 `[User]: ... / [Assistant]: ... / [Tool result]: ...` 文本供自定义摘要使用，工具结果截断到 2,000 字符。
- 默认摘要为结构化 Markdown：目标、约束、进展、关键决策、后续步骤、关键上下文及读取/修改文件列表。挂在 session_before_compact 的提取器可分析 messagesToSummarize 而不替换默认摘要：不返回内容即可，返回值仅用于自定义或取消。session_compact 随后触发并携带已保存条目。

<a id="skills-from-skillsmd--adjacent-mechanism-not-a-memory-store"></a>
## 技能：相邻机制，但不是记忆存储

- 技能遵循 agentskills.io 标准：目录内有带 name、description frontmatter 的 SKILL.md，按需加载；只有名称和描述始终在上下文中，即渐进式披露。
- 位置包括全局 `~/.pi/agent/skills/`、`~/.agents/skills/`；受信任门控的项目 `.pi/skills/`、`.agents/skills/`；包、设置 skills 数组及 `--skill` 参数。
- 记忆扩展可以选择附带说明记忆策略的技能，但技能是静态能力文档，不是可写存储。resources_discover 可贡献技能、提示词、主题路径，不能贡献扩展或任意上下文路径。

<a id="packaging-from-packagesmd"></a>
## 打包：来自 packages.md

- Pi 包是 npm/Git 仓库，在 package.json 中具有 pi 清单，例如 `"pi": { "extensions": ["./src/index.ts"] }`，或使用 extensions/、skills/、prompts/、themes/ 等约定目录。加入 pi-package 关键字可出现在 pi.dev 展示页，可选 image/video 预览字段。
- 安装支持 `pi install npm:pkg`、`git:github.com/user/repo@ref` 或本地路径；`-l` 写入团队共享的 `.pi/settings.json`，可信项目启动时自动安装缺失项目包。另有 pi remove、pi list、pi update。
- 同一包同时出现在全局和项目设置时，**项目条目优先**；身份依据为 npm 名称、不含 ref 的 Git URL 或解析后的路径。

<a id="session-entry-types-relevant-to-memory-from-session-formatmd"></a>
## 与记忆相关的会话条目类型

- CustomEntry（appendCustomEntry）：扩展状态，不进入上下文。
- CustomMessageEntry（appendCustomMessageEntry/sendMessage）：扩展消息，进入上下文，带 display 标志。
- CompactionEntry/BranchSummaryEntry：携带 details，默认含 readFiles、modifiedFiles，可由扩展自定义。
- SessionManager.list(cwd)/listAll() 枚举会话文件。
