> 中文阅读版；原文路径：`README.md` · [英文原文](../../README.md) · [阅读索引](INDEX.md)
> 对应提交：`d32ebc625797f6cce4d8dd4ba6a03b1fdbe3bb83` · 原文 SHA-256：`572187839f0bddb46b236e7d07220ce159c6d6ad4f2e1f65ef1cc0636ff95d78`
> 正文译为中文，代码示例及其中注释保留英文；安装命令、相对路径和工作目录按原项目解释。本页仅供阅读，不代表执行其中操作。

> 阅读提示（译者补充）：本 README 对注入内容的描述不应直接当作运行时保证。学习时请对照原项目 `extensions/index.ts`、`src/resident-inject.ts` 和 `src/residency.ts` 的入口及常驻页选择逻辑。

<a id="pi-memory"></a>
# pi-memory

为 [pi](https://pi.dev) 编程智能体提供基于文件的持久记忆。智能体跨会话积累长期有效的经验（纠正、构建命令、决策和偏好），以可阅读、编辑和比较差异的纯 Markdown 保存。

设计依据与研究：[docs/design.md](../../docs/design.md)、[docs/research/](../../docs/research/)。

<a id="how-it-works"></a>
## 工作原理

采用两个作用域，与 pi 自身的全局和项目约定一致：

```
~/.pi/agent/memory/      # global: this user, all projects (machine-local)
<repo>/.pi/memory/       # project: committed to the repo, shared with the team
├── MEMORY.md            # concise index — injected into every session (capped)
├── <topic>.md           # detail files — the agent reads them on demand
└── archive/             # stale content is moved here, never injected
```

每次提交提示时，扩展会在系统提示词后追加记忆块：简短的使用说明，以及各作用域的 `MEMORY.md`，上限为**每个作用域 200 行 / 8 KiB**。智能体使用 pi 内置的 `edit` / `write` 工具编辑这些文件，保存并更新记忆；每次变更都能在工具日志中看到，项目作用域的变更也可在版本控制中查看。

项目记忆只在**受信任**的项目中读取；扩展不会自行创建目录，只有智能体首次保存内容时才会出现文件。

<a id="install"></a>
## 安装

```bash
pi install npm:@josephakern/pi-memory                 # global, from npm
pi install git:github.com/josephkern/pi-memory        # global, from git
pi install -l npm:@josephakern/pi-memory              # project-local (.pi/settings.json)
```

用于开发时也可这样运行：

```bash
pi -e ./src/index.ts
```

<a id="usage"></a>
## 用法

无需额外设置。你可以对 pi 说“记住我们在这里使用 pnpm”，也可以照常工作；智能体会保存它认为长期有用的信息。

- `/memory`：显示两个作用域的文件、大小、已注入和因上限而未注入的内容，以及信任状态。
- `/memory pages`：预览从 `MEMORY.md` 派生的 ClawVM 风格类型化页面，以及页表旁路文件状态。
- `/memory verify`：根据当前 `MEMORY.md` 文件重建 `page-table.jsonl` 旁路文件。
- `/memory remember global|project <text>`：在 `writeback-journal.jsonl` 中暂存一项仅追加的记忆写入。
- `/memory flush`：校验并提交待处理的写回操作，重建页表。
- `/memory faults` / `/memory traces` / `/memory trace <id>`：检查记忆缺页以及驻留和写回轨迹。
- `/memory off` / `/memory on`：关闭或开启当前会话的记忆注入。
- `pi --no-memory`：以禁用记忆注入的方式启动。

记忆文件是纯 Markdown，可随时在编辑器中修改或删除。

<a id="configuration"></a>
## 配置

任一记忆目录中都可放置可选的 `config.json`（项目配置覆盖全局配置，与 pi 设置一致）：

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

<a id="development"></a>
## 开发

```bash
npm install
npm run typecheck
npm test
```

依赖提供方的记忆冒烟测试需要显式启用，因为它们会调用真实的 pi 智能体：

```bash
npm run test:provider
```
