# dsh-snowluma-bridge

把 [SnowLuma](https://github.com/SnowLuma/SnowLuma)（OneBot v11）接到 [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）的插件。

连接方式和消息处理照搬 [AstrBot](https://github.com/AstrBotDevs/AstrBot) 的 aiocqhttp 适配器，只是把接收方从 AstrBot 换成了 dsh，并在它的基础上补了几处（见下面「和 AstrBot 不同的地方」）。这个插件只负责连接和传数据，人设、记忆等交给它的搭档 [dsh-companion-core](https://github.com/Geng-zy/dsh-companion-core)（插件二）。**两个一起从零部署的步骤和一键脚本见下面「部署」。**

**迁移至 SnowLuma**：请使用[SnowLuma 迁移指南](docs/SNOWLUMA.md)及[Compose 模板](deploy/snowluma.compose.yml)。现有实例保留平台 ID（通常为 `snowluma`），会话、规则、存档和 companion-core 记忆继续使用。当前插件包名、服务与事件统一使用 SnowLuma；部署按上述指南进行。

## 工作方式

1. 插件开一个反向 WebSocket 服务（默认 `0.0.0.0:6199`，路径 `/ws`），SnowLuma 作为客户端连进来。
   - 握手时校验 `Authorization: Bearer <token>`：缺失返回 401，错误返回 403。
   - 支持 `X-Client-Role` 为 `Universal`、`Event`、`API` 三种连接。
2. QQ 协议端推来的消息、通知、请求，按 AstrBot 的规则转成统一的消息对象（`AstrBotMessage`）：
   - **文字**：相邻几段合并，前后空白去掉。
   - **@**：调 `get_group_member_info` 查群名片，没有名片再调 `get_stranger_info` 查昵称，在文字里写成 `@名片(QQ号)`。开头 @ 机器人自己的那个不写进文字。
   - **引用**：调 `get_msg` 取回被引用的消息，只取一层。
   - **文件**：调 `get_group_file_url` / `get_private_file_url` 换成下载地址。
   - **markdown**：当文字。
   - **QQ 管家**（2854196310）的消息：忽略。
   - **通知、请求**：不交给模型，只通过事件广播。
3. 每条消息都会发出 dsh 事件 `snowluma/message`，给其他插件用。
4. 照 AstrBot 流水线的顺序过一遍：唤醒 → 白名单 → 指令 → 只 @ 不说话时等下一条 → 频率限制 → 语音转文字（视频截图是本插件新增）。唤醒规则同 AstrBot 默认：
   - **私聊**：都交给模型。
   - **群聊**：正文包含唤醒词、@机器人、引用机器人的消息，或以唤醒前缀（默认 `/`）开头时交给模型，唤醒前缀会去掉。关键词不匹配 @其他人的昵称。
5. 每个会话对应一个 dsh 会话（发 /new 或 /reset 换新的），新会话按"管理员私聊 > 私聊/群聊 > 默认"选预设和模型。会话标识按 AstrBot 的 `平台ID:消息类型:会话ID` 来分，群聊的会话 ID 是群号，私聊的是对方 QQ 号。
6. 交给模型的内容：群消息前面加 `[昵称(QQ号)]`；`<system_reminder>` 里写当前时间、群名、发送者是不是管理员；有引用时接上 `<Quoted Message>(昵称): 内容</Quoted Message>`，引用的是聊天记录会逐层展开；直接发来的聊天记录写成 `<Forward Message>`；图片（包括商城表情、引用和聊天记录里的图片）作为附件一起交给模型；视频在文字里写 `[视频]`，有 ffmpeg 时另外截几张画面当图片给模型。交给模型前先发 `snowluma/prompt`，其他插件（例如记忆）可以往里加内容。
7. 模型一轮结束后，把最后一条回复的文字发回去：私聊用 `send_private_msg`，群聊用 `send_group_msg`，然后发 `snowluma/sent`。发之前按「发消息节奏」像真人一样等一会儿：按打字速度（默认每分钟 100 字，也就是每个字 0.6 秒，最少 1 秒、最多 10 秒）；群里两条之间至少隔 5 秒、一分钟最多 5 条，超出就排队，排队超过 2 分钟这条就不发。同一个会话的消息按顺序发。分段发送（默认只在管理员私聊里开）会把一次回复按行拆成几条，一句一条地发。

## 和 AstrBot 不同的地方

| | AstrBot | 本插件 |
|---|---|---|
| 消息时间 | 收到的时间 | QQ 上的发送时间 |
| 重复消息 | 照常处理 | 同一条消息（机器人 QQ + 消息 ID）10 分钟内只处理一次 |
| @ 查名片 | 每次都查 | 缓存 10 分钟 |
| 群名 | 用事件里带的（SnowLuma 常常不带） | 没带时查 `get_group_info`，缓存 30 分钟 |
| 小黄脸 | 只留编号 | 文字里写成 `[表情:微笑]` |
| 商城表情 | SnowLuma 以图片段发来，当普通图片 | 一样当普通图片交给模型 |
| 通知、请求 | 只有发送者 QQ 号，昵称也填 QQ 号 | 查真实名字，并写一句中文描述放在 `event_text`（谁进群、退群、撤回了什么、戳了谁、加好友等） |
| 群里谁在说话 | 默认不告诉模型 | 群消息前面加 `[昵称(QQ号)]`（`identifier`） |
| 图片 | 由 AstrBot 流水线另外处理 | 作为 dsh 附件交给模型（`imageToModel`），模型要支持看图，如 deepseek-flash |
| 引用 | 流水线整理成 `<Quoted Message>`，展开引用的聊天记录 | 照搬同样的做法 |
| 白名单 | 旧混合名单、管理员豁免可配置 | 群聊和普通私聊使用两份独立名单；管理员始终豁免，无额外开关；主动唤醒、代发和发送前复查，群主动聊天不能继承管理员发言权限 |
| 只 @ 不说话时等下一条 | 等这个会话里任何人的下一条 | 只等那个人的下一条 |
| 管理员身份 | 不告诉模型 | 可以写进 `<system_reminder>` |
| 指令 | 私聊时不带前缀也能触发 | 必须带唤醒前缀，免得聊天里说到 new 也被当成指令 |
| 直接发来的聊天记录 | 不展开 | 展开成 `<Forward Message>` |
| 视频 | 不交给模型 | 文字里写 `[视频]`；有 ffmpeg 时截几张画面当图片交给模型（DeepSeek 模型收不了视频原件），设置页可以一键安装 ffmpeg |
| 消息存档权限 | 无本插件接口 | 新增 `ctx.snowluma.canArchive(session)`，实时共用两份白名单；群无管理员发言豁免，管理员私聊允许；companion-core ≥ 0.13.0 收发存档与图片下载均检查 |
| 群回复 @ / 引用 | `reply_with_mention` / `reply_with_quote` | 两个独立开关默认关闭；群聊文字和指令回复使用实际来信的发送者 / 消息 ID；分段只在首条文字附加，不装饰主动聊天或私聊 |
| 发消息节奏 | 没有 | 模拟打字速度；群里限制发言频率（见上面第 7 条） |
| 发语音 | 文字转语音（TTS）插件，单家服务商 | 每条先用 BreezeBlue，这条出错（含额度用完）就这条换 Inworld，两家都不行发文字；她可以自己决定哪句用语音（见「配置项 · 语音回复」） |
| 给其他插件的接口 | — | 交给模型前的 `snowluma/prompt`、发出后的 `snowluma/sent`、会话信息、换会话、媒体转换（见「给其他插件用」） |

## 部署

本项目使用 SnowLuma OneBot v11。由 `ubuntu` 管理 Docker Compose 和 QQ 登录数据，由无 sudo 权限的 `dafeiyu` 运行 dsh 与陪伴插件。

1. 安装 Node.js 24、pnpm 和 dsh，并以服务用户创建 web profile。
2. 安装两个插件：

```sh
dsh plugin --profile web add github:Geng-zy/dsh-snowluma-bridge#v0.21.0 github:Geng-zy/dsh-companion-core#v0.18.0
```

3. 按 [SnowLuma 部署指南](https://github.com/Geng-zy/dsh-snowluma-bridge/blob/main/docs/SNOWLUMA.md)配置 Compose、持久化目录及反向 WebSocket。
4. 默认平台 ID 为 `snowluma`，在桥接设置中填写管理员 QQ、白名单、预设及模型。设置页检查连接后，由账号本人扫码登录 QQ。
5. 为 dsh 配置 `User=dafeiyu` 的 systemd 服务；QQ 协议端由 Docker 的重启策略管理。

数据迁移涉及会话 ID、OneBot 消息归属和持久化日志，须在 dsh 停止时统一处理；不要只改平台 ID 后直接使用旧会话目录。

## 安装

```bash
dsh plugin --profile web add github:Geng-zy/dsh-snowluma-bridge#v0.21.0
```

然后在 profile 的 `cordis.patch.yml` 里写配置（行 id 固定是 `snowluma-bridge`）：

```yaml
- id: snowluma-bridge
  config:
    ws_reverse_host: 0.0.0.0
    ws_reverse_port: 6199
    ws_reverse_token: 换成你自己的随机字符串
    workspacePath: /home/you/qq-workspace
```

SnowLuma 那边在「网络配置」里新建一个 **WebSocket 客户端**：
- 地址填 `ws://127.0.0.1:6199/ws`（SnowLuma 和 dsh 在同一台机器上时；不在同一台就填 dsh 那台机器的地址）
- Token 和上面的 `ws_reverse_token` 一致（也可以在设置页「连接」里点「随机生成 Token」，保存后填过去）
- 消息格式选 `array`

## 设置页

装好后在 dsh 侧栏 **插件** → **dsh-snowluma-bridge** 打开设置页，下面所有配置项都能在网页里改，点保存后立即生效，不用重启 dsh：
- 监听地址、端口、Token、平台 ID 在默认收起的「连接」框里；Token 下面的「测试连接」会告诉你 SnowLuma 有没有连上、Token 对不对；
- 每项的说明在名称右上角的小角标里，鼠标移上去显示；
- 改了监听地址或端口，插件会自动换新地址重新监听，SnowLuma 会自动重连；
- Token 不会显示出来，只提示有没有设置；留空保存表示不改；
- 「视频」分组显示有没有找到 ffmpeg；Linux（x64 / arm64）上没有时可以点「安装 ffmpeg」，从 GitHub [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) 下载独立版（约 140MB），核对 SHA256 后放进 `<DSH_HOME>/snowluma-bridge/ffmpeg/`，不需要管理员权限；
- 页面用 dsh 自带的表单组件和颜色，深色/浅色主题自动跟随 dsh。

也可以直接改 profile 的 `cordis.patch.yml`，两边是同一份配置。

## 配置项

都可以在设置页里改，分组同设置页。

| 分组 | 配置 | 默认值 | 说明 |
|---|---|---|---|
| 连接 | `ws_reverse_host` | `0.0.0.0` | 监听地址 |
| | `ws_reverse_port` | `6199` | 监听端口 |
| | `ws_reverse_token` | 不设 | 连接 Token，不设则不校验 |
| | `id` | `snowluma` | 平台 ID，会话标识的第一段 |
| 访问控制 | `admins` | `[]` | 管理员 QQ 号 |
| | `whitelistEnabled` | `true` | 同时启用群聊和普通私聊白名单；空名单禁止对应普通会话，管理员始终豁免 |
| | `groupWhitelist` | 空 | 群号或完整群会话标识；只限制普通群成员、群主动聊天和无来信身份的群代发 |
| | `privateWhitelist` | 空 | 其他人的 QQ 号或完整私聊标识；管理员不用添加 |
| | `whitelist` | `[]` | 旧混合名单，仅供首次迁移；完整标识按类型拆分，裸号码保留旧版双重匹配含义、分别复制到两份名单，迁移后清空旧字段；之后两份名单独立编辑 |
| | `whitelistIgnoreAdminOnGroup` / `whitelistIgnoreAdminOnFriend` | `false` | 两个旧字段都忽略且不显示，管理员自动拥有权限，不需要豁免开关 |
| | `whitelistLog` | `true` | 不在白名单时记日志 |
| | `rateLimitCount` / `rateLimitSeconds` / `rateLimitStrategy` | `30` / `60` / `stall` | 频率限制，0 = 不限；stall 排队，discard 丢弃 |
| 唤醒 | `wakeKeywords` | `["大肥鱼", "肥鱼"]` | 群消息里出现这些词也唤醒（不用 @，本插件新增） |
| | `wake_prefix` | `["/"]` | 唤醒前缀 |
| | `friend_message_needs_wake_prefix` | `false` | 私聊也要唤醒前缀 |
| | `ignore_bot_self_message` | `false` | 忽略她自己发出的消息 |
| | `emptyMentionWaiting` / `emptyMentionNeedReply` | `true` / `true` | 只 @ 不说话时等下一条 / 先问一句 |
| 交给模型的内容 | `identifier` | `true` | 群消息前面加 `[昵称(QQ号)]` |
| | `markAdmin` | `true` | 发送者是管理员时告诉模型 |
| | `markWake` | `true` | 群里被 @ 或被引用叫醒时，告诉模型「这条是在叫你」和她自己的 QQ 号、群名片（叫醒她的 @ 会从文字里去掉，不写明她可能以为在叫别人） |
| | `groupNameDisplay` | `true` | 告诉模型群名 |
| | `datetimeReminder` / `timezone` | `true` / `Asia/Shanghai` | 告诉模型当前时间 |
| | `imageToModel` / `maxImages` | `true` / `0` | 图片交给模型；每条最多几张，0 = 不限 |
| 语音转文字 | `sttMode` | `off` | `off` / `command`（本机命令）/ `openai`（兼容接口） |
| | `sttCommand` | 空 | 本机命令，`{file}` 换成语音文件路径，输出就是文字 |
| | `sttApiUrl` / `sttApiKey` / `sttModel` | 空 | OpenAI 兼容接口（到 /v1 为止）、Key、模型 |
| 视频 | `videoFrames` | `true` | 视频抽帧（找不到 ffmpeg 时自动当作关闭；关掉 `imageToModel` 时也不截） |
| | `videoMaxFrames` | `4` | 每个视频最多截几张，整段平均分布 |
| | `videoSecondsPerFrame` | `5` | 短视频少截：每多少秒最多一张 |
| | `videoMaxEdge` | `1024` | 截图最长边（像素） |
| | `videoMaxMB` / `videoMaxMinutes` | `100` / `10` | 超过这么大或这么长只截封面 |
| | `videoTimeoutSeconds` | `30` | 一个视频最多处理几秒，超时只写 `[视频]` |
| | `ffmpegPath` | 空 | ffmpeg 位置；空 = 先找插件自己装的，再找系统里的 |
| 会话 | `workspacePath` | 空 | QQ 会话的工作目录 |
| | `uniqueSession` | `false` | 群里每人单独一个会话 |
| | `agentPreset` | 空 | 默认预设 |
| | `adminPrivateAgentPreset` / `privateAgentPreset` / `groupAgentPreset` | 空 | 分类型预设 |
| | `watchEnabled` / `watchIntervalMinutes` / `watchGraceMinutes` / `alertRepeatHours` / `alertOnRecover` | `true` / `2` / `3` / `6` / `true` | 小号掉线检测：SnowLuma 下线通知、心跳、定时主动问；问题持续几分钟才提醒，没恢复每几小时再提醒，恢复发一条 |
| | `mailEnabled` / `smtpHost` / `smtpPort` / `smtpUser` / `smtpPass` / `mailTo` | `false` / 空 / `465` / 空 / 空 / 空 | 邮件提醒（`smtpPass` 是邮箱授权码，密钥；`mailTo` 空 = 发给自己） |
| | `pushService` / `pushKey` | `off` / 空 | 微信推送：`serverchan`（Server酱 SendKey）或 `pushplus`（token），Key 是密钥 |
| | `adminPrivateModel` / `privateModel` / `groupModel` | `deepseek-official/deepseek-flash` | 分类型模型，`提供方/模型`；设置页里从 dsh 已配置的模型里选 |
| | `adminPrivateReasoning` / `privateReasoning` / `groupReasoning` | `high` / `low` / `low` | 分类型思考等级，按模型支持的档来（DeepSeek：`off` / `low` / `high` / `max`；设置页下拉里只列这个模型支持的）；改了以后，那个会话下一条消息起生效（正在回复的等说完），聊天记录不变 |
| | `silenceToken` | `[不发]` | 她的回复以这个开头时不发出去（主动唤醒时她决定不说话） |
| | `nudgeOnEmpty` | `true` | 她一轮什么都没说出来（话只在思考里）时自动提醒她一次把话说出来 |
| 发消息节奏 | `typingPrivate` / `typingGroup` | `true` / `true` | 私聊、群里模拟打字 |
| | `typingCharsPerMinute` / `typingMinSeconds` / `typingMaxSeconds` | `100` / `1` / `10` | 打字速度（0 = 不等）、最少和最多等几秒 |
| | `groupMinGapSeconds` / `groupMaxPerWindow` / `groupWindowSeconds` | `5` / `5` / `60` | 同一个群她两条之间至少隔几秒、一段时间里最多几条（0 = 不限） |
| | `sendMaxWaitSeconds` | `120` | 为了守频率最多排队几秒，超过就不发 |
| 群聊回复对象 | `groupReplyMention` / `groupReplyQuote` | `false` / `false` | 设置页「发消息 → 群聊回复对象」：回复时 @ 对方 / 引用原消息，可独立启用。只加在首条实际发送的文字；引用触发本轮的来信，不是来信里引用的旧消息。群指令也生效；私聊、主动聊天、纯语音不附加，语音随附文字或失败回退文字时生效。多条来信进入同一轮时使用本轮最后实际消费的一条；排队期间新来信不改变已生成回复的对象 |
| 分段发送 | `segmentAdminPrivate` / `segmentPrivate` / `segmentGroup` | `true` / `false` / `false` | 把一次回复按行拆成几条发（代码块不拆）；每条按自己的字数等打字，但每条最多 `segmentMaxSeconds` 秒 |
| | `segmentMax` / `segmentMaxSeconds` | `10` / `3` | 一次最多拆成几条（多出来的并进最后一条）；拆开时每条最多等几秒打字 |
| 语音回复 | `ttsEnabled` | `false` | 文字转语音：她的回复可以用语音发（mp3 交给 SnowLuma 转成 QQ 语音） |
| | `ttsMode` / `ttsChance` | `tag` / `30` | 什么时候用语音：`tag` 她自己决定（要念的那一行开头写 `[语音]`，每条消息会提示她怎么用）、`always` 每条都用、`chance` 按概率（%，按一次回复算） |
| | `ttsAdminPrivate` / `ttsPrivate` / `ttsGroup` | `true` / `false` / `false` | 主人私聊、其他私聊、群聊里能不能发语音；不能发的会话里 `[语音]` 记号会被去掉 |
| | `ttsMaxChars` / `ttsSpeed` | `150` / `100` | 一条语音最多几个字（超过发文字）；语速 %（50–150） |
| | `ttsStripParens` / `ttsAlsoText` | `true` / `false` | 念之前去掉括号里的动作和 Markdown 符号；语音后再发一条文字 |
| | `breezeApiKey` / `breezeVoiceId` / `breezeModel` / `breezeLanguage` | 不设 / 空 / `breeze-tts-2` / `zh` | BreezeBlue（先用）：Key（密钥）、音色 id（克隆音色也行，和 Key 同一个账号）、模型、语言（`auto` = 自己判断） |
| | `inworldApiKey` / `inworldVoiceId` / `inworldModel` | 不设 / 空 / `inworld-tts-2-flash` | Inworld（BreezeBlue 这一条连不上、出错或额度用完时，这一条用它）：Key（后台给的 Basic 那一串，密钥）、音色 id（和 Key 同一个工作区）、模型 |
| 指令 | `commandsEnabled` / `noPermissionReply` | `true` / `true` | QQ 指令；没有权限时回一句 |
| 日志 | `logLevel` | `info` | 日志级别 |

## QQ 指令

白名单开启时，普通群成员查「群聊白名单」，其他人的私聊查「其他人私聊白名单」，两份名单互不影响；对应名单为空时禁止对应普通会话。管理员私聊及管理员在群内发言始终允许，不用列入名单，也不受入口/群发送限频约束；群内仍按 @、关键词等正常唤醒方式触发，打字和分段设置照常使用。

普通会话被移出对应名单后，生成中或排队的回复仍会在发送前复查。管理员群内豁免只跟随这一轮真实来信，不会留给下一条普通成员消息，也不能放行群主动聊天。群里仍不提供主人私聊的私密记忆或改人格权限；管理员发言的豁免不会改变会话记忆隔离。未唤醒的群消息仍按存档设置保存。

以唤醒前缀开头：`/help`、`/sid`（查看会话标识，加白名单时用）、`/new`、`/reset`（换一个新的 dsh 会话）、`/stop`（停止她正在进行的回复）。群里 `/new`、`/reset` 只有管理员、群主、群管理能用。

## 给其他插件用

```ts
// 每条消息（包括没唤醒的群消息、通知、请求）
ctx.on('snowluma/message', (abm, event, isWake) => {
  abm.session_id   // 群号或对方 QQ 号
  abm.sender       // { user_id, nickname }
  abm.message_str  // 纯文字
  abm.message      // 消息段
  abm.raw_message  // SnowLuma 原始数据
  abm.timestamp    // QQ 上的发送时间（秒）
  abm.event_text   // 通知和请求的中文描述，例如「小明(42) 撤回了一条消息：……」
})

// 交给模型之前（按顺序等每个监听者，最多等 30 秒）：直接改 payload.content，往前后插文字或图片
ctx.on('snowluma/prompt', async payload => {
  payload.info        // 会话信息，见下面 sessionInfo
  payload.newSession  // 这是这个 dsh 会话的第一轮
  payload.message     // 唤醒她的那条消息（AstrBotMessage）
  payload.content.unshift({ type: 'text', text: '<记忆>……</记忆>' })
  payload.content.push({ type: 'image', mediaType: 'image/png', data: '<base64>' })  // 插件一统一交给 dsh 附件服务
})

// 她发出了一条 QQ 消息（一轮说完的回复，或者别的插件用 sendBySession 发的）
ctx.on('snowluma/sent', ({ umo, session, text, chain, source, time }) => {})

// QQ 会话换了新的 dsh 会话（/new、/reset，或者调用了 rotateSession）
ctx.on('snowluma/session-changed', ({ umo, oldSessionId, newSessionId, reason }) => {})

// 服务
ctx.snowluma.callAction('get_group_info', { group_id: 123 })
ctx.snowluma.sendBySession({ platform_name: 'snowluma', message_type: 'FriendMessage', session_id: '123' }, { chain: [{ type: 'Plain', text: '你好' }] })
ctx.snowluma.sessions()                  // [{ umo, sessionId }]
ctx.snowluma.masterPrivateBindings()      // 当前管理员 QQ 私聊的 ownerId/prefix/sessionId/cwd（供原始会话备份）
await ctx.snowluma.restoreMasterPrivateBinding(ownerId, sessionId) // 接回已恢复的新日志；仅当前管理员，原会话保留
ctx.snowluma.sessionInfo(dsh会话id)       // { umo, sessionId, platformId, selfId, type: 'private'|'group', userId?, groupId?, adminPrivate }；
                                       // 建会话之前就登记好，预设里的插件在 setup 时就能查到；不是 QQ 会话时 undefined
ctx.snowluma.sessionInfoByUmo(umo)
await ctx.snowluma.rotateSession(umo)    // 换一个新的 dsh 会话，旧的留在 dsh 里；返回 { oldSessionId, newSessionId }
await ctx.snowluma.wake(umo, 内容)       // 主动唤醒她（来源 plugin:snowluma-bridge-wake）；回复照常发到 QQ，以「不发」暗号开头时不发
await ctx.snowluma.media.convert(消息段)  // 图片原图、语音转文字、视频截图（按本插件的设置）→ { text, parts, used, failed }
await ctx.snowluma.media.admit(内容)      // 交给 dsh 附件服务（插件一在 snowluma/prompt 之后会自动做，自己发内容时才用）
```

## 开发

```bash
scripts/setup-test-env.sh          # 装官方 Node 和 dsh 到 .cache/test-env（DSH_VERSION 可指定 dsh 版本）
scripts/check.sh                   # 安装依赖、编译、单元测试、端到端测试（真实 dsh + 假模型 + 假 SnowLuma）、扫描密钥
node scripts/check-upstreams.mjs   # 看 dsh、AstrBot、aiocqhttp、SnowLuma、Linux QQ、QFace、Node、ffmpeg 构建有没有新版本（对照 upstreams.json）
node scripts/update-qface.mjs      # 从 QFace 重新生成小黄脸名字表
```

`lib/` 是编译产物，要提交进仓库（dsh 从 GitHub 安装时不跑构建）。

## 许可证

AGPL-3.0-or-later。代码移植自 AstrBot（AGPL-3.0-or-later）和 aiocqhttp（MIT），署名见 [NOTICE.md](NOTICE.md)。一键安装的 ffmpeg 是运行时从 BtbN/FFmpeg-Builds 下载的 LGPL 版，不随本插件分发。


### 消息存档权限（v0.19.0）

`ctx.snowluma.canArchive(session)` 返回当前 QQ 会话是否允许存档。白名单开启时群必须在群名单内（不因管理员发言放行），普通私聊须在私聊名单内，管理员私聊自动允许；白名单关闭时不限制。companion-core ≥ v0.13.0 在收发存档和图片落盘前调用此接口，不能用未唤醒消息存档开关绕过。此接口与管理员群内回复权限分开，历史存档和 dsh 自身会话日志不自动删除。


### 关键词唤醒与 @ 他人（v0.19.1）

关键词只在收到的正文（Plain 消息段）中匹配，不匹配 @ 对象的群昵称、名称或QQ号，也不会跨非正文段拼接词语。正文确实提到唤醒词、真实 @机器人、引用机器人和原有前缀唤醒仍按原规则处理；交给模型的消息保留 @对象信息。

### 0.20.1：移除独立判断

按用户要求移除独立群聊判断及其设置、额外模型请求和上下文接口。群聊命中正文唤醒词、真实 @机器人、引用机器人或唤醒前缀后，按既有访问规则直接进入正式回复流程。没有额外判断模型调用。正式回复的群上下文、人格和记忆继续沿用原流程。

### 0.20.2：设置帮助说明

统一重写全部现有中英文设置帮助，并为原先缺少说明的设置补充“？”角标。说明覆盖用途、适用范围、默认值、输入格式及关联条件；唤醒前缀、白名单与存档边界、会话模型生效时间等表述已核实。仅调整帮助文字及角标，功能、配置字段和默认值保持不变。

### 0.20.3：代码审查与精简

- 清理未使用的设置词条、局部变量和客户端模块包装；简化 React 状态声明、事件订阅、消息段转换及 WebSocket 单连接选择。
- 启用未使用变量/参数编译检查；测试文件自动发现，完整检查不再重复运行同一套单元测试，失败时保留完整输出。
- 权限、两份白名单、唤醒、存档接口、群回复目标、媒体和发送行为及默认值保持。
