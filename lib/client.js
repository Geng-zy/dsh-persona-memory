// dsh-napcat-bridge 设置页（浏览器一侧）。
// 注册到 dsh「插件」页的 plugins.bundle.config 扩展点：在插件页打开本插件即可看到。
// 表单读写 dsh 设置服务里本插件的配置行（id: napcat-bridge），保存后插件立即读到新值。
// 只用 dsh 自带的表单组件和 --dsw-* 颜色变量，外观随 dsh 的主题（深色/浅色）变化。
// 这个文件不经过打包，构建时原样复制到 lib/client.js。
window.__ModuleLoader__.load({
	id: "dsh-napcat-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var reactModule = require("react");
		var React = typeof reactModule.createElement === "function" ? reactModule : reactModule.default;
		var P = require("@deepseek-ai/dsh-client-ui-primitives");
		var h = React.createElement;

		/** 词条命名空间 */
		var NS = "napcatBridge";
		/** 插件包名（plugins.bundle.config 的 key） */
		var PACKAGE = "dsh-napcat-bridge";
		/** 设置服务里的配置行 id（cordis.patch.yml 里的 id） */
		var SECTION = "napcat-bridge";

		var zh = {
			reasoningMinimal: "最少（minimal）",
			reasoningMedium: "中（medium）",
			reasoningUnsupported: "（这个模型不支持）",
			reasoningNone: "这个模型不能调思考等级。",
			dshModelsFailed: "读不到 dsh 的模型列表：{error}",
			loadingModels: "正在读取…",
			modelBlankDefault: "不单独设（用 dsh 的默认模型）",
			modelBlankAdmin: "不单独设（用「其他私聊」的设置，再空就用 dsh 默认模型）",
			modelPickHint: "dsh 网页「设置 → 模型」里已经配置好的模型，按服务商分组。改了以后这类聊天下一条消息起换模型（正在回复的等它说完），聊天记录不变。",
			langIsEn: "0",
			provider: "服务商",
			providerHint: "选一家就自动填好接口地址和常用模型；不在列表里的选「自定义」，自己填接口地址（OpenAI 兼容，到 /v1 为止）。",
			providerSearch: "搜索服务商",
			providerCustom: "自定义（OpenAI 兼容）",
			providerGetKey: "去这家拿 Key ↗",
			pModelHint: "点「获取模型列表」用填的 Key 去这家拉你能用的模型；拉不到时下拉里是这家常用的几个。也可以选「手动填写」。",
			modelFetch: "获取模型列表",
			modelFetching: "正在获取…",
			modelFetched: "拿到 {n} 个可用的模型，在下拉里选。",
			modelFetchedAll: "拿到 {n} 个模型（从名字看不出哪些能用在这里，全列出来了）。",
			modelFetchFailed: "没拉到模型列表：{error}。下拉里是这家常用的模型。",
			modelManual: "手动填写…",
			modelManualLabel: "模型名（手动填写）",
			modelPickList: "从列表选",
			modelNoteArk: "火山方舟的模型可以填模型名，也可以填控制台里建的推理接入点 ID（ep- 开头）。",
			modelNoteLocal: "本机服务：先在服务器上装好并下载模型；Key 随便填一个（比如 local）。",
			summary: "把 NapCat（OneBot v11）接到 dsh，照搬 AstrBot 的 aiocqhttp 适配器。",
			connection: "连接",
			connectionHint: "NapCat 在「网络配置」里新建 WebSocket 客户端，地址填 ws://<地址>:<端口>/ws，Token 与这里一致。改监听地址或端口后插件会自动重新监听，NapCat 会自动重连。",
			host: "监听地址",
			hostHint: "0.0.0.0 表示所有网卡都能连；NapCat 和 dsh 在同一台机器上时可以填 127.0.0.1，只允许本机连。",
			port: "端口",
			portHint: "1–65535。",
			token: "Token",
			tokenHint: "留空表示保持当前 Token。与 NapCat 里填的一致；没有 Token 时不校验，任何人都能连。",
			napcatSetupHint: "NapCat 那边：网络配置 → 新建「WebSocket 客户端」，URL 填 {url}，消息格式 Array，Token 填和这里一样的。用部署脚本装的话这些已经配好了。",
			tokenGenerate: "随机生成 Token",
			tokenCopy: "复制",
			tokenCopied: "已复制",
			tokenGenerated: "已经填进上面的框：先点「保存」，再把它填进 NapCat 的 WebSocket 客户端。离开页面后不会再显示。",
			tokenSet: "已设置 Token。",
			tokenUnset: "没有设置 Token，连接不校验。",
			platformId: "平台 ID",
			platformIdHint: "会话标识的第一段（平台ID:消息类型:会话ID）。改了以后已有的 QQ 会话会对应到新的 dsh 会话。",
			wake: "唤醒",
			wakeHint: "私聊默认都交给模型；群里 @ 她、引用她的消息、以唤醒前缀开头、或者提到唤醒词时才交给模型。",
			wakePrefix: "唤醒前缀",
			wakePrefixHint: "多个用空格或逗号分开，例如 / #。全部删掉表示不用前缀唤醒。",
			wakeKeywords: "唤醒词（群里）",
			wakeKeywordsHint: "群消息里出现这些词，不用 @ 她也会被唤醒来接话（比如她的名字）。多个用空格或逗号分开，英文不分大小写。全部删掉就只有 @、引用、前缀能唤醒。私聊本来每条都会唤醒，不受影响。",
			friendNeedsPrefix: "私聊也需要唤醒前缀",
			ignoreSelf: "忽略她自己发出的消息",
			model: "交给模型的内容",
			identifier: "群消息前面加 [昵称(QQ号)]",
			identifierHint: "让她分得清群里谁在说话。",
			imageToModel: "图片交给模型",
			imageToModelHint: "包括商城表情和被引用消息里的图片。模型要能看图（如 deepseek-flash）。",
			maxImages: "每条消息最多几张图片",
			maxImagesHint: "0 表示不限。",
			session: "会话",
			workspacePath: "工作目录",
			workspacePathHint: "QQ 会话在 dsh 里使用的目录（绝对路径）。留空用 dsh 进程当前目录。",
			agentPreset: "默认的 Agent 预设",
			agentPresetHint: "QQ 会话使用的预设 id，留空用 dsh 的默认预设。",
			log: "日志",
			logLevel: "日志级别",
			logLevelHint: "debug 会记录每条收到的原始消息，排查问题时再开。",
			friendNeedsPrefixHint: "打开后私聊也要以唤醒前缀开头才交给模型。",
			ignoreSelfHint: "她在别的设备上用这个 QQ 号发的消息，NapCat 也会推过来；打开后这些消息不交给模型。",
			test: "测试连接",
			testing: "测试中…",
			testUsesSaved: "测试用的是已保存的设置。",
			testOk: "已连接：{who}，Token 校验通过。",
			testOkNoToken: "已连接：{who}。没有设置 Token，任何人都能连。",
			testConnectedApiFailed: "NapCat 已连上，但调用接口没有成功：{error}",
			testRejectedMissing: "{minutes} 分钟内有 NapCat 来连接，但没带 Token。请在 NapCat 里填上和这里一致的 Token。",
			testRejectedWrong: "{minutes} 分钟内有 NapCat 来连接，但 Token 不对。请检查 NapCat 里填的 Token。",
			testNoClient: "插件正在监听 {address}，但还没有 NapCat 连上来。请在 NapCat 里新建 WebSocket 客户端并填对地址和 Token。",
			testNotListening: "插件没有在监听 {address}，可能端口被占用，请换一个端口。",
			testFailed: "测试失败：{error}",
			access: "访问控制",
			accessHint: "谁能让她回话，以及每个会话多快能处理一条。管理员在群里和私聊都可以不受白名单限制。",
			admins: "管理员 QQ 号",
			adminsHint: "多个用空格或逗号分开。管理员可以在群里用 /new /reset，可以不受白名单限制，开了「告诉模型管理员身份」时她也会知道。",
			whitelistEnabled: "启用白名单",
			whitelistEnabledHint: "白名单是空的时候不检查，谁都能找她。",
			whitelist: "白名单",
			whitelistHint: "群号、QQ 号（只对私聊有效）或完整会话标识（发 /sid 可以查），多个用空格或逗号分开。",
			wlAdminGroup: "群里管理员不受白名单限制",
			wlAdminFriend: "私聊管理员不受白名单限制",
			wlLog: "不在白名单时记日志",
			wlLogHint: "日志里会写出被挡下的会话标识，方便你加进白名单。",
			rateCount: "频率限制：最多几条",
			rateCountHint: "同一个会话在下面的时间窗口里最多处理几条消息。0 表示不限。",
			rateSeconds: "频率限制：时间窗口（秒）",
			rateSecondsHint: "默认 60 秒。",
			rateStrategy: "超出以后",
			rateStrategyHint: "排队：等窗口过去再处理；丢弃：直接不处理。",
			rateStall: "排队等",
			rateDiscard: "丢弃",
			invalidPositive: "请填正整数",
			emptyWaiting: "只 @ 她不说话时等下一条",
			emptyWaitingHint: "有人只 @ 她、或只发唤醒前缀时，把这个人 60 秒内的下一条当成对她说的。",
			emptyReply: "只 @ 她时先让她问一句",
			emptyReplyHint: "让她先自然地问一句「想聊什么」。",
			markAdmin: "告诉模型管理员身份",
			markAdminHint: "发送者是管理员时，在给模型的提示里写明（本插件新增，AstrBot 没有）。",
			groupName: "告诉模型群名",
			groupNameHint: "在给模型的提示里写上当前群名。",
			datetime: "告诉模型当前时间",
			datetimeHint: "在给模型的提示里写上日期、时间和星期。",
			timezone: "时区",
			timezoneHint: "IANA 时区名，例如 Asia/Shanghai。",
			stt: "语音转文字",
			sttHint: "收到语音时转成文字交给她。关闭时她只会看到「[语音]」。",
			sttMode: "方式",
			sttOff: "关闭",
			sttCommandMode: "本机命令",
			sttOpenai: "OpenAI 兼容接口",
			sttCommand: "命令",
			sttCommandHint: "在 dsh 所在的机器上运行，{file} 换成语音文件路径（wav），命令输出的内容就是转出来的文字。例如 sherpa-onnx 的离线识别命令。",
			sttApiUrl: "接口地址",
			sttApiUrlHint: "选了服务商会自动填；自定义时写到 /v1 为止，插件会请求 /audio/transcriptions。",
			sttApiKey: "接口 Key",
			sttApiKeyHint: "不会显示出来；留空表示保持当前 Key。",
			keySet: "已设置 Key。",
			keyUnset: "没有设置 Key。",
			sttModel: "模型",
			sttModelHint: "例如 FunAudioLLM/SenseVoiceSmall。",
			video: "视频",
			videoHint: "DeepSeek 模型看不了视频原件，所以用 ffmpeg 从视频里截几张画面当图片给她看，前面附一句「视频，时长 0:32，以下是截取的 4 张画面」。没有 ffmpeg 或关掉时她只看到「[视频]」。截图也算在「每条消息最多几张图片」里。",
			videoFrames: "视频抽帧",
			videoFramesHint: "找不到 ffmpeg 时自动当作关闭。",
			videoMaxFrames: "每个视频最多截几张",
			videoMaxFramesHint: "在整段视频里平均分布，第一张取开头附近。张数越多看得越全，也越费钱。",
			videoSecondsPerFrame: "短视频少截：每多少秒最多一张",
			videoSecondsPerFrameHint: "默认 5：10 秒的视频只截 2 张，不会硬凑满。",
			videoMaxEdge: "截图最长边（像素）",
			videoMaxEdgeHint: "默认 1024。再大对看清内容帮助不大，只会多花钱。",
			videoMaxMB: "超过多大只截封面（MB）",
			videoMaxMBHint: "太大的视频处理慢，只截一张。",
			videoMaxMinutes: "超过多长只截封面（分钟）",
			videoMaxMinutesHint: "太长的视频只截一张。",
			videoTimeout: "处理超时（秒）",
			videoTimeoutHint: "一个视频最多处理这么久，超时就只写 [视频]。",
			ffmpegPath: "ffmpeg 位置",
			ffmpegPathHint: "一般不用填。留空时先找下面「安装」装到插件目录里的，再找系统里的。",
			ffmpegChecking: "正在查找 ffmpeg…",
			ffmpegFound: "已找到 ffmpeg（{source}）：{path} · {version}",
			ffmpegPathAuto: "留空，自动用：{path}",
			ffmpegSourceConfigured: "上面填的位置",
			ffmpegSourceBundled: "插件目录",
			ffmpegSourceSystem: "系统里的",
			ffmpegMissing: "没找到 ffmpeg，视频只会写成「[视频]」。可以点下面的「安装 ffmpeg」（要能连上 GitHub）；服务器连不上 GitHub 时，用有管理员权限的用户运行 sudo apt install -y ffmpeg，再点「重新查找」。",
			ffmpegInstall: "安装 ffmpeg",
			ffmpegInstallConfirm: "从 GitHub（BtbN/FFmpeg-Builds）下载独立版 ffmpeg，大约 140MB，核对 SHA256 后放进插件目录，不需要管理员权限，也不改系统。现在安装吗？",
			ffmpegInstallYes: "确认安装",
			ffmpegInstallNo: "取消",
			ffmpegUnsupported: "一键安装只支持 Linux（x64 / arm64），这台机器是 {platform}。请自己安装 ffmpeg，例如 Mac 上运行 brew install ffmpeg。",
			ffmpegDownloading: "正在下载 {asset}：{percent}（{received} / {total} MB）",
			ffmpegVerifying: "正在核对 SHA256…",
			ffmpegExtracting: "正在解压…",
			ffmpegDone: "安装完成：{version}",
			ffmpegFailed: "安装失败：{error}",
			ffmpegRecheck: "重新查找",
			sessionHint: "这些设置只影响新建的会话；已经在聊的会话发 /new 之后才会用上。",
			tabsLabel: "设置分类",
			tab_conn: "连接和权限",
			tab_session: "会话和模型",
			tab_content: "消息内容",
			tab_send: "发消息",
			tab_log: "日志",
			rateSub: "频率限制",
			presetSub: "预设",
			modelSub: "模型和思考等级",
			silenceSub: "主动唤醒",
			typingSub: "模拟打字",
			segmentSub: "分段发送",
			groupRateSub: "群里的发言频率",
			sttTest: "测试语音转文字",
			sttTestOk: "能用：{ms} 毫秒有回应（测试用的是一秒静音，转出来：{text}）。",
			sttTestEmpty: "空的，正常",
			silenceToken: "「不发」暗号",
			paceSec: "发消息节奏",
			paceHint: "让她像真人一样回消息：发之前按打字速度等一会儿；群里两条之间隔开，一段时间里不刷屏。同一个会话的消息按顺序发。只管她自己的回复（包括主动聊天），别的插件代发的不受影响。",
			typingPrivate: "私聊里模拟打字",
			typingGroup: "群里模拟打字",
			typingCharsPerMinute: "打字速度（每分钟几个字）",
			typingCharsPerMinuteHint: "0 表示不等。默认 100（每个字 0.6 秒）：10 个字等 6 秒，最少 1 秒、最多 10 秒。分段发送时每条各按自己的字数算，但不超过下面「分段时每条最多等几秒」。",
			typingMinSeconds: "最少等几秒",
			typingMaxSeconds: "最多等几秒",
			typingMaxSecondsHint: "长回复也不会让人等太久。",
			groupMinGapSeconds: "群里两条之间至少隔几秒",
			groupMaxPerWindow: "群里一段时间最多发几条",
			groupWindowSeconds: "这段时间是几秒",
			sendMaxWaitSeconds: "最多排队等几秒",
			sendMaxWaitSecondsHint: "为了守上面的频率要等太久时，这条就不发了（日志里会记）。",
			segmentAdminPrivate: "管理员私聊分段发送",
			segmentPrivate: "其他私聊分段发送",
			segmentGroup: "群聊分段发送",
			segmentHint: "把她一次的回复按行拆成几条 QQ 消息，一句一条地发（代码块整段不拆），每一条按自己的字数等一会儿，但不超过「分段时每条最多等几秒」。",
			segmentMax: "一次最多拆成几条",
			segmentMaxSeconds: "分段时每条最多等几秒",
			segmentMaxSecondsHint: "拆开发时，每一条按打字速度等，但最多等这么久。默认 3 秒：八行的回复大约二十秒发完。",
			segmentMaxHint: "多出来的并进最后一条，免得刷屏。默认 10。",
			silenceTokenHint: "她的回复以这个开头时不发到 QQ。别的插件主动唤醒她（比如定时主动聊天）时，她用它表示这次不说话。留空表示不用暗号。",
			uniqueSession: "群里每人单独一个会话",
			uniqueSessionHint: "打开后同一个群里每个人和她的对话分开记。",
			adminPrivatePreset: "管理员私聊用的预设",
			privatePreset: "私聊用的预设",
			groupPreset: "群聊用的预设",
			presetOverrideHint: "留空就用上一级：管理员私聊 → 私聊 → 默认的 Agent 预设。",
			adminPrivateModel: "管理员私聊用的模型",
			privateModel: "私聊用的模型",
			groupModel: "群聊用的模型",
			modelHint: "写成 提供方/模型，例如 deepseek-official/deepseek-flash（用 API Key 的 DeepSeek）；留空用上一级，都空就用 dsh 的默认模型。",
			adminPrivateReasoning: "管理员私聊的思考等级",
			privateReasoning: "其他私聊的思考等级",
			groupReasoning: "群聊的思考等级",
			reasoningHint: "思考深度，越高越慢、越费 token；下拉里只列这个模型支持的档（DeepSeek：不思考 / 低 / 高 / 最高）。改了以后，这个会话下一条消息起生效（正在回复的等它说完），聊天记录不变。",
			reasoningOff: "不思考（off）",
			reasoningLow: "低（low）",
			reasoningHigh: "高（high）",
			reasoningMax: "最高（max）",
			commands: "指令",
			commandsHint: "以唤醒前缀开头，例如 /help、/sid、/new、/reset、/stop。群里 /new 和 /reset 只有管理员、群主和群管理能用。",
			commandsEnabled: "启用 QQ 里的指令",
			noPermissionReply: "没有权限时回一句",
			noPermissionReplyHint: "关掉的话没有权限的人用指令时她什么都不说。",
			overridden: "已修改",
			reset: "恢复默认",
			invalid: "格式不对",
			invalidPort: "请填 1–65535 的整数",
			invalidCount: "请填 0 或正整数",
			readOnly: "本部署的设置为只读。",
			unavailable: "插件当前没有加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "没有保存成功，修改已保留，请检查后重试。"
		};
		var en = {
			reasoningMinimal: "Minimal",
			reasoningMedium: "Medium",
			reasoningUnsupported: " (not supported)",
			reasoningNone: "This model's reasoning cannot be adjusted.",
			dshModelsFailed: "Could not read dsh models: {error}",
			loadingModels: "Loading…",
			modelBlankDefault: "Not set (dsh's default model)",
			modelBlankAdmin: "Not set (use the other-private setting, then dsh default)",
			modelPickHint: "Models configured in dsh Settings → Models, grouped by provider. Takes effect from the next message.",
			langIsEn: "1",
			provider: "Provider",
			providerHint: "Pick one to fill in the API address and common models; choose Custom for any other OpenAI-compatible API (address up to /v1).",
			providerSearch: "Search providers",
			providerCustom: "Custom (OpenAI compatible)",
			providerGetKey: "Get a key ↗",
			pModelHint: "\"Fetch models\" lists the models your key can use; if that fails the list shows this provider's common models. You can also type one.",
			modelFetch: "Fetch models",
			modelFetching: "Fetching…",
			modelFetched: "Found {n} usable models.",
			modelFetchedAll: "Found {n} models (could not tell which fit, showing all).",
			modelFetchFailed: "Could not list models: {error}. Showing common ones.",
			modelManual: "Type a model…",
			modelManualLabel: "Model name",
			modelPickList: "Pick from list",
			modelNoteArk: "Ark accepts a model name or an endpoint ID (ep-…).",
			modelNoteLocal: "Local service: install it and pull the model on the server first; any key works (e.g. local).",
			summary: "Connect NapCat (OneBot v11) to dsh, a port of AstrBot's aiocqhttp adapter.",
			connection: "Connection",
			connectionHint: "In NapCat, add a WebSocket client at ws://<host>:<port>/ws with the same token. Changing the address or port makes the plugin listen again; NapCat reconnects by itself.",
			host: "Listen address",
			hostHint: "0.0.0.0 accepts every interface (AstrBot's default); use 127.0.0.1 when NapCat runs on the same machine.",
			port: "Port",
			portHint: "1–65535.",
			token: "Token",
			tokenHint: "Leave blank to keep the current token. Must match NapCat; without a token, connections are not checked.",
			napcatSetupHint: "In NapCat: Network → new \"WebSocket client\", URL {url}, message format Array, same token as here. The deploy script sets this up for you.",
			tokenGenerate: "Generate token",
			tokenCopy: "Copy",
			tokenCopied: "Copied",
			tokenGenerated: "Put into the field above: click Save, then paste it into NapCat's WebSocket client. It is not shown again after you leave.",
			tokenSet: "A token is set.",
			tokenUnset: "No token: connections are not checked.",
			platformId: "Platform ID",
			platformIdHint: "First part of the session key (platform:type:session). Changing it maps QQ chats to new dsh sessions.",
			wake: "Wake",
			wakeHint: "Private chats always reach the model; in groups only an @, a reply to her, or a wake prefix does.",
			wakePrefix: "Wake prefixes",
			wakeKeywords: "Wake words (groups)",
			wakeKeywordsHint: "A group message containing any of these wakes her without an @. Separate with spaces or commas; case-insensitive.",
			wakePrefixHint: "Separate with spaces or commas, e.g. / #. Remove all to disable prefixes.",
			friendNeedsPrefix: "Private chats need a wake prefix too",
			ignoreSelf: "Ignore messages she sent herself",
			model: "What the model receives",
			identifier: "Prefix group messages with [nickname(QQ)]",
			identifierHint: "So she can tell who is speaking in a group.",
			imageToModel: "Send images to the model",
			imageToModelHint: "Including market stickers and images in quoted messages. The model must accept images (e.g. deepseek-flash).",
			maxImages: "Max images per message",
			maxImagesHint: "0 means no limit.",
			session: "Sessions",
			workspacePath: "Working directory",
			workspacePathHint: "Absolute directory QQ sessions use in dsh; blank uses the dsh process directory. Affects new sessions only.",
			agentPreset: "Agent preset",
			agentPresetHint: "Preset id for QQ sessions; blank uses the default. Affects new sessions only.",
			log: "Logging",
			logLevel: "Log level",
			logLevelHint: "debug logs every raw message; turn it on only while troubleshooting.",
			friendNeedsPrefixHint: "When on, private chats also need a wake prefix to reach the model.",
			ignoreSelfHint: "NapCat also reports messages this QQ account sends from other devices; when on, they are not sent to the model.",
			test: "Test connection",
			testing: "Testing…",
			testUsesSaved: "The test uses the saved settings.",
			testOk: "Connected: {who}; token accepted.",
			testOkNoToken: "Connected: {who}. No token is set, so anyone can connect.",
			testConnectedApiFailed: "NapCat is connected but the API call failed: {error}",
			testRejectedMissing: "Within {minutes} min a NapCat tried to connect without a token. Set the same token in NapCat.",
			testRejectedWrong: "Within {minutes} min a NapCat tried to connect with a wrong token. Check the token in NapCat.",
			testNoClient: "Listening on {address}, but no NapCat has connected. Add a WebSocket client in NapCat with this address and token.",
			testNotListening: "Not listening on {address}; the port may be in use. Try another port.",
			testFailed: "Test failed: {error}",
			access: "Access control",
			accessHint: "Who can get a reply, and how fast each chat is processed. Admins can bypass the allowlist.",
			admins: "Admin QQ numbers",
			adminsHint: "Separate with spaces or commas. Admins can use /new and /reset in groups and may bypass the allowlist.",
			whitelistEnabled: "Enable allowlist",
			whitelistEnabledHint: "An empty allowlist is not enforced.",
			whitelist: "Allowlist",
			whitelistHint: "Group numbers, QQ numbers (private chats) or full session keys (see /sid), separated by spaces or commas.",
			wlAdminGroup: "Admins bypass the allowlist in groups",
			wlAdminFriend: "Admins bypass the allowlist in private chats",
			wlLog: "Log blocked chats",
			wlLogHint: "The log names the blocked session key so you can add it.",
			rateCount: "Rate limit: max messages",
			rateCountHint: "Messages one chat may have processed per window. 0 means no limit.",
			rateSeconds: "Rate limit: window (seconds)",
			rateSecondsHint: "Default 60.",
			rateStrategy: "When exceeded",
			rateStrategyHint: "Queue waits for the window; drop discards the message.",
			rateStall: "Queue",
			rateDiscard: "Drop",
			invalidPositive: "Enter a positive integer",
			emptyWaiting: "Wait after an empty mention",
			emptyWaitingHint: "When someone only @-mentions her or sends just a wake prefix, their next message within 60 s is treated as addressed to her.",
			emptyReply: "Ask back on an empty mention",
			emptyReplyHint: "She first asks what they want to talk about.",
			markAdmin: "Tell the model about admins",
			markAdminHint: "Note in the prompt when the sender is an admin (not in AstrBot).",
			groupName: "Tell the model the group name",
			groupNameHint: "Adds the group name to the prompt.",
			datetime: "Tell the model the time",
			datetimeHint: "Adds date, time and weekday to the prompt.",
			timezone: "Time zone",
			timezoneHint: "IANA name, e.g. Asia/Shanghai.",
			stt: "Speech to text",
			sttHint: "Transcribe voice messages for her. When off she only sees [语音].",
			sttMode: "Method",
			sttOff: "Off",
			sttCommandMode: "Local command",
			sttOpenai: "OpenAI-compatible API",
			sttCommand: "Command",
			sttCommandHint: "Runs on the dsh machine; {file} becomes the voice file path (wav) and its output is the text.",
			sttApiUrl: "API base URL",
			sttApiUrlHint: "Up to /v1, e.g. https://api.siliconflow.cn/v1; the plugin calls /audio/transcriptions.",
			sttApiKey: "API key",
			sttApiKeyHint: "Never shown; leave blank to keep the current key.",
			keySet: "A key is set.",
			keyUnset: "No key is set.",
			sttModel: "Model",
			sttModelHint: "e.g. FunAudioLLM/SenseVoiceSmall.",
			video: "Video",
			videoHint: "DeepSeek models cannot take video, so ffmpeg grabs a few frames and sends them as images with a note such as \"video, 0:32, 4 frames follow\". Without ffmpeg, or when off, she only sees [视频]. Frames count toward the per-message image limit.",
			videoFrames: "Grab video frames",
			videoFramesHint: "Treated as off when ffmpeg is not found.",
			videoMaxFrames: "Max frames per video",
			videoMaxFramesHint: "Spread evenly over the video, the first near the start. More frames show more and cost more.",
			videoSecondsPerFrame: "Short videos: at most one frame per N seconds",
			videoSecondsPerFrameHint: "Default 5: a 10-second clip gets 2 frames.",
			videoMaxEdge: "Frame long edge (px)",
			videoMaxEdgeHint: "Default 1024. Larger rarely helps and costs more.",
			videoMaxMB: "Cover only above (MB)",
			videoMaxMBHint: "Large videos get a single frame.",
			videoMaxMinutes: "Cover only above (minutes)",
			videoMaxMinutesHint: "Long videos get a single frame.",
			videoTimeout: "Timeout (seconds)",
			videoTimeoutHint: "Per video; on timeout she only sees [视频].",
			ffmpegPath: "ffmpeg path",
			ffmpegPathHint: "Usually blank: the copy installed below into the plugin directory is used first, then the system one.",
			ffmpegChecking: "Looking for ffmpeg…",
			ffmpegFound: "ffmpeg found ({source}): {path} · {version}",
			ffmpegPathAuto: "Blank, using: {path}",
			ffmpegSourceConfigured: "configured path",
			ffmpegSourceBundled: "plugin directory",
			ffmpegSourceSystem: "system",
			ffmpegMissing: "ffmpeg not found; videos become [视频]. Use Install below (needs GitHub access), or run sudo apt install -y ffmpeg on the server and click Check again.",
			ffmpegInstall: "Install ffmpeg",
			ffmpegInstallConfirm: "Download a static ffmpeg (about 140 MB) from GitHub BtbN/FFmpeg-Builds, verify its SHA256 and put it in the plugin directory. No admin rights needed and the system is not changed. Install now?",
			ffmpegInstallYes: "Install",
			ffmpegInstallNo: "Cancel",
			ffmpegUnsupported: "One-click install supports Linux (x64 / arm64) only; this machine is {platform}. Install ffmpeg yourself, e.g. brew install ffmpeg on a Mac.",
			ffmpegDownloading: "Downloading {asset}: {percent} ({received} / {total} MB)",
			ffmpegVerifying: "Verifying SHA256…",
			ffmpegExtracting: "Extracting…",
			ffmpegDone: "Installed: {version}",
			ffmpegFailed: "Install failed: {error}",
			ffmpegRecheck: "Check again",
			sessionHint: "These apply to new sessions; an existing chat picks them up after /new.",
			tabsLabel: "Settings sections",
			tab_conn: "Connection & access",
			tab_session: "Sessions & models",
			tab_content: "Message content",
			tab_send: "Sending",
			tab_log: "Log",
			rateSub: "Rate limit",
			presetSub: "Presets",
			modelSub: "Models & reasoning",
			silenceSub: "Wake-ups",
			typingSub: "Typing",
			segmentSub: "Splitting",
			groupRateSub: "Group message rate",
			sttTest: "Test speech-to-text",
			sttTestOk: "Works: answered in {ms} ms (tested with one second of silence; result: {text}).",
			sttTestEmpty: "empty, as expected",
			silenceToken: "Silence token",
			paceSec: "Sending rhythm",
			paceHint: "Makes her reply like a person: waits by typing speed before sending, and spaces out messages in groups. Messages in one chat keep their order. Only her own replies are affected.",
			typingPrivate: "Simulate typing in private chats",
			typingGroup: "Simulate typing in groups",
			typingCharsPerMinute: "Typing speed (chars/min)",
			typingCharsPerMinuteHint: "0 disables. Default 100 (0.6 s per character), 1–10 s; when splitting, each part is timed by its own length, capped by the per-part limit below.",
			typingMinSeconds: "Minimum wait (s)",
			typingMaxSeconds: "Maximum wait (s)",
			typingMaxSecondsHint: "Caps the wait for long replies.",
			groupMinGapSeconds: "Min gap between group messages (s)",
			groupMaxPerWindow: "Max group messages per window",
			groupWindowSeconds: "Window (s)",
			sendMaxWaitSeconds: "Max queue wait (s)",
			sendMaxWaitSecondsHint: "A message that would wait longer is dropped (logged).",
			segmentAdminPrivate: "Split replies in admin private chats",
			segmentPrivate: "Split replies in other private chats",
			segmentGroup: "Split replies in groups",
			segmentHint: "Sends one reply as several QQ messages, one line each (code blocks stay whole); each waits by typing speed.",
			segmentMax: "Max messages per reply",
			segmentMaxSeconds: "Max wait per part (s)",
			segmentMaxSecondsHint: "Each part waits by typing speed, up to this. Default 3.",
			segmentMaxHint: "The rest is merged into the last one. Default 10.",
			silenceTokenHint: "Replies starting with this are not sent. Used when another plugin wakes her and she decides to stay quiet. Blank disables.",
			uniqueSession: "One session per person in groups",
			uniqueSessionHint: "Keeps each person's conversation separate within a group.",
			adminPrivatePreset: "Preset for admin private chats",
			privatePreset: "Preset for private chats",
			groupPreset: "Preset for group chats",
			presetOverrideHint: "Blank falls back: admin private → private → default preset.",
			adminPrivateModel: "Model for admin private chats",
			privateModel: "Model for private chats",
			groupModel: "Model for group chats",
			modelHint: "provider/model, e.g. deepseek-official/deepseek-flash; blank falls back to the next level, then dsh's default model.",
			adminPrivateReasoning: "Reasoning for admin private chats",
			privateReasoning: "Reasoning for other private chats",
			groupReasoning: "Reasoning for group chats",
			reasoningHint: "DeepSeek thinking depth. Takes effect from the chat's next message (after any reply in progress); history is kept.",
			reasoningOff: "Off",
			reasoningLow: "Low",
			reasoningHigh: "High",
			reasoningMax: "Max",
			commands: "Commands",
			commandsHint: "Start with a wake prefix: /help, /sid, /new, /reset, /stop. In groups only admins, the owner and group admins can use /new and /reset.",
			commandsEnabled: "Enable QQ commands",
			noPermissionReply: "Reply when not permitted",
			noPermissionReplyHint: "When off, she stays silent on commands the sender may not use.",
			overridden: "Changed",
			reset: "Reset",
			invalid: "Invalid value",
			invalidPort: "Enter an integer from 1 to 65535",
			invalidCount: "Enter 0 or a positive integer",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "The plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "Not saved; your edits are kept for you to correct."
		};

		var CSS = [
			".napcatb-section{display:grid;gap:12px;padding:4px 0 8px}",
			".napcatb-section,.napcatb-details+.napcatb-section{border-top:.5px solid var(--dsw-alias-border-l3);padding-top:16px}",
			".napcatb-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;margin:0}",
			".napcatb-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}",
			".napcatb-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;border-bottom:.5px solid var(--dsw-alias-border-l3);margin:0 0 4px;position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,inherit))}",
			".napcatb-tabs::-webkit-scrollbar{display:none}",
			".napcatb-tab{flex:none;padding:9px 12px 8px;border:none;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;white-space:nowrap;cursor:pointer;border-radius:0}",
			".napcatb-tab:hover{color:var(--dsw-alias-label-primary)}",
			".napcatb-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--dsw-alias-label-primary)}",
			".napcatb-tab:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:-2px}",
			".napcatb-tabs + .napcatb-section,.napcatb-tabs + .napcatb-details{border-top:none;margin-top:8px}",
			".napcatb-subtitle{color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));font-size:12px;font-weight:600;margin:6px 0 0}",
			".napcatb-modelRow{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:12px 16px;align-items:end}",
			"@media (max-width:520px){.napcatb-modelRow{grid-template-columns:1fr}}",
			".napcatb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 16px;align-items:end}",
			".napcatb-grid>*{padding-top:0!important;padding-bottom:0!important;border-top:none!important;margin:0!important;min-width:0}",
			".napcatb-grid>*>:first-child{flex-wrap:wrap;row-gap:2px}",
			".napcatb-grid .napcatb-select{width:100%;min-width:0}",
			".napcatb-labelText{display:inline-flex;align-items:center;gap:3px;line-height:20px}",
			".napcatb-tip{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-top:0;border-radius:50%;border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary);font-size:9px;font-weight:600;line-height:1;cursor:help;user-select:none}",
			".napcatb-tip:hover,.napcatb-tip:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary);outline:none}",
			".napcatb-toggleRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
			".napcatb-field{display:grid;gap:6px}",
			".napcatb-label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;min-height:20px}",
			".napcatb-select{justify-self:start;min-width:160px;height:35px;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;padding:0 12px;font:inherit;font-size:13px}",
			".napcatb-details{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px);padding:0 14px}",
			".napcatb-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}",
			".napcatb-summary::-webkit-details-marker{display:none}",
			".napcatb-chevron{display:inline-block;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease;font-size:16px;line-height:1}",
			".napcatb-details[open] .napcatb-chevron{transform:rotate(90deg)}",
			".napcatb-detailsBody{display:grid;gap:12px;padding:4px 0 16px}",
			".napcatb-test{display:grid;gap:6px;margin-top:-4px}",
			".napcatb-testRow{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
			".napcatb-testBtn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-label-primary);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;cursor:pointer}",
			".napcatb-testBtn:hover:not(:disabled){background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff))}",
			".napcatb-testBtn:disabled{opacity:.55;cursor:default}",
			".napcatb-testBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:2px}",
			".napcatb-testIcon{font-size:14px;line-height:1}",
			".napcatb-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
			".napcatb-input{height:35px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}",
			".napcatb-input:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".napcatb-pCurrent{display:inline-flex;align-items:center;gap:10px;min-width:220px;max-width:100%;height:38px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}",
			".napcatb-pCurrent:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".napcatb-pCurrent .napcatb-pName{flex:1;text-align:left}",
			".napcatb-pCaret{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".napcatb-pIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:6px;object-fit:contain}",
			".napcatb-pIconMono{background-color:var(--dsw-alias-label-primary);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}",
			".napcatb-pIconText{background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.18));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));font-size:12px;font-weight:600}",
			".napcatb-pPanel{display:grid;gap:10px;margin-top:4px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1,transparent)}",
			".napcatb-pSearch{width:100%;box-sizing:border-box}",
			".napcatb-pGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}",
			".napcatb-pCard{display:flex;align-items:center;gap:10px;min-width:0;height:46px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}",
			".napcatb-pCard:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-color:var(--dsw-alias-label-tertiary)}",
			".napcatb-pCard.napcatb-pOn{border-color:var(--dsw-alias-label-primary);font-weight:600}",
			".napcatb-pCard .napcatb-pName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".napcatb-pCard:focus-visible,.napcatb-pCurrent:focus-visible,.napcatb-pBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".napcatb-pModel{min-width:240px;max-width:100%;flex:1 1 240px}",
			".napcatb-pBtn{height:35px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}",
			".napcatb-pBtn:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".napcatb-pBtn:disabled{opacity:.55;cursor:default}",
			".napcatb-link{text-decoration:underline;text-underline-offset:2px}",
			"@media (max-width:520px){.napcatb-pCurrent{width:100%}.napcatb-pGrid{grid-template-columns:1fr 1fr}}",
			".napcatb-pill{display:inline-block;margin:0;padding:6px 10px;border-radius:8px;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".napcatb-pill.napcatb-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 14%,transparent)}",
			".napcatb-pill.napcatb-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e03131) 14%,transparent)}",
			".napcatb-confirm{display:grid;gap:8px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,6px)}",
			".napcatb-result,.napcatb-hint{overflow-wrap:anywhere}",
			".napcatb-code{display:block;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;font-size:12px;overflow-wrap:anywhere;user-select:all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
			".napcatb-result{margin:0;font-size:12px;line-height:1.5}",
			".napcatb-ok{color:var(--dsw-alias-state-success-primary,#2f9e44)}",
			".napcatb-warn{color:var(--dsw-alias-state-warning-primary,#d97706)}",
			".napcatb-error{color:var(--dsw-alias-state-error-primary)}",
			"@media (prefers-reduced-motion:reduce){.napcatb-chevron{transition:none}}"
		].join("\n");
		var CSS_ID = "dsh-napcat-bridge/settings.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			var tag = document.createElement("style");
			tag.dataset.plugin = PACKAGE;
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		//#region 字段格式：文字 ↔ 配置值
		function boolField(field) {
			return {
				field: field,
				format: function (v) { return v === true ? "true" : "false"; },
				parse: function (text) { return text === "true" ? { kind: "set", value: true } : text === "false" ? { kind: "set", value: false } : void 0; }
			};
		}
		function intField(field, min, max) {
			return {
				field: field,
				format: function (v) { return typeof v === "number" ? String(v) : ""; },
				parse: function (text) {
					var s = text.trim();
					if (s === "") return { kind: "clear" };
					var n = Number(s);
					return Number.isSafeInteger(n) && n >= min && n <= max ? { kind: "set", value: n } : void 0;
				}
			};
		}
		function listField(field) {
			return {
				field: field,
				format: function (v) { return Array.isArray(v) ? v.join(" ") : ""; },
				parse: function (text) {
					return { kind: "set", value: text.split(/[\s,，]+/).filter(function (x) { return x !== ""; }) };
				}
			};
		}
		function enumField(field, choices) {
			var text = P.settingsTextField(field);
			return {
				field: field,
				format: text.format,
				parse: function (s) { var v = s.trim(); return v === "" ? { kind: "clear" } : choices.indexOf(v) >= 0 ? { kind: "set", value: v } : void 0; }
			};
		}
		var LOG_LEVELS = ["debug", "info", "warn", "error"];
		var RATE_STRATEGIES = ["stall", "discard"];
		var STT_MODES = ["off", "command", "openai"];
		var BOOLS = [
			"friend_message_needs_wake_prefix", "ignore_bot_self_message", "identifier", "imageToModel",
			"whitelistEnabled", "whitelistIgnoreAdminOnGroup", "whitelistIgnoreAdminOnFriend", "whitelistLog",
			"emptyMentionWaiting", "emptyMentionNeedReply", "uniqueSession",
			"datetimeReminder", "groupNameDisplay", "markAdmin", "commandsEnabled", "noPermissionReply",
			"videoFrames", "typingPrivate", "typingGroup", "segmentAdminPrivate", "segmentPrivate", "segmentGroup"
		];
		var TEXTS = [
			"ws_reverse_host", "id", "workspacePath", "agentPreset", "timezone",
			"privateAgentPreset", "groupAgentPreset", "adminPrivateAgentPreset",
			"privateModel", "groupModel", "adminPrivateModel", "adminPrivateReasoning", "privateReasoning", "groupReasoning",
			"sttCommand", "sttApiUrl", "sttModel", "ffmpegPath", "silenceToken"
		];
		/** 整数字段：[字段, 最小值] */
		var INTS = [
			["ws_reverse_port", 1, 65535], ["maxImages", 0], ["rateLimitCount", 0], ["rateLimitSeconds", 1],
			["videoMaxFrames", 1], ["videoSecondsPerFrame", 1], ["videoMaxEdge", 64], ["videoMaxMB", 1],
			["videoMaxMinutes", 1], ["videoTimeoutSeconds", 5],
			["typingCharsPerMinute", 0], ["typingMinSeconds", 0], ["typingMaxSeconds", 0], ["groupMinGapSeconds", 0], ["groupMaxPerWindow", 0], ["groupWindowSeconds", 1], ["sendMaxWaitSeconds", 0], ["segmentMax", 1], ["segmentMaxSeconds", 1]
		];
		var LISTS = ["wake_prefix", "wakeKeywords", "admins", "whitelist"];
		var SECRETS = ["ws_reverse_token", "sttApiKey"];
		//#endregion

		//#region 表单模型
		function createForm(scope) {
			var specs = INTS.map(function (x) { return intField(x[0], x[1], x[2] === undefined ? Number.MAX_SAFE_INTEGER : x[2]); }).concat([
				enumField("logLevel", LOG_LEVELS),
				enumField("rateLimitStrategy", RATE_STRATEGIES),
				enumField("sttMode", STT_MODES)
			], LISTS.map(listField), BOOLS.map(boolField), TEXTS.map(function (f) { return P.settingsTextField(f); }));
			var secrets = SECRETS.map(function (field) {
				return { field: field, write: function (text) { return scope.mutate([{ op: "set", path: [field], value: text }]); } };
			});
			var form = new P.SettingsFormModel(scope, specs, secrets);
			var all = INTS.map(function (x) { return x[0]; }).concat(["logLevel", "rateLimitStrategy", "sttMode"], LISTS, BOOLS, TEXTS, SECRETS);
			// 设置服务不把密钥发给浏览器，只告诉它有没有设置；由 refreshSecrets 向服务查询
			var secretSet = {};
			function compute() {
				var state = Object.assign({}, form.shell());
				all.forEach(function (f) { state[f] = form.field(f); });
				state.secretSet = Object.assign({}, secretSet);
				return state;
			}
			var store = form.bind(compute);
			return {
				form: form,
				store: store,
				setSecrets: function (next) {
					if (JSON.stringify(next) === JSON.stringify(secretSet)) return;
					secretSet = next;
					store.set(compute());
				}
			};
		}
		//#endregion

		//#region 页面
		/** 名称 + 右上角的小角标；鼠标移上去（或键盘聚焦）显示说明。 */
		function Label(props) {
			if (!props.hint) return props.text;
			return h("span", { className: "napcatb-labelText" },
				props.text,
				h(P.Tooltip, { label: props.hint, side: "top", delayMs: 150, maxWidth: 320 },
					h("span", { className: "napcatb-tip", tabIndex: 0, role: "img", "aria-label": props.hint }, "?")));
		}

		var TAB_IDS = ["conn", "session", "content", "send", "log"];
		function readTab() {
			try { var v = window.localStorage.getItem("napcat-bridge:tab"); return TAB_IDS.indexOf(v) >= 0 ? v : "conn"; } catch (e) { return "conn"; }
		}
		function Tabs(props) {
			var t = props.t;
			return h("div", { className: "napcatb-tabs", role: "tablist", "aria-label": t("tabsLabel") },
				TAB_IDS.map(function (id) {
					return h("button", {
						key: id, type: "button", role: "tab", className: "napcatb-tab",
						"aria-selected": props.cur === id,
						onClick: function () { props.onChange(id); try { window.localStorage.setItem("napcat-bridge:tab", id); } catch (e) { /* 存不了就算了 */ } }
					}, t("tab_" + id));
				}));
		}
		/** 几个相关的输入框排成一行（窄窗口自动换行） */
		function G() { return h("div", { className: "napcatb-grid" }, Array.prototype.slice.call(arguments)); }
		function Sub(text) { return h("h4", { className: "napcatb-subtitle" }, text); }
		function Section(props) {
			return h("section", { className: "napcatb-section" },
				h("h3", { className: "napcatb-title" }, h(Label, { text: props.title, hint: props.hint })),
				props.children);
		}

		function Toggle(props) {
			var field = props.state[props.field];
			return h("div", { className: "napcatb-toggleRow" },
				h(Label, { text: props.label, hint: props.hint }),
				h(P.Switch, {
					checked: field.text === "true",
					label: props.label,
					disabled: props.disabled,
					onChange: function (checked) { props.edit(props.field, checked ? "true" : "false"); }
				}));
		}

		function Value(props) {
			var t = props.t;
			return h(P.SettingsValueField, Object.assign({
				id: "napcat-bridge-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				invalidLabel: props.invalidLabel || t("invalid"),
				numeric: props.numeric === true,
				placeholder: props.placeholder,
				disabled: props.disabled
			}, props.state[props.field], {
				onEdit: function (text) { props.edit(props.field, text); },
				onReset: function () { props.resetField(props.field); }
			}));
		}

		/** 把状态接口的结果写成一句话和语气（ok / warn / error）。 */
		function describeStatus(t, st) {
			if (!st.listening) return { tone: "error", text: t("testNotListening", { address: st.address }) };
			var conns = st.connections || [];
			if (conns.length > 0) {
				if (st.login && st.login.user_id !== undefined && st.login.user_id !== null) {
					var who = (st.login.nickname ? st.login.nickname + " " : "") + "(" + st.login.user_id + ")";
					return { tone: "ok", text: t(st.tokenSet ? "testOk" : "testOkNoToken", { who: who }) };
				}
				return { tone: "warn", text: t("testConnectedApiFailed", { error: st.loginError || "?" }) };
			}
			if (st.lastRejected) {
				var minutes = Math.max(1, Math.round((Date.now() - st.lastRejected.at) / 60000));
				var key = String(st.lastRejected.status).indexOf("401") === 0 ? "testRejectedMissing" : "testRejectedWrong";
				return { tone: "error", text: t(key, { minutes: minutes }) };
			}
			return { tone: "warn", text: t("testNoClient", { address: st.address }) };
		}

		/** 测试按钮：比普通小按钮显眼（描边、加粗、带图标） */
		function TestButton(props) {
			return h("button", { type: "button", className: "napcatb-testBtn", disabled: props.busy, onClick: props.onClick },
				h("span", { className: "napcatb-testIcon", "aria-hidden": true }, props.busy ? "…" : "⇄"), props.label);
		}
		function ConnectionTest(props) {
			var t = props.t;
			var stateHook = React.useState(null);
			var result = stateHook[0], setResult = stateHook[1];
			var busyHook = React.useState(false);
			var busy = busyHook[0], setBusy = busyHook[1];
			function run() {
				setBusy(true);
				var url = new URL("api/napcat-bridge/status", document.baseURI).href;
				fetch(url, { credentials: "same-origin", cache: "no-store" })
					.then(function (res) {
						if (!res.ok) throw new Error("HTTP " + res.status);
						return res.json();
					})
					.then(function (st) { setResult(describeStatus(t, st)); },
						function (error) { setResult({ tone: "error", text: t("testFailed", { error: error && error.message || String(error) }) }); })
					.finally(function () { setBusy(false); });
			}
			return h("div", { className: "napcatb-test" },
				h("div", { className: "napcatb-testRow" },
					h(TestButton, { busy: busy, onClick: run, label: busy ? t("testing") : t("test") }),
					props.dirty ? h("span", { className: "napcatb-hint" }, t("testUsesSaved")) : null),
				result ? h("div", null, h("p", { className: "napcatb-pill napcatb-result napcatb-" + result.tone, role: "status" }, result.text)) : null);
		}

		/** 语音转文字的「测试」（POST <dsh>/api/napcat-bridge/stt/test，用保存过的设置拿一段静音试）。 */
		function SttTest(props) {
			var t = props.t;
			var stateHook = React.useState(null), result = stateHook[0], setResult = stateHook[1];
			var busyHook = React.useState(false), busy = busyHook[0], setBusy = busyHook[1];
			function run() {
				setBusy(true);
				fetch(new URL("api/napcat-bridge/stt/test", document.baseURI).href, { method: "POST", credentials: "same-origin", cache: "no-store" })
					.then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
					.then(function (r) {
						setResult(r.ok ? { tone: "ok", text: t("sttTestOk", { ms: r.ms, text: r.text || t("sttTestEmpty") }) } : { tone: "error", text: t("testFailed", { error: r.error }) });
					}, function (error) { setResult({ tone: "error", text: t("testFailed", { error: error && error.message || String(error) }) }); })
					.finally(function () { setBusy(false); });
			}
			return h("div", { className: "napcatb-test" },
				h("div", { className: "napcatb-testRow" },
					h(TestButton, { busy: busy, onClick: run, label: busy ? t("testing") : t("sttTest") }),
					props.dirty ? h("span", { className: "napcatb-hint" }, t("testUsesSaved")) : null),
				result ? h("div", null, h("p", { className: "napcatb-pill napcatb-result napcatb-" + result.tone, role: "status" }, result.text)) : null);
		}

		/** ffmpeg 状态和一键安装（GET/POST <dsh>/api/napcat-bridge/ffmpeg[/install]）。 */
		function FfmpegStatus(props) {
			var t = props.t;
			var stHook = React.useState(null);
			var st = stHook[0], setSt = stHook[1];
			var errHook = React.useState(null);
			var err = errHook[0], setErr = errHook[1];
			var url = function (path) { return new URL("api/napcat-bridge/" + path, document.baseURI).href; };
			function load(method, path) {
				return fetch(url(path), { method: method, credentials: "same-origin", cache: "no-store" })
					.then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
					.then(function (next) { setErr(null); setSt(next); if (props.onFound) props.onFound(next && next.found ? next.found.path : null); return next; },
						function (error) { setErr(error && error.message || String(error)); });
			}
			React.useEffect(function () { load("GET", "ffmpeg"); }, []);
			var busy = st && st.install && ["downloading", "verifying", "extracting"].indexOf(st.install.state) >= 0;
			React.useEffect(function () {
				if (!busy) return void 0;
				var timer = setInterval(function () { load("GET", "ffmpeg"); }, 1000);
				return function () { clearInterval(timer); };
			}, [busy]);
			// 页面内确认（不用 window.confirm：dsh 桌面端里浏览器弹窗可能不显示）
			var askHook = React.useState(false);
			var asking = askHook[0], setAsking = askHook[1];
			function install() {
				setAsking(false);
				load("POST", "ffmpeg/install");
			}
			var mb = function (n) { return typeof n === "number" ? (n / 1048576).toFixed(0) : "?"; };
			var lines = [];
			if (err) lines.push({ tone: "error", text: t("testFailed", { error: err }) });
			else if (!st) lines.push({ tone: "hint", text: t("ffmpegChecking") });
			else {
				if (st.found) {
					var source = t(st.found.source === "configured" ? "ffmpegSourceConfigured" : st.found.source === "bundled" ? "ffmpegSourceBundled" : "ffmpegSourceSystem");
					lines.push({ tone: "ok", text: t("ffmpegFound", { source: source, path: st.found.path, version: st.found.version }) });
				} else {
					lines.push({ tone: "warn", text: t("ffmpegMissing") });
					if (!st.installSupported) lines.push({ tone: "hint", text: t("ffmpegUnsupported", { platform: st.platform }) });
				}
				var ins = st.install || { state: "idle" };
				if (ins.state === "downloading") {
					var percent = ins.total ? Math.floor((ins.received || 0) * 100 / ins.total) + "%" : "…";
					lines.push({ tone: "hint", text: t("ffmpegDownloading", { asset: ins.asset || "ffmpeg", percent: percent, received: mb(ins.received), total: mb(ins.total) }) });
				} else if (ins.state === "verifying") lines.push({ tone: "hint", text: t("ffmpegVerifying") });
				else if (ins.state === "extracting") lines.push({ tone: "hint", text: t("ffmpegExtracting") });
				else if (ins.state === "done") lines.push({ tone: "ok", text: t("ffmpegDone", { version: ins.version || "" }) });
				else if (ins.state === "failed") lines.push({ tone: "error", text: t("ffmpegFailed", { error: ins.error || "?" }) });
			}
			var canInstall = st && !st.found && st.installSupported && !busy;
			return h("div", { className: "napcatb-test" },
				canInstall && asking ? h("div", { className: "napcatb-confirm", role: "group", "aria-label": t("ffmpegInstall") },
					h("p", { className: "napcatb-hint" }, t("ffmpegInstallConfirm")),
					h("div", { className: "napcatb-testRow" },
						h(P.Button, { size: "sm", onClick: install }, t("ffmpegInstallYes")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("ffmpegInstallNo")))) : null,
				h("div", { className: "napcatb-testRow" },
					canInstall && !asking ? h(P.Button, { size: "sm", onClick: function () { setAsking(true); } }, t("ffmpegInstall")) : null,
					h(P.Button, { size: "sm", disabled: busy, onClick: function () { load("GET", "ffmpeg"); } }, t("ffmpegRecheck"))),
				lines.map(function (line, i) {
					return h("p", { key: i, className: line.tone === "hint" ? "napcatb-hint" : "napcatb-result napcatb-" + line.tone, role: i === 0 ? "status" : void 0 }, line.text);
				}));
		}

		function Select(props) {
			var field = props.state[props.field];
			return h("div", { className: "napcatb-field" },
				h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-" + props.field }, h(Label, { text: props.label, hint: props.hint })),
				h("select", {
					id: "napcat-bridge-" + props.field,
					className: "napcatb-select",
					value: field.text || props.fallback,
					disabled: props.disabled,
					onChange: function (event) { props.edit(props.field, event.target.value); }
				}, props.options.map(function (o) { return h("option", { key: o.value, value: o.value }, o.label); })));
		}

		function Secret(props) {
			var t = props.t;
			var set = props.state.secretSet[props.field] === true;
			return h(P.SettingsSecretField, {
				id: "napcat-bridge-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				disabled: props.disabled,
				text: props.state[props.field].text,
				configured: set,
				stateLabel: set ? props.setLabel : props.unsetLabel,
				onEdit: function (text) { props.edit(props.field, text); }
			});
		}

		/** 手动部署时用：随机生成一个 Token（填进上面的框，保存后生效），并告诉你 NapCat 里该填什么 */
		function NapcatSetup(props) {
			var t = props.t;
			var genHook = React.useState(""), made = genHook[0], setMade = genHook[1];
			var copiedHook = React.useState(false), copied = copiedHook[0], setCopied = copiedHook[1];
			var port = (props.state.ws_reverse_port && props.state.ws_reverse_port.text) || "6199";
			var wsUrl = "ws://127.0.0.1:" + port + "/ws";
			function generate() {
				var bytes = new Uint8Array(32);
				window.crypto.getRandomValues(bytes);
				var tok = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
				props.edit("ws_reverse_token", tok);
				setMade(tok); setCopied(false);
			}
			function copy() {
				function done() { setCopied(true); }
				if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(made).then(done, function () {});
				else {
					// 不是 https 时浏览器不给用剪贴板接口，退回到选中文字再复制
					var ta = document.createElement("textarea"); ta.value = made; ta.style.position = "fixed"; ta.style.opacity = "0";
					document.body.appendChild(ta); ta.select();
					try { if (document.execCommand("copy")) done(); } catch (e) { /* 复制不了就让用户自己选 */ }
					ta.remove();
				}
			}
			return h("div", { className: "napcatb-test" },
				h("p", { className: "napcatb-hint" }, t("napcatSetupHint", { url: wsUrl })),
				h("div", { className: "napcatb-testRow" },
					h(P.Button, { size: "sm", disabled: props.disabled, onClick: generate }, t("tokenGenerate")),
					made ? h(P.Button, { size: "sm", onClick: copy }, copied ? t("tokenCopied") : t("tokenCopy")) : null),
				made ? h("code", { className: "napcatb-code" }, made) : null,
				made ? h("p", { className: "napcatb-result napcatb-warn" }, t("tokenGenerated")) : null);
		}

		//#region 服务商预设（地址、常用模型、logo）和模型列表
		// logo 来自 LobeHub 的 lobe-icons（MIT，见 NOTICE.md），以 data: 图片内嵌，不从外网加载；商标归各厂商所有。
		// 单色的 logo 用 CSS 遮罩染成文字颜色，深色、浅色主题都看得清。
		var PROVIDER_ICONS = {
			"groq": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+R3JvcTwvdGl0bGU+PHBhdGggZD0iTTEyLjAzNiAyYy0zLjg1My0uMDM1LTcgMy03LjAzNiA2Ljc4MS0uMDM1IDMuNzgyIDMuMDU1IDYuODcyIDYuOTA4IDYuOTA3aDIuNDJ2LTIuNTY2aC0yLjI5MmMtMi40MDcuMDI4LTQuMzgtMS44NjYtNC40MDgtNC4yMy0uMDI5LTIuMzYyIDEuOTAxLTQuMjk4IDQuMzA4LTQuMzI2aC4xYzIuNDA3IDAgNC4zNTggMS45MTUgNC4zNjUgNC4yNzh2Ni4zMDVjMCAyLjM0Mi0xLjk0NCA0LjI1LTQuMzIzIDQuMjc5YTQuMzc1IDQuMzc1IDAgMDEtMy4wMzMtMS4yNTJsLTEuODUxIDEuODE4QTcgNyAwIDAwMTIuMDI5IDIyaC4wOTJjMy44MDMtLjA1NiA2Ljg1OC0zLjA4MyA2Ljg3OS02LjgxNnYtNi41QzE4LjkwNyA0Ljk2MyAxNS44MTcgMiAxMi4wMzYgMnoiPjwvcGF0aD48L3N2Zz4=" },
			"mistral": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk1pc3RyYWw8L3RpdGxlPjxwYXRoIGQ9Ik0zLjQyOCAzLjRoMy40Mjl2My40MjhIMy40MjhWMy40em0xMy43MTQgMGgzLjQzdjMuNDI4aC0zLjQzVjMuNHoiIGZpbGw9ImdvbGQiPjwvcGF0aD48cGF0aCBkPSJNMy40MjggNi44MjhoNi44NTd2My40MjlIMy40MjlWNi44Mjh6bTEwLjI4NiAwaDYuODU3djMuNDI5aC02Ljg1N1Y2LjgyOHoiIGZpbGw9IiNGRkFGMDAiPjwvcGF0aD48cGF0aCBkPSJNMy40MjggMTAuMjU4aDE3LjE0NHYzLjQyOEgzLjQyOHYtMy40Mjh6IiBmaWxsPSIjRkY4MjA1Ij48L3BhdGg+PHBhdGggZD0iTTMuNDI4IDEzLjY4NmgzLjQyOXYzLjQyOEgzLjQyOHYtMy40Mjh6bTYuODU4IDBoMy40Mjl2My40MjhoLTMuNDI5di0zLjQyOHptNi44NTYgMGgzLjQzdjMuNDI4aC0zLjQzdi0zLjQyOHoiIGZpbGw9IiNGQTUwMEYiPjwvcGF0aD48cGF0aCBkPSJNMCAxNy4xMTRoMTAuMjg2djMuNDI5SDB2LTMuNDI5em0xMy43MTQgMEgyNHYzLjQyOUgxMy43MTR2LTMuNDI5eiIgZmlsbD0iI0UxMDUwMCI+PC9wYXRoPjwvc3ZnPg==" },
			"openai": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+T3BlbkFJPC90aXRsZT48cGF0aCBkPSJNOS4yMDUgOC42NTh2LTIuMjZjMC0uMTkuMDcyLS4zMzMuMjM4LS40MjhsNC41NDMtMi42MTZjLjYxOS0uMzU3IDEuMzU2LS41MjMgMi4xMTctLjUyMyAyLjg1NCAwIDQuNjYyIDIuMjEyIDQuNjYyIDQuNTY2IDAgLjE2NyAwIC4zNTctLjAyNC41NDdsLTQuNzEtMi43NTlhLjc5Ny43OTcgMCAwMC0uODU2IDBsLTUuOTcgMy40NzN6bTEwLjYwOSA4LjhWMTIuMDZjMC0uMzMzLS4xNDMtLjU3LS40MjktLjczN2wtNS45Ny0zLjQ3MyAxLjk1LTEuMTE4YS40MzMuNDMzIDAgMDEuNDc2IDBsNC41NDMgMi42MTdjMS4zMDkuNzYgMi4xODkgMi4zNzggMi4xODkgMy45NDggMCAxLjgwOC0xLjA3IDMuNDczLTIuNzYgNC4xNjN6TTcuODAyIDEyLjcwM2wtMS45NS0xLjE0MmMtLjE2Ny0uMDk1LS4yMzktLjIzOC0uMjM5LS40MjhWNS44OTljMC0yLjU0NSAxLjk1LTQuNDcyIDQuNTkxLTQuNDcyIDEgMCAxLjkyNy4zMzMgMi43MTIuOTI4TDguMjMgNS4wNjdjLS4yODUuMTY2LS40MjguNDA0LS40MjguNzM3djYuODk4ek0xMiAxNS4xMjhsLTIuNzk1LTEuNTd2LTMuMzNMMTIgOC42NThsMi43OTUgMS41N3YzLjMzTDEyIDE1LjEyOHptMS43OTYgNy4yM2MtMSAwLTEuOTI3LS4zMzItMi43MTItLjkyN2w0LjY4Ni0yLjcxMmMuMjg1LS4xNjYuNDI4LS40MDQuNDI4LS43Mzd2LTYuODk4bDEuOTc0IDEuMTQyYy4xNjcuMDk1LjIzOC4yMzguMjM4LjQyOHY1LjIzM2MwIDIuNTQ1LTEuOTc0IDQuNDcyLTQuNjE0IDQuNDcyem0tNS42MzctNS4zMDNsLTQuNTQ0LTIuNjE3Yy0xLjMwOC0uNzYxLTIuMTg4LTIuMzc4LTIuMTg4LTMuOTQ4QTQuNDgyIDQuNDgyIDAgMDE0LjIxIDYuMzI3djUuNDIzYzAgLjMzMy4xNDMuNTcxLjQyOC43MzhsNS45NDcgMy40NDktMS45NSAxLjExOGEuNDMyLjQzMiAwIDAxLS40NzYgMHptLS4yNjIgMy45Yy0yLjY4OCAwLTQuNjYyLTIuMDIxLTQuNjYyLTQuNTE5IDAtLjE5LjAyNC0uMzguMDQ3LS41N2w0LjY4NiAyLjcxYy4yODYuMTY3LjU3MS4xNjcuODU2IDBsNS45Ny0zLjQ0OHYyLjI2YzAgLjE5LS4wNy4zMzMtLjIzNy40MjhsLTQuNTQzIDIuNjE2Yy0uNjE5LjM1Ny0xLjM1Ni41MjMtMi4xMTcuNTIzem01Ljg5OSAyLjgzYTUuOTQ3IDUuOTQ3IDAgMDA1LjgyNy00Ljc1NkMyMi4yODcgMTguMzM5IDI0IDE1Ljg0IDI0IDEzLjI5NmMwLTEuNjY1LS43MTMtMy4yODItMS45OTgtNC40NDguMTE5LS41LjE5LS45OTkuMTktMS40OTggMC0zLjQwMS0yLjc1OS01Ljk0Ny01Ljk0Ni01Ljk0Ny0uNjQyIDAtMS4yNi4wOTUtMS44OC4zMUE1Ljk2MiA1Ljk2MiAwIDAwMTAuMjA1IDBhNS45NDcgNS45NDcgMCAwMC01LjgyNyA0Ljc1N0MxLjcxMyA1LjQ0NyAwIDcuOTQ1IDAgMTAuNDljMCAxLjY2Ni43MTMgMy4yODMgMS45OTggNC40NDgtLjExOS41LS4xOSAxLS4xOSAxLjQ5OSAwIDMuNDAxIDIuNzU5IDUuOTQ2IDUuOTQ2IDUuOTQ2LjY0MiAwIDEuMjYtLjA5NSAxLjg4LS4zMDlhNS45NiA1Ljk2IDAgMDA0LjE2MiAxLjcxM3oiPjwvcGF0aD48L3N2Zz4=" },
			"siliconcloud": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlNpbGljb25DbG91ZDwvdGl0bGU+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjIuOTU2IDYuNTIxSDEyLjUyMmMtLjU3NyAwLTEuMDQ0LjQ2OC0xLjA0NCAxLjA0NHYzLjEzYzAgLjU3Ny0uNDY2IDEuMDQ0LTEuMDQzIDEuMDQ0SDEuMDQ0Yy0uNTc3IDAtMS4wNDQuNDY3LTEuMDQ0IDEuMDQ0djQuMTc0QzAgMTcuNTMzLjQ2NyAxOCAxLjA0NCAxOGgxMC40MzRjLjU3NyAwIDEuMDQ0LS40NjcgMS4wNDQtMS4wNDN2LTMuMTNjMC0uNTc4LjQ2Ni0xLjA0NCAxLjA0My0xLjA0NGg5LjM5MWMuNTc3IDAgMS4wNDQtLjQ2NyAxLjA0NC0xLjA0NFY3LjU2NWMwLS41NzYtLjQ2Ny0xLjA0NC0xLjA0NC0xLjA0NHoiIGZpbGw9IiM2RTI5RjYiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PC9wYXRoPjwvc3ZnPg==" },
			"zhipu": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlpoaXB1PC90aXRsZT48cGF0aCBkPSJNMTEuOTkxIDIzLjUwM2EuMjQuMjQgMCAwMC0uMjQ0LjI0OC4yNC4yNCAwIDAwLjI0NC4yNDkuMjQuMjQgMCAwMC4yNDUtLjI0OS4yNC4yNCAwIDAwLS4yMi0uMjQ3bC0uMDI1LS4wMDF6TTkuNjcxIDUuMzY1YTEuNjk3IDEuNjk3IDAgMDExLjA5OSAyLjEzMmwtLjA3MS4xNzItLjAxNi4wNC0uMDE4LjA1NGMtLjA3LjE2LS4xMDQuMzItLjEwNC40OTgtLjAzNS43MS40NyAxLjI3OSAxLjE4NiAxLjMxNGguMzY2YzEuMzA5LjA1MyAyLjMzOCAxLjE3MyAyLjI4NiAyLjUyMy0uMDUyIDEuMzMyLTEuMTUyIDIuMzgtMi40NzggMi4zMjdoLS4xNzRjLS43MTUuMDE4LTEuMjc0LjY0LTEuMjM5IDEuMzY4IDAgLjEyNC4wMTguMjMuMDUzLjMzNy4yMDkuMzczLjU0LjY1OC45Ni44Ljc1LjIzIDEuNTE3LS4xMjUgMS45LS43ODJsLjAxOC0uMDM1Yy40MDItLjY0IDEuMTctLjk2IDEuOTItLjcxMS44NTQuMjg0IDEuMzc4IDEuMjI2IDEuMDk5IDIuMTY3YTEuNjYxIDEuNjYxIDAgMDEtMi4wNzcgMS4xMDIgMS43MTEgMS43MTEgMCAwMS0uOTA3LS43MTFsLS4wMTctLjAzNWMtLjItLjMyMy0uNDYzLS41OC0uODUxLS43MTFsLS4wNTYtLjAxOGExLjY0NiAxLjY0NiAwIDAwLTEuOTU0Ljc0NiAxLjY2IDEuNjYgMCAwMS0xLjA2NS43NjQgMS42NzcgMS42NzcgMCAwMS0xLjk4OS0xLjI3OWMtLjIwOS0uOTA2LjMzMi0xLjgzIDEuMjU3LTIuMDQzYTEuNTEgMS41MSAwIDAxLjI5Ni0uMDM1aC4wMThjLjY4LS4wNzEgMS4xNTEtLjYyMiAxLjExNi0xLjMzM2ExLjMwNyAxLjMwNyAwIDAwLS4yMjctLjY5MyAyLjUxNSAyLjUxNSAwIDAxLS4zNjYtMS40MDMgMi4zOSAyLjM5IDAgMDEuMzY2LTEuMjA4Yy4xNC0uMTk1LjIxLS40NDQuMjI3LS42OTMuMDE4LS43MS0uNTA2LTEuMjYxLTEuMTg2LTEuMzMybC0uMDctLjAxOGExLjQzIDEuNDMgMCAwMS0uMjk5LS4wN2wtLjA1LS4wMTlhMS43IDEuNyAwIDAxLTEuMDQ3LTIuMTE0IDEuNjggMS42OCAwIDAxMi4wOTQtMS4xMDF6bS01LjU3NSAxMC4xMWMuMjYtLjI2NC42MzktLjM2Ny45OTQtLjI3LjM1NS4wOTYuNjMzLjM3OS43MjguNzQuMDk1LjM2Mi0uMDA3Ljc0OC0uMjY3IDEuMDEzLS40MDIuNDEtMS4wNTMuNDEtMS40NTUgMGExLjA2MiAxLjA2MiAwIDAxMC0xLjQ4MnptMTQuODQ1LS4yOTRjLjM1OS0uMDkuNzM4LjAyNC45OTIuMjk3LjI1NC4yNzQuMzQ0LjY2NS4yMzcgMS4wMjUtLjEwNy4zNi0uMzk2LjYzNC0uNzU2LjcxOC0uNTUxLjEyOC0xLjEtLjIyLTEuMjMtLjc4MWExLjA1IDEuMDUgMCAwMS43NTctMS4yNnptLS4wNjQtNC4zOWMuMzE0LjMyLjQ5Ljc1My40OSAxLjIwNiAwIC40NTItLjE3Ni44ODYtLjQ5IDEuMjA2LS4zMTUuMzItLjc0LjUtMS4xODUuNS0uNDQ0IDAtLjg3LS4xOC0xLjE4NC0uNWExLjcyNyAxLjcyNyAwIDAxMC0yLjQxMiAxLjY1NCAxLjY1NCAwIDAxMi4zNjkgMHptLTExLjI0My4xNjNjLjM2NC40ODQuNDQ3IDEuMTI4LjIxOCAxLjY5MWExLjY2NSAxLjY2NSAwIDAxLTIuMTg4LjkyM2MtLjg1NS0uMzYtMS4yNi0xLjM1OC0uOTA3LTIuMjI4YTEuNjggMS42OCAwIDAxMS4zMy0xLjAzOGMuNTkzLS4wOCAxLjE4My4xNjkgMS41NDcuNjUyem0xMS41NDUtNC4yMjFjLjM2OCAwIC43MDguMi44OTIuNTI0LjE4NC4zMjQuMTg0LjcyNCAwIDEuMDQ4YTEuMDI2IDEuMDI2IDAgMDEtLjg5Mi41MjRjLS41NjggMC0xLjAzLS40Ny0xLjAzLTEuMDQ4IDAtLjU3OS40NjItMS4wNDggMS4wMy0xLjA0OHptLTE0LjM1OCAwYy4zNjggMCAuNzA3LjIuODkxLjUyNC4xODQuMzI0LjE4NC43MjQgMCAxLjA0OGExLjAyNiAxLjAyNiAwIDAxLS44OTEuNTI0Yy0uNTY5IDAtMS4wMy0uNDctMS4wMy0xLjA0OCAwLS41NzkuNDYxLTEuMDQ4IDEuMDMtMS4wNDh6bTEwLjAzMS0xLjQ3NWMuOTI1IDAgMS42NzUuNzY0IDEuNjc1IDEuNzA2cy0uNzUgMS43MDUtMS42NzUgMS43MDUtMS42NzQtLjc2My0xLjY3NC0xLjcwNWMwLS45NDIuNzUtMS43MDYgMS42NzQtMS43MDZ6bS0yLjYyNi0uNjg0Yy4zNjItLjA4Mi42NTMtLjM1Ni43NjEtLjcxOGExLjA2MiAxLjA2MiAwIDAwLS4yMzgtMS4wMjggMS4wMTcgMS4wMTcgMCAwMC0uOTk2LS4yOTRjLS41NDcuMTQtLjg4MS43LS43NTIgMS4yNTcuMTMuNTU4LjY3NS45MDcgMS4yMjUuNzgzem0wIDE2Ljg3NmMuMzU5LS4wODcuNjQ0LS4zNi43NS0uNzJhMS4wNjIgMS4wNjIgMCAwMC0uMjM3LTEuMDE5IDEuMDE4IDEuMDE4IDAgMDAtLjk4NS0uMzAxIDEuMDM3IDEuMDM3IDAgMDAtLjc2Mi43MTdjLS4xMDguMzYxLS4wMTcuNzU0LjIzOSAxLjAyOC4yNDUuMjYzLjYwNi4zNzcuOTUzLjMwNWwuMDQzLS4wMXpNMTcuMTkgMy41YS42MzEuNjMxIDAgMDAuNjI4LS42NGMwLS4zNTUtLjI3OS0uNjQtLjYyOC0uNjRhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NS4yOC42NC42MjguNjR6bS0xMC4zOCAwYS42MzEuNjMxIDAgMDAuNjI4LS42NGMwLS4zNTUtLjI4LS42NC0uNjI4LS42NGEuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU1LjI3OS42NC42MjguNjR6bS01LjE4MiA3Ljg1MmEuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU0LjI4LjYzOS42MjguNjM5YS42My42MyAwIDAwLjYyNy0uNjA2bC4wMDEtLjAzNGEuNjIuNjIgMCAwMC0uNjI4LS42NHptNS4xODIgOS4xM2EuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU1LjI3OS42NC42MjguNjRhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjgtLjY0LS42MjgtLjY0em0xMC4zOC4wMThhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NS4yOC42NC42MjguNjRhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjc5LS42NC0uNjI4LS42NHptNS4xODItOS4xNDhhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NC4yNzkuNjM5LjYyOC42MzlhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjgtLjY0LS42MjgtLjY0em0tLjM4NC00Ljk5MmEuMjQuMjQgMCAwMC4yNDQtLjI0OS4yNC4yNCAwIDAwLS4yNDQtLjI0OS4yNC4yNCAwIDAwLS4yNDQuMjQ5YzAgLjE0Mi4xMjIuMjQ5LjI0NC4yNDl6TTExLjk5MS40OTdhLjI0LjI0IDAgMDAuMjQ1LS4yNDhBLjI0LjI0IDAgMDAxMS45OSAwYS4yNC4yNCAwIDAwLS4yNDQuMjQ5YzAgLjEzMy4xMDguMjM2LjIyMy4yNDdsLjAyMS4wMDF6TTIuMDExIDYuMzZhLjI0LjI0IDAgMDAuMjQ1LS4yNDkuMjQuMjQgMCAwMC0uMjQ0LS4yNDkuMjQuMjQgMCAwMC0uMjQ0LjI0OS4yNC4yNCAwIDAwLjI0NC4yNDl6bTAgMTEuMjYzYS4yNC4yNCAwIDAwLS4yNDMuMjQ4LjI0LjI0IDAgMDAuMjQ0LjI0OS4yNC4yNCAwIDAwLjI0NC0uMjQ5LjI1Mi4yNTIgMCAwMC0uMjQ0LS4yNDh6bTE5Ljk5NS0uMDE4YS4yNC4yNCAwIDAwLS4yNDUuMjQ4LjI0LjI0IDAgMDAuMjQ1LjI1LjI0LjI0IDAgMDAuMjQ0LS4yNS4yNTIuMjUyIDAgMDAtLjI0NC0uMjQ4eiIgZmlsbD0iIzM4NTlGRiIgZmlsbC1ydWxlPSJub256ZXJvIj48L3BhdGg+PC9zdmc+" }
		};
		var PROVIDERS = [
			{"id": "siliconflow", "name": "硅基流动", "en": "SiliconFlow", "icon": "siliconcloud", "url": "https://api.siliconflow.cn/v1", "models": ["FunAudioLLM/SenseVoiceSmall", "TeleAI/TeleSpeechASR"], "query": "?sub_type=speech-to-text", "keyUrl": "https://cloud.siliconflow.cn/account/ak"},
			{"id": "zhipu", "name": "智谱 BigModel", "en": "Zhipu BigModel", "icon": "zhipu", "url": "https://open.bigmodel.cn/api/paas/v4", "models": ["glm-asr-2512", "glm-asr"], "keyUrl": "https://bigmodel.cn/usercenter/proj-mgmt/apikeys"},
			{"id": "openai", "name": "OpenAI", "en": "OpenAI", "icon": "openai", "url": "https://api.openai.com/v1", "models": ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"], "keyUrl": "https://platform.openai.com/api-keys"},
			{"id": "groq", "name": "Groq", "en": "Groq", "icon": "groq", "url": "https://api.groq.com/openai/v1", "models": ["whisper-large-v3-turbo", "whisper-large-v3"], "keyUrl": "https://console.groq.com/keys"},
			{"id": "mistral", "name": "Mistral", "en": "Mistral", "icon": "mistral", "url": "https://api.mistral.ai/v1", "models": ["voxtral-mini-latest"], "keyUrl": "https://console.mistral.ai/api-keys"}
		];
		function normUrl(u) { return String(u || "").trim().replace(/\/+$/, "").toLowerCase(); }
		function providerOf(url) {
			var n = normUrl(url);
			for (var i = 0; i < PROVIDERS.length; i++) if (normUrl(PROVIDERS[i].url) === n) return PROVIDERS[i];
			return null;
		}
		function ProviderIcon(props) {
			var ic = props.icon ? PROVIDER_ICONS[props.icon] : null;
			if (!ic) return h("span", { className: "napcatb-pIcon napcatb-pIconText", "aria-hidden": true }, (props.name || "?").slice(0, 1));
			if (ic.mono) return h("span", { className: "napcatb-pIcon napcatb-pIconMono", "aria-hidden": true, style: { WebkitMaskImage: "url(" + ic.src + ")", maskImage: "url(" + ic.src + ")" } });
			return h("img", { className: "napcatb-pIcon", src: ic.src, alt: "", "aria-hidden": true });
		}
		function providerName(t, p) { return p ? (t("langIsEn") === "1" ? p.en : p.name) : t("providerCustom"); }
		/** 选服务商：点开后是带搜索的格子，选一家就填好接口地址（模型不在这家的常用列表里时换成第一个） */
		function ProviderField(props) {
			var t = props.t;
			var url = props.state[props.urlField].text;
			var cur = providerOf(url);
			var openHook = React.useState(false), open = openHook[0], setOpen = openHook[1];
			var qHook = React.useState(""), q = qHook[0], setQ = qHook[1];
			function choose(p) {
				setOpen(false); setQ("");
				if (!p) { props.onCustom && props.onCustom(); return; }
				props.edit(props.urlField, p.url);
				var model = props.state[props.modelField].text;
				if (p.models.length > 0 && p.models.indexOf(model) < 0) props.edit(props.modelField, p.models[0]);
				if (props.onPick) props.onPick(p);
			}
			var list = PROVIDERS.filter(function (p) { var s = q.trim().toLowerCase(); return !s || (p.name + " " + p.en + " " + p.id).toLowerCase().indexOf(s) >= 0; });
			return h("div", { className: "napcatb-field" },
				h("span", { className: "napcatb-label" }, h(Label, { text: t("provider"), hint: t("providerHint") })),
				h("div", { className: "napcatb-row" },
					h("button", { type: "button", className: "napcatb-pCurrent", disabled: props.disabled, "aria-expanded": open, onClick: function () { setOpen(!open); } },
						h(ProviderIcon, { icon: cur && cur.icon, name: cur ? providerName(t, cur) : "+" }),
						h("span", { className: "napcatb-pName" }, providerName(t, cur)),
						h("span", { className: "napcatb-pCaret", "aria-hidden": true }, open ? "▴" : "▾")),
					cur && cur.keyUrl ? h("a", { className: "napcatb-hint napcatb-link", href: cur.keyUrl, target: "_blank", rel: "noreferrer noopener" }, t("providerGetKey")) : null),
				open ? h("div", { className: "napcatb-pPanel", role: "dialog", "aria-label": t("provider") },
					h("input", { className: "napcatb-input napcatb-pSearch", type: "search", placeholder: t("providerSearch"), value: q, autoFocus: true, onChange: function (e) { setQ(e.target.value); } }),
					h("div", { className: "napcatb-pGrid", role: "listbox" },
						list.map(function (p) {
							return h("button", { key: p.id, type: "button", role: "option", "aria-selected": cur === p, className: "napcatb-pCard" + (cur === p ? " napcatb-pOn" : ""), onClick: function () { choose(p); } },
								h(ProviderIcon, { icon: p.icon, name: p.name }), h("span", { className: "napcatb-pName" }, providerName(t, p)));
						}),
						h("button", { type: "button", role: "option", "aria-selected": !cur, className: "napcatb-pCard" + (!cur ? " napcatb-pOn" : ""), onClick: function () { choose(null); } },
							h(ProviderIcon, { name: "+" }), h("span", { className: "napcatb-pName" }, t("providerCustom"))))) : null);
		}
		/** 模型：下拉里是拉到的模型（拉不到就用这家的常用模型），也能手动填 */
		function ModelField(props) {
			var t = props.t;
			var url = props.state[props.urlField].text;
			var cur = providerOf(url);
			var model = props.state[props.modelField].text;
			var listHook = React.useState(null), fetched = listHook[0], setFetched = listHook[1];
			var msgHook = React.useState(null), msg = msgHook[0], setMsg = msgHook[1];
			var busyHook = React.useState(false), busy = busyHook[0], setBusy = busyHook[1];
			var manualHook = React.useState(false), manual = manualHook[0], setManual = manualHook[1];
			function fetchModels() {
				var typedKey = props.state[props.keyField] ? props.state[props.keyField].text : "";
				setBusy(true); setMsg(null);
				return fetch(new URL(props.apiPath, document.baseURI).href, {
					method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
					body: JSON.stringify({ apiUrl: url, apiKey: typedKey || "", query: (cur && cur.query) || "" })
				}).then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
					.then(function (r) {
						if (r.ok) { setFetched(r.models); setMsg({ tone: "ok", text: t(r.filtered ? "modelFetched" : "modelFetchedAll", { n: r.models.length }) }); }
						else { setFetched(null); setMsg({ tone: "error", text: t("modelFetchFailed", { error: r.error }) }); }
					}, function (e) { setMsg({ tone: "error", text: t("modelFetchFailed", { error: e && e.message || String(e) }) }); })
					.finally(function () { setBusy(false); });
			}
			// 换了服务商：清掉上一家拉到的列表；有 Key（保存过的或刚填的）就自动拉一次
			var lastUrl = React.useRef(url);
			React.useEffect(function () {
				if (lastUrl.current === url) return;
				lastUrl.current = url; setFetched(null); setMsg(null); setManual(false);
				var hasKey = (props.state.secretSet && props.state.secretSet[props.keyField]) || (props.state[props.keyField] && props.state[props.keyField].text);
				if (cur && (hasKey || /^http:\/\/127\.0\.0\.1/.test(cur.url))) fetchModels();
			}, [url]);
			var options = (fetched || (cur ? cur.models : [])).slice();
			if (model && options.indexOf(model) < 0) options.unshift(model);
			var MANUAL = "\u0000manual";
			var showSelect = !manual && options.length > 0;
			return h("div", { className: "napcatb-field" },
				h("span", { className: "napcatb-label" }, h(Label, { text: props.label, hint: t("pModelHint") })),
				h("div", { className: "napcatb-row" },
					showSelect ? h("select", { className: "napcatb-select napcatb-pModel", disabled: props.disabled, value: model, "aria-label": props.label, onChange: function (e) { if (e.target.value === MANUAL) setManual(true); else props.edit(props.modelField, e.target.value); } },
						options.map(function (m) { return h("option", { key: m, value: m }, m); }),
						h("option", { value: MANUAL }, t("modelManual"))) : null,
					h("button", { type: "button", className: "napcatb-pBtn", disabled: busy || props.disabled || !url, onClick: fetchModels }, busy ? t("modelFetching") : t("modelFetch")),
					showSelect ? null : (options.length > 0 ? h("button", { type: "button", className: "napcatb-pBtn", onClick: function () { setManual(false); } }, t("modelPickList")) : null)),
				showSelect ? null : h(Value, Object.assign({}, props.common, { field: props.modelField, label: t("modelManualLabel") })),
				cur && cur.note ? h("p", { className: "napcatb-hint" }, t(cur.note)) : null,
				msg ? h("p", { className: "napcatb-pill napcatb-result napcatb-" + msg.tone, role: "status" }, msg.text) : null);
		}
		//#endregion


		//#region 聊天用的模型：从 dsh 里配置的模型里选，思考等级按这个模型支持的列
		var dshModelsCache = null;
		function napcatApi(method, path, body) {
			var init = { method: method, credentials: "same-origin", cache: "no-store" };
			if (body !== void 0) { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(body); }
			return fetch(new URL("api/napcat-bridge/" + path, document.baseURI).href, init).then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); });
		}
		function loadDshModels() {
			if (!dshModelsCache) dshModelsCache = napcatApi("GET", "llm/dsh-models").catch(function (e) { dshModelsCache = null; throw e; });
			return dshModelsCache;
		}
		function effortName(t, id, name) {
			var key = "reasoning" + id.charAt(0).toUpperCase() + id.slice(1);
			var tr = t(key);
			return tr && tr !== key ? tr : (name || id);
		}
		/** 一类聊天（主人私聊 / 其他私聊 / 群聊）：模型下拉 + 思考等级下拉 */
		function ChatModelPick(props) {
			var t = props.t;
			var listHook = React.useState(null), list = listHook[0], setList = listHook[1];
			var errHook = React.useState(null), err = errHook[0], setErr = errHook[1];
			var effHook = React.useState(null), eff = effHook[0], setEff = effHook[1];
			var value = props.state[props.modelField].text;
			var effort = props.state[props.effortField].text || props.effortFallback;
			React.useEffect(function () { loadDshModels().then(setList, function (e) { setErr(e && e.message || String(e)); }); }, []);
			var shown = value || props.inherited || "";
			React.useEffect(function () {
				setEff(null);
				var slash = shown.indexOf("/");
				napcatApi("POST", "llm/efforts", slash > 0 ? { provider: shown.slice(0, slash), model: shown.slice(slash + 1) } : {}).then(setEff, function () { setEff({ efforts: [] }); });
			}, [shown]);
			var groups = ((list && list.providers) || []).filter(function (g) { return g.models.length > 0; });
			var known = groups.some(function (g) { return g.models.some(function (m) { return g.id + "/" + m.id === value; }); });
			var opts = eff ? eff.efforts.slice() : [];
			if (opts.length > 0 && opts.every(function (o) { return o.id !== effort; })) opts.unshift({ id: effort, name: effort, missing: true });
			return h("div", { className: "napcatb-modelRow" },
				h("div", { className: "napcatb-field" },
					h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-" + props.modelField }, h(Label, { text: props.label, hint: t("modelPickHint") })),
					err ? h("p", { className: "napcatb-result napcatb-error" }, t("dshModelsFailed", { error: err })) : null,
					h("select", { id: "napcat-bridge-" + props.modelField, className: "napcatb-select", disabled: props.disabled || !list, value: value, onChange: function (e) { props.edit(props.modelField, e.target.value); } },
						h("option", { value: "" }, list ? props.blankLabel : t("loadingModels")),
						value && !known ? h("option", { value: value }, value) : null,
						groups.map(function (g) {
							return h("optgroup", { key: g.id, label: g.name }, g.models.map(function (m) { return h("option", { key: m.id, value: g.id + "/" + m.id }, m.name + (m.name !== m.id ? "（" + m.id + "）" : "")); }));
						}))),
				h("div", { className: "napcatb-field" },
					h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-" + props.effortField }, h(Label, { text: props.effortLabel, hint: t("reasoningHint") })),
					opts.length === 0 ? h("p", { className: "napcatb-hint" }, eff ? t("reasoningNone") : t("loadingModels")) :
					h("select", { id: "napcat-bridge-" + props.effortField, className: "napcatb-select", disabled: props.disabled, value: effort, onChange: function (e) { props.edit(props.effortField, e.target.value); } },
						opts.map(function (o) { return h("option", { key: o.id, value: o.id }, effortName(t, o.id, o.name) + (o.missing ? t("reasoningUnsupported") : "")); }))));
		}
		//#endregion
		function SettingsPage(props) {
			var t = props.t;
			if (props.view === "summary") return t("summary");
			var state = props.useNapcatForm(function (s) { return s; });
			var disabled = !state.writable || state.saving;
			var common = { t: t, state: state, disabled: disabled, edit: props.edit, resetField: props.resetField };
			var sttMode = state.sttMode.text || "off";
			var tabHook = React.useState(readTab), tab = tabHook[0], setTab = tabHook[1];
			// 找到的 ffmpeg 在哪（「ffmpeg 位置」留空时显示在框里）
			var ffHook = React.useState(null), ffmpegAt = ffHook[0], setFfmpegAt = ffHook[1];
			return h(P.SettingsForm, {
				labels: { unavailable: t("unavailable"), readOnly: t("readOnly"), saveFailed: t("saveFailed"), save: t("save"), saving: t("saving") },
				state: state,
				onSave: props.save,
				onDiscard: props.discard
			},
				h(Tabs, { t: t, cur: tab, onChange: setTab }),
				tab === "conn" ? [
					h("details", { key: "c", className: "napcatb-details" },
						h("summary", { className: "napcatb-summary" },
							h("span", { className: "napcatb-chevron", "aria-hidden": true }, "›"),
							h(Label, { text: t("connection"), hint: t("connectionHint") })),
						h("div", { className: "napcatb-detailsBody" },
							G(h(Value, Object.assign({ field: "ws_reverse_host", label: t("host"), hint: t("hostHint") }, common)),
								h(Value, Object.assign({ field: "ws_reverse_port", label: t("port"), hint: t("portHint"), numeric: true, invalidLabel: t("invalidPort") }, common)),
								h(Value, Object.assign({ field: "id", label: t("platformId"), hint: t("platformIdHint") }, common))),
							h(Secret, Object.assign({ field: "ws_reverse_token", label: t("token"), hint: t("tokenHint"), setLabel: t("tokenSet"), unsetLabel: t("tokenUnset") }, common)),
							h(NapcatSetup, { t: t, state: state, edit: props.edit, disabled: disabled }),
							h(ConnectionTest, { t: t, dirty: state.dirty }))),
					h(Section, { key: "a", title: t("access"), hint: t("accessHint") },
						G(h(Value, Object.assign({ field: "admins", label: t("admins"), hint: t("adminsHint") }, common)),
							h(Value, Object.assign({ field: "whitelist", label: t("whitelist"), hint: t("whitelistHint") }, common))),
						h(Toggle, Object.assign({ field: "whitelistEnabled", label: t("whitelistEnabled"), hint: t("whitelistEnabledHint") }, common)),
						h(Toggle, Object.assign({ field: "whitelistIgnoreAdminOnGroup", label: t("wlAdminGroup") }, common)),
						h(Toggle, Object.assign({ field: "whitelistIgnoreAdminOnFriend", label: t("wlAdminFriend") }, common)),
						h(Toggle, Object.assign({ field: "whitelistLog", label: t("wlLog"), hint: t("wlLogHint") }, common)),
						Sub(t("rateSub")),
						G(h(Value, Object.assign({ field: "rateLimitCount", label: t("rateCount"), hint: t("rateCountHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
							h(Value, Object.assign({ field: "rateLimitSeconds", label: t("rateSeconds"), hint: t("rateSecondsHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Select, Object.assign({ field: "rateLimitStrategy", label: t("rateStrategy"), hint: t("rateStrategyHint"), fallback: "stall", options: [{ value: "stall", label: t("rateStall") }, { value: "discard", label: t("rateDiscard") }] }, common)))),
					h(Section, { key: "w", title: t("wake"), hint: t("wakeHint") },
						G(h(Value, Object.assign({ field: "wakeKeywords", label: t("wakeKeywords"), hint: t("wakeKeywordsHint") }, common)),
							h(Value, Object.assign({ field: "wake_prefix", label: t("wakePrefix"), hint: t("wakePrefixHint") }, common))),
						h(Toggle, Object.assign({ field: "friend_message_needs_wake_prefix", label: t("friendNeedsPrefix"), hint: t("friendNeedsPrefixHint") }, common)),
						h(Toggle, Object.assign({ field: "ignore_bot_self_message", label: t("ignoreSelf"), hint: t("ignoreSelfHint") }, common)),
						h(Toggle, Object.assign({ field: "emptyMentionWaiting", label: t("emptyWaiting"), hint: t("emptyWaitingHint") }, common)),
						h(Toggle, Object.assign({ field: "emptyMentionNeedReply", label: t("emptyReply"), hint: t("emptyReplyHint") }, common))),
					h(Section, { key: "m", title: t("commands"), hint: t("commandsHint") },
						h(Toggle, Object.assign({ field: "commandsEnabled", label: t("commandsEnabled") }, common)),
						h(Toggle, Object.assign({ field: "noPermissionReply", label: t("noPermissionReply"), hint: t("noPermissionReplyHint") }, common)))
				] : null,
				tab === "session" ? h(Section, { title: t("session"), hint: t("sessionHint") },
					h(Value, Object.assign({ field: "workspacePath", label: t("workspacePath"), hint: t("workspacePathHint") }, common)),
					h(Toggle, Object.assign({ field: "uniqueSession", label: t("uniqueSession"), hint: t("uniqueSessionHint") }, common)),
					Sub(t("presetSub")),
					G(h(Value, Object.assign({ field: "agentPreset", label: t("agentPreset"), hint: t("agentPresetHint") }, common)),
						h(Value, Object.assign({ field: "adminPrivateAgentPreset", label: t("adminPrivatePreset"), hint: t("presetOverrideHint") }, common)),
						h(Value, Object.assign({ field: "privateAgentPreset", label: t("privatePreset"), hint: t("presetOverrideHint") }, common)),
						h(Value, Object.assign({ field: "groupAgentPreset", label: t("groupPreset"), hint: t("presetOverrideHint") }, common))),
					Sub(t("modelSub")),
					h(ChatModelPick, Object.assign({ modelField: "adminPrivateModel", effortField: "adminPrivateReasoning", label: t("adminPrivateModel"), effortLabel: t("adminPrivateReasoning"), effortFallback: "high", blankLabel: t("modelBlankAdmin") }, common)),
					h(ChatModelPick, Object.assign({ modelField: "privateModel", effortField: "privateReasoning", label: t("privateModel"), effortLabel: t("privateReasoning"), effortFallback: "low", blankLabel: t("modelBlankDefault") }, common)),
					h(ChatModelPick, Object.assign({ modelField: "groupModel", effortField: "groupReasoning", label: t("groupModel"), effortLabel: t("groupReasoning"), effortFallback: "low", blankLabel: t("modelBlankDefault") }, common)),
					Sub(t("silenceSub")),
					h(Value, Object.assign({ field: "silenceToken", label: t("silenceToken"), hint: t("silenceTokenHint") }, common))) : null,
				tab === "content" ? [
					h(Section, { key: "m", title: t("model") },
						h(Toggle, Object.assign({ field: "identifier", label: t("identifier"), hint: t("identifierHint") }, common)),
						h(Toggle, Object.assign({ field: "markAdmin", label: t("markAdmin"), hint: t("markAdminHint") }, common)),
						h(Toggle, Object.assign({ field: "groupNameDisplay", label: t("groupName"), hint: t("groupNameHint") }, common)),
						h(Toggle, Object.assign({ field: "datetimeReminder", label: t("datetime"), hint: t("datetimeHint") }, common)),
						h(Toggle, Object.assign({ field: "imageToModel", label: t("imageToModel"), hint: t("imageToModelHint") }, common)),
						G(h(Value, Object.assign({ field: "timezone", label: t("timezone"), hint: t("timezoneHint") }, common)),
							h(Value, Object.assign({ field: "maxImages", label: t("maxImages"), hint: t("maxImagesHint"), numeric: true, invalidLabel: t("invalidCount") }, common)))),
					h(Section, { key: "s", title: t("stt"), hint: t("sttHint") },
						h(Select, Object.assign({ field: "sttMode", label: t("sttMode"), fallback: "off", options: [{ value: "off", label: t("sttOff") }, { value: "command", label: t("sttCommandMode") }, { value: "openai", label: t("sttOpenai") }] }, common)),
						sttMode === "command" ? h(Value, Object.assign({ field: "sttCommand", label: t("sttCommand"), hint: t("sttCommandHint") }, common)) : null,
						sttMode === "openai" ? h(ProviderField, Object.assign({ urlField: "sttApiUrl", modelField: "sttModel" }, common)) : null,
						sttMode === "openai" ? h(Secret, Object.assign({ field: "sttApiKey", label: t("sttApiKey"), hint: t("sttApiKeyHint"), setLabel: t("keySet"), unsetLabel: t("keyUnset") }, common)) : null,
						sttMode === "openai" ? h(ModelField, Object.assign({ urlField: "sttApiUrl", modelField: "sttModel", keyField: "sttApiKey", apiPath: "api/napcat-bridge/stt/models", label: t("sttModel"), common: common }, common)) : null,
						sttMode === "openai" ? h(Value, Object.assign({ field: "sttApiUrl", label: t("sttApiUrl"), hint: t("sttApiUrlHint") }, common)) : null,
						sttMode !== "off" ? h(SttTest, { t: t, dirty: state.dirty }) : null),
					h(Section, { key: "v", title: t("video"), hint: t("videoHint") },
						h(Toggle, Object.assign({ field: "videoFrames", label: t("videoFrames"), hint: t("videoFramesHint") }, common)),
						h(FfmpegStatus, { t: t, onFound: setFfmpegAt }),
						G(h(Value, Object.assign({ field: "videoMaxFrames", label: t("videoMaxFrames"), hint: t("videoMaxFramesHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoSecondsPerFrame", label: t("videoSecondsPerFrame"), hint: t("videoSecondsPerFrameHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoMaxEdge", label: t("videoMaxEdge"), hint: t("videoMaxEdgeHint"), numeric: true, invalidLabel: t("invalid") }, common)),
							h(Value, Object.assign({ field: "videoMaxMB", label: t("videoMaxMB"), hint: t("videoMaxMBHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoMaxMinutes", label: t("videoMaxMinutes"), hint: t("videoMaxMinutesHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoTimeoutSeconds", label: t("videoTimeout"), hint: t("videoTimeoutHint"), numeric: true, invalidLabel: t("invalid") }, common))),
						h(Value, Object.assign({ field: "ffmpegPath", label: t("ffmpegPath"), hint: t("ffmpegPathHint"), placeholder: ffmpegAt ? t("ffmpegPathAuto", { path: ffmpegAt }) : void 0 }, common)))
				] : null,
				tab === "send" ? h(Section, { title: t("paceSec"), hint: t("paceHint") },
					Sub(t("typingSub")),
					h(Toggle, Object.assign({ field: "typingPrivate", label: t("typingPrivate") }, common)),
					h(Toggle, Object.assign({ field: "typingGroup", label: t("typingGroup") }, common)),
					G(h(Value, Object.assign({ field: "typingCharsPerMinute", label: t("typingCharsPerMinute"), hint: t("typingCharsPerMinuteHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "typingMinSeconds", label: t("typingMinSeconds"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "typingMaxSeconds", label: t("typingMaxSeconds"), hint: t("typingMaxSecondsHint"), numeric: true, invalidLabel: t("invalidCount") }, common))),
					Sub(t("segmentSub")),
					h(Toggle, Object.assign({ field: "segmentAdminPrivate", label: t("segmentAdminPrivate"), hint: t("segmentHint") }, common)),
					h(Toggle, Object.assign({ field: "segmentPrivate", label: t("segmentPrivate") }, common)),
					h(Toggle, Object.assign({ field: "segmentGroup", label: t("segmentGroup") }, common)),
					G(h(Value, Object.assign({ field: "segmentMax", label: t("segmentMax"), hint: t("segmentMaxHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "segmentMaxSeconds", label: t("segmentMaxSeconds"), hint: t("segmentMaxSecondsHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					Sub(t("groupRateSub")),
					G(h(Value, Object.assign({ field: "groupMinGapSeconds", label: t("groupMinGapSeconds"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "groupMaxPerWindow", label: t("groupMaxPerWindow"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "groupWindowSeconds", label: t("groupWindowSeconds"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "sendMaxWaitSeconds", label: t("sendMaxWaitSeconds"), hint: t("sendMaxWaitSecondsHint"), numeric: true, invalidLabel: t("invalidCount") }, common)))) : null,
				tab === "log" ? h(Section, { title: t("log") },
					h(Select, Object.assign({ field: "logLevel", label: t("logLevel"), hint: t("logLevelHint"), fallback: "info", options: LOG_LEVELS.map(function (l) { return { value: l, label: l }; }) }, common))) : null);
		}
		//#endregion

		//#region 入口
		var inject = ["slots", "locale", "configForms", "remote", "remote.settings"];

		function apply(ctx) {
			ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "napcat-bridge: dictionaries");
			var scope = ctx.configForms.get(SECTION);
			var model = createForm(scope);
			ctx.effect(function () { return function () { model.form.dispose(); }; }, "napcat-bridge: form");
			var disposed = false;
			ctx.effect(function () { return function () { disposed = true; }; }, "napcat-bridge: lifetime");
			function refreshToken() {
				ctx.remote.settings.describe().then(function (response) {
					if (disposed || !response.ok) return;
					var row = response.value.namespaces.find(function (n) { return n.ns === SECTION; });
					var next = {};
					((row && row.secrets) || []).forEach(function (x) { if (x.path.length === 1) next[x.path[0]] = x.set === true; });
					model.setSecrets(next);
				}, function () {});
			}
			refreshToken();
			ctx.effect(function () { return scope.subscribe(refreshToken); }, "napcat-bridge: token state");
			ctx.effect(function () {
				return ctx.configForms.whileServed([SECTION], function () {
					return ctx.slots.inject("plugins.bundle.config", function () {
						return ctx.slots.register({
							name: "plugins.bundle.config",
							key: PACKAGE,
							locale: NS,
							inject: function () { return Object.assign({ hooks: { napcatForm: model.store } }, model.form.actions()); }
						}, SettingsPage);
					});
				});
			}, "napcat-bridge: page");
		}
		//#endregion

		exports.inject = inject;
		exports.apply = apply;
		exports.SettingsPage = SettingsPage;
		return module.exports;
	}
});
