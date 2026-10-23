# dsh-companion-core

给 [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）用的陪伴插件：让一个角色的人格和记忆放在会话外面，换会话、换电脑都还是她。为 QQ 陪伴 AI「大肥鱼」写，配合 [dsh-napcat-bridge](https://github.com/Geng-zy/dsh-napcat-bridge)（≥ 0.6.0）使用；不装它也能用，只是没有 QQ 会话的分类和消息存档。

当前是 **0.1.x（阶段 1）**：人格、核心记忆、上下文管理、消息存档。长期记忆（写入、召回、遗忘、向量检索）、日记、备份迁移在后面的版本加。

## 它做什么

1. **人格对所有会话即时生效**：人格稿是一个文件（`<DSH_HOME>/companion/persona/persona.md`）。插件挂在 dsh 全局的系统提示词组装环节上，QQ 和 dsh 里的所有会话每一步都现读这个文件，改完下一句就是新人格，正在聊的会话也一样，不用重启。（dsh 为了保住缓存，不改对话开头那份系统提示词，而是把新的一份接在对话后面，最新的生效。）
2. **核心记忆**：一直放在她脑子里、不会被遗忘的事。主人的核心记忆只在主人的会话里出现，公开的核心记忆所有会话都有。
3. **她自己改人格和核心记忆**：主人的会话里给她两个工具 `persona_edit`、`core_memory_edit`，改了直接生效，旧版本自动保存（默认留 5 份，可回退）。群聊和别人的私聊里没有这两个工具，执行时也会再检查一次会话身份。
4. **上下文管理**：替换 dsh 自带的压缩。每个会话超过「最多保留轮数」或上下文到了模型上限的 70%，就处理最早的几轮：
   - **按轮数截断**：直接去掉，留一句"更早的 N 轮对话已经省略"；
   - **让模型写回忆**：中文、她的第一人称（"我们聊了什么、对方的状态、约定、没聊完的话题、我的感受、重要细节"），上一份回忆会合并进新的。
   - 模型报"超出上限"时，不管设的哪种，都立刻按轮数截断再重试。
   - 默认：主人 60 轮、一次 20 轮、写回忆；其他私聊和群聊 60 轮、一次 20 轮、截断。
5. **消息存档**：QQ 上收到和发出的每条消息（包括没唤醒她的群消息）按原样存进 SQLite（`<DSH_HOME>/companion/companion.db`，用 Node 自带的 `node:sqlite`）。
6. **例外规则**：按 QQ 号或群号单独设置轮数、处理方式、存档天数、存不存没唤醒的群消息。

## 会话怎么分

| 会话 | 算作 |
|---|---|
| dsh-napcat-bridge 登记的主人私聊（管理员 QQ 号的私聊） | 主人 |
| 其他 QQ 私聊 | 其他私聊 |
| QQ 群 | 群聊 |
| dsh 里直接开的会话（只有主人能打开 dsh） | 主人 |
| id 是 `napcat-…` 但插件一没登记的会话（例如在 dsh 网页里打开了一个 QQ 会话） | 按 id 归到群聊或其他私聊，**不当主人** |

## 安装

```bash
dsh plugin --profile web add github:Geng-zy/dsh-companion-core#v0.1.0
```

装好后：
1. 重启 dsh。插件会自动加一个 **「陪伴模式」预设**（id `companion`）：工具照抄 dsh 0.2.1 的标准模式，不带 `dsh-persona`，压缩换成本插件的上下文管理。
2. 在 dsh「设置 → Agent 预设」里把「陪伴模式」设成**新任务默认**；dsh-napcat-bridge 设置页「默认的 Agent 预设」填 `companion`。（已经开着的会话锁定了原来的预设，要新开会话才用上上下文管理；人格和核心记忆不受这个限制。）
3. 在侧栏 **插件 → dsh-companion-core** 打开设置页，填人格和核心记忆。

人格留空时不替换，用预设原来的人格。

## 和 dsh-persona、预设的关系

| 人格从哪来 | 插件能不能替换 |
|---|---|
| dsh 全局设置里的默认人格（"You are a coding agent…"） | 能 |
| 预设里的 `dsh-persona` 行，普通模式（内置的标准、PTC、创造模式） | 能 |
| 预设里的 `dsh-persona` 开了 `complete: true`（内置的极简模式） | **不能**：dsh 在组装之后会把它原样恢复。请把这个预设加进「不生效的预设」 |

人格只在本插件的设置页改；`AGENTS.md` 里别再写人格，否则会叠在一起。写代码用的预设可以加进「不生效的预设」，这些会话保持 dsh 原样。

## 设置页

在 dsh 侧栏「插件 → dsh-companion-core」，深色/浅色主题、窄窗口都能用，桌面端和 Web 端是同一个页面。每项的说明在名称右上角的「?」里。

| 分组 | 内容 |
|---|---|
| 状态 | 有没有检测到 dsh-napcat-bridge、存档条数、数据目录 |
| 生效范围 | 不生效的预设、只用人格 |
| 人格 | 人格编辑器（单独的「保存人格」按钮）、历史版本（查看、页面内确认后回退）、让她自己改、保留几份历史 |
| 核心记忆 | 主人的 / 公开的两个编辑器和各自的历史版本、上限 |
| 上下文 | 到上限的百分比；主人、其他私聊、群聊各自的最多保留轮数、一次处理几轮、处理方式；写回忆用的模型 |
| 例外规则 | 按 QQ 号或群号一条一条加 |
| 消息存档 | 开关、存不存没唤醒的群消息、保留天数（到期整理和删除在阶段 3 加上） |
| 日志 | 日志级别、最近的日志 |

## 配置项

| 配置 | 默认值 | 说明 |
|---|---|---|
| `excludedPresets` | `[]` | 不生效的预设 id |
| `personaOnly` | `true` | 去掉 dsh 的编程助手身份句 |
| `selfEdit` | `true` | 主人会话里给她改人格/核心记忆的工具 |
| `historyKeep` | `5` | 人格、两份核心记忆各留几份历史 |
| `coreMaxKB` | `24` | 每份核心记忆的上限 |
| `thresholdPercent` | `70` | 上下文到模型上限的百分之多少就处理（10–95） |
| `masterMaxRounds` / `masterDropRounds` / `masterMode` | `60` / `20` / `llm` | 主人 |
| `privateMaxRounds` / `privateDropRounds` / `privateMode` | `60` / `20` / `truncate` | 其他私聊 |
| `groupMaxRounds` / `groupDropRounds` / `groupMode` | `60` / `20` / `truncate` | 群聊 |
| `summaryModel` | 空 | 写回忆用的模型（`提供方/模型`），空 = 会话自己的 |
| `rules` | `[]` | 例外规则：`{ target, kind: user|group, maxRounds?, dropRounds?, mode?, archiveDays?, archiveUnwoken?: on|off, note? }` |
| `archiveEnabled` / `archiveUnwoken` | `true` / `true` | 消息存档；存没唤醒她的群消息 |
| `archiveDaysMaster` / `archiveDaysOthers` | `365` / `5` | 保留天数（阶段 3 起生效） |
| `logLevel` | `info` | 日志级别 |

## 数据目录

```
<DSH_HOME>/companion/
├── persona/persona.md, persona/history/
├── core/master.md, core/public.md, core/history-master/, core/history-public/
└── companion.db          消息存档（SQLite，带数据结构版本号）
```

所有路径都相对这个目录，整个目录拷走就是备份。

## 给其他插件用

```ts
// 截断或压缩上下文之前（serial，最多等 60 秒）：阶段 2 的记忆在这里先把要紧内容写进记忆
ctx.on('companion/before-compact', async ({ sessionId, scope, mode, reason, transcript }) => {})
```

## 开发

```bash
scripts/setup-test-env.sh          # 装官方 Node 和 dsh 到 .cache/test-env
scripts/check.sh                   # 安装依赖、编译、单元测试、端到端测试（真实 dsh + dsh-napcat-bridge + 假模型 + 假 NapCat）、扫描密钥
node scripts/check-upstreams.mjs   # 看 dsh、dsh-napcat-bridge、Node 有没有新版本（对照 upstreams.json）
```

端到端测试要用旁边文件夹的 dsh-napcat-bridge（`../dsh-napcat-bridge`，或用 `BRIDGE_DIR` 指定），先在那里编译好。`lib/` 是编译产物，要提交进仓库。

## 许可证

AGPL-3.0-or-later。陪伴模式预设的工具列表照抄 dsh-web-app 的标准模式（MIT），上下文管理继承 dsh-compaction-basic（MIT），见 [NOTICE.md](NOTICE.md)。
