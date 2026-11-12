> 中文阅读版；原文路径：`docs/memory-effectiveness-testing.md` · [英文原文](../../../docs/memory-effectiveness-testing.md) · [阅读索引](../INDEX.md)
> 对应提交：`8264fdabc7f6a9620daec04082012c2e6150c0f7` · 原文 SHA-256：`33328955040fd8f3715e9c5aab9ac04f9bcdaafda96fd8bd9b54b590c9a7fd86`
> 正文译为中文，代码示例及其中注释保留英文；命令和路径按原项目解释。本页仅供阅读，不代表执行其中操作；历史设计和研究结论不等于当前运行时保证。

<a id="memory-effectiveness-testing"></a>
# 记忆效果测试

项目从**利用率、饱和度和错误**三类测试记忆效果。目标不仅是确认记忆存在，还要确认 harness 在预算压力下正确使用记忆，并让失败可观测。

<a id="1-utilization"></a>
## 1. 利用率

**问题：**需要使用记忆时，是否确实使用了它？

主要指标：

- `neededRecallRate`：任务必需页面被选入常驻集的比例。
- `usefulMemoryTokenRatio`：相关页面被选中的 token 数，占全部已选记忆 token 的比例。
- 后续：写入利用率，即捕获的长期事实数除以符合条件的长期事实数。

示例断言：

- 回答构建或包管理问题时，预置的包管理器约束应处于常驻状态。
- 任务要求某个工作流时，对应的必需流程页应常驻。
- 预算允许时，不相关记忆不应挤掉明确需要的记忆。

<a id="2-saturation"></a>
## 2. 饱和度

**问题：**记忆增长或 token 预算缩小时会发生什么？

主要指标：

- `pinnedSurvivalRate`：硬固定或活跃固定页面保持常驻的比例。
- `saturationRatio`：最低必需 token 数除以配置的记忆预算。
- 后续：抖动指数，即重复驱逐、重新获取、重新加载事件数除以有效命中数。
- 后续：按页面数量统计提示词组装延迟。

预期行为：

- `saturationRatio <= 1` 时，固定页面应保留，策略可控故障应为零。
- `saturationRatio > 1` 时，应显式报告 `invariant_pressure`；静默省略是缺陷。
- 可选页面应先于约束、启动策略和活跃计划降级或省略。

<a id="3-errors"></a>
## 3. 错误

**问题：**记忆失败时是否安全且可观测？

主要指标：

- `policyControllableFaultCount`：harness 策略应能预防或显式报告的故障数量。

当前建模的故障：

- `pinned_invariant_miss`：固定不变量缺失。
- `post_compaction_bootstrap_loss`：压缩后启动信息丢失。
- `flush_miss`：刷新写入遗漏。
- `silent_recall`：静默召回。
- `writeback_rejected`：回写被拒绝。
- `sidecar_corrupt`：辅助文件损坏。
- `duplicate_tool_signature`：工具签名重复。
- `refetch`：重新获取。
- `invariant_pressure`：不变量预算压力。

示例断言：

- 缺少最低保真度表示时，产生 `pinned_invariant_miss`。
- 必需页面超出预算时，产生 `invariant_pressure`。
- 损坏的 JSONL 辅助文件应被报告，而非忽略。
- 项目不可信时，项目记忆保持不可用。

<a id="current-deterministic-test-coverage"></a>
## 当前确定性测试覆盖

自动化 Node 测试套件包括：

- `test/page-table.test.ts`：页面派生、页表辅助文件校验、稳定 ID 和异常 JSONL 处理。
- `test/residency.test.ts`：确定性常驻集选择、固定页优先级、升级、必需页和不变量压力。
- `test/effectiveness.test.ts`：确定性驻留决策的利用率、饱和度和错误指标。

运行命令：

```bash
npm run typecheck
npm test
```

<a id="provider-backed-pi-agent-tests"></a>
## 由真实提供方驱动的 pi-agent 测试

这类测试速度更慢、结果非确定且要求模型访问权限，因此除非显式启用，否则不纳入日常确定性断言。`test/provider-agent.test.ts` 禁用工具、上下文文件、技能、提示词模板、主题、会话和无关扩展，只加载本包扩展，以隔离一个问题：真实提供方驱动的 Pi 智能体，能否根据注入的持久记忆和记忆指令回答？

运行命令：

```bash
npm run test:provider
```

可选环境变量：

```bash
PI_MEMORY_PROVIDER=google PI_MEMORY_MODEL='gemini*' npm run test:provider
PI_BIN=/path/to/pi npm run test:provider
```

当前黑盒场景：

1. **记忆利用：**询问包管理器问题，唯一启用的信息来源是注入记忆。
2. **指令利用：**询问是否写入 `AGENTS.md`、保存项目秘密、使用主题文件、归档旧条目，以及避免重复代码或 Git 历史。

建议后续增加：

1. **作用域正确性：**分别运行可信和不可信项目会话，确认只有可信时出现项目记忆。
2. **生命周期持久性：**写入长期事实，启动新的无会话或干净会话，验证召回。
3. **饱和度：**创建超大记忆，验证重要约束仍能正确用于回答。
4. **错误可见性：**损坏辅助文件，运行 `/memory pages`，验证故障可见。

黑盒运行可使用以下总体分数，即有记忆时任务成功率减去无记忆时任务成功率：

```text
memory_effectiveness = task_success_with_memory - task_success_without_memory
```

策略级测试目标更严格：

```text
policy_controllable_fault_count == 0 when saturationRatio <= 1
```
