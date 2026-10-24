// dsh-companion-core 设置页（浏览器一侧），嵌在 dsh「插件」页里（plugins.bundle.config 扩展点）。
// 普通设置读写 dsh 设置服务里本插件的配置行（id: companion-core），点「保存」后插件立即读到新值；
// 人格稿和核心记忆是文件，用各自的「保存」按钮，经 <dsh>/api/companion/… 接口读写（要先登录 dsh）。
// 只用 dsh 自带的表单组件和 --dsw-* 颜色变量，深色/浅色主题自动跟随；桌面端和 Web 端都用这一份：
// 不用 window.confirm/alert（桌面端可能不显示），确认都放在页面里；窄窗口下自动换行。
// 这个文件不经过打包，构建时原样复制到 lib/client.js。
window.__ModuleLoader__.load({
	id: "dsh-companion-core",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var reactModule = require("react");
		var React = typeof reactModule.createElement === "function" ? reactModule : reactModule.default;
		var P = require("@deepseek-ai/dsh-client-ui-primitives");
		var h = React.createElement;

		var NS = "companionCore";
		var PACKAGE = "dsh-companion-core";
		var SECTION = "companion-core";

		var zh = {
			summary: "人格和核心记忆对所有会话即时生效，按轮数截断或用中文回忆压缩上下文，消息存档。",
			status: "状态",
			statusHint: "数据都在下面这个目录里（人格、核心记忆、历史版本、存档数据库），备份时整个目录拷走就行。",
			dataDir: "数据目录：{dir}",
			napcatOn: "插件一（dsh-napcat-bridge）已连上：QQ 会话按主人 / 其他私聊 / 群聊分规则。",
			napcatOff: "没检测到插件一（dsh-napcat-bridge）：所有会话都按「主人」处理，也不会有消息存档。",
			archiveCount: "存档 {total} 条（私聊 {private}，群聊 {group}）",
			loading: "读取中…",
			loadFailed: "读取失败：{error}",
			scope: "生效范围",
			scopeHint: "插件二对 QQ 和 dsh 里的所有会话生效。dsh 里直接开的会话算「主人」，和你的 QQ 私聊共用同一份核心记忆。新会话要用「陪伴模式」预设才有下面的上下文管理；在 dsh「设置 → Agent 预设」里把它设成新任务默认，插件一的「默认的 Agent 预设」也填 companion。",
			excludedPresets: "不生效的预设",
			excludedPresetsHint: "预设 id，多个用空格或逗号分开。比如写代码用的 standard。这些预设的会话保持 dsh 原样：不换人格、不装工具、按 dsh 自带方式压缩。",
			personaOnly: "只用人格",
			personaOnlyHint: "去掉 dsh 默认的那句 \"You are an AI agent powered by DeepSeek Harness.\"。注意：预设里的 dsh-persona 如果开了 complete（完整替换，比如内置的极简模式），插件二替换不了它的人格，请把那个预设加进上面的列表。",
			persona: "人格",
			personaHint: "这里改完点「保存人格」，所有会话（包括正在聊的）下一句话起就是新人格，不用重启。留空表示不替换，用预设原来的人格。",
			savePersona: "保存人格",
			selfEdit: "让她自己改人格和核心记忆",
			selfEditHint: "只在主人的会话里（QQ 主人私聊、dsh 里的会话）给她「修改人格」「修改核心记忆」两个工具，改了直接生效、旧版本自动保存。群聊和别人的私聊里没有这两个工具。",
			personaGuardSec: "改人格的限制",
			personaGuardHint: "人格一直放在她的系统提示词里，写进去的东西会一直影响她说话；如果让她随便写，她会把具体的事、数字、别人的话塞进去，越写越乱。所以她改人格时：先过硬规则（一次加的字数、人格总长度、一次删一半以上、日期、长数字、链接、邮箱、密钥、「忽略规则」之类的话都直接退回），再让模型按下面两张清单审核。被退回时会告诉她原因，让她把具体的事写进记忆或核心记忆。主人在这个页面上直接改人格不受这些限制。",
			personaGuard: "限制她改人格",
			personaReview: "改之前让模型审核",
			personaReviewHint: "用「记忆生成」里整理记忆的模型。审核出错时这次不改。",
			personaEditMaxChars: "一次最多加几个字",
			personaMaxChars: "人格最多几个字",
			personaMaxCharsHint: "超过以后她只能把人格改短，不能再加。",
			personaAllowed: "可以写（一行一条）",
			personaForbidden: "不许写（一行一条）",
			historyKeep: "保留几份历史版本",
			historyKeepHint: "人格和两份核心记忆各自最多保留几份；0 表示不留。",
			core: "核心记忆",
			coreHint: "一直放在她脑子里、不会被遗忘的事：主人是谁、称呼、约定、禁忌。主人的核心记忆只在主人的会话里出现；公开的核心记忆所有会话都有，别写私密的事。",
			coreMaster: "主人的核心记忆",
			corePublic: "公开的核心记忆",
			saveCore: "保存",
			coreMaxKB: "核心记忆上限（KB）",
			coreMaxKBHint: "每份最多多大，默认 24KB。",
			chars: "{n} 字",
			saved: "已保存。",
			saveDocFailed: "没保存成功：{error}",
			unsaved: "有改动还没保存",
			history: "历史版本",
			historyEmpty: "还没有历史版本。",
			bySettings: "设置页",
			byTool: "她自己",
			byRestore: "回退",
			view: "查看",
			hide: "收起",
			restore: "回退到这一版",
			restoreConfirm: "回退后当前内容会先存成一份历史版本。确认回退？",
			confirm: "确认",
			cancel: "取消",
			context: "上下文",
			contextHint: "每个会话超过「最多保留轮数」，或者上下文到了模型上限的百分比，就处理最早的几轮（哪个先到算哪个）。处理前先把要紧内容写进记忆。模型报「超出上限」时不管设的什么，都立刻按轮数截断再重试。一轮 = 一条人说的话加她的回复。",
			thresholdPercent: "到上限的百分之多少就处理",
			thresholdPercentHint: "默认 70。10–95。",
			masterRow: "主人",
			privateRow: "其他私聊",
			groupRow: "群聊",
			maxRounds: "最多保留轮数",
			maxRoundsHint: "0 表示不按轮数限制（只看上面的百分比）。",
			dropRounds: "一次处理几轮",
			mode: "处理方式",
			modeTruncate: "按轮数截断",
			modeLlm: "让模型写回忆（压缩）",
			modeDefault: "用默认",
			summaryModel: "写回忆用的模型",
			summaryModelHint: "写成 提供方/模型，例如 deepseek/deepseek-flash；留空用这个会话自己的模型。",
			rules: "例外规则",
			rulesHint: "按 QQ 号或群号单独设置，空着的项用上面的默认。私聊（包括主人）按对方 QQ 号，群按群号。",
			rulesEmpty: "还没有例外规则。",
			addRule: "加一条",
			removeRule: "删除",
			kind: "类型",
			kindUser: "QQ 号",
			kindGroup: "群号",
			target: "号码",
			archiveDays: "存档天数",
			archiveUnwoken: "存没唤醒的群消息",
			unwokenOn: "存",
			unwokenOff: "不存",
			note: "备注",
			archive: "消息存档",
			archiveHint: "QQ 上收到和发出的每条消息按原样存进数据库（和 dsh 的会话日志不是一回事）。保留天数到期后，先把还没整理的部分整理进记忆，再删除。",
			archiveEnabled: "消息存档",
			archiveUnwokenAll: "保存没唤醒她的群消息",
			archiveUnwokenAllHint: "关掉后只存她参与过的群消息；以后「参与群话题时附上之前几条」也会跟着关。",
			archiveDaysMaster: "主人私聊保留天数",
			archiveDaysOthers: "其他私聊和群聊保留天数",
			log: "日志",
			logLevel: "日志级别",
			logLevelHint: "debug 会记录每次检查的轮数和上下文占用，排查问题时再开。",
			recentLogs: "最近的日志",
			noLogs: "还没有日志。",
			refresh: "刷新",
			overridden: "已修改",
			reset: "恢复默认",
			invalid: "格式不对",
			invalidCount: "请填 0 或正整数",
			invalidPositive: "请填正整数",
			readOnly: "本部署的设置为只读。",
			unavailable: "插件当前没有加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "没有保存成功，修改已保留，请检查后重试。",
			memRecall: "记忆召回",
			memRecallHint: "每轮交给她之前，用这条消息去记忆库里找相关的几条，放进这一轮的消息里（不放系统提示词，前面的缓存不受影响）。关键词检索一直开；填了下面「向量检索」的 Key 后再加上向量检索。主人的会话也能想起群里的事（排名打折），群里和别人私聊想不起主人的事。",
			recallEnabled: "自动想起相关记忆",
			recallTopK: "每轮最多几条（别人私聊、群聊）",
			recallTopKHint: "群里只想得起这个群的和公开的记忆，想不起主人私聊的。条数固定，不会越聊越费 token。",
			recallTopKMaster: "每轮最多几条（主人的会话）",
			recallTopKMasterHint: "主人的 QQ 私聊和 dsh 里的会话。主人会话也能想起群里的事（排得靠后），条数固定。",
			keywordThreshold: "关键词门槛",
			keywordThresholdHint: "0–1。只用关键词时，问题里的词至少有这么多（按重要性加权）出现在记忆里才算相关。",
			vectorThreshold: "向量门槛",
			vectorThresholdHint: "0–1。用了向量时，综合相似度低于这个不要。换了向量模型后要重新调。",
			keywordWeight: "关键词占比",
			keywordWeightHint: "用了向量时，关键词相关度占多少，其余是向量相似度。",
			importanceWeight: "重要程度权重",
			recencyWeight: "新近程度权重",
			groupDiscount: "群记忆折扣",
			groupDiscountHint: "主人会话里群记忆排名乘这个数，免得群里的琐事挤掉你们之间的事。",
			halfLifeDays: "半衰期（天）",
			halfLifeDaysHint: "多久没被想起，重要程度就降一半；被想起一次会回升一点。",
			invalidRatio: "请填 0 到 1 之间的数",
			memGen: "记忆生成",
			memGenHint: "让模型把还没整理过的聊天挑出值得记的写进记忆。每个 QQ 会话记着「已整理到哪条」，同一段只整理一次。",
			activeMemory: "主动记忆",
			activeMemoryHint: "给每个会话装上「回忆」「记住」「遗忘」三个工具，她自己觉得要记、要查、要忘的时候用。只影响新开的会话。",
			organizeEveryRounds: "每多少轮整理一次",
			organizeEveryRoundsHint: "0 表示不按轮数整理。",
			organizeBeforeCompact: "截断/压缩前先整理",
			organizeBeforeCompactHint: "处理掉最早几轮之前，先把那部分里要紧的事写进记忆。",
			memoryModel: "整理用的模型",
			memoryModelHint: "写成 提供方/模型；留空用 dsh 的默认模型。",
			currentModel: "现在用的模型：{model}",
			noModel: "没找到可用的模型，请填「整理用的模型」或在 dsh 里设置默认模型。",
			pending: "还没整理：QQ 会话 {qs} 个（{qm} 条消息），dsh 会话 {ds} 个",
			organizeNow: "立即整理",
			organizing: "整理中…",
			organizeStarted: "已开始整理，完成后刷新就能看到。",
			forget: "遗忘",
			forgetHint: "普通遗忘：不再被想起，原文还在，可以恢复。彻底遗忘：删掉原文，只留几十字节的指纹，以后同样的内容不会再被写回来。",
			masterForget: "主人的记忆",
			privateForget: "别人私聊的记忆",
			groupForget: "群聊的记忆",
			forgetNormal: "普通遗忘",
			forgetPurge: "彻底遗忘",
			cleanupEnabled: "主人记忆的模型清理",
			cleanupEnabledHint: "打开后可以点「运行」：模型把普通遗忘里的主人记忆看一遍，列出建议彻底遗忘的（过时、重复、琐碎），你勾选确认后才删。",
			cleanupAutoPurge: "判断完直接删",
			cleanupAutoPurgeHint: "打开后模型清理不等你确认，直接彻底遗忘它挑出来的。",
			runCleanup: "运行",
			running: "运行中…",
			cleanupNone: "模型没有挑出要删的。",
			cleanupResult: "{time} 模型建议彻底遗忘 {n} 条：",
			cleanupPurged: "已删",
			purgeSelected: "彻底遗忘勾选的",
			vector: "向量检索",
			vectorHint: "用 OpenAI 兼容的向量接口（默认硅基流动的 BAAI/bge-m3）把记忆变成向量，聊到相关但字面不同的事也能想起来。没填 Key 时不启用。换了模型会自动重建，重建期间关键词检索照常能用。",
			embedApiUrl: "接口地址",
			embedApiUrlHint: "写到 /v1 为止，插件会请求 /embeddings。",
			embedApiKey: "接口 Key",
			embedApiKeyHint: "不会显示出来；留空表示保持当前 Key。",
			embedModel: "向量模型",
			embedBatch: "一次算几条",
			keySet: "已设置 Key。",
			keyUnset: "没有设置 Key，向量检索不启用。",
			indexState: "索引：{state}",
			stIdle: "空闲",
			stRunning: "正在建",
			stPaused: "已暂停",
			stDone: "已完成",
			stFailed: "失败",
			stCancelled: "已取消",
			stDisabled: "没启用（没填 Key）",
			indexModel: "模型 {model}，{dim} 维",
			indexCount: "已建 {embedded} / {total} 条",
			indexProgress: "这次：{done} / {todo}",
			indexLastError: "最近的错误：{error}",
			indexErrors: "跳过了 {n} 条算不出来的",
			indexTimes: "开始 {start}，结束 {end}",
			rebuild: "手动重建",
			tabsLabel: "设置分类",
			tab_persona: "人格",
			tab_chat: "对话",
			tab_memory: "记忆",
			tab_search: "检索",
			tab_diary: "日记",
			tab_proactive: "主动聊天",
			tab_backup: "备份和日志",
			graphSec: "图记忆",
			graphSecHint: "另外维护一张关系网：从记忆里抽出人、地点、事、物和它们的关系（比如「主人 —养了→ 咪咪」）。聊到「咪咪」时能顺着关系想起相关的记忆，哪怕那条记忆里没出现这个词。两路结果按排名融合，每轮想起的条数不变。代价：每条记忆要多调一次模型，所以默认关；打开后会对已有记忆补抽一遍（日记不抽）。填了向量 Key 时，实体名也会算向量，说法不同也能认出来。",
			graphEnabled: "图记忆",
			graphModel: "抽关系用的模型",
			graphModelHint: "写成「提供方/模型」；空着就和整理记忆用同一个。",
			graphBatch: "一次让模型看几条",
			graphHops: "顺着关系走几步",
			graphHopsHint: "0–2。1 就是「咪咪 → 主人的猫」这一层。",
			graphState: "关系网：{state}",
			graphCounts: "已抽 {done}/{memories} 条记忆 · 实体 {entities} 个 · 关系 {relations} 条",
			graphSample: "最近抽出来的关系",
			graphEmpty: "还没有关系。",
			graphRebuildConfirm: "清空关系网，对所有记忆重新抽一遍（要调很多次模型）。确认？",
			rebuildConfirm: "会清掉所有向量重新算，期间关键词检索照常能用。确认重建？",
			pause: "暂停",
			resume: "继续",
			cancelIndex: "取消",
			memList: "记忆列表",
			memListHint: "所有长期记忆。可以改内容、普通遗忘、彻底遗忘、恢复，也能手动加一条。",
			filterScope: "归属",
			scopeAll: "全部",
			scopeMaster: "主人",
			scopePublic: "公开",
			scopeGroups: "所有群",
			scopeUsers: "所有别人私聊",
			filterStatus: "状态",
			statusActive: "正常",
			statusForgotten: "普通遗忘",
			statusSuperseded: "已被取代",
			statusAll: "全部",
			search: "搜索",
			memTotal: "共 {n} 条",
			memEmpty: "没有记忆。",
			loadMore: "再看 50 条",
			edit: "改",
			saveEdit: "保存",
			doForget: "普通遗忘",
			doPurge: "彻底遗忘",
			purgeConfirm: "彻底遗忘后原文删掉、不能恢复。确认？",
			doRestore: "恢复",
			memMeta: "#{id} · {scope} · {kind} · 重要 {imp} · 想起 {count} 次 · {time}",
			addMemory: "手动加一条",
			addScope: "记成",
			addContent: "内容",
			addKind: "类型",
			addImportance: "重要程度（0–1）",
			add: "加上",
			added: "加上了。",
			blocked: "这条以前被彻底遗忘过，不能再加。",
			kindFact: "事实",
			kindPreference: "喜好",
			kindEvent: "事件",
			kindPromise: "约定",
			kindOther: "其他",
			kindDiary: "日记",
			groupCtx: "群聊上下文",
			groupCtxHint: "她参与群话题时（被 @），把群里最近几条消息（包括她自己说的）一起给她看，里面的图片全都给、不限张数；语音转文字、视频截图用插件一的设置。",
			groupContextCount: "附上之前几条",
			groupContextCountHint: "0 表示不附。",
			groupCtxOff: "「保存没唤醒她的群消息」关着，这一项不起作用。",
			forgetMode: "遗忘方式",
			proactive: "主动聊天",
			proRuleOn: "主动找",
			proRuleOff: "不主动找",
			memStats: "记忆：正常 {active} 条，普通遗忘 {forgotten} 条，被取代 {superseded} 条，指纹 {tomb} 个",
			diarySec: "日记",
			diarySecHint: "她每天用第一人称写一篇（只写和主人的事，不写群里的），一天一个文件，永久保留，也写进记忆库；每月写一篇月度总览。主人的会话开新会话时，自动先给她看最近的日记和总览（全自动，不用你做什么）。",
			diaryEnabled: "每天写日记",
			diaryTime: "每天几点",
			diaryTimeHint: "HH:MM。到这个时间写日记，并处理存档到期。默认 01:30。",
			dayBoundaryHour: "一天按凌晨几点分界",
			dayBoundaryHourHint: "默认 4：凌晨 4 点前的聊天算前一天。",
			timezone: "时区",
			monthlyEnabled: "每月写月度总览",
			diaryOnNewSession: "主人开新会话时先给她看日记",
			diaryDays: "最近几天的日记",
			overviewMonths: "最近几个月的总览",
			diaryBudgetPercent: "最多占模型上限的百分之多少",
			diaryBudgetPercentHint: "超了就把最早几天的日记缩短，还不够就去掉最早的。",
			diaryCount: "已有日记 {days} 篇、月度总览 {months} 篇。最近一篇：{latest}",
			writeDiaryNow: "现在就写一篇",
			diaryWritten: "写好了 {date} 的日记。",
			diaryNothing: "这段时间没有和主人的聊天，没写。",
			diaryPage: "日记本",
			diaryPageHint: "按日期列出她的日记和月度总览，可以看、改、删；也可以上传以前的日记（Markdown 或文本文件，按文件名或正文里的日期归位）。",
			diaryEmpty: "还没有日记。",
			monthlyLabel: "月度总览",
			del: "删除",
			delConfirm: "删掉这篇日记？（记忆库里的那份不受影响）",
			upload: "上传日记文件",
			uploadHint: "可以一次选多个。",
			conflict: "同一天已经有日记时",
			conflictSkip: "跳过",
			conflictMerge: "合并（接在后面）",
			conflictOverwrite: "覆盖",
			importPreview: "选了 {n} 个文件：",
			importNoDate: "认不出日期",
			importExists: "这天已有日记",
			importNew: "新的一天",
			importNow: "导入",
			importDone: "导入了 {n} 篇，跳过 {skip} 篇，认不出日期 {bad} 个。",
			expirySec: "存档到期",
			expirySecHint: "每天写完日记后处理：先整理还没整理的 → 删掉到期的存档 → 会话用满保留期就换新会话（开头带上最近几条）→ 旧会话归档；其他人的旧会话等它最后一条消息也过期后删掉（主人的永不删）。删旧会话是插件自己的做法（dsh 没有删除接口），已经在测试里验证过删完以后 dsh 能正常用、重启也正常。",
			rotateSessions: "会话用满保留期就换新会话",
			deleteOldSessions: "其他人的旧会话过期后删除",
			deleteOldSessionsHint: "关掉就只归档不删。主人的旧会话无论如何都不删。",
			carryMessages: "换会话时带过去最近几条消息",
			archiveImages: "收到的图片下载存起来",
			archiveImagesHint: "QQ 的图片链接过一阵会失效。按内容命名存在数据目录的 media/ 里，跟着存档一起到期删除。",
			runExpiry: "现在处理到期",
			expiryDone: "处理完了：删了 {deleted} 条存档，换了 {rotated} 个会话，删了 {sessions} 个旧会话，清掉 {media} 张图片。",
			lastRun: "上次运行：{time}",
			retired: "换下来的旧会话",
			retiredEmpty: "还没有换下来的会话。",
			retiredState: "{umo} · {cat} · 最后一条 {last} · {state}",
			stArchived: "已归档",
			stDeleted: "已删除",
			stFailed: "删除失败：{note}",
			proSec: "主动聊天",
			proSecHint: "每个 QQ 会话按随机间隔唤醒她一次，让她自己决定要不要说话（不想说就回「不发」暗号，插件一不会发出去）。主人私聊、别人的私聊和群聊各自在最短到最长间隔里随机；别人和群只找最近几天里聊过的。她刚在这个会话里说过话、或者在免打扰时间里都不触发，自动顺延。群里主动说话时带上最近几条群消息（图片不限张数）。需要 dsh-napcat-bridge 0.7.0 以上。",
			proactiveEnabled: "主动聊天",
			proactiveMinMinutes: "主人私聊：最短间隔（分钟）",
			proactiveMaxMinutes: "主人私聊：最长间隔（分钟）",
			proactiveOthersMinMinutes: "别人和群：最短间隔（分钟）",
			proactiveOthersMaxMinutes: "别人和群：最长间隔（分钟）",
			proIntervalHint: "默认主人 60～240（1～4 小时），别人和群 120～240（2～4 小时）。",
			proactivePrivate: "也主动找别人私聊",
			proactiveGroup: "也在群里主动说话",
			quietStart: "免打扰开始",
			quietEnd: "免打扰结束",
			quietHint: "HH:MM，可以跨午夜。默认 01:00–09:00。",
			proactiveRecentMinutes: "她说过话后几分钟内不触发",
			proactiveGroupContext: "群里带几条上下文",
			proactiveActiveDays: "别人和群：最近几天聊过才找",
			proSilence: "「不发」暗号",
			proSilenceHint: "和 dsh-napcat-bridge 设置里的保持一致。",
			proNoWake: "没检测到 dsh-napcat-bridge 0.7.0 以上的唤醒接口，主动聊天不会生效。",
			proListEmpty: "还没有可以主动找的会话（要先在 QQ 上聊过）。",
			proItem: "{umo} · {cat} · 下次 {next} · 上次 {last}",
			proTry: "现在试一次",
			proTried: "唤醒了，看她发不发。",
			never: "还没有",
			careSec: "记忆保养",
			careSecHint: "每隔几天（跟着每天的任务一起）做一次：自动清理久没想起又不重要的记忆（按每个会话的遗忘方式）；把相近的零散记忆合并成更精炼的一两条（原来的标成被取代，最近一次可以撤销）。日记永远不清理、不合并。",
			autoCleanup: "自动清理",
			autoCleanupDays: "超过几天没被想起",
			autoCleanupImportance: "重要程度低于",
			purgeForgotten: "普通遗忘很久的自动彻底遗忘",
			purgeForgottenDays: "普通遗忘超过几天",
			consolidateEnabled: "定期整合",
			consolidateOverlap: "相近程度门槛",
			consolidateOverlapHint: "0.2–0.95，越大越严（只合并很像的）。",
			consolidateGroups: "一次最多整合几组",
			careIntervalDays: "每几天做一次",
			careLast: "上次清理：{cleanup}；上次整合：{consolidate}",
			careRun: "现在做一次",
			careDone: "做完了：普通遗忘 {f} 条，彻底遗忘 {p} 条；整合 {g} 组（{m} 条合成 {c} 条）。",
			careLastRun: "最近一次整合（{time}）：",
			careGroup: "{old} → {created}",
			careUndo: "撤销最近一次整合",
			careUndoConfirm: "撤销后合成的新记忆删掉，原来的几条恢复。确认？",
			careUndone: "撤销了。",
			backupSec: "备份与迁移",
			backupSecHint: "备份包里有人格、核心记忆、日记、记忆库、主人私聊的存档和图片、插件二的设置（不含任何 Key）；别人的私聊、群聊存档和 dsh 的会话日志不进备份。换电脑时在新机器上导入这个包就行，向量模型不一样会自动重建索引。",
			backupEnabled: "每天自动备份",
			backupTime: "自动备份时间",
			backupKeep: "每一类最多留几份",
			backupKeepHint: "自动、手动、导入前的备份各自最多留这么多。建议偶尔把备份拷到别的机器上一份。",
			exportNow: "现在备份并下载",
			exported: "备份好了：{name}",
			download: "下载",
			importFile: "导入备份包",
			chooseFile: "选择备份包…",
			importFileHint: "选一个 companion-….tar.gz。会先核对，给你看包里有什么，确认后才覆盖。",
			previewTitle: "包里有：",
			previewLine: "插件 {plugin} · {time} 做的 · 记忆 {mem} 条 · 日记 {days} 篇 · 月度总览 {months} 篇 · 主人存档 {msgs} 条 · 图片 {media} 张 · 向量模型 {model}",
			previewSettings: "包里的设置不会自动套用（看一眼，需要的话自己改）：",
			confirmImport: "确认导入（先自动备份当前数据）",
			cancelImport: "不导入",
			importing: "正在导入，插件会自动重新加载…",
			imported: "导入完成（{time}）。",
			importFailed: "导入失败，原来的数据没动：{error}",
			backupList: "备份列表",
			backupEmpty: "还没有备份。",
			backupItem: "{name} · {size} · {reason}",
			reasonAuto: "自动",
			reasonManual: "手动",
			reasonBefore: "导入前",
			restoreThis: "从它还原",
			deleteBackup: "删除",
			deleteBackupConfirm: "删除这个备份文件？",
			selfCheck: "迁移后自检",
			selfCheckHint: "用几个固定问题在主人的记忆里搜，看她能不能想起来。导入完成后会自动跑一次。问题用空格或逗号分开。",
			selfCheckQueries: "自检问题",
			runSelfCheck: "现在自检",
			selfCheckResult: "「{q}」→ {a}",
			selfCheckNone: "（没想起来）"
		};
		var en = {
			summary: "A live persona and core memory for every session, round-based truncation or first-person summaries, and a message archive.",
			status: "Status",
			statusHint: "All data lives in this directory (persona, core memory, history, archive database). Copy it to back up.",
			dataDir: "Data directory: {dir}",
			napcatOn: "dsh-napcat-bridge is loaded: QQ sessions follow master / other private / group rules.",
			napcatOff: "dsh-napcat-bridge not detected: every session is treated as the master's, and nothing is archived.",
			archiveCount: "{total} archived messages (private {private}, group {group})",
			loading: "Loading…",
			loadFailed: "Failed to load: {error}",
			scope: "Scope",
			scopeHint: "Applies to every QQ and dsh session. Sessions opened in dsh count as the master's. Context management needs the \"companion\" preset: make it the default for new tasks, and set it as the bridge's default preset.",
			excludedPresets: "Excluded presets",
			excludedPresetsHint: "Preset ids separated by spaces or commas, e.g. standard for coding. Their sessions stay untouched.",
			personaOnly: "Persona only",
			personaOnlyHint: "Drop dsh's \"You are an AI agent powered by DeepSeek Harness.\" A preset whose dsh-persona sets complete: true cannot be overridden; exclude it.",
			persona: "Persona",
			personaHint: "Saved changes apply to every session, including running ones, from the next message. Blank keeps each preset's own persona.",
			savePersona: "Save persona",
			selfEdit: "Let her edit her persona and core memory",
			selfEditHint: "Only the master's sessions get the two editing tools; changes apply immediately and the old version is kept.",
			personaGuardSec: "Persona edit limits",
			personaGuardHint: "Her persona stays in the system prompt, so only personality and speaking style belong there. Her edits pass hard rules (size, dates, long numbers, links, emails, keys, jailbreak phrases) and then a model review against the two lists below. Refusals tell her why. Your own edits on this page are not limited.",
			personaGuard: "Limit her persona edits",
			personaReview: "Model review before editing",
			personaReviewHint: "Uses the memory model. If the review fails, the edit is refused.",
			personaEditMaxChars: "Max characters added per edit",
			personaMaxChars: "Max persona length (characters)",
			personaMaxCharsHint: "Above this she can only shorten it.",
			personaAllowed: "Allowed (one per line)",
			personaForbidden: "Not allowed (one per line)",
			historyKeep: "History versions to keep",
			historyKeepHint: "Per document; 0 keeps none.",
			core: "Core memory",
			coreHint: "Always in her mind and never forgotten. The master's core memory only appears in the master's sessions; the public one appears everywhere.",
			coreMaster: "Master's core memory",
			corePublic: "Public core memory",
			saveCore: "Save",
			coreMaxKB: "Core memory limit (KB)",
			coreMaxKBHint: "Per document, default 24 KB.",
			chars: "{n} chars",
			saved: "Saved.",
			saveDocFailed: "Not saved: {error}",
			unsaved: "Unsaved changes",
			history: "History",
			historyEmpty: "No history yet.",
			bySettings: "settings",
			byTool: "herself",
			byRestore: "restore",
			view: "View",
			hide: "Hide",
			restore: "Restore this version",
			restoreConfirm: "The current text is saved to history first. Restore?",
			confirm: "Confirm",
			cancel: "Cancel",
			context: "Context",
			contextHint: "When a session exceeds its round limit, or its context reaches the given share of the model window, the oldest rounds are handled. A provider context-overflow error always truncates by rounds and retries.",
			thresholdPercent: "Handle at this % of the window",
			thresholdPercentHint: "Default 70; 10–95.",
			masterRow: "Master",
			privateRow: "Other private",
			groupRow: "Groups",
			maxRounds: "Max rounds",
			maxRoundsHint: "0 means no round limit.",
			dropRounds: "Rounds per pass",
			mode: "Method",
			modeTruncate: "Truncate",
			modeLlm: "Summarize",
			modeDefault: "Default",
			summaryModel: "Summary model",
			summaryModelHint: "provider/model; blank uses the session's own model.",
			rules: "Exceptions",
			rulesHint: "Per QQ number or group number; blank fields use the defaults above.",
			rulesEmpty: "No exceptions yet.",
			addRule: "Add",
			removeRule: "Remove",
			kind: "Type",
			kindUser: "QQ",
			kindGroup: "Group",
			target: "Number",
			archiveDays: "Archive days",
			archiveUnwoken: "Archive unwoken",
			unwokenOn: "Yes",
			unwokenOff: "No",
			note: "Note",
			archive: "Message archive",
			archiveHint: "Every QQ message received or sent, stored as is. On expiry, unorganized messages are turned into memories first, then deleted.",
			archiveEnabled: "Archive messages",
			archiveUnwokenAll: "Archive group messages that did not wake her",
			archiveUnwokenAllHint: "When off, only group messages she took part in are kept.",
			archiveDaysMaster: "Master's private chat: days to keep",
			archiveDaysOthers: "Others and groups: days to keep",
			log: "Logging",
			logLevel: "Log level",
			logLevelHint: "debug logs every round count and context load.",
			recentLogs: "Recent log",
			noLogs: "No log yet.",
			refresh: "Refresh",
			overridden: "Changed",
			reset: "Reset",
			invalid: "Invalid value",
			invalidCount: "Enter 0 or a positive integer",
			invalidPositive: "Enter a positive integer",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "The plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "Not saved; your edits are kept for you to correct.",
			memRecall: "Recall",
			memRecallHint: "Before each round, related memories are found and added to that round's message (not the system prompt). Keywords always; vectors once a key is set below.",
			recallEnabled: "Recall related memories",
			recallTopK: "Max per round (others, groups)",
			recallTopKHint: "Groups recall only their own and public memories.",
			recallTopKMaster: "Max per round (master)",
			recallTopKMasterHint: "The master's QQ private chat and dsh sessions; fixed number, so no extra tokens.",
			keywordThreshold: "Keyword threshold",
			keywordThresholdHint: "0–1, weighted share of query words found in a memory.",
			vectorThreshold: "Vector threshold",
			vectorThresholdHint: "0–1, combined similarity when vectors are on. Retune after changing the model.",
			keywordWeight: "Keyword share",
			keywordWeightHint: "Share of keyword relevance when vectors are on.",
			importanceWeight: "Importance weight",
			recencyWeight: "Recency weight",
			groupDiscount: "Group discount",
			groupDiscountHint: "Group memories rank lower by this factor in the master's sessions.",
			halfLifeDays: "Half-life (days)",
			halfLifeDaysHint: "Importance halves after this long without recall.",
			invalidRatio: "Enter a number from 0 to 1",
			memGen: "Memory writing",
			memGenHint: "A model picks what is worth remembering from chat not yet organized. Each QQ chat keeps its position so nothing is organized twice.",
			activeMemory: "Active memory",
			activeMemoryHint: "Give every session recall/remember/forget tools. New sessions only.",
			organizeEveryRounds: "Organize every N rounds",
			organizeEveryRoundsHint: "0 disables.",
			organizeBeforeCompact: "Organize before truncating/summarizing",
			organizeBeforeCompactHint: "Save what matters from the rounds about to be dropped.",
			memoryModel: "Model for organizing",
			memoryModelHint: "provider/model; blank uses dsh's default model.",
			currentModel: "Using: {model}",
			noModel: "No usable model; set one here or a dsh default model.",
			pending: "Not organized yet: {qs} QQ chats ({qm} messages), {ds} dsh sessions",
			organizeNow: "Organize now",
			organizing: "Organizing…",
			organizeStarted: "Started; refresh to see the result.",
			forget: "Forgetting",
			forgetHint: "Forget: no longer recalled, text kept, can be restored. Purge: text deleted, a small fingerprint stops it from being written back.",
			masterForget: "Master's memories",
			privateForget: "Others' private chats",
			groupForget: "Groups",
			forgetNormal: "Forget",
			forgetPurge: "Purge",
			cleanupEnabled: "Model cleanup of the master's memories",
			cleanupEnabledHint: "Run a model over forgotten master memories to suggest purges you confirm.",
			cleanupAutoPurge: "Purge without asking",
			cleanupAutoPurgeHint: "Purge the model's picks immediately.",
			runCleanup: "Run",
			running: "Running…",
			cleanupNone: "Nothing suggested.",
			cleanupResult: "{time}: {n} suggested for purging:",
			cleanupPurged: "purged",
			purgeSelected: "Purge selected",
			vector: "Vector search",
			vectorHint: "Embeds memories via an OpenAI-compatible API (default SiliconFlow BAAI/bge-m3). Off without a key. Changing the model rebuilds automatically; keyword search keeps working meanwhile.",
			embedApiUrl: "API base URL",
			embedApiUrlHint: "Up to /v1; the plugin calls /embeddings.",
			embedApiKey: "API key",
			embedApiKeyHint: "Never shown; leave blank to keep the current key.",
			embedModel: "Embedding model",
			embedBatch: "Batch size",
			keySet: "A key is set.",
			keyUnset: "No key: vector search is off.",
			indexState: "Index: {state}",
			stIdle: "idle",
			stRunning: "building",
			stPaused: "paused",
			stDone: "done",
			stFailed: "failed",
			stCancelled: "cancelled",
			stDisabled: "off (no key)",
			indexModel: "{model}, {dim} dims",
			indexCount: "{embedded} / {total} embedded",
			indexProgress: "This run: {done} / {todo}",
			indexLastError: "Last error: {error}",
			indexErrors: "{n} skipped",
			indexTimes: "Started {start}, finished {end}",
			rebuild: "Rebuild",
			tabsLabel: "Settings sections",
			tab_persona: "Persona",
			tab_chat: "Chat",
			tab_memory: "Memory",
			tab_search: "Search",
			tab_diary: "Diary",
			tab_proactive: "Proactive",
			tab_backup: "Backup & logs",
			graphSec: "Graph memory",
			graphSecHint: "Keeps a relation graph extracted from memories (people, places, things and how they relate), so related memories can be recalled even without shared words. Both routes are fused by rank; the number recalled stays the same. Costs one extra model call per memory, so it is off by default.",
			graphEnabled: "Graph memory",
			graphModel: "Extraction model",
			graphModelHint: "provider/model; empty uses the memory model.",
			graphBatch: "Memories per call",
			graphHops: "Hops",
			graphHopsHint: "0–2.",
			graphState: "Graph: {state}",
			graphCounts: "{done}/{memories} memories extracted · {entities} entities · {relations} relations",
			graphSample: "Latest relations",
			graphEmpty: "No relations yet.",
			graphRebuildConfirm: "Clear the graph and extract every memory again (many model calls). Confirm?",
			rebuildConfirm: "All vectors are recomputed; keyword search keeps working. Rebuild?",
			pause: "Pause",
			resume: "Resume",
			cancelIndex: "Cancel",
			memList: "Memories",
			memListHint: "Edit, forget, purge, restore, or add memories.",
			filterScope: "Scope",
			scopeAll: "All",
			scopeMaster: "Master",
			scopePublic: "Public",
			scopeGroups: "All groups",
			scopeUsers: "All other private chats",
			filterStatus: "Status",
			statusActive: "Active",
			statusForgotten: "Forgotten",
			statusSuperseded: "Superseded",
			statusAll: "All",
			search: "Search",
			memTotal: "{n} in total",
			memEmpty: "No memories.",
			loadMore: "50 more",
			edit: "Edit",
			saveEdit: "Save",
			doForget: "Forget",
			doPurge: "Purge",
			purgeConfirm: "Purging deletes the text for good. Confirm?",
			doRestore: "Restore",
			memMeta: "#{id} · {scope} · {kind} · importance {imp} · recalled {count}× · {time}",
			addMemory: "Add a memory",
			addScope: "Scope",
			addContent: "Text",
			addKind: "Kind",
			addImportance: "Importance (0–1)",
			add: "Add",
			added: "Added.",
			blocked: "This was purged before and cannot be added again.",
			kindFact: "fact",
			kindPreference: "preference",
			kindEvent: "event",
			kindPromise: "promise",
			kindOther: "other",
			kindDiary: "diary",
			groupCtx: "Group context",
			groupCtxHint: "When she joins a group topic, the latest group messages (including her own) are included, with all their images.",
			groupContextCount: "Messages to include",
			groupContextCountHint: "0 disables.",
			groupCtxOff: "\"Archive group messages that did not wake her\" is off, so this has no effect.",
			forgetMode: "Forgetting",
			proactive: "Proactive",
			proRuleOn: "On",
			proRuleOff: "Off",
			memStats: "Memories: {active} active, {forgotten} forgotten, {superseded} superseded, {tomb} fingerprints",
			diarySec: "Diary",
			diarySecHint: "She writes a first-person entry each day (only about the master), kept forever and added to memory, plus a monthly overview. New master sessions automatically start with recent entries.",
			diaryEnabled: "Write a daily diary",
			diaryTime: "At",
			diaryTimeHint: "HH:MM; also when archive expiry runs. Default 01:30.",
			dayBoundaryHour: "Day starts at (hour)",
			dayBoundaryHourHint: "Default 4: chats before 4 a.m. count as the previous day.",
			timezone: "Time zone",
			monthlyEnabled: "Monthly overview",
			diaryOnNewSession: "Read the diary when a master session starts",
			diaryDays: "Days of entries",
			overviewMonths: "Months of overviews",
			diaryBudgetPercent: "Max % of the context window",
			diaryBudgetPercentHint: "Older entries are shortened, then dropped, to fit.",
			diaryCount: "{days} entries, {months} overviews. Latest: {latest}",
			writeDiaryNow: "Write one now",
			diaryWritten: "Wrote the entry for {date}.",
			diaryNothing: "No chat with the master in that period; nothing written.",
			diaryPage: "Diary book",
			diaryPageHint: "Read, edit or delete entries; upload old ones (Markdown or text, dated by file name or content).",
			diaryEmpty: "No entries yet.",
			monthlyLabel: "Monthly overview",
			del: "Delete",
			delConfirm: "Delete this entry? (The copy in memory is kept.)",
			upload: "Upload diary files",
			uploadHint: "Several at once is fine.",
			conflict: "When the day already has an entry",
			conflictSkip: "Skip",
			conflictMerge: "Merge (append)",
			conflictOverwrite: "Overwrite",
			importPreview: "{n} files selected:",
			importNoDate: "no date found",
			importExists: "day already has an entry",
			importNew: "new day",
			importNow: "Import",
			importDone: "Imported {n}, skipped {skip}, {bad} without a date.",
			expirySec: "Archive expiry",
			expirySecHint: "After the diary each day: organize what is left, delete expired archive, start a new session when one has used up the retention period (carrying the last few messages), archive the old one; others' old sessions are deleted once their last message expires (the master's never).",
			rotateSessions: "Start a new session when the retention period is used up",
			deleteOldSessions: "Delete others' old sessions after expiry",
			deleteOldSessionsHint: "Off keeps them archived. The master's are never deleted.",
			carryMessages: "Messages carried into the new session",
			archiveImages: "Save received images",
			archiveImagesHint: "QQ image links expire. Saved by content hash under media/, deleted with the archive.",
			runExpiry: "Run expiry now",
			expiryDone: "Done: {deleted} messages deleted, {rotated} sessions renewed, {sessions} old sessions deleted, {media} images removed.",
			lastRun: "Last run: {time}",
			retired: "Retired sessions",
			retiredEmpty: "None yet.",
			retiredState: "{umo} · {cat} · last message {last} · {state}",
			stArchived: "archived",
			stDeleted: "deleted",
			stFailed: "delete failed: {note}",
			proSec: "Proactive chat",
			proSecHint: "Each QQ chat wakes her at random intervals so she can decide whether to say something (or answer the silence token). The master and others/groups each have their own range; others/groups only if active recently. If she spoke recently or it is quiet hours, it is postponed. Needs dsh-napcat-bridge 0.7.0+.",
			proactiveEnabled: "Proactive chat",
			proactiveMinMinutes: "Master: min interval (min)",
			proactiveMaxMinutes: "Master: max interval (min)",
			proactiveOthersMinMinutes: "Others/groups: min interval (min)",
			proactiveOthersMaxMinutes: "Others/groups: max interval (min)",
			proIntervalHint: "Defaults: master 60–240, others/groups 120–240.",
			proactivePrivate: "Also others' private chats",
			proactiveGroup: "Also groups",
			quietStart: "Quiet from",
			quietEnd: "Quiet until",
			quietHint: "HH:MM; may wrap past midnight. Default 01:00–09:00.",
			proactiveRecentMinutes: "Skip if she spoke within (min)",
			proactiveGroupContext: "Group context messages",
			proactiveActiveDays: "Others/groups: active within (days)",
			proSilence: "Silence token",
			proSilenceHint: "Keep it the same as in dsh-napcat-bridge.",
			proNoWake: "dsh-napcat-bridge 0.7.0+ wake API not found; proactive chat is inactive.",
			proListEmpty: "No chats to reach yet.",
			proItem: "{umo} · {cat} · next {next} · last {last}",
			proTry: "Try now",
			proTried: "Woken; she decides whether to speak.",
			never: "never",
			careSec: "Memory care",
			careSecHint: "Every few days: forget idle, unimportant memories; merge similar scattered ones (undo the latest run). Diaries are never touched.",
			autoCleanup: "Automatic cleanup",
			autoCleanupDays: "Not recalled for (days)",
			autoCleanupImportance: "Importance below",
			purgeForgotten: "Purge long-forgotten memories",
			purgeForgottenDays: "Forgotten for (days)",
			consolidateEnabled: "Periodic consolidation",
			consolidateOverlap: "Similarity threshold",
			consolidateOverlapHint: "0.2–0.95; higher is stricter.",
			consolidateGroups: "Max groups per run",
			careIntervalDays: "Every (days)",
			careLast: "Last cleanup: {cleanup}; last consolidation: {consolidate}",
			careRun: "Run now",
			careDone: "Done: {f} forgotten, {p} purged; {g} groups ({m} merged into {c}).",
			careLastRun: "Latest consolidation ({time}):",
			careGroup: "{old} → {created}",
			careUndo: "Undo the latest consolidation",
			careUndoConfirm: "The merged memories are removed and the originals restored. Confirm?",
			careUndone: "Undone.",
			backupSec: "Backup & migration",
			backupSecHint: "A backup holds persona, core memory, diaries, the memory database, the master's archive and images, and settings (no keys). Others' archives and dsh session logs are excluded. Import it on a new machine; a different embedding model rebuilds automatically.",
			backupEnabled: "Daily automatic backup",
			backupTime: "Backup time",
			backupKeep: "Keep per kind",
			backupKeepHint: "Automatic, manual and pre-import backups each keep this many.",
			exportNow: "Back up and download now",
			exported: "Backed up: {name}",
			download: "Download",
			importFile: "Import a backup",
			chooseFile: "Choose a package…",
			importFileHint: "Choose a companion-….tar.gz. It is verified and previewed before anything is replaced.",
			previewTitle: "The package contains:",
			previewLine: "plugin {plugin} · made {time} · {mem} memories · {days} entries · {months} overviews · {msgs} archived messages · {media} images · embedding {model}",
			previewSettings: "Settings in the package are not applied automatically:",
			confirmImport: "Import (current data is backed up first)",
			cancelImport: "Don't import",
			importing: "Importing; the plugin reloads itself…",
			imported: "Imported ({time}).",
			importFailed: "Import failed; existing data untouched: {error}",
			backupList: "Backups",
			backupEmpty: "No backups yet.",
			backupItem: "{name} · {size} · {reason}",
			reasonAuto: "auto",
			reasonManual: "manual",
			reasonBefore: "pre-import",
			restoreThis: "Restore",
			deleteBackup: "Delete",
			deleteBackupConfirm: "Delete this backup file?",
			selfCheck: "Post-migration self-check",
			selfCheckHint: "Searches the master's memories with fixed questions. Runs automatically after an import.",
			selfCheckQueries: "Questions",
			runSelfCheck: "Run self-check",
			selfCheckResult: "\"{q}\" → {a}",
			selfCheckNone: "(nothing recalled)"
		};

		var CSS = [
			".compc-section{display:grid;gap:12px;padding:16px 0 8px;border-top:.5px solid var(--dsw-alias-border-l3)}",
			".compc-section:first-child{border-top:none;padding-top:4px}",
			".compc-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;margin:0}",
			".compc-subtitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;margin:4px 0 0}",
			".compc-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".compc-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;border-bottom:.5px solid var(--dsw-alias-border-l3);margin:4px 0 0;position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,inherit))}",
			".compc-tabs::-webkit-scrollbar{display:none}",
			".compc-tab{flex:none;padding:9px 12px 8px;border:none;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;white-space:nowrap;cursor:pointer;border-radius:0}",
			".compc-tab:hover{color:var(--dsw-alias-label-primary)}",
			".compc-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--dsw-alias-label-primary)}",
			".compc-tab:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:-2px}",
			".compc-tabs + .compc-section{border-top:none;padding-top:12px}",
			".compc-labelText{display:inline-flex;align-items:center;gap:3px;line-height:20px}",
			".compc-tip{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-top:0;border-radius:50%;border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary);font-size:9px;font-weight:600;line-height:1;cursor:help;user-select:none}",
			".compc-tip:hover,.compc-tip:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary);outline:none}",
			".compc-toggleRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
			".compc-field{display:grid;gap:6px;min-width:0}",
			".compc-label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;min-height:20px}",
			".compc-select,.compc-input{min-width:0;height:35px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;padding:0 12px;font:inherit;font-size:13px;box-sizing:border-box}",
			".compc-select{justify-self:start;align-self:start;min-width:120px;max-width:100%}",
			".compc-ruleGrid .compc-select,.compc-ruleGrid .compc-input,.compc-grid .compc-select{width:100%;min-width:0}",
			".compc-textarea{width:100%;min-height:220px;resize:vertical;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,6px);padding:10px;font:inherit;font-size:13px;line-height:1.6}",
			".compc-textarea.compc-small{min-height:120px}",
			".compc-select:focus-visible,.compc-input:focus-visible,.compc-textarea:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".compc-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
			".compc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 16px;align-items:end}",
			".compc-grid>*{padding-top:0!important;padding-bottom:0!important;border-top:none!important;margin:0!important;min-width:0}",
			".compc-grid>*>:first-child{flex-wrap:wrap;row-gap:2px}",
			".compc-grid>.compc-field,.compc-grid>.compc-toggleRow{align-self:end}",
			".compc-card{display:grid;gap:10px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px)}",
			".compc-ruleGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px 12px;align-items:end}",
			".compc-result{margin:0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".compc-ok{color:var(--dsw-alias-state-success-primary,#2f9e44)}",
			".compc-warn{color:var(--dsw-alias-state-warning-primary,#d97706)}",
			".compc-error{color:var(--dsw-alias-state-error-primary)}",
			".compc-history{display:grid;gap:6px;margin:0;padding:0;list-style:none}",
			".compc-historyItem{display:grid;gap:6px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,6px)}",
			".compc-pre{margin:0;max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}",
			".compc-details{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px);padding:0 12px}",
			".compc-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}",
			".compc-summary::-webkit-details-marker{display:none}",
			".compc-chevron{display:inline-block;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease;font-size:16px;line-height:1}",
			".compc-details[open] .compc-chevron{transform:rotate(90deg)}",
			".compc-detailsBody{display:grid;gap:8px;padding:0 0 12px}",
			".compc-progress{height:6px;border-radius:3px;background:var(--dsw-alias-border-l3);overflow:hidden}",
			".compc-progressBar{height:100%;background:var(--dsw-alias-state-success-primary,#2f9e44);transition:width .3s ease}",
			".compc-mem{display:grid;gap:6px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,6px)}",
			".compc-memText{margin:0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere}",
			".compc-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary);line-height:1.5}",
			".compc-check input{margin-top:3px}",
			".compc-input.compc-wide{width:100%}",
			"@media (prefers-reduced-motion:reduce){.compc-chevron,.compc-progressBar{transition:none}}"
		].join("\n");
		var CSS_ID = "dsh-companion-core/settings.css";
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
				parse: function (text) { return { kind: "set", value: text.split(/[\s,，]+/).filter(function (x) { return x !== ""; }) }; }
			};
		}
		/** 一行一条的列表（条目里可以有空格、逗号） */
		function lineListField(field) {
			return {
				field: field,
				format: function (v) { return Array.isArray(v) ? v.join("\n") : ""; },
				parse: function (text) { return { kind: "set", value: text.split("\n").map(function (x) { return x.trim(); }).filter(function (x) { return x !== ""; }) }; }
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
		/** 例外规则：整张表存成 JSON 文字，编辑器里改完写回。 */
		function rulesField(field) {
			return {
				field: field,
				format: function (v) { return JSON.stringify(Array.isArray(v) ? v : []); },
				parse: function (text) {
					try {
						var rows = JSON.parse(text);
						if (!Array.isArray(rows)) return void 0;
						return { kind: "set", value: rows.map(cleanRule).filter(function (r) { return r.target !== ""; }) };
					} catch (e) { return void 0; }
				}
			};
		}
		function cleanRule(r) {
			var out = { target: String(r.target || "").trim(), kind: r.kind === "group" ? "group" : "user" };
			["maxRounds", "dropRounds", "archiveDays"].forEach(function (k) {
				var n = Number(r[k]);
				if (r[k] !== "" && r[k] !== void 0 && r[k] !== null && Number.isSafeInteger(n) && n >= 0) out[k] = n;
			});
			out.mode = r.mode === "truncate" || r.mode === "llm" ? r.mode : "";
			out.archiveUnwoken = r.archiveUnwoken === "on" || r.archiveUnwoken === "off" ? r.archiveUnwoken : "";
			out.forgetMode = r.forgetMode === "normal" || r.forgetMode === "purge" ? r.forgetMode : "";
			out.proactive = r.proactive === "on" || r.proactive === "off" ? r.proactive : "";
			if (r.note) out.note = String(r.note);
			return out;
		}
		var MODES = ["truncate", "llm"];
		var LOG_LEVELS = ["debug", "info", "warn", "error"];
		var BOOLS = ["personaOnly", "selfEdit", "archiveEnabled", "archiveUnwoken", "recallEnabled", "activeMemory", "organizeBeforeCompact", "cleanupEnabled", "cleanupAutoPurge",
			"diaryEnabled", "monthlyEnabled", "diaryOnNewSession", "rotateSessions", "deleteOldSessions", "archiveImages",
			"proactiveEnabled", "proactivePrivate", "proactiveGroup", "graphEnabled", "personaGuard", "personaReview", "autoCleanup", "purgeForgotten", "consolidateEnabled", "backupEnabled"];
		var TEXTS = ["summaryModel", "memoryModel", "graphModel", "embedApiUrl", "embedModel", "diaryTime", "timezone", "quietStart", "quietEnd", "silenceToken", "backupTime"];
		var SECRETS = ["embedApiKey"];
		var FLOATS = ["keywordThreshold", "vectorThreshold", "keywordWeight", "importanceWeight", "recencyWeight", "groupDiscount", "autoCleanupImportance", "consolidateOverlap"];
		var FORGET = ["normal", "purge"];
		var LISTS = ["excludedPresets", "selfCheckQueries"];
		/** 一行一条 */
		var LINE_LISTS = ["personaAllowed", "personaForbidden"];
		var INTS = [
			["historyKeep", 0], ["coreMaxKB", 1], ["thresholdPercent", 10, 95],
			["masterMaxRounds", 0], ["masterDropRounds", 1], ["privateMaxRounds", 0], ["privateDropRounds", 1],
			["groupMaxRounds", 0], ["groupDropRounds", 1], ["archiveDaysMaster", 1], ["archiveDaysOthers", 1],
			["recallTopK", 0], ["recallTopKMaster", 0], ["halfLifeDays", 1], ["organizeEveryRounds", 0], ["embedBatch", 1, 64], ["groupContextCount", 0], ["graphBatch", 1, 30], ["graphHops", 0, 2],
			["dayBoundaryHour", 0, 12], ["diaryDays", 0], ["overviewMonths", 0], ["diaryBudgetPercent", 1, 60], ["carryMessages", 0],
			["personaEditMaxChars", 10], ["personaMaxChars", 100],
			["proactiveMinMinutes", 10], ["proactiveMaxMinutes", 10], ["proactiveOthersMinMinutes", 10], ["proactiveOthersMaxMinutes", 10], ["proactiveRecentMinutes", 0], ["proactiveGroupContext", 0], ["proactiveActiveDays", 1],
			["autoCleanupDays", 1], ["purgeForgottenDays", 1], ["consolidateGroups", 1], ["careIntervalDays", 1], ["backupKeep", 1]
		];
		var ENUMS = [["masterMode", MODES], ["privateMode", MODES], ["groupMode", MODES], ["logLevel", LOG_LEVELS], ["masterForget", FORGET], ["privateForget", FORGET], ["groupForget", FORGET]];
		function floatField(field) {
			return {
				field: field,
				format: function (v) { return typeof v === "number" ? String(v) : ""; },
				parse: function (text) {
					var t = text.trim();
					if (t === "") return { kind: "clear" };
					var n = Number(t);
					return Number.isFinite(n) && n >= 0 && n <= 1 ? { kind: "set", value: n } : void 0;
				}
			};
		}
		//#endregion

		//#region 表单模型
		function createForm(scope) {
			var specs = INTS.map(function (x) { return intField(x[0], x[1], x[2] === void 0 ? Number.MAX_SAFE_INTEGER : x[2]); })
				.concat(ENUMS.map(function (x) { return enumField(x[0], x[1]); }), LISTS.map(listField), LINE_LISTS.map(lineListField), BOOLS.map(boolField),
					TEXTS.map(function (f) { return P.settingsTextField(f); }), FLOATS.map(floatField), [rulesField("rules")]);
			var secrets = SECRETS.map(function (field) {
				return { field: field, write: function (text) { return scope.mutate([{ op: "set", path: [field], value: text }]); } };
			});
			var form = new P.SettingsFormModel(scope, specs, secrets);
			var all = INTS.map(function (x) { return x[0]; }).concat(ENUMS.map(function (x) { return x[0]; }), LISTS, LINE_LISTS, BOOLS, TEXTS, FLOATS, SECRETS, ["rules"]);
			// 设置服务不把密钥发给浏览器，只告诉它有没有设置
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

		//#region 通用小组件
		function Label(props) {
			if (!props.hint) return props.text;
			return h("span", { className: "compc-labelText" },
				props.text,
				h(P.Tooltip, { label: props.hint, side: "top", delayMs: 150, maxWidth: 320 },
					h("span", { className: "compc-tip", tabIndex: 0, role: "img", "aria-label": props.hint }, "?")));
		}
		function Section(props) {
			if (props.tab !== undefined && props.tab !== props.cur) return null
			return h("section", { className: "compc-section" },
				h("h3", { className: "compc-title" }, h(Label, { text: props.title, hint: props.hint })),
				props.children);
		}
		var TAB_IDS = ["persona", "chat", "memory", "search", "diary", "proactive", "backup"];
		function readTab() {
			try { var v = window.localStorage.getItem("companion-core:tab"); return TAB_IDS.indexOf(v) >= 0 ? v : "persona"; } catch (e) { return "persona"; }
		}
		function Tabs(props) {
			var t = props.t;
			return h("div", { className: "compc-tabs", role: "tablist", "aria-label": t("tabsLabel") },
				TAB_IDS.map(function (id) {
					return h("button", {
						key: id, type: "button", role: "tab", className: "compc-tab",
						"aria-selected": props.cur === id,
						onClick: function () { props.onChange(id); try { window.localStorage.setItem("companion-core:tab", id); } catch (e) { /* 存不了就算了 */ } }
					}, t("tab_" + id));
				}));
		}
		function Toggle(props) {
			var field = props.state[props.field];
			return h("div", { className: "compc-toggleRow" },
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
				id: "companion-core-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				invalidLabel: props.invalidLabel || t("invalid"),
				numeric: props.numeric === true,
				disabled: props.disabled
			}, props.state[props.field], {
				onEdit: function (text) { props.edit(props.field, text); },
				onReset: function () { props.resetField(props.field); }
			}));
		}
		function Lines(props) {
			var t = props.t, field = props.state[props.field];
			return h("div", { className: "compc-field" },
				h("label", { className: "compc-label", htmlFor: "companion-core-" + props.field }, h(Label, { text: props.label, hint: props.hint })),
				h("textarea", { id: "companion-core-" + props.field, className: "compc-textarea compc-small", value: field.text, disabled: props.disabled, onChange: function (e) { props.edit(props.field, e.target.value); } }),
				field.overridden ? h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: function () { props.resetField(props.field); } }, t("reset"))) : null);
		}
		function Select(props) {
			var field = props.state[props.field];
			return h("div", { className: "compc-field" },
				h("label", { className: "compc-label", htmlFor: "companion-core-" + props.field }, h(Label, { text: props.label, hint: props.hint })),
				h("select", {
					id: "companion-core-" + props.field,
					className: "compc-select",
					value: field.text || props.fallback,
					disabled: props.disabled,
					onChange: function (event) { props.edit(props.field, event.target.value); }
				}, props.options.map(function (o) { return h("option", { key: o.value, value: o.value }, o.label); })));
		}
		function apiUrl(path) { return new URL("api/companion/" + path, document.baseURI).href; }
		function api(method, path, body) {
			var init = { method: method, credentials: "same-origin", cache: "no-store" };
			if (body !== void 0) { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(body); }
			return fetch(apiUrl(path), init).then(function (res) {
				return res.json().catch(function () { return {}; }).then(function (json) {
					if (!res.ok) throw new Error(json && json.error || "HTTP " + res.status);
					return json;
				});
			});
		}
		function fmtTime(ms) {
			var d = new Date(ms);
			var p = function (n) { return String(n).padStart(2, "0"); };
			return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
		}
		//#endregion

		//#region 人格、核心记忆：文件编辑器 + 历史版本
		function HistoryList(props) {
			var t = props.t;
			var openHook = React.useState(null), open = openHook[0], setOpen = openHook[1];
			var textHook = React.useState(""), text = textHook[0], setText = textHook[1];
			var askHook = React.useState(null), asking = askHook[0], setAsking = askHook[1];
			var list = props.history || [];
			if (list.length === 0) return h("p", { className: "compc-hint" }, t("historyEmpty"));
			function view(id) {
				if (open === id) { setOpen(null); return; }
				setOpen(id); setText(t("loading"));
				api("GET", "doc/" + props.name + "/version/" + encodeURIComponent(id)).then(function (r) { setText(r.text); }, function (e) { setText(t("loadFailed", { error: e.message })); });
			}
			var BY = { settings: "bySettings", tool: "byTool", restore: "byRestore" };
			return h("ul", { className: "compc-history" }, list.map(function (v) {
				var who = BY[v.by] ? t(BY[v.by]) : v.by;
				return h("li", { key: v.id, className: "compc-historyItem" },
					h("div", { className: "compc-row" },
						h("span", { className: "compc-label" }, fmtTime(v.time)),
						h("span", { className: "compc-hint" }, who + " · " + t("chars", { n: v.length }) + (v.reason ? " · " + v.reason : ""))),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { view(v.id); } }, open === v.id ? t("hide") : t("view")),
						asking === v.id ? null : h(P.Button, { size: "sm", disabled: props.busy, onClick: function () { setAsking(v.id); } }, t("restore"))),
					asking === v.id ? h("div", { className: "compc-card", role: "group" },
						h("p", { className: "compc-hint" }, t("restoreConfirm")),
						h("div", { className: "compc-row" },
							h(P.Button, { size: "sm", onClick: function () { setAsking(null); props.onRestore(v.id); } }, t("confirm")),
							h(P.Button, { size: "sm", onClick: function () { setAsking(null); } }, t("cancel")))) : null,
					open === v.id ? h("pre", { className: "compc-pre" }, text) : null);
			}));
		}

		function DocEditor(props) {
			var t = props.t;
			var doc = props.doc || { text: "", history: [] };
			var draftHook = React.useState(null), draft = draftHook[0], setDraft = draftHook[1];
			var busyHook = React.useState(false), busy = busyHook[0], setBusy = busyHook[1];
			var msgHook = React.useState(null), msg = msgHook[0], setMsg = msgHook[1];
			var value = draft === null ? doc.text : draft;
			var dirty = draft !== null && draft !== doc.text;
			function save() {
				setBusy(true); setMsg(null);
				api("POST", "doc/" + props.name, { text: value }).then(function (st) {
					setDraft(null); props.onState(st); setMsg({ tone: "ok", text: t("saved") });
				}, function (e) { setMsg({ tone: "error", text: t("saveDocFailed", { error: e.message }) }); }).finally(function () { setBusy(false); });
			}
			function restore(id) {
				setBusy(true); setMsg(null);
				api("POST", "doc/" + props.name + "/restore/" + encodeURIComponent(id), {}).then(function (st) {
					setDraft(null); props.onState(st); setMsg({ tone: "ok", text: t("saved") });
				}, function (e) { setMsg({ tone: "error", text: t("saveDocFailed", { error: e.message }) }); }).finally(function () { setBusy(false); });
			}
			return h("div", { className: "compc-field" },
				props.title ? h("h4", { className: "compc-subtitle" }, props.title) : null,
				h("textarea", {
					className: "compc-textarea" + (props.small ? " compc-small" : ""),
					value: value,
					"aria-label": props.title || props.ariaLabel,
					spellCheck: false,
					onChange: function (e) { setDraft(e.target.value); setMsg(null); }
				}),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: busy || !dirty, onClick: save }, busy ? t("saving") : props.saveLabel),
					h("span", { className: "compc-hint" }, t("chars", { n: value.length }) + (dirty ? " · " + t("unsaved") : ""))),
				msg ? h("p", { className: "compc-result compc-" + msg.tone, role: "status" }, msg.text) : null,
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("history") + "（" + (doc.history || []).length + "）"),
					h("div", { className: "compc-detailsBody" }, h(HistoryList, { t: t, name: props.name, history: doc.history, busy: busy, onRestore: restore }))));
		}
		//#endregion

		//#region 例外规则表
		function RulesEditor(props) {
			var t = props.t;
			var rows;
			try { rows = JSON.parse(props.state.rules.text || "[]"); } catch (e) { rows = []; }
			if (!Array.isArray(rows)) rows = [];
			function write(next) { props.edit("rules", JSON.stringify(next)); }
			function set(i, key, value) {
				var next = rows.map(function (r, j) { return j === i ? Object.assign({}, r, (function () { var o = {}; o[key] = value; return o; })()) : r; });
				write(next);
			}
			function num(i, key) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, t(key)),
					h("input", { className: "compc-input", inputMode: "numeric", value: rows[i][key] === void 0 ? "" : String(rows[i][key]), placeholder: t("modeDefault"), disabled: props.disabled,
						onChange: function (e) { var v = e.target.value.trim(); set(i, key, v === "" ? void 0 : Number(v)); } }));
			}
			function sel(i, key, options) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, t(key)),
					h("select", { className: "compc-select", value: rows[i][key] || "", disabled: props.disabled, onChange: function (e) { set(i, key, e.target.value); } },
						options.map(function (o) { return h("option", { key: o[0], value: o[0] }, o[1]); })));
			}
			return h("div", { className: "compc-field" },
				rows.length === 0 ? h("p", { className: "compc-hint" }, t("rulesEmpty")) : null,
				rows.map(function (r, i) {
					return h("div", { key: i, className: "compc-card" },
						h("div", { className: "compc-ruleGrid" },
							sel(i, "kind", [["user", t("kindUser")], ["group", t("kindGroup")]]),
							h("label", { className: "compc-field" },
								h("span", { className: "compc-hint" }, t("target")),
								h("input", { className: "compc-input", inputMode: "numeric", value: r.target || "", disabled: props.disabled, onChange: function (e) { set(i, "target", e.target.value.trim()); } })),
							num(i, "maxRounds"), num(i, "dropRounds"),
							sel(i, "mode", [["", t("modeDefault")], ["truncate", t("modeTruncate")], ["llm", t("modeLlm")]]),
							num(i, "archiveDays"),
							r.kind === "group" ? sel(i, "archiveUnwoken", [["", t("modeDefault")], ["on", t("unwokenOn")], ["off", t("unwokenOff")]]) : null,
							sel(i, "forgetMode", [["", t("modeDefault")], ["normal", t("forgetNormal")], ["purge", t("forgetPurge")]]),
							sel(i, "proactive", [["", t("modeDefault")], ["on", t("proRuleOn")], ["off", t("proRuleOff")]]),
							h("label", { className: "compc-field" },
								h("span", { className: "compc-hint" }, t("note")),
								h("input", { className: "compc-input", value: r.note || "", disabled: props.disabled, onChange: function (e) { set(i, "note", e.target.value); } }))),
						h("div", { className: "compc-row" },
							h(P.Button, { size: "sm", disabled: props.disabled, onClick: function () { write(rows.filter(function (_r, j) { return j !== i; })); } }, t("removeRule"))));
				}),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: props.disabled, onClick: function () { write(rows.concat([{ kind: "group", target: "" }])); } }, t("addRule"))));
		}
		//#endregion

		//#region 记忆：整理、清理、向量索引、记忆列表
		function Secret(props) {
			var t = props.t;
			var set = props.state.secretSet && props.state.secretSet[props.field] === true;
			return h(P.SettingsSecretField, {
				id: "companion-core-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				disabled: props.disabled,
				text: props.state[props.field].text,
				configured: set,
				stateLabel: set ? props.setLabel : props.unsetLabel,
				onEdit: function (text) { props.edit(props.field, text); }
			});
		}
		function Status(props) {
			return props.msg ? h("p", { className: "compc-result compc-" + props.msg.tone, role: "status" }, props.msg.text) : null;
		}
		function useAction() {
			var busyHook = React.useState(false), msgHook = React.useState(null);
			return {
				busy: busyHook[0], msg: msgHook[0], setMsg: msgHook[1],
				run: function (task, okText) {
					busyHook[1](true); msgHook[1](null);
					return task().then(function (r) { if (okText) msgHook[1]({ tone: "ok", text: okText }); return r; },
						function (e) { msgHook[1]({ tone: "error", text: e.message }); }).finally(function () { busyHook[1](false); });
				}
			};
		}

		function OrganizePanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data) return null;
			var p = data.pending || { qqSessions: 0, qqMessages: 0, dshSessions: 0 };
			var target = data.modelTarget;
			return h("div", { className: "compc-field" },
				h("p", { className: "compc-hint" }, target ? t("currentModel", { model: target.provider + "/" + target.model }) : t("noModel")),
				data.memory ? h("p", { className: "compc-hint" }, t("memStats", { active: data.memory.active, forgotten: data.memory.forgotten, superseded: data.memory.superseded, tomb: data.memory.tombstones })) : null,
				h("p", { className: "compc-hint" }, t("pending", { qs: p.qqSessions, qm: p.qqMessages, ds: p.dshSessions })),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { act.run(function () { return api("POST", "organize", {}).then(props.onState); }, t("organizeStarted")); } }, act.busy ? t("organizing") : t("organizeNow"))),
				h(Status, { msg: act.msg }));
		}

		function CleanupPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			var pickHook = React.useState({}), picked = pickHook[0], setPicked = pickHook[1];
			if (!data || props.enabled !== true) return null;
			var c = data.cleanup;
			var purged = c ? c.purged || [] : [];
			var left = c ? c.suggestions.filter(function (x) { return purged.indexOf(x.id) < 0; }) : [];
			var chosen = left.filter(function (x) { return picked[x.id]; }).map(function (x) { return x.id; });
			return h("div", { className: "compc-card" },
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { act.run(function () { return api("POST", "cleanup", {}).then(function (st) { setPicked({}); props.onState(st); }); }); } }, act.busy ? t("running") : t("runCleanup"))),
				h(Status, { msg: act.msg }),
				c ? (c.suggestions.length === 0 ? h("p", { className: "compc-hint" }, t("cleanupNone")) : h("div", { className: "compc-field" },
					h("p", { className: "compc-hint" }, t("cleanupResult", { time: fmtTime(c.at), n: c.suggestions.length })),
					c.suggestions.map(function (x) {
						var done = purged.indexOf(x.id) >= 0;
						return h("label", { key: x.id, className: "compc-check" },
							h("input", { type: "checkbox", disabled: done, checked: done || picked[x.id] === true, onChange: function (e) { var n = Object.assign({}, picked); n[x.id] = e.target.checked; setPicked(n); } }),
							h("span", null, "#" + x.id + " " + x.content + (x.reason ? "（" + x.reason + "）" : "") + (done ? " · " + t("cleanupPurged") : "")));
					}),
					left.length > 0 ? h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", disabled: act.busy || chosen.length === 0, onClick: function () { act.run(function () { return api("POST", "cleanup/purge", { ids: chosen }).then(props.onState); }); } }, t("purgeSelected"))) : null)) : null);
		}

		function IndexPanel(props) {
			var t = props.t;
			var stHook = React.useState(props.initial || null), st = stHook[0], setSt = stHook[1];
			var askHook = React.useState(false), asking = askHook[0], setAsking = askHook[1];
			var act = useAction();
			function load() { return api("GET", "index").then(setSt, function () {}); }
			React.useEffect(function () { if (props.initial) setSt(props.initial); }, [props.initial]);
			var running = st && st.state === "running";
			React.useEffect(function () {
				if (!running) return void 0;
				var timer = setInterval(load, 1500);
				return function () { clearInterval(timer); };
			}, [running]);
			if (!st) return null;
			var names = { idle: "stIdle", running: "stRunning", paused: "stPaused", done: "stDone", failed: "stFailed", cancelled: "stCancelled", disabled: "stDisabled" };
			var tone = st.state === "done" ? "ok" : st.state === "failed" ? "error" : st.state === "disabled" ? "warn" : "hint";
			var pct = st.todo ? Math.min(100, Math.round((st.done || 0) * 100 / st.todo)) : (st.total ? Math.round(st.embedded * 100 / st.total) : 0);
			function post(path) { return act.run(function () { return api("POST", "index/" + path, {}).then(setSt); }); }
			return h("div", { className: "compc-card" },
				h("p", { className: tone === "hint" ? "compc-hint" : "compc-result compc-" + tone, role: "status" }, t("indexState", { state: t(names[st.state] || "stIdle") })),
				st.model ? h("p", { className: "compc-hint" }, t("indexModel", { model: st.model, dim: st.dim || "?" }) + " · " + t("indexCount", { embedded: st.embedded, total: st.total })) : null,
				h("div", { className: "compc-progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct }, h("div", { className: "compc-progressBar", style: { width: pct + "%" } })),
				st.todo ? h("p", { className: "compc-hint" }, t("indexProgress", { done: st.done || 0, todo: st.todo })) : null,
				st.startedAt ? h("p", { className: "compc-hint" }, t("indexTimes", { start: fmtTime(st.startedAt), end: st.finishedAt ? fmtTime(st.finishedAt) : "…" })) : null,
				st.lastError ? h("p", { className: "compc-result compc-error" }, t("indexLastError", { error: st.lastError })) : null,
				st.errors && st.errors.length > 0 ? h("p", { className: "compc-hint" }, t("indexErrors", { n: st.errors.length })) : null,
				st.state === "disabled" ? null : h("div", { className: "compc-row" },
					asking ? null : h(P.Button, { size: "sm", disabled: act.busy || running, onClick: function () { setAsking(true); } }, t("rebuild")),
					running ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("pause"); } }, t("pause")) : null,
					st.state === "paused" || st.state === "failed" || st.state === "cancelled" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("resume"); } }, t("resume")) : null,
					running || st.state === "paused" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("cancel"); } }, t("cancelIndex")) : null,
					h(P.Button, { size: "sm", onClick: load }, t("refresh"))),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("rebuildConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); post("rebuild"); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h(Status, { msg: act.msg }));
		}

		function GraphPanel(props) {
			var t = props.t, data = props.data;
			var askHook = React.useState(false), asking = askHook[0], setAsking = askHook[1];
			var act = useAction();
			var st = data && data.graph;
			var running = !!st && st.state === "running";
			React.useEffect(function () {
				if (!running) return void 0;
				var timer = setInterval(function () { api("GET", "state").then(props.onState, function () {}); }, 2000);
				return function () { clearInterval(timer); };
			}, [running]);
			if (!st) return null;
			var names = { idle: "stIdle", running: "stRunning", paused: "stPaused", done: "stDone", failed: "stFailed", cancelled: "stCancelled", disabled: "stDisabled" };
			var tone = st.state === "done" ? "ok" : st.state === "failed" ? "error" : st.state === "disabled" ? "warn" : "hint";
			var c = st.counts;
			var pct = st.todo ? Math.min(100, Math.round((st.done || 0) * 100 / st.todo)) : (c.memories ? Math.round(c.done * 100 / c.memories) : 0);
			function post(path) { return act.run(function () { return api("POST", "graph/" + path, {}).then(props.onState); }); }
			return h("div", { className: "compc-card" },
				h("p", { className: tone === "hint" ? "compc-hint" : "compc-result compc-" + tone, role: "status" }, t("graphState", { state: t(names[st.state] || "stIdle") })),
				h("p", { className: "compc-hint" }, t("graphCounts", c)),
				h("div", { className: "compc-progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct }, h("div", { className: "compc-progressBar", style: { width: pct + "%" } })),
				st.todo ? h("p", { className: "compc-hint" }, t("indexProgress", { done: st.done || 0, todo: st.todo })) : null,
				st.startedAt ? h("p", { className: "compc-hint" }, t("indexTimes", { start: fmtTime(st.startedAt), end: st.finishedAt ? fmtTime(st.finishedAt) : "…" })) : null,
				st.lastError ? h("p", { className: "compc-result compc-error" }, t("indexLastError", { error: st.lastError })) : null,
				st.errors && st.errors.length > 0 ? h("p", { className: "compc-hint" }, t("indexErrors", { n: st.errors.length })) : null,
				st.state === "disabled" ? null : h("div", { className: "compc-row" },
					asking ? null : h(P.Button, { size: "sm", disabled: act.busy || running, onClick: function () { setAsking(true); } }, t("rebuild")),
					running ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("pause"); } }, t("pause")) : null,
					st.state === "paused" || st.state === "failed" || st.state === "cancelled" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("resume"); } }, t("resume")) : null,
					running || st.state === "paused" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("cancel"); } }, t("cancelIndex")) : null),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("graphRebuildConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); post("rebuild"); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("graphSample")),
					h("div", { className: "compc-detailsBody" },
						(st.sample || []).length === 0 ? h("p", { className: "compc-hint" }, t("graphEmpty")) : st.sample.map(function (r, i) {
							return h("p", { key: i, className: "compc-memText" }, r.src + " —" + r.rel + "→ " + r.dst + "  ", h("span", { className: "compc-hint" }, scopeLabel(t, r.scope) + " · #" + r.memory));
						}))),
				h(Status, { msg: act.msg }));
		}

		var KIND_KEYS = { fact: "kindFact", preference: "kindPreference", event: "kindEvent", promise: "kindPromise", other: "kindOther", diary: "kindDiary" };
		function scopeLabel(t, sc) {
			if (sc === "master") return t("scopeMaster");
			if (sc === "public") return t("scopePublic");
			if (sc.indexOf("group:") === 0) return t("kindGroup") + " " + sc.slice(6);
			if (sc.indexOf("user:") === 0) return t("kindUser") + " " + sc.slice(5);
			return sc;
		}

		function MemoryItem(props) {
			var t = props.t, m = props.m;
			var editHook = React.useState(null), draft = editHook[0], setDraft = editHook[1];
			var askHook = React.useState(false), asking = askHook[0], setAsking = askHook[1];
			var act = useAction();
			function post(path, body) { return act.run(function () { return api("POST", "memory/" + m.id + "/" + path, body || {}).then(props.onChanged); }); }
			var inactive = m.status === "forgotten" || m.supersededBy !== void 0;
			return h("div", { className: "compc-mem" },
				draft === null ? h("p", { className: "compc-memText" }, m.content)
					: h("textarea", { className: "compc-textarea compc-small", value: draft, autoFocus: true, "aria-label": t("edit"), onChange: function (e) { setDraft(e.target.value); } }),
				h("p", { className: "compc-hint" }, t("memMeta", { id: m.id, scope: scopeLabel(t, m.scope), kind: t(KIND_KEYS[m.kind] || "kindOther"), imp: m.importance.toFixed(2), count: m.recallCount, time: fmtTime(m.createdAt) })
					+ (m.status === "forgotten" ? " · " + t("statusForgotten") : "") + (m.supersededBy !== void 0 ? " · " + t("statusSuperseded") + " #" + m.supersededBy : "")),
				h("div", { className: "compc-row" },
					draft === null ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setDraft(m.content); } }, t("edit"))
						: h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("edit", { content: draft }).then(function () { setDraft(null); }); } }, t("saveEdit")),
					draft !== null ? h(P.Button, { size: "sm", onClick: function () { setDraft(null); } }, t("cancel")) : null,
					inactive ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("restore"); } }, t("doRestore"))
						: h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("forget"); } }, t("doForget")),
					asking ? null : h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(true); } }, t("doPurge"))),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("purgeConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); post("purge"); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h(Status, { msg: act.msg }));
		}

		function MemoryList(props) {
			var t = props.t;
			var fHook = React.useState({ scope: "", status: "active", q: "" }), f = fHook[0], setF = fHook[1];
			var qHook = React.useState(""), qDraft = qHook[0], setQDraft = qHook[1];
			var listHook = React.useState(null), list = listHook[0], setList = listHook[1];
			var errHook = React.useState(null), err = errHook[0], setErr = errHook[1];
			var limHook = React.useState(50), limit = limHook[0], setLimit = limHook[1];
			function load() {
				var qs = "status=" + encodeURIComponent(f.status) + "&limit=" + limit + (f.scope ? "&scope=" + encodeURIComponent(f.scope) : "") + (f.q ? "&q=" + encodeURIComponent(f.q) : "");
				return api("GET", "memory?" + qs).then(function (r) { setErr(null); setList(r); }, function (e) { setErr(e.message); });
			}
			React.useEffect(function () { load(); }, [f.scope, f.status, f.q, limit, props.version]);
			var add = useAction();
			var nHook = React.useState({ scope: "master", content: "", kind: "fact", importance: "0.6" }), nm = nHook[0], setNm = nHook[1];
			function addMemory() {
				return add.run(function () {
					return api("POST", "memory/add", { scope: nm.scope, content: nm.content, kind: nm.kind, importance: Number(nm.importance) }).then(function (r) {
						if (r.action === "blocked") throw new Error(t("blocked"));
						setNm(Object.assign({}, nm, { content: "" })); load(); props.onChanged();
					});
				}, t("added"));
			}
			function selectBox(label, value, options, onChange) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, label),
					h("select", { className: "compc-select", value: value, onChange: function (e) { onChange(e.target.value); } },
						options.map(function (o) { return h("option", { key: o[0], value: o[0] }, o[1]); })));
			}
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-ruleGrid" },
					selectBox(t("filterScope"), f.scope, [["", t("scopeAll")], ["master", t("scopeMaster")], ["public", t("scopePublic")], ["group:*", t("scopeGroups")], ["user:*", t("scopeUsers")]], function (v) { setF(Object.assign({}, f, { scope: v })); }),
					selectBox(t("filterStatus"), f.status, [["active", t("statusActive")], ["forgotten", t("statusForgotten")], ["superseded", t("statusSuperseded")], ["all", t("statusAll")]], function (v) { setF(Object.assign({}, f, { status: v })); }),
					h("label", { className: "compc-field" },
						h("span", { className: "compc-hint" }, t("search")),
						h("input", { className: "compc-input", value: qDraft, onChange: function (e) { setQDraft(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") setF(Object.assign({}, f, { q: qDraft.trim() })); }, onBlur: function () { setF(Object.assign({}, f, { q: qDraft.trim() })); } }))),
				err ? h("p", { className: "compc-result compc-error" }, t("loadFailed", { error: err })) : null,
				list ? h("p", { className: "compc-hint" }, t("memTotal", { n: list.total })) : h("p", { className: "compc-hint" }, t("loading")),
				list && list.items.length === 0 ? h("p", { className: "compc-hint" }, t("memEmpty")) : null,
				list ? list.items.map(function (m) { return h(MemoryItem, { key: m.id + ":" + m.content.length + ":" + m.status + ":" + (m.supersededBy || ""), t: t, m: m, onChanged: function () { load(); props.onChanged(); } }); }) : null,
				list && list.total > list.items.length ? h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: function () { setLimit(limit + 50); } }, t("loadMore"))) : null,
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("addMemory")),
					h("div", { className: "compc-detailsBody" },
						h("div", { className: "compc-ruleGrid" },
							selectBox(t("addScope"), nm.scope, [["master", t("scopeMaster")], ["public", t("scopePublic")]], function (v) { setNm(Object.assign({}, nm, { scope: v })); }),
							selectBox(t("addKind"), nm.kind, [["fact", t("kindFact")], ["preference", t("kindPreference")], ["event", t("kindEvent")], ["promise", t("kindPromise")], ["other", t("kindOther")]], function (v) { setNm(Object.assign({}, nm, { kind: v })); }),
							h("label", { className: "compc-field" },
								h("span", { className: "compc-hint" }, t("addImportance")),
								h("input", { className: "compc-input", inputMode: "decimal", value: nm.importance, onChange: function (e) { setNm(Object.assign({}, nm, { importance: e.target.value })); } }))),
						h("label", { className: "compc-field" },
							h("span", { className: "compc-hint" }, t("addContent")),
							h("textarea", { className: "compc-textarea compc-small", value: nm.content, onChange: function (e) { setNm(Object.assign({}, nm, { content: e.target.value })); } })),
						h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: add.busy || nm.content.trim() === "", onClick: addMemory }, t("add"))),
						h(Status, { msg: add.msg }))));
		}
		//#endregion

		//#region 日记、存档到期
		function DiaryPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data || !data.diary) return null;
			var d = data.diary;
			return h("div", { className: "compc-field" },
				h("p", { className: "compc-hint" }, t("diaryCount", { days: d.days, months: d.months, latest: d.latest || "—" })),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () {
						act.run(function () {
							return api("POST", "maintenance", { what: "diary" }).then(function (r) {
								props.onState(r.state);
								var dr = r.report && r.report.diary;
								if (dr && dr.error) throw new Error(dr.error);
								act.setMsg({ tone: dr && dr.written ? "ok" : "warn", text: dr && dr.written ? t("diaryWritten", { date: dr.date }) : t("diaryNothing") });
							});
						});
					} }, act.busy ? t("running") : t("writeDiaryNow"))),
				h(Status, { msg: act.msg }));
		}

		function DiaryEntryItem(props) {
			var t = props.t, e = props.entry;
			var openHook = React.useState(false), open = openHook[0], setOpen = openHook[1];
			var textHook = React.useState(null), text = textHook[0], setText = textHook[1];
			var draftHook = React.useState(null), draft = draftHook[0], setDraft = draftHook[1];
			var askHook = React.useState(false), asking = askHook[0], setAsking = askHook[1];
			var act = useAction();
			function load() { return api("GET", "diary/" + e.date).then(function (r) { setText(r.text); }); }
			return h("div", { className: "compc-mem" },
				h("div", { className: "compc-row" },
					h("span", { className: "compc-label" }, e.date + (props.monthly ? " · " + t("monthlyLabel") : "")),
					h("span", { className: "compc-hint" }, t("chars", { n: e.length }))),
				open && draft === null ? h("pre", { className: "compc-pre" }, text === null ? t("loading") : text) : null,
				draft !== null ? h("textarea", { className: "compc-textarea", value: draft, autoFocus: true, "aria-label": e.date, onChange: function (ev) { setDraft(ev.target.value); } }) : null,
				h("div", { className: "compc-row" },
					draft === null ? h(P.Button, { size: "sm", onClick: function () { if (!open && text === null) load(); setOpen(!open); } }, open ? t("hide") : t("view")) : null,
					draft === null ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { (text === null ? load() : Promise.resolve()).then(function () { setOpen(true); }); setDraft(text === null ? "" : text); if (text === null) api("GET", "diary/" + e.date).then(function (r) { setText(r.text); setDraft(r.text); }); } }, t("edit")) : null,
					draft !== null ? h(P.Button, { size: "sm", disabled: act.busy || draft.trim() === "", onClick: function () { act.run(function () { return api("POST", "diary/" + e.date, { text: draft }).then(function () { setText(draft); setDraft(null); props.onChanged(); }); }, t("saved")); } }, t("saveEdit")) : null,
					draft !== null ? h(P.Button, { size: "sm", onClick: function () { setDraft(null); } }, t("cancel")) : null,
					asking || draft !== null ? null : h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(true); } }, t("del"))),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("delConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); act.run(function () { return api("POST", "diary/" + e.date + "/delete", {}).then(props.onChanged); }); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h(Status, { msg: act.msg }));
		}

		/** 和服务端一样的认日期规则（上传前预览用）。 */
		function guessDate(name, text) {
			function one(s) {
				var m = /(20\d{2})[-_.年/]?(\d{1,2})[-_.月/]?(\d{1,2})日?/.exec(s);
				if (!m) return null;
				var mo = Number(m[2]), d = Number(m[3]);
				if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
				return m[1] + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
			}
			return one(name) || one(String(text).slice(0, 200));
		}

		function DiaryBook(props) {
			var t = props.t;
			var listHook = React.useState(null), list = listHook[0], setList = listHook[1];
			var filesHook = React.useState([]), files = filesHook[0], setFiles = filesHook[1];
			var modeHook = React.useState("skip"), mode = modeHook[0], setMode = modeHook[1];
			var act = useAction();
			var inputRef = React.useRef(null);
			function load() { return api("GET", "diary").then(setList, function (e) { act.setMsg({ tone: "error", text: e.message }); }); }
			React.useEffect(function () { load(); }, [props.version]);
			function pick(ev) {
				var chosen = Array.prototype.slice.call(ev.target.files || []);
				Promise.all(chosen.map(function (f) { return f.text().then(function (text) { return { name: f.name, text: text }; }); })).then(setFiles);
			}
			var known = list ? list.days.map(function (x) { return x.date; }) : [];
			function doImport() {
				act.run(function () {
					return api("POST", "diary/import", { files: files, conflict: mode }).then(function (r) {
						var res = r.results || [];
						var skip = res.filter(function (x) { return x.result === "skipped"; }).length;
						var bad = res.filter(function (x) { return x.result === "no-date"; }).length;
						act.setMsg({ tone: "ok", text: t("importDone", { n: res.length - skip - bad, skip: skip, bad: bad }) });
						setFiles([]);
						if (inputRef.current) inputRef.current.value = "";
						load(); props.onChanged();
					});
				});
			}
			return h("div", { className: "compc-field" },
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("upload")),
					h("div", { className: "compc-detailsBody" },
						h("p", { className: "compc-hint" }, t("uploadHint")),
						h("input", { ref: inputRef, type: "file", multiple: true, accept: ".md,.markdown,.txt,text/markdown,text/plain", onChange: pick, "aria-label": t("upload") }),
						h("label", { className: "compc-field" },
							h("span", { className: "compc-hint" }, t("conflict")),
							h("select", { className: "compc-select", value: mode, onChange: function (e) { setMode(e.target.value); } },
								h("option", { value: "skip" }, t("conflictSkip")), h("option", { value: "merge" }, t("conflictMerge")), h("option", { value: "overwrite" }, t("conflictOverwrite")))),
						files.length > 0 ? h("div", { className: "compc-field" },
							h("p", { className: "compc-hint" }, t("importPreview", { n: files.length })),
							files.map(function (f, i) {
								var date = guessDate(f.name, f.text);
								var note = !date ? t("importNoDate") : known.indexOf(date) >= 0 ? t("importExists") : t("importNew");
								return h("p", { key: i, className: !date ? "compc-result compc-warn" : "compc-hint" }, f.name + " → " + (date || "?") + "（" + note + "）");
							}),
							h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: act.busy, onClick: doImport }, t("importNow")))) : null)),
				h(Status, { msg: act.msg }),
				!list ? h("p", { className: "compc-hint" }, t("loading")) : list.days.length === 0 && list.months.length === 0 ? h("p", { className: "compc-hint" }, t("diaryEmpty")) : null,
				list ? list.months.map(function (e) { return h(DiaryEntryItem, { key: "m" + e.date + e.length, t: t, entry: e, monthly: true, onChanged: function () { load(); props.onChanged(); } }); }) : null,
				list ? list.days.map(function (e) { return h(DiaryEntryItem, { key: e.date + e.length, t: t, entry: e, onChanged: function () { load(); props.onChanged(); } }); }) : null);
		}

		function ExpiryPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data) return null;
			var last = data.maintenance;
			var names = { archived: "stArchived", deleted: "stDeleted", failed: "stFailed" };
			return h("div", { className: "compc-field" },
				last ? h("p", { className: "compc-hint" }, t("lastRun", { time: fmtTime(last.at) })) : null,
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () {
						act.run(function () {
							return api("POST", "maintenance", { what: "expire" }).then(function (r) {
								props.onState(r.state);
								var rep = r.report;
								var deleted = rep.expired.reduce(function (n, e) { return n + (e.deleted || 0); }, 0);
								var rotated = rep.expired.filter(function (e) { return e.rotated; }).length;
								act.setMsg({ tone: "ok", text: t("expiryDone", { deleted: deleted, rotated: rotated, sessions: rep.deletedSessions.length, media: rep.mediaRemoved }) });
							});
						});
					} }, act.busy ? t("running") : t("runExpiry"))),
				h(Status, { msg: act.msg }),
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("retired") + "（" + (data.retired || []).length + "）"),
					h("div", { className: "compc-detailsBody" },
						(data.retired || []).length === 0 ? h("p", { className: "compc-hint" }, t("retiredEmpty")) :
							data.retired.map(function (r) {
								var cat = r.category === "master" ? t("scopeMaster") : r.category === "group" ? t("kindGroup") : t("kindUser");
								return h("p", { key: r.sessionId, className: r.state === "failed" ? "compc-result compc-warn" : "compc-hint" },
									t("retiredState", { umo: r.umo, cat: cat, last: fmtTime(r.lastTime), state: t(names[r.state] || "stArchived", { note: r.note || "" }) }));
							}))));
		}
		//#endregion

		//#region 主动聊天、记忆保养、备份与迁移
		function ProactivePanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data || !data.proactive) return null;
			var pr = data.proactive;
			var catName = function (c) { return c === "master" ? t("scopeMaster") : c === "group" ? t("kindGroup") : t("kindUser"); };
			return h("div", { className: "compc-field" },
				pr.wakeAvailable ? null : h("p", { className: "compc-result compc-warn" }, t("proNoWake")),
				pr.list.length === 0 ? h("p", { className: "compc-hint" }, t("proListEmpty")) : pr.list.map(function (e) {
					return h("div", { key: e.umo, className: "compc-row" },
						h("span", { className: "compc-hint" }, t("proItem", { umo: e.umo, cat: catName(e.category), next: e.next ? fmtTime(e.next) : "—", last: e.last ? fmtTime(e.last) : t("never") })),
						h(P.Button, { size: "sm", disabled: act.busy || !pr.wakeAvailable, onClick: function () { act.run(function () { return api("POST", "proactive/try", { umo: e.umo }).then(props.onState); }, t("proTried")); } }, t("proTry")));
				}),
				h(Status, { msg: act.msg }));
		}

		function CarePanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			var askHook = React.useState(false), asking = askHook[0], setAsking = askHook[1];
			if (!data || !data.care) return null;
			var c = data.care;
			var lr = c.lastRun;
			return h("div", { className: "compc-field" },
				h("p", { className: "compc-hint" }, t("careLast", { cleanup: c.lastCleanup ? fmtTime(c.lastCleanup) : t("never"), consolidate: c.lastConsolidate ? fmtTime(c.lastConsolidate) : t("never") })),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () {
						act.run(function () {
							return api("POST", "care/run", {}).then(function (r) {
								props.onState(r.state);
								var cl = r.report.cleanup || { forgotten: 0, purged: 0 }, co = r.report.consolidate || { groups: 0, merged: 0, created: 0 };
								if (r.report.consolidateError) throw new Error(r.report.consolidateError);
								act.setMsg({ tone: "ok", text: t("careDone", { f: cl.forgotten, p: cl.purged, g: co.groups, m: co.merged, c: co.created }) });
							});
						});
					} }, act.busy ? t("running") : t("careRun"))),
				h(Status, { msg: act.msg }),
				lr && lr.groups.length > 0 ? h("div", { className: "compc-card" },
					h("p", { className: "compc-hint" }, t("careLastRun", { time: fmtTime(lr.at) })),
					lr.groups.map(function (g, i) {
						return h("p", { key: i, className: "compc-memText" }, t("careGroup", { old: g.old.map(function (m) { return m.content; }).join(" / "), created: g.created.map(function (m) { return m.content; }).join(" / ") }));
					}),
					asking ? h("div", { className: "compc-card", role: "group" },
						h("p", { className: "compc-hint" }, t("careUndoConfirm")),
						h("div", { className: "compc-row" },
							h(P.Button, { size: "sm", onClick: function () { setAsking(false); act.run(function () { return api("POST", "care/undo", {}).then(function (r) { props.onState(r.state); }); }, t("careUndone")); } }, t("confirm")),
							h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel"))))
						: h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(true); } }, t("careUndo")))) : null);
		}

		function firstLine(text) {
			var line = text.split("\n").map(function (x) { return x.replace(/^#+\s*/, "").trim(); }).filter(Boolean)[0] || "";
			return line.length > 80 ? line.slice(0, 80) + "…" : line;
		}
		function sizeText(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

		function BackupPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			var askHook = React.useState(null), asking = askHook[0], setAsking = askHook[1];
			var waitHook = React.useState(false), waiting = waitHook[0], setWaiting = waitHook[1];
			var inputRef = React.useRef(null);
			if (!data) return null;
			var fileUrl = function (name) { return apiUrl("backup/file/" + encodeURIComponent(name)); };
			var reasonName = function (r) { return r === "auto" ? t("reasonAuto") : r === "before-import" ? t("reasonBefore") : t("reasonManual"); };
			function upload(ev) {
				var f = ev.target.files && ev.target.files[0];
				if (!f) return;
				act.run(function () {
					return fetch(apiUrl("backup/upload"), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/octet-stream", "x-companion-upload": "1" }, body: f })
						.then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.error || "HTTP " + res.status); return j; }); })
						.then(props.onState);
				}).finally(function () { if (inputRef.current) inputRef.current.value = ""; });
			}
			function confirmImport(id) {
				var before = data.lastImport ? data.lastImport.at : 0;
				act.run(function () {
					return api("POST", "backup/confirm", { id: id }).then(function () {
						setWaiting(true);
						var tries = 0;
						var timer = setInterval(function () {
							tries += 1;
							api("GET", "state").then(function (st) {
								if (st.lastImport && st.lastImport.at !== before) { clearInterval(timer); setWaiting(false); props.onState(st); }
							}, function () {});
							if (tries > 60) { clearInterval(timer); setWaiting(false); }
						}, 1000);
					});
				});
			}
			var pend = data.importing;
			var m = pend && pend.manifest;
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () {
						act.run(function () {
							return api("POST", "backup/create", {}).then(function (r) {
								props.onState(r.state);
								act.setMsg({ tone: "ok", text: t("exported", { name: r.name }) });
								var a = document.createElement("a"); a.href = fileUrl(r.name); a.download = r.name; document.body.appendChild(a); a.click(); a.remove();
							});
						});
					} }, act.busy ? t("running") : t("exportNow"))),
				h("div", { className: "compc-field" },
					h("span", { className: "compc-label" }, h(Label, { text: t("importFile"), hint: t("importFileHint") })),
					h("input", { ref: inputRef, type: "file", accept: ".gz,.tgz,application/gzip", hidden: true, onChange: upload }),
					h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: act.busy || waiting, onClick: function () { if (inputRef.current) inputRef.current.click(); } }, t("chooseFile")))),
				waiting ? h("p", { className: "compc-result compc-warn", role: "status" }, t("importing")) : null,
				h(Status, { msg: act.msg }),
				data.lastImport ? h("p", { className: "compc-result " + (data.lastImport.error ? "compc-error" : "compc-ok") }, data.lastImport.error ? t("importFailed", { error: data.lastImport.error }) : t("imported", { time: fmtTime(data.lastImport.at) })) : null,
				m ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-label" }, t("previewTitle")),
					h("p", { className: "compc-hint" }, t("previewLine", { plugin: m.plugin, time: fmtTime(m.createdAt), mem: m.counts.memories, days: m.counts.diaryDays, months: m.counts.months, msgs: m.counts.archiveMessages, media: m.counts.media, model: (m.embed && m.embed.model) || "—" })),
					h("details", { className: "compc-details" },
						h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("previewSettings")),
						h("div", { className: "compc-detailsBody" }, h("pre", { className: "compc-pre" }, JSON.stringify(m.settings, null, 2)))),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { confirmImport(pend.id); } }, t("confirmImport")),
						h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { act.run(function () { return api("POST", "backup/cancel", {}).then(props.onState); }); } }, t("cancelImport")))) : null,
				h("h4", { className: "compc-subtitle" }, t("backupList")),
				(data.backups || []).length === 0 ? h("p", { className: "compc-hint" }, t("backupEmpty")) : data.backups.map(function (b) {
					return h("div", { key: b.name, className: "compc-mem" },
						h("p", { className: "compc-hint" }, t("backupItem", { name: b.name, size: sizeText(b.size), reason: reasonName(b.reason) })),
						h("div", { className: "compc-row" },
							h("a", { href: fileUrl(b.name), download: b.name, className: "compc-hint" }, t("download")),
							h(P.Button, { size: "sm", disabled: act.busy || waiting, onClick: function () { act.run(function () { return api("POST", "backup/restore", { name: b.name }).then(props.onState); }); } }, t("restoreThis")),
							asking === b.name ? null : h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(b.name); } }, t("deleteBackup"))),
						asking === b.name ? h("div", { className: "compc-card", role: "group" },
							h("p", { className: "compc-hint" }, t("deleteBackupConfirm")),
							h("div", { className: "compc-row" },
								h(P.Button, { size: "sm", onClick: function () { setAsking(null); act.run(function () { return api("POST", "backup/delete", { name: b.name }).then(props.onState); }); } }, t("confirm")),
								h(P.Button, { size: "sm", onClick: function () { setAsking(null); } }, t("cancel")))) : null);
				}));
		}

		function SelfCheckPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data) return null;
			var sc = data.selfCheck;
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { act.run(function () { return api("POST", "selfcheck", {}).then(function () { return api("GET", "state").then(props.onState); }); }); } }, act.busy ? t("running") : t("runSelfCheck"))),
				h(Status, { msg: act.msg }),
				sc ? h("div", { className: "compc-card" },
					h("p", { className: "compc-hint" }, fmtTime(sc.at)),
					sc.results.map(function (r, i) {
						return h("p", { key: i, className: r.found.length > 0 ? "compc-memText" : "compc-result compc-warn" }, t("selfCheckResult", { q: r.query, a: r.found.length > 0 ? firstLine(r.found[0].content) : t("selfCheckNone") }));
					})) : null);
		}
		//#endregion

		//#region 页面
		function ContextRow(props) {
			var t = props.t, c = props.common, p = props.prefix;
			return h("div", { className: "compc-card" },
				h("h4", { className: "compc-subtitle" }, props.title),
				h("div", { className: "compc-grid" },
					h(Value, Object.assign({ field: p + "MaxRounds", label: t("maxRounds"), hint: t("maxRoundsHint"), numeric: true, invalidLabel: t("invalidCount") }, c)),
					h(Value, Object.assign({ field: p + "DropRounds", label: t("dropRounds"), numeric: true, invalidLabel: t("invalidPositive") }, c)),
					h(Select, Object.assign({ field: p + "Mode", label: t("mode"), fallback: props.fallback, options: [{ value: "truncate", label: t("modeTruncate") }, { value: "llm", label: t("modeLlm") }] }, c))));
		}

		function SettingsPage(props) {
			var t = props.t;
			if (props.view === "summary") return t("summary");
			var state = props.useCompanionForm(function (s) { return s; });
			var disabled = !state.writable || state.saving;
			var common = { t: t, state: state, disabled: disabled, edit: props.edit, resetField: props.resetField };
			var dataHook = React.useState(null), data = dataHook[0], setData = dataHook[1];
			var errHook = React.useState(null), err = errHook[0], setErr = errHook[1];
			var verHook = React.useState(0), memVersion = verHook[0], setMemVersion = verHook[1];
			var tabHook = React.useState(readTab), tab = tabHook[0], setTab = tabHook[1];
			function load() {
				setMemVersion(function (v) { return v + 1; });
				api("GET", "state").then(function (st) { setErr(null); setData(st); }, function (e) { setErr(e.message); });
			}
			React.useEffect(function () { load(); }, []);
			var docs = data ? data.docs : {};
			var stats = data && data.archive;
			var statusLines = err ? [h("p", { key: "e", className: "compc-result compc-error" }, t("loadFailed", { error: err }))]
				: !data ? [h("p", { key: "l", className: "compc-hint" }, t("loading"))]
				: [
					h("p", { key: "n", className: "compc-result " + (data.napcat ? "compc-ok" : "compc-warn") }, t(data.napcat ? "napcatOn" : "napcatOff")),
					stats ? h("p", { key: "a", className: "compc-hint" }, t("archiveCount", { total: stats.total, private: (stats.byKind && stats.byKind.private) || 0, group: (stats.byKind && stats.byKind.group) || 0 })) : null,
					h("p", { key: "d", className: "compc-hint" }, t("dataDir", { dir: data.dataDir }))
				];
			return h(P.SettingsForm, {
				labels: { unavailable: t("unavailable"), readOnly: t("readOnly"), saveFailed: t("saveFailed"), save: t("save"), saving: t("saving") },
				state: state,
				onSave: props.save,
				onDiscard: props.discard
			},
				h(Section, { title: t("status"), hint: t("statusHint") },
					statusLines,
					h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: load }, t("refresh")))),
				h(Tabs, { t: t, cur: tab, onChange: setTab }),
				h(Section, { tab: "persona", cur: tab, title: t("scope"), hint: t("scopeHint") },
					h(Value, Object.assign({ field: "excludedPresets", label: t("excludedPresets"), hint: t("excludedPresetsHint") }, common)),
					h(Toggle, Object.assign({ field: "personaOnly", label: t("personaOnly"), hint: t("personaOnlyHint") }, common))),
				h(Section, { tab: "persona", cur: tab, title: t("persona"), hint: t("personaHint") },
					data ? h(DocEditor, { t: t, name: "persona", doc: docs.persona, ariaLabel: t("persona"), saveLabel: t("savePersona"), onState: setData }) : null,
					h(Toggle, Object.assign({ field: "selfEdit", label: t("selfEdit"), hint: t("selfEditHint") }, common)),
					h(Value, Object.assign({ field: "historyKeep", label: t("historyKeep"), hint: t("historyKeepHint"), numeric: true, invalidLabel: t("invalidCount") }, common))),
				h(Section, { tab: "persona", cur: tab, title: t("personaGuardSec"), hint: t("personaGuardHint") },
					h(Toggle, Object.assign({ field: "personaGuard", label: t("personaGuard") }, common)),
					state.personaGuard.text === "true" ? h("div", { className: "compc-field" },
						h(Toggle, Object.assign({ field: "personaReview", label: t("personaReview"), hint: t("personaReviewHint") }, common)),
						h("div", { className: "compc-grid" },
							h(Value, Object.assign({ field: "personaEditMaxChars", label: t("personaEditMaxChars"), numeric: true, invalidLabel: t("invalid") }, common)),
							h(Value, Object.assign({ field: "personaMaxChars", label: t("personaMaxChars"), hint: t("personaMaxCharsHint"), numeric: true, invalidLabel: t("invalid") }, common))),
						h(Lines, Object.assign({ t: t, field: "personaAllowed", label: t("personaAllowed") }, common)),
						h(Lines, Object.assign({ t: t, field: "personaForbidden", label: t("personaForbidden") }, common))) : null),
				h(Section, { tab: "persona", cur: tab, title: t("core"), hint: t("coreHint") },
					data ? h(DocEditor, { t: t, name: "core-master", title: t("coreMaster"), small: true, doc: docs["core-master"], saveLabel: t("saveCore"), onState: setData }) : null,
					data ? h(DocEditor, { t: t, name: "core-public", title: t("corePublic"), small: true, doc: docs["core-public"], saveLabel: t("saveCore"), onState: setData }) : null,
					h(Value, Object.assign({ field: "coreMaxKB", label: t("coreMaxKB"), hint: t("coreMaxKBHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
				h(Section, { tab: "chat", cur: tab, title: t("context"), hint: t("contextHint") },
					h(Value, Object.assign({ field: "thresholdPercent", label: t("thresholdPercent"), hint: t("thresholdPercentHint"), numeric: true, invalidLabel: t("invalid") }, common)),
					h(ContextRow, { t: t, common: common, prefix: "master", title: t("masterRow"), fallback: "llm" }),
					h(ContextRow, { t: t, common: common, prefix: "private", title: t("privateRow"), fallback: "truncate" }),
					h(ContextRow, { t: t, common: common, prefix: "group", title: t("groupRow"), fallback: "truncate" }),
					h(Value, Object.assign({ field: "summaryModel", label: t("summaryModel"), hint: t("summaryModelHint") }, common))),
				h(Section, { tab: "chat", cur: tab, title: t("rules"), hint: t("rulesHint") },
					h(RulesEditor, { t: t, state: state, edit: props.edit, disabled: disabled })),
				h(Section, { tab: "chat", cur: tab, title: t("archive"), hint: t("archiveHint") },
					h(Toggle, Object.assign({ field: "archiveEnabled", label: t("archiveEnabled") }, common)),
					h(Toggle, Object.assign({ field: "archiveUnwoken", label: t("archiveUnwokenAll"), hint: t("archiveUnwokenAllHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "archiveDaysMaster", label: t("archiveDaysMaster"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "archiveDaysOthers", label: t("archiveDaysOthers"), numeric: true, invalidLabel: t("invalidPositive") }, common)))),
				h(Section, { tab: "chat", cur: tab, title: t("groupCtx"), hint: t("groupCtxHint") },
					state.archiveUnwoken.text === "false" ? h("p", { className: "compc-result compc-warn" }, t("groupCtxOff")) : null,
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({}, common, { field: "groupContextCount", label: t("groupContextCount"), hint: t("groupContextCountHint"), numeric: true, invalidLabel: t("invalidCount"), disabled: disabled || state.archiveUnwoken.text === "false" })),)),
				h(Section, { tab: "memory", cur: tab, title: t("memRecall"), hint: t("memRecallHint") },
					h(Toggle, Object.assign({ field: "recallEnabled", label: t("recallEnabled") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "recallTopKMaster", label: t("recallTopKMaster"), hint: t("recallTopKMasterHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "recallTopK", label: t("recallTopK"), hint: t("recallTopKHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "halfLifeDays", label: t("halfLifeDays"), hint: t("halfLifeDaysHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "keywordThreshold", label: t("keywordThreshold"), hint: t("keywordThresholdHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "vectorThreshold", label: t("vectorThreshold"), hint: t("vectorThresholdHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "keywordWeight", label: t("keywordWeight"), hint: t("keywordWeightHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "importanceWeight", label: t("importanceWeight"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "recencyWeight", label: t("recencyWeight"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "groupDiscount", label: t("groupDiscount"), hint: t("groupDiscountHint"), invalidLabel: t("invalidRatio") }, common)))),
				h(Section, { tab: "memory", cur: tab, title: t("memGen"), hint: t("memGenHint") },
					h(Toggle, Object.assign({ field: "activeMemory", label: t("activeMemory"), hint: t("activeMemoryHint") }, common)),
					h(Toggle, Object.assign({ field: "organizeBeforeCompact", label: t("organizeBeforeCompact"), hint: t("organizeBeforeCompactHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "organizeEveryRounds", label: t("organizeEveryRounds"), hint: t("organizeEveryRoundsHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "memoryModel", label: t("memoryModel"), hint: t("memoryModelHint") }, common))),
					h(OrganizePanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "memory", cur: tab, title: t("forget"), hint: t("forgetHint") },
					h("div", { className: "compc-grid" },
						h(Select, Object.assign({ field: "masterForget", label: t("masterForget"), fallback: "normal", options: [{ value: "normal", label: t("forgetNormal") }, { value: "purge", label: t("forgetPurge") }] }, common)),
						h(Select, Object.assign({ field: "privateForget", label: t("privateForget"), fallback: "purge", options: [{ value: "normal", label: t("forgetNormal") }, { value: "purge", label: t("forgetPurge") }] }, common)),
						h(Select, Object.assign({ field: "groupForget", label: t("groupForget"), fallback: "purge", options: [{ value: "normal", label: t("forgetNormal") }, { value: "purge", label: t("forgetPurge") }] }, common))),
					h(Toggle, Object.assign({ field: "cleanupEnabled", label: t("cleanupEnabled"), hint: t("cleanupEnabledHint") }, common)),
					state.cleanupEnabled.text === "true" ? h(Toggle, Object.assign({ field: "cleanupAutoPurge", label: t("cleanupAutoPurge"), hint: t("cleanupAutoPurgeHint") }, common)) : null,
					h(CleanupPanel, { t: t, data: data, enabled: state.cleanupEnabled.text === "true" && !state.dirty, onState: setData })),
				h(Section, { tab: "search", cur: tab, title: t("vector"), hint: t("vectorHint") },
					h(Value, Object.assign({ field: "embedApiUrl", label: t("embedApiUrl"), hint: t("embedApiUrlHint") }, common)),
					h(Secret, Object.assign({ field: "embedApiKey", label: t("embedApiKey"), hint: t("embedApiKeyHint"), setLabel: t("keySet"), unsetLabel: t("keyUnset") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "embedModel", label: t("embedModel") }, common)),
						h(Value, Object.assign({ field: "embedBatch", label: t("embedBatch"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(IndexPanel, { t: t, initial: data ? data.index : null })),
				h(Section, { tab: "search", cur: tab, title: t("graphSec"), hint: t("graphSecHint") },
					h(Toggle, Object.assign({ field: "graphEnabled", label: t("graphEnabled") }, common)),
					h(Value, Object.assign({ field: "graphModel", label: t("graphModel"), hint: t("graphModelHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "graphBatch", label: t("graphBatch"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "graphHops", label: t("graphHops"), hint: t("graphHopsHint"), numeric: true, invalidLabel: t("invalid") }, common))),
					h(GraphPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "diary", cur: tab, title: t("diarySec"), hint: t("diarySecHint") },
					h(Toggle, Object.assign({ field: "diaryEnabled", label: t("diaryEnabled") }, common)),
					h(Toggle, Object.assign({ field: "monthlyEnabled", label: t("monthlyEnabled") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "diaryTime", label: t("diaryTime"), hint: t("diaryTimeHint") }, common)),
						h(Value, Object.assign({ field: "dayBoundaryHour", label: t("dayBoundaryHour"), hint: t("dayBoundaryHourHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "timezone", label: t("timezone") }, common))),
					h(Toggle, Object.assign({ field: "diaryOnNewSession", label: t("diaryOnNewSession") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "diaryDays", label: t("diaryDays"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "overviewMonths", label: t("overviewMonths"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "diaryBudgetPercent", label: t("diaryBudgetPercent"), hint: t("diaryBudgetPercentHint"), numeric: true, invalidLabel: t("invalid") }, common))),
					h(DiaryPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "diary", cur: tab, title: t("diaryPage"), hint: t("diaryPageHint") },
					h(DiaryBook, { t: t, version: memVersion, onChanged: function () { api("GET", "state").then(setData, function () {}); } })),
				h(Section, { tab: "chat", cur: tab, title: t("expirySec"), hint: t("expirySecHint") },
					h(Toggle, Object.assign({ field: "rotateSessions", label: t("rotateSessions") }, common)),
					h(Toggle, Object.assign({ field: "deleteOldSessions", label: t("deleteOldSessions"), hint: t("deleteOldSessionsHint") }, common)),
					h(Toggle, Object.assign({ field: "archiveImages", label: t("archiveImages"), hint: t("archiveImagesHint") }, common)),
					h(Value, Object.assign({ field: "carryMessages", label: t("carryMessages"), numeric: true, invalidLabel: t("invalidCount") }, common)),
					h(ExpiryPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "proactive", cur: tab, title: t("proSec"), hint: t("proSecHint") },
					h(Toggle, Object.assign({ field: "proactiveEnabled", label: t("proactiveEnabled") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "proactiveMinMinutes", label: t("proactiveMinMinutes"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveMaxMinutes", label: t("proactiveMaxMinutes"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveOthersMinMinutes", label: t("proactiveOthersMinMinutes"), hint: t("proIntervalHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveOthersMaxMinutes", label: t("proactiveOthersMaxMinutes"), hint: t("proIntervalHint"), numeric: true, invalidLabel: t("invalid") }, common))),
					h(Toggle, Object.assign({ field: "proactivePrivate", label: t("proactivePrivate") }, common)),
					h(Toggle, Object.assign({ field: "proactiveGroup", label: t("proactiveGroup") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "quietStart", label: t("quietStart"), hint: t("quietHint") }, common)),
						h(Value, Object.assign({ field: "quietEnd", label: t("quietEnd"), hint: t("quietHint") }, common)),
						h(Value, Object.assign({ field: "proactiveRecentMinutes", label: t("proactiveRecentMinutes"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "proactiveGroupContext", label: t("proactiveGroupContext"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "proactiveActiveDays", label: t("proactiveActiveDays"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "silenceToken", label: t("proSilence"), hint: t("proSilenceHint") }, common))),
					h(ProactivePanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "memory", cur: tab, title: t("careSec"), hint: t("careSecHint") },
					h(Toggle, Object.assign({ field: "autoCleanup", label: t("autoCleanup") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "autoCleanupDays", label: t("autoCleanupDays"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "autoCleanupImportance", label: t("autoCleanupImportance"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "careIntervalDays", label: t("careIntervalDays"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(Toggle, Object.assign({ field: "purgeForgotten", label: t("purgeForgotten") }, common)),
					state.purgeForgotten.text === "true" ? h(Value, Object.assign({ field: "purgeForgottenDays", label: t("purgeForgottenDays"), numeric: true, invalidLabel: t("invalidPositive") }, common)) : null,
					h(Toggle, Object.assign({ field: "consolidateEnabled", label: t("consolidateEnabled") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "consolidateOverlap", label: t("consolidateOverlap"), hint: t("consolidateOverlapHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "consolidateGroups", label: t("consolidateGroups"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(CarePanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "backup", cur: tab, title: t("backupSec"), hint: t("backupSecHint") },
					h(Toggle, Object.assign({ field: "backupEnabled", label: t("backupEnabled") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "backupTime", label: t("backupTime"), hint: t("diaryTimeHint") }, common)),
						h(Value, Object.assign({ field: "backupKeep", label: t("backupKeep"), hint: t("backupKeepHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(BackupPanel, { t: t, data: data, onState: setData }),
					h("h4", { className: "compc-subtitle" }, h(Label, { text: t("selfCheck"), hint: t("selfCheckHint") })),
					h(Value, Object.assign({ field: "selfCheckQueries", label: t("selfCheckQueries") }, common)),
					h(SelfCheckPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "memory", cur: tab, title: t("memList"), hint: t("memListHint") },
					h(MemoryList, { t: t, version: memVersion, onChanged: function () { api("GET", "state").then(setData, function () {}); } })),
				h(Section, { tab: "backup", cur: tab, title: t("log") },
					h(Select, Object.assign({ field: "logLevel", label: t("logLevel"), hint: t("logLevelHint"), fallback: "info", options: LOG_LEVELS.map(function (l) { return { value: l, label: l }; }) }, common)),
					h("details", { className: "compc-details" },
						h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("recentLogs")),
						h("div", { className: "compc-detailsBody" },
							data && data.logs && data.logs.length > 0
								? h("pre", { className: "compc-pre" }, data.logs.slice().reverse().map(function (l) { return fmtTime(l.time) + " [" + l.level + "] " + l.message; }).join("\n"))
								: h("p", { className: "compc-hint" }, t("noLogs"))))));
		}
		//#endregion

		//#region 入口
		var inject = ["slots", "locale", "configForms", "remote", "remote.settings"];

		function apply(ctx) {
			ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "companion-core: dictionaries");
			var scope = ctx.configForms.get(SECTION);
			var model = createForm(scope);
			ctx.effect(function () { return function () { model.form.dispose(); }; }, "companion-core: form");
			var disposed = false;
			ctx.effect(function () { return function () { disposed = true; }; }, "companion-core: lifetime");
			function refreshSecrets() {
				ctx.remote.settings.describe().then(function (response) {
					if (disposed || !response.ok) return;
					var row = response.value.namespaces.find(function (n) { return n.ns === SECTION; });
					var next = {};
					((row && row.secrets) || []).forEach(function (x) { if (x.path.length === 1) next[x.path[0]] = x.set === true; });
					model.setSecrets(next);
				}, function () {});
			}
			refreshSecrets();
			ctx.effect(function () { return scope.subscribe(refreshSecrets); }, "companion-core: secret state");
			ctx.effect(function () {
				return ctx.configForms.whileServed([SECTION], function () {
					return ctx.slots.inject("plugins.bundle.config", function () {
						return ctx.slots.register({
							name: "plugins.bundle.config",
							key: PACKAGE,
							locale: NS,
							inject: function () { return Object.assign({ hooks: { companionForm: model.store } }, model.form.actions()); }
						}, SettingsPage);
					});
				});
			}, "companion-core: page");
		}
		//#endregion

		exports.inject = inject;
		exports.apply = apply;
		exports.SettingsPage = SettingsPage;
		return module.exports;
	}
});
