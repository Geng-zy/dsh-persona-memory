# dsh-companion-core

给 [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）用的陪伴插件：让一个角色的人格和记忆放在会话外面，换会话、换电脑都还是她。为 QQ 陪伴 AI「大肥鱼」写，配合 [dsh-napcat-bridge](https://github.com/Geng-zy/dsh-napcat-bridge)（≥ 0.6.0）使用；不装它也能用，只是没有 QQ 会话的分类和消息存档。

当前是 **0.3.x（阶段 3）**：人格、核心记忆、上下文管理、消息存档、长期记忆（整理、召回、主动记忆工具、两级遗忘、向量检索）、群聊上下文、日记和月度总览、存档到期和会话轮换。备份迁移、自动清理和整合在后面的版本加。

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
6. **例外规则**：按 QQ 号或群号单独设置轮数、处理方式、存档天数、存不存没唤醒的群消息、遗忘方式。
7. **长期记忆**：
   - **归属**：主人（QQ 主人私聊和 dsh 里的会话共用）、公开、每个群、每个人的私聊。主人的会话也能想起群里的事（排名打折），群里和别人私聊想不起主人的事。
   - **整理**：模型把还没整理过的聊天挑出值得记的写进记忆（每 N 轮、截断/压缩前、设置页「立即整理」）；QQ 会话从消息存档里取，记着整理到哪条。
   - **召回**：每轮用这条消息找相关的几条，放进这一轮的消息里（不放系统提示词）。关键词一直用，填了向量 Key 再加向量；按相关度、重要程度（随时间衰减）、新近程度排名。
   - **主动记忆**：`memory_search`（回忆）、`memory_save`（记住）、`memory_forget`（遗忘），每个会话只碰得到自己能看到的那部分。
   - **遗忘**：普通遗忘可恢复；彻底遗忘删原文、只留指纹，同样的内容不会再被写回来。主人记忆可以让模型挑出可删的，你勾选确认。
   - **向量检索**：OpenAI 兼容的 `/embeddings`（默认硅基流动 `BAAI/bge-m3`），没填 Key 不启用；换模型自动重建，可以暂停、继续、取消、手动重建。
8. **群聊上下文**：她在群里被 @ 时，把她上次发言之后没看到的群消息一起给她（收到时下载好的图片优先，其他用 dsh-napcat-bridge 的媒体服务转换）。
9. **日记**：每天定时（默认 01:30，按凌晨 4 点分界）用第一人称写一篇只关于主人的日记，每月写月度总览，永久保留并写进记忆库。主人开新会话时第一轮自动先读最近 30 篇日记和 12 个月总览（不超过模型上限的 20%）。
10. **存档到期**：每天写完日记后，按保留天数先整理再删到期存档；会话用满保留期就换新会话（新会话开头带上个会话最后几条），旧会话归档；其他人的旧会话最后一条也过期后删除（主人的永不删）。

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
dsh plugin --profile web add github:Geng-zy/dsh-companion-core#v0.3.0
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
| 群聊上下文 | 附上之前几条、其中最多几张图片 |
| 记忆召回 | 开关、每轮几条、关键词/向量门槛和权重、群记忆折扣、半衰期 |
| 记忆生成 | 主动记忆、每多少轮整理、压缩前整理、整理用的模型、还没整理的数量、「立即整理」 |
| 遗忘 | 主人 / 别人私聊 / 群聊各自的遗忘方式、模型清理（运行、勾选确认） |
| 向量检索 | 接口地址、Key、模型、批量；索引状态、进度、手动重建、暂停、继续、取消 |
| 日记 | 开关、时间、分界、时区、月度总览、开新会话时读几篇和几个月、预算、「现在就写一篇」 |
| 日记本 | 看、改、删日记和总览；上传以前的日记（同一天已有时跳过/合并/覆盖） |
| 存档到期 | 换会话、删别人的旧会话、下载图片、换会话带几条；「现在处理到期」；换下来的旧会话列表 |
| 记忆列表 | 按归属、状态筛选，搜索，改、普通遗忘、彻底遗忘（页面内确认）、恢复、手动加一条 |
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
| `rules` | `[]` | 例外规则：`{ target, kind: user|group, maxRounds?, dropRounds?, mode?, archiveDays?, archiveUnwoken?: on|off, forgetMode?: normal|purge, note? }` |
| `archiveEnabled` / `archiveUnwoken` | `true` / `true` | 消息存档；存没唤醒她的群消息 |
| `archiveDaysMaster` / `archiveDaysOthers` | `365` / `5` | 保留天数（阶段 3 起生效） |
| `recallEnabled` / `recallTopK` | `true` / `6` | 每轮自动想起几条 |
| `keywordThreshold` / `vectorThreshold` / `keywordWeight` | `0.3` / `0.45` / `0.3` | 门槛和关键词占比 |
| `importanceWeight` / `recencyWeight` / `groupDiscount` / `halfLifeDays` | `0.2` / `0.1` / `0.7` / `30` | 排名权重、群记忆折扣、半衰期 |
| `activeMemory` | `true` | 回忆/记住/遗忘工具 |
| `organizeEveryRounds` / `organizeBeforeCompact` / `memoryModel` | `20` / `true` / 空 | 整理 |
| `masterForget` / `privateForget` / `groupForget` | `normal` / `purge` / `purge` | 遗忘方式 |
| `cleanupEnabled` / `cleanupAutoPurge` | `false` / `false` | 主人记忆的模型清理 |
| `embedApiUrl` / `embedApiKey` / `embedModel` / `embedBatch` | 硅基流动 / 不设 / `BAAI/bge-m3` / `16` | 向量检索 |
| `groupContextCount` / `groupContextImages` | `10` / `4` | 群聊上下文 |
| `diaryEnabled` / `diaryTime` / `dayBoundaryHour` / `timezone` / `monthlyEnabled` | `true` / `01:30` / `4` / `Asia/Shanghai` / `true` | 日记 |
| `diaryOnNewSession` / `diaryDays` / `overviewMonths` / `diaryBudgetPercent` | `true` / `30` / `12` / `20` | 开新会话先读日记 |
| `rotateSessions` / `deleteOldSessions` / `carryMessages` / `archiveImages` | `true` / `true` / `10` / `true` | 存档到期 |
| `logLevel` | `info` | 日志级别 |

## 数据目录

```
<DSH_HOME>/companion/
├── persona/persona.md, persona/history/
├── core/master.md, core/public.md, core/history-master/, core/history-public/
├── diary/2026-10-24.md, diary/monthly/2026-10.md
├── media/<sha256>.png   收到时下载的图片
└── companion.db          消息存档、dsh 会话的聊天流水、长期记忆（含向量）、彻底遗忘的指纹、整理进度、换下来的旧会话（SQLite，数据结构版本 3）
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
