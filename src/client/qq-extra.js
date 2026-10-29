// dsh-companion-core 设置页（浏览器一侧），嵌在 dsh「插件」页里（plugins.bundle.config 扩展点）。
// 普通设置读写 dsh 设置服务里本插件的配置行（id: companion-core），点「保存」后插件立即读到新值；
// 人格稿和核心记忆是文件，用各自的「保存」按钮，经 <dsh>/api/qq-gateway/… 接口读写（要先登录 dsh）。
// 只用 dsh 自带的表单组件和 --dsw-* 颜色变量，深色/浅色主题自动跟随；桌面端和 Web 端都用这一份：
// 不用 window.confirm/alert（桌面端可能不显示），确认都放在页面里；窄窗口下自动换行。
// 这个文件不经过打包，构建时原样复制到 lib/client.js。
window.__ModuleLoader__.load({
	id: "dsh-qq-gateway/ui-extra",
	factory: (require) => {
		var exports = {};
		var reactModule = require("react");
		var React = typeof reactModule.createElement === "function" ? reactModule : reactModule.default;
		var P = require("@deepseek-ai/dsh-client-ui-primitives");
		var h = React.createElement;

		var NS = "qqGatewayExtra";
		var PACKAGE = "dsh-qq-gateway";

		var zh = {
            imageGenConnection: "服务配置",
            imageGenStudio: "试画与图库",
            imageGenAccess: "使用范围",
            imageGenAccessHint: "主人会话在功能开启后可用；其他人和群聊分别授权。",
            imageGenOwnerAccess: "主人会话默认可用",
            imageGenLimits: "任务与保存",
            imageGenAdvanced: "高级接入",
            imageGenAdvancedHint: "工作流、自定义HTTP模板和本地程序配置。常规云接口通常保留默认即可。",
            imageGenReady: "已开启",
            imageGenOff: "已关闭",
            imageGenNoKey: "尚未配置密钥",
            imageGenActiveService: "当前服务",
            imageGenConfigHint: "独立配置生图服务，聊天模型仍负责理解请求和调用工具。",
            imageGenQuotaNotice: "每次生成会使用服务商额度。试画结果仅在这里展示。",
            imageGenPromptPlaceholder: "描述你想画的主体、场景、风格、光线与构图…",
            imageGenResults: "生成结果",
            imageGenResultEmpty: "你的下一张作品从这里开始",
            imageGenResultEmptyHint: "填写描述并生成，或从下方图库选择已有图片。",
            imageGenHistory: "最近图片",
            imageGenCount: "{count} 张",
            imageGenSuccess: "图片已生成",
            imageGenFailed: "生成未完成",
            imageGenWaiting: "已等待 {seconds} 秒",
            imageGenSelectImage: "查看图片 {index}",
            imageGenProviderCloud: "云端接口",
            imageGenProviderLocal: "本地与自定义",
            imageGenSavedShort: "使用已保存配置",
            imageGenOpenImage: "打开原图",
            imageGenDraftNotice: "配置有未保存改动，请先保存再试画。",

            imageGenKeyHint: "填写生图服务自己的密钥。已保存凭据不回显，不导出到备份；本地程序可从IMAGE_GENERATION_API_KEY环境变量读取。",
			imageGenTitle: "图片生成",
			imageGenHint: "通过独立生图接口生成图片。聊天模型调用工具后，QQ会话自动发送结果；网页会话在工具结果中展示。默认关闭，仅主人可用，其他私聊和群聊需单独开放。",
			imageGenEnabled: "启用图片生成",
			imageGenProvider: "接口协议",
			imageGenApiUrl: "生图 API 地址",
			imageGenApiKey: "生图 API 密钥 / 令牌",
			imageGenModel: "生图模型 / 部署标识",
			imageGenPrivate: "允许其他人私聊生图",
			imageGenGroup: "允许群聊生图",
			imageGenPrivateHint: "仅允许通过现有访问权限检查的普通私聊；主人私聊不需要开启此项。",
			imageGenGroupHint: "沿用群聊白名单及管理员豁免，发送前再次检查权限。群聊不会获得主人私密记忆。",
			imageGenApiUrlHint: "通常填写提供商基础地址；Azure、Vertex、自定义HTTP填写完整请求端点。选择协议会填入参考地址和模型，请按账号及服务商文档核对。",
			imageGenModelHint: "填生图服务实际支持的模型名称、Replicate owner/model 或 fal 路径；与 dsh 聊天模型目录相互独立。Gemini、Imagen请填写当前账号可用的具体型号。",
			imageGenOptions: "高级参数 / 工作流（JSON）",
			imageGenOptionsHint: "填写JSON对象。普通接口为附加参数；ComfyUI填写workflow和可选outputNodes；自定义HTTP填写body、headers、resultPath和可选poll。模板支持{{prompt}}、{{negativePrompt}}、{{size}}、{{width}}、{{height}}、{{model}}、{{seed}}，认证用{{apiKey}}，不把密钥直接写进此处。具体范例见生图接入文档。",
			imageGenCommand: "本地程序及参数（JSON数组）",
			imageGenCommandHint: "例如 [\"/usr/bin/python3\",\"/绝对路径/generate.py\"]。程序从stdin读取提示词JSON，在stdout输出{\"images\":[\"图片Base64或HTTP地址\"]}；诊断写stderr。可接Diffusers、云CLI或自定义SDK。不经Shell，不把提示词拼接到命令中。",
			imageGenTimeoutSeconds: "任务总超时（秒）",
			imageGenMaxImages: "每次最多图片张数",
			imageGenMaxMB: "单张图片大小上限（MB）",
			imageGenKeepDays: "本地图片保留天数",
			imageGenLimitsHint: "提交、轮询、下载共用总超时，最多并发2个任务，无自动重试。部分接口逐张提交，按各自规则计费。取消或超时不能保证远端停止计费。",
			imageGenKeepHint: "每次生成成功后按天数清理，并最多保留100张；生成图片不纳入普通插件备份。网页工具的附件由dsh独立保存。",
			imageGenPrompt: "试画提示词",
			imageGenGenerate: "生成一张（消耗额度）",
			imageGenCancel: "取消等待",
			imageGenRefresh: "刷新图片",
			imageGenSaved: "试画使用已保存的配置。先保存设置，再点击生成；不会发送到QQ。",
			imageGenDocs: "查看生图接入文档",
			imageGenDownload: "打开 / 下载",
			imageGenEmpty: "尚无生成图片。",
			imageGenWorking: "正在生成并等待图片…",
			imageGenCanceled: "已取消等待；远端任务可能仍运行并计费。",

			docView: "文档视图",
			docEdit: "编辑",
			docPreview: "模型正文预览",
			docPreviewHint: "只预览当前草稿按已保存设置处理后的正文，不会保存或调用模型。实际请求还会按会话权限加入核心记忆、召回等内容。",
			docReload: "载入服务器版本",
			docNotWritten: "尚未保存文件",
			docEmpty: "正文为空；人格为空时保留预设原有人格。",
			docImport: "导入 Markdown",
			docExport: "导出当前稿",
			docTooLarge: "请选择不超过512KB的UTF-8文本文件。",
			docDiscardConfirm: "当前有未保存草稿。确认放弃草稿并载入服务器最新版本？可先导出当前稿保留副本。",
			docConflict: "服务器文档已更新。请先导出草稿，再载入服务器版本并合并，避免覆盖其他修改。",
			personaPlaceholder: "# 身份与性格\n\n在这里写下稳定的角色设定。\n\n# 语气与表达\n\n描述称呼、说话习惯和表达偏好。",
			personaIgnoreComments: "忽略人格中的 HTML 注释",
			personaIgnoreCommentsHint: "仅在组装人格正文和对外人格服务时排除<!-- ... -->注释，原文件、历史和备份保持原样。默认关闭，兼容现有人格；开启后保存设置即可。未闭合注释会排除其后全部内容，可在模型正文预览中检查。",
			personaCurrent: "已保存的人格",
			personaHostConnected: "已读取宿主状态",
			personaReady: "正文 {n} 字符；受管会话的后续模型请求会读取最新保存内容。",
			personaBlank: "人格正文为空，受管会话保留预设原有人格；核心记忆单独生效。",
			personaApplies: "生效预设：",
			personaExcludes: "排除：",
			personaAllPresets: "全部",
			personaTraceHint: "记录本插件组装阶段，保留最近10次元数据，重启清空；其他人格插件仍可能后续覆盖。",
			personaTrace: "最近组装记录",
			personaNoTrace: "尚无组装记录。打开设置页或预览不会产生记录。",
			personaDefaultPreset: "默认预设",
			scope_master: "主人范围",
			scope_private: "其他私聊",
			scope_group: "群聊",
			trace_applied: "人格 {persona} / 核心记忆 {core} 字符",
			trace_excluded: "预设已排除，未应用",
			trace_empty: "正文为空，保留原提示词",
			sharedSilence: "静默标记与“聊天与回复”中的设置共用。",
			unsavedBar: "有改动还没保存：点「保存」才生效，离开这个页面会丢掉",
			discardChanges: "放弃改动",
			diaryModel: "写日记用的模型",
			diaryModelHint: "日记和月度总览使用管理员私聊模型，依次回退至普通私聊模型及 dsh 默认模型。模型选择在“聊天与回复”中配置；此处单独设置思考等级，默认 high，仅在模型支持时生效。",
			diaryModelFrom_admin: "来自“聊天与回复 → 管理员私聊模型”。",
			diaryModelFrom_private: "未单独设置管理员私聊模型，用的是「私聊用的模型」。",
			diaryModelFrom_default: "未设置独立聊天模型，用的是 dsh 的默认模型。",
			diaryModelFrom_none: "dsh 还没有可用的模型。",
			apiKeySet: "已设置 Key。",
			apiKeyUnset: "还没设置 Key。",
			embedFoldClose: "收起向量模型设置",
			embedFold: "向量模型：{provider} · {model}（点开修改）",
			llmTestFailed: "不通：{error}",
			llmTestOk: "通了：{model}，思考等级 {effort}，{ms} 毫秒，回复「{text}」",
			llmTest: "测试这个模型",
			effort_max: "最高",
			effort_high: "高",
			effort_medium: "中",
			effort_low: "低",
			effort_minimal: "最少",
			effort_off: "关闭（不思考）",
			effortDefault: "模型默认",
			effortUnsupported: "（这个模型不支持）",
			effortPickModel: "先选模型。",
			effortNoneApi: "这家不能调思考等级（或者看不出来），由模型自己决定。",
			effortNone: "这个模型不能调思考等级。",
			effortHint: "选择目标模型支持的思考等级。较高等级通常增加生成时间与用量；不支持此参数的模型使用服务默认行为。选项随模型或服务变化。",
			effort: "思考等级",
			chatApiUrlHint: "聊天补全服务的 OpenAI 兼容基础地址，通常填写至 /v1。插件会追加 /chat/completions，不应重复填写具体接口路径。",
			apiModel: "模型",
			dshModelsFailed: "读不到 dsh 的模型列表：{error}",
			dshModelPick: "选一个模型",
			dshModelHint: "选择已在 dsh“设置 → 模型”中配置的模型，按提供方分组。此处不单独配置该提供方的凭据。",
			dshModel: "dsh 里的模型",
			followNone: "dsh 还没有默认模型",
			followUses: "现在会用",
			sourceApi: "其他服务商（用自己的 Key）",
			sourceDsh: "dsh 里配置的模型",
			followGraphNote: "用「记忆生成」里整理用的模型和思考等级。",
			followGraph: "和「整理用的模型」一样",
			followMemory: "跟随 dsh 配置（dsh 的默认模型）",
			followSummaryNote: "用正在聊的这个会话的模型和思考等级，不用另外设置。",
			followSummary: "跟随 dsh 配置（用这个会话自己的模型）",
			langIsEn: "0",
			provider: "服务商",
			providerHint: "选择服务商预设以填入接口基础地址和常用模型。选择“自定义”时，请使用与当前任务对应的 OpenAI 兼容接口；通常填写至 /v1。",
			providerSearch: "搜索服务商",
			providerCustom: "自定义（OpenAI 兼容）",
			providerGetKey: "去这家拿 Key ↗",
			pModelHint: "使用当前填写或已保存的凭据获取模型列表；失败时仍可使用预设选项或手动填写模型标识。列表仅供选择，不保证账号具有调用权限。",
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
			summary: "QQ消息存档、群上下文、主动聊天、生图及独立备份恢复。",
			status: "状态",
			statusHint: "显示QQ消息存档、QQ功能运行状态和本插件数据目录。人格、核心记忆和日记由独立的人格与记忆插件管理。",
			dataDir: "数据目录：{dir}",
			snowlumaOn: "QQ 接入模块已就绪：QQ 会话按主人 / 其他私聊 / 群聊分规则。",
			snowlumaOff: "QQ 接入模块暂未就绪，QQ 会话分类与消息存档不可用。",
			archiveCount: "存档 {total} 条（私聊 {private}，群聊 {group}）",
			loading: "正在读取…",
			loadFailed: "读取失败：{error}",
			scope: "生效范围",
			scopeHint: "本插件按预设筛选会话，再应用人格、核心记忆、召回和上下文管理。默认允许 companion 陪伴预设；dsh 内直接创建的受管会话按主人范围处理，QQ 会话由 bridge 区分主人私聊、其他私聊与群聊。",
			pluginAccess: "给其他插件用",
			pluginAccessHint: "控制其他插件通过本插件服务接口读取人格和记忆、写入记忆的范围。“全部”允许按目标访问主人资料；“只给公开的”将访问限制为公开范围；“不给”拒绝接口调用。此项不替代各会话内部的工具权限。",
			pluginAccessAll: "全部（含主人的）",
			pluginAccessPublic: "只给公开的",
			pluginAccessOff: "不给",
			personaPresets: "生效的预设",
			personaPresetsHint: "允许应用本插件人格、核心记忆、召回和上下文管理的预设 ID，默认 companion。多个值用空格或逗号分隔；* 表示全部，列表为空时也不按允许名单限制。仍会排除“不生效的预设”。",
			excludedPresets: "不生效的预设",
			excludedPresetsHint: "明确排除的预设 ID，多个值用空格或逗号分隔。排除规则优先于“生效的预设”，对应会话保留原预设的人格、工具和上下文管理方式。",
			personaOnly: "只用人格",
			personaOnlyHint: "移除 dsh 默认的 Harness 身份说明，使自定义人格不再同时附带该身份句。不会强制覆盖使用 complete 完整替换模式的其他人格插件；此类预设应按实际需求配置排除范围。",
			persona: "人格",
			personaHint: "编辑并“保存人格”后，受管会话后续模型请求将使用最新内容，无需重启。留空时不替换预设原有人格。此处直接编辑不受模型自改人格的审核规则限制。",
			savePersona: "保存人格",
			selfEdit: "让她自己改人格和核心记忆",
			selfEditHint: "仅向主人范围的受管会话提供修改人格和核心记忆的工具，包括管理员 QQ 私聊及 dsh 内直接创建的会话。群聊和其他人的私聊不获得这两项修改权限。",
			personaGuardSec: "改人格的限制",
			personaGuardHint: "模型修改人格时，检查单次新增字数、总长度、大幅删除，以及日期、长数字、链接、邮箱、密钥和改变规则的内容等；可进一步调用模型审核允许与禁止清单。拒绝时向模型返回原因。设置页直接编辑不受该自改流程限制。",
			personaGuard: "限制她改人格",
			personaReview: "改之前让模型审核",
			personaReviewHint: "在硬规则检查通过后，使用“整理用的模型”审核人格修改是否符合允许及禁止清单。调用失败或结果无法解析时，本次修改不予执行。",
			personaEditMaxChars: "一次最多加几个字",
			personaMaxChars: "人格最多几个字",
			personaMaxCharsHint: "模型自改人格的总字数上限，默认 15000，按非空白字符统计。超过上限后仅允许缩短现有内容；设置页直接编辑不受此自改上限流程限制。",
			personaAllowed: "可以写（一行一条）",
			personaForbidden: "不许写（一行一条）",
			historyKeep: "保留几份历史版本",
			historyKeepHint: "人格、主人核心记忆和公开核心记忆分别保留的历史版本数量，默认各 5 份。0 表示不保留历史版本，不会清空当前正文。",
			core: "核心记忆",
			coreHint: "每次模型请求持续附带的关键事实，不参与普通长期记忆的自动遗忘。主人核心记忆仅用于主人范围；公开核心记忆可用于群聊及其他私聊，应仅包含可公开信息。",
			coreMaster: "主人的核心记忆",
			corePublic: "公开的核心记忆",
			saveCore: "保存",
			coreMasterMaxChars: "主人的核心记忆最多几个字",
			coreMasterMaxCharsHint: "主人核心记忆的非空白字符上限，默认 5000。模型修改和设置页保存均检查此上限；现有内容超限时仅允许缩短。此上限为固定配置，不随人格上限自动调整。",
			corePublicMaxChars: "公开的核心记忆最多几个字",
			corePublicMaxCharsHint: "公开核心记忆的非空白字符上限，默认 1500。保存和模型修改均检查上限；内容将用于所有相应受管会话，请勿填写仅限主人可见的资料。",
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
			contextHint: "会话轮数或上下文占用达到配置条件时，处理最早的若干轮，可选择截断或模型压缩。“压缩前先整理记忆”决定是否先提取长期记忆；模型报上下文超限时会执行截断重试。一轮按一条真实用户发言及其后续回复计算。",
			thresholdPercent: "到上限的百分之多少就处理",
			thresholdPercentHint: "上下文处理的占用阈值，取值 10～95，默认 70，表示达到模型上下文上限的 70% 时开始处理。与轮数限制共同生效，以先达到的条件为准。",
			masterRow: "主人",
			privateRow: "其他私聊",
			groupRow: "群聊",
			maxRounds: "最多保留轮数",
			maxRoundsHint: "该类会话保留的用户对话轮数上限，默认 60。0 表示关闭轮数触发条件，仍可因上下文占用阈值或模型超限而处理。",
			dropRounds: "一次处理几轮",
			mode: "处理方式",
			modeTruncate: "按轮数截断",
			modeLlm: "让模型写回忆（压缩）",
			modeDefault: "用默认",
			summaryModel: "压缩用的模型",
			summaryModelHint: "上下文处理选择“模型压缩”时，用此模型将旧对话整理为第一人称回忆。默认跟随当前会话模型；也可选择 dsh 已配置模型或独立服务商，压缩会产生额外模型请求。",
			rules: "例外规则",
			rulesHint: "按QQ号或群号覆盖存档保留、未唤醒群消息存档及主动聊天规则；留空继承默认值。规则不绕过白名单和存档权限。",
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
			archiveHint: "将获准的 QQ 收发消息保存在 companion 数据库中，与 dsh 会话日志独立。白名单开启时，名单外群聊包括管理员收发均不存，普通名单外私聊不存，管理员私聊允许。到期内容先尝试整理再删除；既有历史不会因移出名单而立即清除。",
			archiveEnabled: "消息存档",
			archiveUnwokenAll: "保存没唤醒她的群消息",
			archiveUnwokenAllHint: "在获准存档的群中，同时保存未触发回复的群消息，默认开启。关闭后不再保存这类来信，并停止附加“最近群聊上下文”；群例外规则可进一步设置，但不能允许名单外群存档。",
			archiveDaysMaster: "主人私聊保留天数",
			archiveDaysOthers: "其他私聊和群聊保留天数",
			log: "日志",
			logLevel: "日志级别",
			logLevelHint: "运行日志详细程度，默认 info。debug 额外记录上下文轮数、占用与处理细节，适用于排查问题，可能增加日志体积。",
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
			memRecallHint: "每轮自动从当前会话可见的长期记忆中检索相关内容，并附加到该轮输入。关键词检索为基础；配置可用向量接口后增加语义检索。主人范围可检索群记忆，群聊和其他私聊不得召回主人私密记忆。",
			recallEnabled: "自动想起相关记忆",
			recallTopK: "每轮最多几条（别人私聊、群聊）",
			recallTopKHint: "其他私聊和群聊每轮自动召回的条数上限，默认 6；0 表示不附加自动召回结果。群聊仅检索本群和公开记忆，实际数量取决于符合条件的结果。",
			recallTopKMaster: "每轮最多几条（主人的会话）",
			recallTopKMasterHint: "主人 QQ 私聊及 dsh 内主人范围会话每轮召回的条数上限，默认 10。可检索主人、公开及群记忆；实际结果仍受可见范围、门槛和排序约束。",
			keywordThreshold: "关键词门槛",
			keywordThresholdHint: "仅使用关键词相关度时的入选门槛，范围 0～1，默认 0.3。数值越高，文字匹配要求越严格，返回结果通常越少。",
			vectorThreshold: "向量门槛",
			vectorThresholdHint: "具备向量的候选记忆使用的综合相关度门槛，范围 0～1，默认 0.45。综合分数同时考虑关键词与向量相似度；缺少向量时使用关键词门槛。",
			keywordWeight: "关键词占比",
			keywordWeightHint: "综合相关度中关键词得分的比例，范围 0～1，默认 0.3，其余比例用于向量相似度。仅在查询和候选记忆均有可用向量时生效。",
			importanceWeight: "重要程度权重",
			recencyWeight: "新近程度权重",
			groupDiscount: "群记忆折扣",
			groupDiscountHint: "主人范围检索群记忆时，对相关度部分应用的折扣系数，范围 0～1，默认 0.7。越小越降低群记忆的排序优先级，不改变群记忆的可见权限。",
			halfLifeDays: "半衰期（天）",
			halfLifeDaysHint: "重要程度与新近程度评分的半衰期，默认 30 天。有效重要程度从最后召回时间或创建时间开始衰减；再次召回会更新其衰减起点，不直接删除记忆。",
			invalidRatio: "请填 0 到 1 之间的数",
			memGen: "记忆生成",
			memGenHint: "使用模型从尚未整理的聊天中提取值得保留的长期记忆。QQ 会话记录整理进度，避免同一段反复提取；需要可用的整理模型，执行时会产生模型请求。",
			activeMemory: "主动记忆",
			activeMemoryHint: "为符合生效范围的会话提供“回忆、记住、遗忘”工具，由模型按需调用。记忆读写仍受会话范围和权限限制；工具挂载在会话创建或插件重新加载时更新。",
			organizeEveryRounds: "每多少轮整理一次",
			organizeEveryRoundsHint: "达到此用户轮数后自动整理尚未处理的聊天，默认 20 轮。0 表示关闭按轮数整理，不关闭手动整理、到期前整理或已启用的压缩前整理。",
			organizeBeforeCompact: "压缩前先整理记忆",
			organizeBeforeCompactHint: "截断或压缩上下文前，先尝试从将要处理的旧对话中提取长期记忆，默认开启，会增加整理模型请求。“对话”和“记忆”标签中的控件修改同一个设置。",
			memoryModel: "整理用的模型",
			memoryModelHint: "用于聊天记忆提取、记忆清理、相近记忆整合及人格修改审核。默认跟随 dsh 默认模型；可选择 dsh 模型或独立服务商。日记和月度总览使用管理员私聊模型，不由此项控制。",
			currentModel: "现在用的模型：{model}",
			noModel: "没找到可用的模型，请填「整理用的模型」或在 dsh 里设置默认模型。",
			pending: "还没整理：QQ 会话 {qs} 个（{qm} 条消息），dsh 会话 {ds} 个",
			organizeNow: "立即整理",
			organizing: "整理中…",
			organizeStarted: "已开始整理，完成后刷新就能看到。",
			forget: "遗忘",
			forgetHint: "“普通遗忘”保留原文并停止正常召回，可手动恢复；“彻底遗忘”删除原文并保留内容指纹，以阻止相同内容重新写入。已彻底遗忘的原文无法通过恢复操作找回。",
			masterForget: "主人的记忆",
			privateForget: "别人私聊的记忆",
			groupForget: "群聊的记忆",
			forgetNormal: "普通遗忘",
			forgetPurge: "彻底遗忘",
			cleanupEnabled: "主人记忆的模型清理",
			cleanupEnabledHint: "启用对已普通遗忘的主人记忆进行模型清理。运行后生成建议彻底遗忘的条目，默认需用户勾选确认；只有同时启用“判断完直接删”才自动执行删除。",
			cleanupAutoPurge: "判断完直接删",
			cleanupAutoPurgeHint: "模型清理选出条目后直接执行彻底遗忘，不再等待逐条确认。默认关闭，仅在主人记忆模型清理启用时生效；删除原文后无法直接恢复。",
			runCleanup: "运行",
			running: "运行中…",
			cleanupNone: "模型没有挑出要删的。",
			cleanupResult: "{time} 模型建议彻底遗忘 {n} 条：",
			cleanupPurged: "已删",
			purgeSelected: "彻底遗忘勾选的",
			vector: "向量检索",
			vectorHint: "使用 OpenAI 兼容 embeddings 接口生成记忆向量，补充语义检索。默认接口预设使用 BAAI/bge-m3；未配置密钥时停用向量功能。切换模型后需重建对应索引，期间关键词检索仍可使用。",
			embedApiUrl: "接口地址",
			embedApiUrlHint: "向量服务的 OpenAI 兼容基础地址，通常填写至 /v1。插件会追加 /embeddings；需确保服务支持所选向量模型。",
			embedApiKey: "接口 Key",
			embedApiKeyHint: "所选模型服务的 API Key。已保存密钥不回显，留空保留现有值；密钥用于相应任务的服务调用，不会包含在插件导出备份中。",
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
			graphStDisabled: "没启用（上面的「图记忆」开关是关的）",
			indexModel: "模型 {model}，{dim} 维",
			indexCount: "已建 {embedded} / {total} 条",
			indexProgress: "这次：{done} / {todo}",
			indexLastError: "最近的错误：{error}",
			indexErrors: "跳过了 {n} 条算不出来的",
			indexTimes: "开始 {start}，结束 {end}",
			rebuild: "手动重建",
			embedTest: "测试向量接口",
			embedTestOk: "能用：模型 {model}，向量 {dim} 维，用时 {ms} 毫秒。",
			embedTestFailed: "测试失败：{error}",
			testing: "测试中…",
			testUsesSaved: "测试用的是已保存的设置，改了先保存。",
			tabsLabel: "设置分类",
			tab_persona: "人格",
			tab_chat: "对话",
			tab_memory: "记忆",
			tab_diary: "日记",
			tab_proactive: "主动聊天",
			tab_backup: "备份和日志",
			graphSec: "图记忆",
			graphSecHint: "从长期记忆提取实体及关系，形成额外的图检索路径，并与普通检索合并排序。默认关闭；启用后会为既有非日记记忆补提取关系，增加模型请求。配置向量服务时也可为实体生成向量，最终召回条数仍受上限控制。",
			graphEnabled: "图记忆",
			graphModel: "抽关系用的模型",
			graphModelHint: "用于从记忆内容提取实体和关系。默认跟随“整理用的模型”及其思考设置，也可选择独立模型或服务；关系提取会产生额外请求。",
			graphBatch: "一次让模型看几条",
			graphHops: "顺着关系走几步",
			graphHopsHint: "图检索从匹配实体向关系相邻实体扩展的步数，范围 0～2，默认 1。0 不扩展邻接关系；增大可覆盖更多关联，也可能引入较弱相关内容。",
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
			memListOpen: "展开记忆列表（看、搜、改、遗忘、手动加）",
			memListClose: "收起记忆列表",
			memListHint: "查看和管理长期记忆，可新增、编辑、普通遗忘、彻底遗忘或恢复。操作影响记忆库，不等同于修改原始聊天存档；彻底遗忘不能直接恢复原文。",
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
			groupCtxHint: "群聊通过 @、引用、唤醒词或前缀进入正式回复时，附加当前消息之前的本群近期存档，包括机器人已发送的消息。需要开启未唤醒消息存档；图片可附加，语音和视频按 bridge 媒体设置转换。此上下文与 dsh 正式对话历史分开。",
			groupContextCount: "附上之前几条",
			groupContextCountHint: "正式群聊回复附带的最近本群存档条数，默认 10，排除当前来信。0 表示不附加；未开启未唤醒存档或没有可用记录时不提供这部分历史。",
			groupCtxOff: "「保存没唤醒她的群消息」关着，这一项不起作用。",
			forgetMode: "遗忘方式",
			proactive: "主动聊天",
			proRuleOn: "主动找",
			proRuleOff: "不主动找",
			memStats: "记忆：正常 {active} 条，普通遗忘 {forgotten} 条，被取代 {superseded} 条，指纹 {tomb} 个",
			diarySec: "日记",
			diarySecHint: "按日生成仅围绕主人互动的第一人称日记，并按月生成总览；文件长期保留，日记也写入记忆库。主人新会话可按下方设置读取近期日记与总览。生成需要可用模型并产生额外请求。",
			diaryEnabled: "每天写日记",
			diaryTime: "每天几点",
			diaryTimeHint: "每日维护任务的计划时间，采用 HH:MM 24 小时制，默认 01:30，按本插件时区执行。维护包含已启用的日记生成及存档到期处理；备份有独立时间设置。",
			dayBoundaryHour: "一天按凌晨几点分界",
			dayBoundaryHourHint: "划分日记归属日期的小时，范围 0～12，默认 4。例如凌晨 04:00 前的互动计入前一个逻辑日，不改变原始消息时间。",
			timezone: "时区",
			monthlyEnabled: "每月写月度总览",
			diaryOnNewSession: "主人开新会话时先给她看日记",
			diaryDays: "最近几天的日记",
			overviewMonths: "最近几个月的总览",
			diaryBudgetPercent: "最多占模型上限的百分之多少",
			diaryBudgetPercentHint: "新会话附加日记及总览所占的模型上下文比例上限，范围 1～60，默认 20。超限时先缩短较早日记，必要时移除最早内容，不删除日记原文件。",
			diaryCount: "已有日记 {days} 篇、月度总览 {months} 篇。最近一篇：{latest}",
			writeDiaryNow: "现在就写一篇",
			diaryWritten: "写好了 {date} 的日记。",
			diaryNothing: "这段时间没有和主人的聊天，没写。",
			diaryPage: "日记本",
			diaryPageHint: "按日期查看、编辑或删除日记和月度总览，也可导入历史 Markdown 或文本日记。导入依据文件名或正文中的日期识别归属，请核对预览和日期。",
			diaryEmpty: "还没有日记。",
			monthlyLabel: "月度总览",
			del: "删除",
			delConfirm: "删掉这篇日记？（记忆库里的那份不受影响）",
			upload: "上传日记文件",
			uploadHint: "支持同时选择多个 Markdown 或文本日记文件。文件需包含可识别日期；导入后请检查对应日期的内容。",
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
			expirySecHint: "每日维护时处理存档到期：尝试整理未处理内容、移除到期消息，并按设置轮换会话、携带近期消息及归档旧会话。其他人的旧会话可在到期后删除；主人旧会话不自动删除。",
			rotateSessions: "会话用满保留期就换新会话",
			deleteOldSessions: "其他人的旧会话过期后删除",
			deleteOldSessionsHint: "到期后自动删除其他私聊及群聊的旧会话文件，默认开启。关闭后仅归档保留；主人旧会话始终保留，不受此开关影响。",
			carryMessages: "换会话时带过去最近几条消息",
			archiveImages: "收到的图片下载存起来",
			archiveImagesHint: "对获准存档消息中的图片下载本地副本，以避免临时 QQ 链接失效。图片保存在数据目录的 media/，随存档到期清理；名单外群聊和普通私聊不触发存档图片下载。",
			runExpiry: "现在处理到期",
			expiryDone: "处理完了：删了 {deleted} 条存档，换了 {rotated} 个会话，删了 {sessions} 个旧会话，清掉 {media} 张图片。",
			lastRun: "上次运行：{time}",
			retired: "换下来的旧会话",
			retiredEmpty: "还没有换下来的会话。",
			retiredState: "{umo} · {cat} · 最后一条 {last} · {state}",
			stArchived: "已归档",
			stDeleted: "已删除",
			stDeleteFailed: "删除失败：{note}",
			proSec: "主动聊天",
			proSecHint: "按随机间隔唤醒获准会话，正式模型自行决定是否发言。遵守白名单、免打扰、近期回复与活跃限制；本功能无需安装人格记忆插件。",
			proactiveEnabled: "主动聊天",
			proactiveMinMinutes: "主人私聊：最短间隔（分钟）",
			proactiveMaxMinutes: "主人私聊：最长间隔（分钟）",
			proactiveOthersMinMinutes: "别人和群：最短间隔（分钟）",
			proactiveOthersMaxMinutes: "别人和群：最长间隔（分钟）",
			proIntervalHint: "从最短到最长间隔随机安排下一次主动聊天，单位为分钟，最短与最长均须至少 10。默认主人 60～240，其他私聊及群聊 120～240；最长间隔应不小于最短间隔。",
			proactivePrivate: "也主动找别人私聊",
			proactiveGroup: "也在群里主动说话",
			quietStart: "免打扰开始",
			quietEnd: "免打扰结束",
			quietHint: "主动聊天免打扰时段，使用 HH:MM 24 小时制，允许跨午夜，默认 01:00～09:00。按本插件时区判断，仅暂停主动聊天，不阻止收到消息后的正常回复。",
			proactiveRecentMinutes: "她说过话后几分钟内不触发",
			proactiveGroupContext: "群里带几条上下文",
			proactiveActiveDays: "别人和群：最近几天聊过才找",
			proSilence: "「不发」暗号",
			proSilenceHint: "主动聊天提示中约定的静默标记，默认 [不发]，须与 bridge 的“「不发」暗号”一致。模型返回该标记表示本次不发送消息；不增加额外判断请求。",
			proNoWake: "QQ 接入模块的唤醒接口暂不可用，主动聊天不会生效。",
			proListEmpty: "还没有可以主动找的会话（要先在 QQ 上聊过）。",
			proItem: "{umo} · {cat} · 下次 {next} · 上次 {last}",
			proTry: "现在试一次",
			proTried: "唤醒了，看她发不发。",
			never: "还没有",
			careSec: "记忆保养",
			careSecHint: "按维护周期清理长期未召回且重要程度较低的记忆，并可调用模型整合相近记忆。遗忘方式按范围和例外规则决定；日记不参与自动清理及整合。最近一次整合支持撤销。",
			autoCleanup: "自动清理",
			autoCleanupDays: "超过几天没被想起",
			autoCleanupImportance: "重要程度低于",
			purgeForgotten: "普通遗忘很久的自动彻底遗忘",
			purgeForgottenDays: "普通遗忘超过几天",
			consolidateEnabled: "定期整合",
			consolidateOverlap: "相近程度门槛",
			consolidateOverlapHint: "候选记忆分组的相近程度门槛，范围 0.2～0.95，默认 0.5。越高越严格，通常只有更相似的记忆进入同一整合组。",
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
			restoreSec: "恢复备份",
			restoreSecHint: "上传本插件导出的 .tar.gz 备份，或选择服务器已有备份。系统先校验并识别包内文件，再由您多选恢复类别；确认前不会覆盖当前数据，未选择的类别保持原状。",
			restoreSelectAll: "全选恢复项目",
			restoreSelectNone: "清空选择",
			restoreFiles: "查看识别到的文件",
			restoreEmptyFiles: "此类别在包中没有文件。空日记项目恢复后将清空当前日记。",
			restoreSharedDb: "记忆库与主人消息存档可能共用 companion.db；恢复时仅替换所选类别对应的数据表，不会因共用文件而恢复未选类别。",
			restoreSelection: "本次将恢复：{items}",
			restoreNothingSelected: "请选择至少一个恢复项目，可同时选择多项。",
			restoreVerified: "文件校验通过，共识别 {count} 个数据文件。",
			restorePending: "暂未确认恢复结果，请刷新页面查看；请勿重复提交恢复。",
			backupSec: "备份计划与导出",
			backupSecHint: "仅备份管理员私聊消息存档、管理员私聊dsh会话及QQ插件设置。密钥不导出；本插件所有备份合计最多五份。",
			backupItemsLabel: "备份哪些内容",
			backupItemsHint: "仅备份QQ插件负责的主人消息存档、主人QQ私聊dsh会话及QQ设置；人格和记忆请在对应插件中备份。",
			bi_persona: "人格",
			bi_personaDesc: "现在的人格稿（不含历史版本）",
			bi_core: "核心记忆",
			bi_coreDesc: "主人的、公开的两份（不含历史版本）",
			bi_diary: "日记",
			bi_diaryDesc: "每天的日记和月度总览",
			bi_memory: "记忆库",
			bi_memoryDesc: "长期记忆、向量、关系网（图记忆）、彻底遗忘的指纹、整合记录",
			bi_archiveMaster: "主人私聊的存档",
			bi_archiveMasterDesc: "你和她私聊的原话和图片，还有 dsh 里直接聊的记录",
			bi_sessionsMaster: "主人私聊的 dsh 会话",
			bi_sessionsMasterDesc: "主人 QQ 私聊的原始 dsh 会话、历史会话及其引用附件；恢复后接回原对话（默认不带）",
			bi_settingsCompanion: "人格、记忆与陪伴设置",
			bi_settingsCompanionDesc: "这个页面里的所有设置（不含向量 Key）",
			bi_settingsBridge: "QQ 连接与聊天设置",
			bi_settingsBridgeDesc: "主人 QQ、白名单、唤醒词、模型、发消息节奏等（不含连接 Token、语音 Key）",
			bi_settingsDsh: "dsh 其他设置",
			bi_settingsDshDesc: "dsh 网页设置页里改过的其他设置，比如选的默认预设、模型（不含 Key）",
			backupNotIncluded: "备份不导出配置密钥、QQ 登录数据或运行环境，也不包含其他私聊、群聊及网页的原始会话。人格和核心记忆只备份现稿。主人原始会话含完整事件及引用附件，可能包含聊天中出现的敏感内容，请妥善保管。",
			backupNoItems: "一样都没勾，备份包会是空的。",
			restorePick: "选择恢复项目（可多选，未选项目保持当前内容）",
			restoreSettingsNote: "勾了的设置确认后马上套用（Key 和 Token 不动）；包里没改过的设置会恢复成默认值。",
			importedItems: "还原了：{items}",
			backupEnabled: "每天自动备份",
			backupTime: "自动备份时间",
			backupKeep: "备份总保留份数",
			backupKeepHint: "自动、手动和导入前备份合计保留的文件数量，默认5份。新备份成功生成后按创建时间删除最早的，保留最新的备份；生成失败时不因此删除旧备份。",
			exportNow: "现在备份并下载",
			exported: "备份好了：{name}",
			download: "下载",
			importFile: "上传备份包并识别内容",
			chooseFile: "选择备份包…",
			importFileHint: "选择本插件导出的 companion-….tar.gz 备份包。系统先校验并展示内容，确认所选恢复项后才执行覆盖；导入前会创建备份。",
			previewTitle: "备份内容识别结果",
			previewLine: "插件 {plugin} · {time} 做的 · 记忆 {mem} 条 · 日记 {days} 篇 · 月度总览 {months} 篇 · 主人存档 {msgs} 条 · 主人 dsh 会话 {sessions} 个 · 图片 {media} 张 · 向量模型 {model}",
			previewSettings: "包里 人格、记忆与陪伴设置：",
			confirmImport: "恢复所选项目（先备份当前数据）",
			cancelImport: "取消本次恢复",
			importing: "正在恢复所选项目，插件会自动重新加载…",
			imported: "恢复完成（{time}）。",
			importFailed: "恢复失败：{error}",
			backupList: "备份列表",
			backupEmpty: "还没有备份。",
			backupItem: "{name} · {size} · {reason}",
			reasonAuto: "自动",
			reasonManual: "手动",
			reasonBefore: "导入前",
			restoreThis: "查看并选择恢复项目",
			deleteBackup: "删除",
			deleteBackupConfirm: "删除这个备份文件？",
			selfCheck: "迁移后自检",
			selfCheckHint: "使用固定查询检查主人范围记忆的检索结果，适用于迁移或导入后验证。多个问题用空格或逗号分隔；此检查不等于调用聊天模型生成答案，导入完成后也会自动执行。",
			selfCheckQueries: "自检问题",
			runSelfCheck: "现在自检",
			selfCheckMatches: "检索命中 {n} 条候选记忆；以下是原文节选，不是模型生成的答案。",
			selfCheckMatchMeta: "记忆 #{id} · 检索相关度 {score}",
			selfCheckExcerpt: "最多展示前200字符；完整记录可在“记忆与存档”中查看。",
			selfCheckNone: "未检索到候选记忆；不表示相关事实一定不存在。",
			personaGuardHintField: "模型自改人格的规则检查总开关，默认开启。关闭后跳过该自改限制流程；设置页直接编辑本就不使用此流程。",
			personaEditMaxCharsHint: "模型一次人格修改允许增加的非空白字符数，默认 300，最小 10。限制净新增量，不限制同等长度的正常替换；仅用于已启用的人格自改检查。",
			personaAllowedHint: "供人格修改审核使用的允许内容清单，每行一条。建议描述稳定的身份、性格及表达方式；审核模型将与禁止清单共同参考。",
			personaForbiddenHint: "供人格修改审核使用的禁止内容清单，每行一条。用于约束模型自改人格；不代替长期记忆管理，也不限制设置页直接编辑。",
			archiveEnabledHint: "QQ 消息存档总开关，默认开启。关闭后停止新增 QQ 消息及其存档图片，也会影响依赖存档的群上下文、整理与日记数据来源；已有数据不会立即删除。 本开关不控制 SnowLuma 与 QQ 客户端自身的协议消息缓存。",
			archiveDaysMasterHint: "管理员 QQ 私聊消息存档的保留天数，默认 365，最小 1。到期后由维护任务处理；这不代表主人长期记忆或日记会随之删除。",
			archiveDaysOthersHint: "其他私聊和群聊消息存档的默认保留天数，默认 5，最小 1。例外规则可覆盖该值；实际写入仍须通过 bridge 存档权限检查。",
			recallEnabledHint: "自动长期记忆召回总开关，默认开启。关闭后不在每轮自动附加检索结果；人格、核心记忆以及已启用的主动记忆工具分别由各自设置控制。",
			importanceWeightHint: "召回排序中有效重要程度的加分权重，范围 0～1，默认 0.2。数值越高越优先保留重要记忆；不改变相关度入选门槛。",
			recencyWeightHint: "召回排序中新近程度的加分权重，范围 0～1，默认 0.1。越高越倾向较新创建的记忆；新近程度按半衰期衰减。",
			embedBatchHint: "单次向量请求处理的记忆数量，范围 1～64，默认 16。增大可减少请求次数，但会增加单次请求体积；应符合服务商批量限制。",
			graphEnabledHint: "启用图记忆关系提取和图检索，默认关闭。需要可用的关系提取模型，既有记忆的补提取会增加模型请求；关闭后不等于删除已有图数据。",
			graphBatchHint: "每批关系提取处理的记忆数量，范围 1～30，默认 8。较大批次增加单次输入规模，应结合目标模型的上下文和输出能力调整。",
			masterForgetHint: "主人范围记忆的默认遗忘方式，默认普通遗忘，保留原文以供恢复。可选择彻底遗忘；到期消息存档与长期记忆使用不同的保留机制。",
			privateForgetHint: "其他私聊记忆的默认遗忘方式，默认彻底遗忘。彻底遗忘删除记忆原文并保留指纹；普通遗忘保留原文，可在记忆列表恢复。",
			groupForgetHint: "群聊长期记忆的默认遗忘方式，默认彻底遗忘，可由群例外规则覆盖。此项不控制群消息存档的保留天数。",
			diaryEnabledHint: "启用每日自动日记生成，默认开启，需要可用的日记模型及主人聊天数据。关闭不删除已有日记，也不关闭独立的存档到期维护。",
			monthlyEnabledHint: "启用月度总览生成，默认开启，从已有日记整理月度内容。实际生成随日记维护流程执行，需要日记生成功能及模型可用。",
			timezoneHint: "日记、维护、备份与主动聊天免打扰时段使用的 IANA 时区，默认 Asia/Shanghai。应与预期运行时间一致；不修改系统时钟或 bridge 自己的时间提示设置。",
			diaryOnNewSessionHint: "主人范围的新会话在开始时附加近期日记及月度总览，默认开启。条数范围由下方天数和月数控制，并受日记上下文预算限制。",
			diaryDaysHint: "主人新会话可读取的近期日记天数，默认 30；0 表示不附加日记。不会删除超出范围的日记文件，附加内容仍受上下文预算约束。",
			overviewMonthsHint: "主人新会话可读取的月度总览月数，默认 12；0 表示不附加总览。不影响总览文件保留。",
			rotateSessionsHint: "会话达到对应存档保留周期时自动创建新会话并归档旧会话，默认开启。近期消息可按下方数量带入；不会删除长期记忆或日记。",
			carryMessagesHint: "自动轮换会话时附加到新会话的近期消息数量，默认 10。0 表示不带入消息；这是轮换衔接内容，不等同于全部迁移旧会话历史。",
			proactiveEnabledHint: "主动聊天总开关，默认开启。仅向符合白名单、类别开关、活跃范围和时间条件的 QQ 会话发起请求；每次请求由正式模型决定是否实际发言。",
			proactiveMinMinutesHint: "管理员私聊主动聊天的最短随机间隔，单位为分钟，默认 60，最小 10。与最长间隔配合，仍受近期发言及免打扰条件限制。",
			proactiveMaxMinutesHint: "管理员私聊主动聊天的最长随机间隔，单位为分钟，默认 240，最小 10。应不小于最短间隔；免打扰或近期已回复时可能继续顺延。",
			proactivePrivateHint: "允许对非管理员 QQ 私聊安排主动聊天，默认开启。对方须满足私聊白名单及最近活跃天数条件，仍受主动聊天总开关限制。",
			proactiveGroupHint: "允许在群聊安排主动发言，默认开启。群必须通过当前群白名单，不能继承管理员此前在群内发言的豁免；仍受活跃时间及免打扰限制。",
			proactiveRecentMinutesHint: "机器人在同一会话最近已发言时的主动聊天抑制时间，单位为分钟，默认 30。窗口内不再次主动唤醒；0 表示关闭此项近期发言抑制。",
			proactiveGroupContextHint: "群主动聊天请求附带的近期本群存档条数，默认 15，0 表示不附加。图片及其他媒体按现有上下文转换规则处理；不读取其他群的记录。",
			proactiveActiveDaysHint: "其他私聊及群聊在最近多少天有互动时才纳入主动聊天，默认 7，最小 1。管理员私聊不使用此项活跃天数过滤。",
			autoCleanupHint: "按维护周期自动处理长期未召回且有效重要程度低于阈值的记忆，默认开启。处理方式遵守对应范围的遗忘设置；日记不参与。",
			autoCleanupDaysHint: "自动清理的未召回时长条件，单位为天，默认 90，最小 1。还必须同时满足有效重要程度阈值，才会进入清理。",
			autoCleanupImportanceHint: "自动清理的有效重要程度阈值，范围 0～1，默认 0.2。与未召回天数共同使用；有效重要程度包含时间衰减。",
			careIntervalDaysHint: "自动清理和记忆整合的运行周期，单位为天，默认 7，最小 1。由每日维护调度检查，不表示每次收到消息都执行。",
			purgeForgottenHint: "将已普通遗忘超过指定天数的记忆自动转为彻底遗忘，默认关闭。启用后会删除相应原文，仅保留内容指纹。",
			purgeForgottenDaysHint: "普通遗忘记忆转为彻底遗忘前的等待天数，默认 180，最小 1。仅在启用对应自动彻底遗忘开关时生效。",
			consolidateEnabledHint: "启用相近长期记忆的定期模型整合，默认开启。原记忆标记为被取代，保留最近一次整合的撤销信息；此操作会产生模型请求。",
			consolidateGroupsHint: "每轮记忆保养最多处理的整合候选组数，默认 20，最小 1。用于限制单次任务规模，不代表每组固定包含多少条记忆。",
			backupEnabledHint: "启用每日定时备份，默认开启。按备份时间、备份项目和保留数量执行；关闭后仍可手动导出备份。",
			backupTimeHint: "每日自动备份的计划时间，HH:MM 24 小时制，默认 04:00，按本插件时区执行。与日记及存档维护时间分别配置。",
			selfCheckQueriesHint: "迁移自检使用的主人记忆查询问题，多个问题用空格或逗号分隔。用于核验检索是否返回预期记忆，不修改人格或聊天记录。",
			dropRoundsHint: "每次上下文处理从最早开始处理的用户轮数，默认 20，至少 1。处理采用所选截断或压缩方式，仍会保留必要的近期上下文。",
			modeHint: "“按轮数截断”直接移除旧轮次的模型上下文；“模型压缩”请求模型生成回忆后替代旧内容。两者均不直接删除消息存档、日记或长期记忆。",
			kindHint: "选择例外规则匹配目标的类型。“QQ 号”匹配私聊对方，“群号”匹配当前群聊。",
			targetHint: "填写与规则类型对应的完整 QQ 号或群号。留空的规则不参与匹配；此字段不使用 dsh 会话 ID。",
			archiveDaysHint: "该目标的消息存档保留天数覆盖值，留空或填 0 继承类别默认。到期由维护任务处理；不能绕过存档总开关或 bridge 存档权限。",
			archiveUnwokenHint: "覆盖本群未唤醒消息的存档选项，留空继承全局设置。即使选择“存”，仍须启用存档总开关并通过群存档权限检查。",
			forgetModeHint: "覆盖此目标长期记忆的默认遗忘方式，留空继承所属类别。普通遗忘可恢复原文；彻底遗忘删除原文并保留指纹。",
			proactiveHint: "覆盖此目标是否参与主动聊天，留空继承默认类别设置。启用不能绕过主动聊天总开关、bridge 白名单、免打扰及其他调度条件。",
			noteHint: "规则备注，仅用于说明配置用途，不改变匹配或权限行为。",
		};
		var en = {
            imageGenConnection: "Connection",
            imageGenStudio: "Studio & gallery",
            imageGenAccess: "Who can generate",
            imageGenAccessHint: "Owner conversations are available when enabled. Authorize other private chats and groups separately.",
            imageGenOwnerAccess: "Owners are allowed by default",
            imageGenLimits: "Tasks & storage",
            imageGenAdvanced: "Advanced integration",
            imageGenAdvancedHint: "Workflows, HTTP templates and local programs. Ordinary cloud services can usually keep the defaults.",
            imageGenReady: "Enabled",
            imageGenOff: "Disabled",
            imageGenNoKey: "No saved key",
            imageGenActiveService: "Current service",
            imageGenConfigHint: "Configure image generation separately. The chat model still interprets requests and calls the tool.",
            imageGenQuotaNotice: "Each generation uses provider quota. Test results are shown only here.",
            imageGenPromptPlaceholder: "Describe the subject, setting, style, lighting and composition…",
            imageGenResults: "Result",
            imageGenResultEmpty: "Your next image starts here",
            imageGenResultEmptyHint: "Describe an image, generate it, or select an existing result below.",
            imageGenHistory: "Recent images",
            imageGenCount: "{count} images",
            imageGenSuccess: "Image generated",
            imageGenFailed: "Generation did not complete",
            imageGenWaiting: "Waiting {seconds}s",
            imageGenSelectImage: "View image {index}",
            imageGenProviderCloud: "Cloud APIs",
            imageGenProviderLocal: "Local & custom",
            imageGenSavedShort: "Uses saved settings",
            imageGenOpenImage: "Open original",
            imageGenDraftNotice: "Save your configuration changes before generating.",

            imageGenKeyHint: "Provider image credential. Saved secrets are never echoed or exported in backups. Local programs can read IMAGE_GENERATION_API_KEY.",
			imageGenTitle: "Image generation",
			imageGenHint: "Independent image APIs. The chat tool delivers results to the current QQ conversation or as web tool attachments. Disabled by default; owner only unless explicitly allowed.",
			imageGenEnabled: "Enable image generation",
			imageGenProvider: "API protocol",
			imageGenApiUrl: "Image API URL",
			imageGenApiKey: "Image API key / token",
			imageGenModel: "Image model / deployment",
			imageGenPrivate: "Allow other private chats",
			imageGenGroup: "Allow group chats",
			imageGenPrivateHint: "Other private chats must still pass the existing access policy.",
			imageGenGroupHint: "Existing group access and administrator rules apply; access is checked again before delivery.",
			imageGenApiUrlHint: "Base URL in most cases; Azure, Vertex and custom HTTP require a complete endpoint. Verify the suggested URL and model against your provider account.",
			imageGenModelHint: "Provider image model ID, Replicate owner/model, or fal path. Separate from the dsh chat model catalog. Choose an available Gemini/Imagen model.",
			imageGenOptions: "Advanced options / workflow (JSON)",
			imageGenOptionsHint: "JSON object: extra provider parameters, ComfyUI workflow/outputNodes, or custom HTTP body/headers/resultPath/poll. Templates support {{prompt}}, {{negativePrompt}}, {{size}}, {{width}}, {{height}}, {{model}}, {{seed}}. Use {{apiKey}} for authentication; never embed credentials in this field. See documentation.",
			imageGenCommand: "Local executable and arguments (JSON array)",
			imageGenCommandHint: "Example [\"/usr/bin/python3\",\"/absolute/path/generate.py\"]. Reads request JSON on stdin and writes {\"images\":[\"base64 or HTTP URL\"]} on stdout. No shell. Supports Diffusers, cloud CLIs and custom SDKs.",
			imageGenTimeoutSeconds: "Total timeout (seconds)",
			imageGenMaxImages: "Maximum images per call",
			imageGenMaxMB: "Maximum image size (MB)",
			imageGenKeepDays: "Local image retention (days)",
			imageGenLimitsHint: "Shared submission/poll/download timeout, up to 2 concurrent tasks, no automatic retries. Some providers submit images separately. Cancellation does not guarantee a remote refund.",
			imageGenKeepHint: "Pruned after successful generation, up to 100 local images. Generated images are not part of ordinary plugin backups. Web tool attachments are stored separately by dsh.",
			imageGenPrompt: "Test prompt",
			imageGenGenerate: "Generate one (uses quota)",
			imageGenCancel: "Cancel waiting",
			imageGenRefresh: "Refresh images",
			imageGenSaved: "Uses saved settings. Save before testing. Does not send to QQ.",
			imageGenDocs: "Image integration guide",
			imageGenDownload: "Open / download",
			imageGenEmpty: "No generated images yet.",
			imageGenWorking: "Generating and waiting for image…",
			imageGenCanceled: "Waiting canceled; the remote task may still run and incur charges.",

			docView: "Document view",
			docEdit: "Edit",
			docPreview: "Model text preview",
			docPreviewHint: "Preview the draft using saved settings without saving or calling a model. Actual requests also include core memory and recall according to session access.",
			docReload: "Load server version",
			docNotWritten: "File not saved yet",
			docEmpty: "Empty text; an empty persona preserves the preset persona.",
			docImport: "Import Markdown",
			docExport: "Export current draft",
			docTooLarge: "Choose a UTF-8 text file no larger than 512KB.",
			docDiscardConfirm: "Discard this unsaved draft and load the latest server version? Export your draft first if you need a copy.",
			docConflict: "The server document changed. Export your draft, then load the server version and merge before saving.",
			personaPlaceholder: "# Identity and personality\n\nWrite the stable character here.\n\n# Voice and expression\n\nDescribe names, speaking habits and preferences.",
			personaIgnoreComments: "Ignore HTML comments in persona",
			personaIgnoreCommentsHint: "Exclude <!-- ... --> notes from assembled persona and the persona service, preserving source, history and backups. Disabled by default for compatibility. Unclosed comments exclude all remaining text; check the model text preview.",
			personaCurrent: "Saved persona",
			personaHostConnected: "Host state received",
			personaReady: "{n} characters; subsequent model requests in managed sessions read the latest saved content.",
			personaBlank: "Empty persona preserves the preset identity; core memory applies separately.",
			personaApplies: "Included presets:",
			personaExcludes: "Excluded:",
			personaAllPresets: "All",
			personaTraceHint: "Tracks this plugin’s assembly stage, keeping the latest 10 metadata entries until restart. Other persona plugins can still override later.",
			personaTrace: "Recent assembly records",
			personaNoTrace: "No assembly records yet. Opening settings or preview does not create one.",
			personaDefaultPreset: "Default preset",
			scope_master: "Master scope",
			scope_private: "Other private chat",
			scope_group: "Group chat",
			trace_applied: "Persona {persona} / core memory {core} characters",
			trace_excluded: "Excluded preset; unchanged",
			trace_empty: "Empty text; original prompt preserved",
			sharedSilence: "The silence marker is shared with Chat & replies.",
			unsavedBar: "Unsaved changes: click Save to apply; leaving the page discards them",
			discardChanges: "Discard",
			diaryModel: "Diary model",
			diaryModelHint: "Diary and monthly summaries use the administrator-private model, falling back to the private model and then the dsh default. Configure the model under Chat & replies; set reasoning here, default high, when supported.",
			diaryModelFrom_admin: "From Chat & replies → Administrator private model.",
			diaryModelFrom_private: "Private chat model (no separate administrator model).",
			diaryModelFrom_default: "dsh's default model (no separate chat model configured).",
			diaryModelFrom_none: "dsh has no usable model yet.",
			apiKeySet: "Key is set.",
			apiKeyUnset: "No key yet.",
			embedFoldClose: "Hide embedding settings",
			embedFold: "Embedding: {provider} · {model} (click to change)",
			llmTestFailed: "Failed: {error}",
			llmTestOk: "OK: {model}, effort {effort}, {ms} ms, replied \"{text}\"",
			llmTest: "Test this model",
			effort_max: "Max",
			effort_high: "High",
			effort_medium: "Medium",
			effort_low: "Low",
			effort_minimal: "Minimal",
			effort_off: "Off",
			effortDefault: "model default",
			effortUnsupported: " (not supported)",
			effortPickModel: "Pick a model first.",
			effortNoneApi: "This provider has no adjustable reasoning (or it is unknown).",
			effortNone: "This model's reasoning cannot be adjusted.",
			effortHint: "Choose a reasoning effort supported by the target model. Higher effort typically increases latency and usage. Unsupported models use provider defaults; options depend on the selected model or service.",
			effort: "Reasoning effort",
			chatApiUrlHint: "OpenAI-compatible chat base URL, usually ending in /v1. The plugin appends /chat/completions; do not repeat the endpoint suffix.",
			apiModel: "Model",
			dshModelsFailed: "Could not read dsh models: {error}",
			dshModelPick: "Pick a model",
			dshModelHint: "Choose a model already configured in dsh Settings → Models, grouped by provider. Provider credentials are managed in dsh.",
			dshModel: "dsh model",
			followNone: "dsh has no default model yet",
			followUses: "Currently uses",
			sourceApi: "Another provider (your own key)",
			sourceDsh: "A model configured in dsh",
			followGraphNote: "Uses the organizing model and its reasoning effort.",
			followGraph: "Same as the organizing model",
			followMemory: "Follow dsh (dsh's default model)",
			followSummaryNote: "Uses the current session's model and reasoning effort.",
			followSummary: "Follow dsh (the session's own model)",
			langIsEn: "1",
			provider: "Provider",
			providerHint: "Select a provider preset to fill its base URL and common models. For a custom service, use an OpenAI-compatible API appropriate to the task, usually ending in /v1.",
			providerSearch: "Search providers",
			providerCustom: "Custom (OpenAI compatible)",
			providerGetKey: "Get a key ↗",
			pModelHint: "Fetch the model list with current or saved credentials. Presets and manual model IDs remain available if fetching fails. Listing a model does not guarantee account access.",
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
			summary: "QQ archives, group context, proactive chat, image generation and independent backups.",
			status: "Status",
			statusHint: "QQ archives and gateway data only. Persona, core memory and diaries belong to the separate Persona & Memory plugin.",
			dataDir: "Data directory: {dir}",
			snowlumaOn: "QQ connection module is ready: QQ sessions follow master / other private / group rules.",
			snowlumaOff: "QQ connection module unavailable: QQ classification and archives are unavailable.",
			archiveCount: "{total} archived messages (private {private}, group {group})",
			loading: "Loading…",
			loadFailed: "Failed to load: {error}",
			scope: "Scope",
			scopeHint: "Sessions are filtered by preset before persona, core memory, recall, and context management apply. Companion is allowed by default. Managed sessions created directly in dsh use master scope; bridge classifies QQ sessions.",
			pluginAccess: "Share with other plugins",
			pluginAccessHint: "Control access through this plugin's service API. All permits target-appropriate master access; public restricts calls to public scope; off rejects calls. This does not replace tool permissions inside sessions.",
			pluginAccessAll: "All (incl. master's)",
			pluginAccessPublic: "Public only",
			pluginAccessOff: "Off",
			personaPresets: "Presets it applies to",
			personaPresetsHint: "Preset IDs eligible for this plugin's persona, core memory, recall, and context management, default companion. Separate with spaces or commas. Asterisk or an empty list allows all, except explicitly excluded presets.",
			excludedPresets: "Excluded presets",
			excludedPresetsHint: "Preset IDs explicitly excluded, separated by spaces or commas. Exclusions override the allowed list; affected sessions retain their preset's persona, tools, and context behavior.",
			personaOnly: "Persona only",
			personaOnlyHint: "Remove the default Harness identity sentence when applying the custom persona. This does not override other persona plugins using complete-replacement mode; configure exclusions for such presets as needed.",
			persona: "Persona",
			personaHint: "After saving the persona, subsequent model requests in managed sessions use the latest text without a restart. Blank preserves the preset persona. Direct edits here bypass model self-edit review restrictions.",
			savePersona: "Save persona",
			selfEdit: "Let her edit her persona and core memory",
			selfEditHint: "Provide persona and core-memory editing tools only in managed master-scope sessions: administrator QQ private chats and sessions created directly in dsh. Other private and group chats do not receive these permissions.",
			personaGuardSec: "Persona edit limits",
			personaGuardHint: "Validate model self-edits for added length, total size, excessive deletion, and disallowed dates, long numbers, links, email addresses, credentials, or rule-changing content. Optional model review checks the allow/deny lists. Rejections return a reason; direct UI edits bypass this self-edit flow.",
			personaGuard: "Limit her persona edits",
			personaReview: "Model review before editing",
			personaReviewHint: "After hard-rule validation, use the memory-processing model to review persona changes against allow/deny lists. Failed or unparseable reviews reject the change.",
			personaEditMaxChars: "Max characters added per edit",
			personaMaxChars: "Max persona length (characters)",
			personaMaxCharsHint: "Total non-whitespace character limit for model persona self-edits, default 15000. Above the limit, edits may only shorten the text. Direct UI editing is outside this self-edit limit workflow.",
			personaAllowed: "Allowed (one per line)",
			personaForbidden: "Not allowed (one per line)",
			historyKeep: "History versions to keep",
			historyKeepHint: "History versions retained separately for persona, master core memory, and public core memory, default 5 each. Zero disables history retention without clearing current documents.",
			core: "Core memory",
			coreHint: "Key facts continuously included in model requests, outside ordinary long-term-memory forgetting. Master core memory is master-only; public core memory is available to groups and other private chats and should contain public information only.",
			coreMaster: "Master's core memory",
			corePublic: "Public core memory",
			saveCore: "Save",
			coreMasterMaxChars: "Master core memory limit (characters)",
			coreMasterMaxCharsHint: "Non-whitespace character limit for master core memory, default 5000. Checked for model edits and UI saves; over-limit content may only be shortened. This limit does not automatically track the persona limit.",
			corePublicMaxChars: "Public core memory limit (characters)",
			corePublicMaxCharsHint: "Non-whitespace character limit for public core memory, default 1500. Enforced for UI saves and model edits. This content is shared with applicable managed sessions; do not include master-private information.",
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
			contextHint: "Process the oldest rounds when round-count or context-usage conditions are met, using truncation or model summarization. The pre-compaction memory switch controls extraction first. Context-overflow errors trigger truncation and retry. A round starts with a real user message and includes subsequent replies.",
			thresholdPercent: "Handle at this % of the window",
			thresholdPercentHint: "Context-usage trigger from 10 to 95 percent, default 70. Processing starts at 70 percent of model capacity by default. The round limit also applies; the first reached condition triggers processing.",
			masterRow: "Master",
			privateRow: "Other private",
			groupRow: "Groups",
			maxRounds: "Max rounds",
			maxRoundsHint: "Maximum user rounds for this conversation category, default 60. Zero disables the round trigger; usage thresholds and overflow recovery still apply.",
			dropRounds: "Rounds per pass",
			mode: "Method",
			modeTruncate: "Truncate",
			modeLlm: "Summarize",
			modeDefault: "Default",
			summaryModel: "Compression model",
			summaryModelHint: "Model used to compress older conversation into a first-person recollection. Defaults to the current session model; a configured dsh model or external provider may be selected. Summarization adds model requests.",
			rules: "Exceptions",
			rulesHint: "Override archive retention, unwoken group archiving and proactive chat per QQ/group ID. Access and archive permission checks still apply.",
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
			archiveHint: "Store permitted QQ messages in the companion database, separate from dsh session logs. With allowlists enabled, unlisted groups are never archived, including administrator traffic; unlisted ordinary private chats are denied, administrator private chats are allowed. Expiry attempts extraction before deletion; removing an entry does not immediately erase history.",
			archiveEnabled: "Archive messages",
			archiveUnwokenAll: "Archive group messages that did not wake her",
			archiveUnwokenAllHint: "Archive group input that does not trigger a reply in groups permitted for archiving, enabled by default. Disabling stops those inputs and supplementary recent-group context. Group overrides may refine this setting but cannot admit unlisted groups.",
			archiveDaysMaster: "Master's private chat: days to keep",
			archiveDaysOthers: "Others and groups: days to keep",
			log: "Logging",
			logLevel: "Log level",
			logLevelHint: "Runtime verbosity, default info. Debug adds context-round, usage, and processing details for troubleshooting and may increase log volume.",
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
			memRecallHint: "Retrieve relevant visible long-term memories and attach them to each turn. Keyword search is the baseline; a configured embedding service adds semantic retrieval. Master scope can retrieve group memories; groups and other private chats cannot retrieve master-private memories.",
			recallEnabled: "Recall related memories",
			recallTopK: "Max per round (others, groups)",
			recallTopKHint: "Maximum automatic recalls per turn in other private and group chats, default 6. Zero attaches none. Groups search only their own and public memories; the actual count depends on eligible matches.",
			recallTopKMaster: "Max per round (master)",
			recallTopKMasterHint: "Maximum automatic recalls per master-scope turn, default 10. Master, public, and group memories are eligible, subject to visibility, thresholds, and ranking.",
			keywordThreshold: "Keyword threshold",
			keywordThresholdHint: "Admission threshold for keyword-only relevance, from 0 to 1, default 0.3. Higher values require stronger lexical matches and usually return fewer results.",
			vectorThreshold: "Vector threshold",
			vectorThresholdHint: "Combined relevance threshold for candidates with embeddings, from 0 to 1, default 0.45. The score combines keyword and vector relevance; candidates without vectors use the keyword threshold.",
			keywordWeight: "Keyword share",
			keywordWeightHint: "Keyword share of combined relevance, from 0 to 1, default 0.3; the remainder is vector similarity. Applies when both query and candidate embeddings are available.",
			importanceWeight: "Importance weight",
			recencyWeight: "Recency weight",
			groupDiscount: "Group discount",
			groupDiscountHint: "Relevance multiplier for group memories retrieved in master scope, from 0 to 1, default 0.7. Lower values reduce ranking priority without changing visibility permissions.",
			halfLifeDays: "Half-life (days)",
			halfLifeDaysHint: "Half-life for importance and recency scoring, default 30 days. Effective importance decays from the last recall or creation time; recalling updates that reference time. This does not directly delete memory.",
			invalidRatio: "Enter a number from 0 to 1",
			memGen: "Memory writing",
			memGenHint: "Use a model to extract lasting facts from unprocessed conversation. QQ extraction tracks progress to avoid reprocessing the same range. Requires an available processing model and adds model requests.",
			activeMemory: "Active memory",
			activeMemoryHint: "Provide recall, remember, and forget tools to eligible sessions for model-directed use. Scope and permissions still apply. Tool registration updates at session creation or plugin reload.",
			organizeEveryRounds: "Organize every N rounds",
			organizeEveryRoundsHint: "Automatically extract unprocessed memories after this many user rounds, default 20. Zero disables round-based extraction only; manual, expiry, and enabled pre-compaction extraction remain available.",
			organizeBeforeCompact: "Organize before truncating/summarizing",
			organizeBeforeCompactHint: "Attempt long-term-memory extraction before truncating or summarizing old context, enabled by default. This adds processing-model requests. Controls on Chat and Memory tabs edit the same setting.",
			memoryModel: "Organizing model",
			memoryModelHint: "Model for memory extraction, cleanup, consolidation, and persona-edit review. Defaults to the dsh default model, with configured dsh or external-provider alternatives. Diaries and monthly summaries use the administrator-private model instead.",
			currentModel: "Using: {model}",
			noModel: "No usable model; set one here or a dsh default model.",
			pending: "Not organized yet: {qs} QQ chats ({qm} messages), {ds} dsh sessions",
			organizeNow: "Organize now",
			organizing: "Organizing…",
			organizeStarted: "Started; refresh to see the result.",
			forget: "Forgetting",
			forgetHint: "Normal forgetting preserves text but excludes it from ordinary recall and can be reversed. Purge removes the text and retains a fingerprint to prevent identical reinsertion. Purged text cannot be restored through the restore action.",
			masterForget: "Master's memories",
			privateForget: "Others' private chats",
			groupForget: "Groups",
			forgetNormal: "Forget",
			forgetPurge: "Purge",
			cleanupEnabled: "Model cleanup of the master's memories",
			cleanupEnabledHint: "Enable model-assisted cleanup of normally forgotten master memories. Runs produce purge suggestions requiring confirmation by default; automatic purge occurs only if its separate switch is enabled.",
			cleanupAutoPurge: "Purge without asking",
			cleanupAutoPurgeHint: "Automatically purge entries selected by model cleanup without per-entry confirmation. Disabled by default and requires master-memory cleanup. Removed text cannot be directly restored.",
			runCleanup: "Run",
			running: "Running…",
			cleanupNone: "Nothing suggested.",
			cleanupResult: "{time}: {n} suggested for purging:",
			cleanupPurged: "purged",
			purgeSelected: "Purge selected",
			vector: "Vector search",
			vectorHint: "Generate memory embeddings with an OpenAI-compatible embeddings API for semantic retrieval. The default preset uses BAAI/bge-m3. No key disables embedding features. Model changes require a matching index rebuild; keyword retrieval remains available.",
			embedApiUrl: "API base URL",
			embedApiUrlHint: "OpenAI-compatible embedding base URL, usually ending in /v1. The plugin appends /embeddings; the service must support the selected model.",
			embedApiKey: "API key",
			embedApiKeyHint: "API key for the selected model service. Stored keys are not displayed; blank retains the saved value. Used for the corresponding service task and excluded from exported plugin backups.",
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
			graphStDisabled: "Off (the graph memory switch above is off)",
			indexModel: "{model}, {dim} dims",
			indexCount: "{embedded} / {total} embedded",
			indexProgress: "This run: {done} / {todo}",
			indexLastError: "Last error: {error}",
			indexErrors: "{n} skipped",
			indexTimes: "Started {start}, finished {end}",
			rebuild: "Rebuild",
			embedTest: "Test embedding API",
			embedTestOk: "Works: model {model}, {dim} dimensions, {ms} ms.",
			embedTestFailed: "Test failed: {error}",
			testing: "Testing…",
			testUsesSaved: "Uses the saved settings; save first.",
			tabsLabel: "Settings sections",
			tab_persona: "Persona",
			tab_chat: "Chat",
			tab_memory: "Memory",
			tab_diary: "Diary",
			tab_proactive: "Proactive",
			tab_backup: "Backup & logs",
			graphSec: "Graph memory",
			graphSecHint: "Extract entities and relations into an additional graph-retrieval path and merge its rankings with ordinary retrieval. Disabled by default. Enabling backfills existing non-diary memories and adds model requests. An embedding service may also vectorize entities; recall count limits still apply.",
			graphEnabled: "Graph memory",
			graphModel: "Graph extraction model",
			graphModelHint: "Model for extracting entities and relations. Defaults to the memory-processing model and its reasoning settings, with independent model or provider options. Extraction adds requests.",
			graphBatch: "Memories per call",
			graphHops: "Hops",
			graphHopsHint: "Number of relation hops from matched entities, from 0 to 2, default 1. Zero disables neighbor expansion. More hops broaden coverage but may include weaker associations.",
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
			memListOpen: "Show memories (browse, search, edit, forget, add)",
			memListClose: "Hide memories",
			memListHint: "View and manage long-term memories: add, edit, forget, purge, or restore. These actions affect memory data rather than original chat archives. Purged text cannot be directly restored.",
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
			groupCtxHint: "When group input enters the reply flow through a mention, quote, wake word, or prefix, attach recent prior archive messages from that group, including bot replies. Requires unwoken-message archiving. Images may be included; audio and video use bridge media settings. This context is separate from dsh conversation history.",
			groupContextCount: "Messages to include",
			groupContextCountHint: "Recent same-group archive messages attached to a normal reply, default 10, excluding the current input. Zero disables this addition. No history is attached without unwoken archiving or available records.",
			groupCtxOff: "\"Archive group messages that did not wake her\" is off, so this has no effect.",
			forgetMode: "Forgetting",
			proactive: "Proactive",
			proRuleOn: "On",
			proRuleOff: "Off",
			memStats: "Memories: {active} active, {forgotten} forgotten, {superseded} superseded, {tomb} fingerprints",
			diarySec: "Diary",
			diarySecHint: "Generate first-person daily diaries focused on master interactions and monthly overviews. Files are retained long-term, and diaries are also added to memory. New master sessions can receive recent entries under the settings below. Generation requires a model and adds requests.",
			diaryEnabled: "Write a daily diary",
			diaryTime: "At",
			diaryTimeHint: "Daily maintenance time in 24-hour HH:MM format, default 01:30 in this plugin's timezone. Includes enabled diary generation and archive expiry. Backups have a separate schedule.",
			dayBoundaryHour: "Day starts at (hour)",
			dayBoundaryHourHint: "Hour defining diary-day boundaries, from 0 to 12, default 4. Interactions before 04:00 belong to the previous logical day; original message timestamps are unchanged.",
			timezone: "Time zone",
			monthlyEnabled: "Monthly overview",
			diaryOnNewSession: "Read the diary when a master session starts",
			diaryDays: "Days of entries",
			overviewMonths: "Months of overviews",
			diaryBudgetPercent: "Max % of the context window",
			diaryBudgetPercentHint: "Context-capacity budget for diary and overview material attached to new sessions, from 1 to 60 percent, default 20. Older entries are shortened or omitted as needed; source files are not deleted.",
			diaryCount: "{days} entries, {months} overviews. Latest: {latest}",
			writeDiaryNow: "Write one now",
			diaryWritten: "Wrote the entry for {date}.",
			diaryNothing: "No chat with the master in that period; nothing written.",
			diaryPage: "Diary book",
			diaryPageHint: "View, edit, or delete dated diaries and monthly overviews, or import historical Markdown/text diaries. Import dates are detected from filenames or content; verify the resulting dates.",
			diaryEmpty: "No entries yet.",
			monthlyLabel: "Monthly overview",
			del: "Delete",
			delConfirm: "Delete this entry? (The copy in memory is kept.)",
			upload: "Upload diary files",
			uploadHint: "Select multiple Markdown or plain-text diary files. Each requires a recognizable date; verify imported content under the corresponding date.",
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
			expirySecHint: "Daily maintenance attempts extraction from unprocessed data, removes expired archives, and optionally rotates sessions with recent messages and archives old sessions. Expired non-master sessions may be deleted; old master sessions are never auto-deleted.",
			rotateSessions: "Start a new session when the retention period is used up",
			deleteOldSessions: "Delete others' old sessions after expiry",
			deleteOldSessionsHint: "Automatically delete expired old non-master private and group session files, enabled by default. When disabled, retain them as archived. Old master sessions are always retained.",
			carryMessages: "Messages carried into the new session",
			archiveImages: "Save received images",
			archiveImagesHint: "Download local image copies for messages permitted to be archived, avoiding expired QQ links. Files are stored in media/ and cleaned up with archive expiry. Unlisted groups and ordinary private chats do not trigger archive image downloads.",
			runExpiry: "Run expiry now",
			expiryDone: "Done: {deleted} messages deleted, {rotated} sessions renewed, {sessions} old sessions deleted, {media} images removed.",
			lastRun: "Last run: {time}",
			retired: "Retired sessions",
			retiredEmpty: "None yet.",
			retiredState: "{umo} · {cat} · last message {last} · {state}",
			stArchived: "archived",
			stDeleted: "deleted",
			stDeleteFailed: "delete failed: {note}",
			proSec: "Proactive chat",
			proSecHint: "Wake eligible conversations at randomized intervals. The normal model chooses whether to speak. Allowlists, quiet hours and activity rules apply; the persona plugin is optional.",
			proactiveEnabled: "Proactive chat",
			proactiveMinMinutes: "Master: min interval (min)",
			proactiveMaxMinutes: "Master: max interval (min)",
			proactiveOthersMinMinutes: "Others/groups: min interval (min)",
			proactiveOthersMaxMinutes: "Others/groups: max interval (min)",
			proIntervalHint: "Randomize the next proactive request between the minimum and maximum interval in minutes, each at least 10. Defaults: master 60–240, others/groups 120–240. The maximum should not be below the minimum.",
			proactivePrivate: "Also others' private chats",
			proactiveGroup: "Also groups",
			quietStart: "Quiet from",
			quietEnd: "Quiet until",
			quietHint: "Quiet hours for proactive chat in 24-hour HH:MM format, including overnight ranges. Default: 01:00–09:00 in this plugin's timezone. Incoming-message replies are unaffected.",
			proactiveRecentMinutes: "Skip if she spoke within (min)",
			proactiveGroupContext: "Group context messages",
			proactiveActiveDays: "Others/groups: active within (days)",
			proSilence: "Silence token",
			proSilenceHint: "Silence token specified in proactive prompts, default [不发]. Must match the bridge silence token. A matching model response suppresses that message without another judgment request.",
			proNoWake: "QQ wake API unavailable; proactive chat is inactive.",
			proListEmpty: "No chats to reach yet.",
			proItem: "{umo} · {cat} · next {next} · last {last}",
			proTry: "Try now",
			proTried: "Woken; she decides whether to speak.",
			never: "never",
			careSec: "Memory care",
			careSecHint: "Periodically clean up stale low-importance memories and optionally consolidate similar ones with a model. Forgetting follows category and override rules. Diaries are excluded from cleanup and consolidation; the latest consolidation can be undone.",
			autoCleanup: "Automatic cleanup",
			autoCleanupDays: "Not recalled for (days)",
			autoCleanupImportance: "Importance below",
			purgeForgotten: "Purge long-forgotten memories",
			purgeForgottenDays: "Forgotten for (days)",
			consolidateEnabled: "Periodic consolidation",
			consolidateOverlap: "Similarity threshold",
			consolidateOverlapHint: "Similarity threshold for consolidation grouping, from 0.2 to 0.95, default 0.5. Higher values require closer similarity for memories to share a group.",
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
			restoreSec: "Restore a backup",
			restoreSecHint: "Upload a plugin .tar.gz backup or choose an existing server backup. Files are verified before you select one or more categories. Current data changes only after confirmation; unselected categories stay unchanged.",
			restoreSelectAll: "Select all restore items",
			restoreSelectNone: "Clear selection",
			restoreFiles: "View detected files",
			restoreEmptyFiles: "No files in this category. Restoring an empty diary category clears current diaries.",
			restoreSharedDb: "Memory and master archives can share companion.db. Only tables belonging to selected categories are replaced; sharing a file does not restore unselected categories.",
			restoreSelection: "Will restore: {items}",
			restoreNothingSelected: "Select at least one category. Multiple selections are supported.",
			restoreVerified: "Verification passed: {count} data files detected.",
			restorePending: "Restoration has not been confirmed yet. Refresh to check the result; do not submit the same restore again.",
			backupSec: "Backup schedule & export",
			backupSecHint: "Export administrator-private QQ archives, dsh sessions and gateway settings. Credentials are excluded; keep at most five backups.",
			backupItemsLabel: "What to back up",
			backupItemsHint: "Back up administrator QQ archives, administrator private dsh sessions and QQ settings only. Use the persona plugin for persona and memory backups.",
			bi_persona: "Persona",
			bi_personaDesc: "Current persona (no history)",
			bi_core: "Core memory",
			bi_coreDesc: "Master and public (no history)",
			bi_diary: "Diary",
			bi_diaryDesc: "Daily entries and monthly summaries",
			bi_memory: "Memory database",
			bi_memoryDesc: "Long-term memories, vectors, graph, purge fingerprints, consolidations",
			bi_archiveMaster: "Master's archive",
			bi_archiveMasterDesc: "Your private chat with her, images, and dsh chats",
			bi_sessionsMaster: "Master's dsh sessions",
			bi_sessionsMasterDesc: "Raw master QQ private sessions, historical sessions and referenced attachments; resumes restored chat (off by default)",
			bi_settingsCompanion: "This plugin's settings",
			bi_settingsCompanionDesc: "Everything on this page (no embedding key)",
			bi_settingsBridge: "SnowLuma bridge settings",
			bi_settingsBridgeDesc: "Master QQ, allowlists, wake words, models, pacing (no token or STT key)",
			bi_settingsDsh: "Other dsh settings",
			bi_settingsDshDesc: "Other settings changed in the dsh web settings, e.g. default preset, models (no keys)",
			backupNotIncluded: "Backups exclude configuration credentials, QQ login data, runtime files, and raw sessions from other private chats, groups or the web. Persona and core memory contain current drafts only. Master sessions contain complete events and referenced attachments, which may contain sensitive chat content.",
			backupNoItems: "Nothing selected; the package would be empty.",
			restorePick: "Restore which (unchecked parts stay as they are):",
			restoreSettingsNote: "Checked settings are applied right away (keys and tokens untouched); settings not changed in the package go back to defaults.",
			importedItems: "Restored: {items}",
			backupEnabled: "Daily automatic backup",
			backupTime: "Backup time",
			backupKeep: "Total backups to keep",
			backupKeepHint: "Total retention across automatic, manual, and pre-import backups, default 5. After a new backup is successfully created, remove the oldest and keep the newest files. Failed creation does not trigger deletion.",
			exportNow: "Back up and download now",
			exported: "Backed up: {name}",
			download: "Download",
			importFile: "Upload and inspect a backup",
			chooseFile: "Choose a package…",
			importFileHint: "Select a companion-….tar.gz backup exported by this plugin. The package is validated and previewed before confirmed selected data is restored. A pre-import backup is created.",
			previewTitle: "The package contains:",
			previewLine: "plugin {plugin} · made {time} · {mem} memories · {days} entries · {months} overviews · {msgs} archived messages · {sessions} master sessions · {media} images · embedding {model}",
			previewSettings: "This plugin's settings in the package:",
			confirmImport: "Restore selected items (back up current data first)",
			cancelImport: "Don't import",
			importing: "Importing; the plugin reloads itself…",
			imported: "Imported ({time}).",
			importFailed: "Restore failed: {error}",
			backupList: "Backups",
			backupEmpty: "No backups yet.",
			backupItem: "{name} · {size} · {reason}",
			reasonAuto: "auto",
			reasonManual: "manual",
			reasonBefore: "pre-import",
			restoreThis: "Preview and select restore items",
			deleteBackup: "Delete",
			deleteBackupConfirm: "Delete this backup file?",
			selfCheck: "Post-migration self-check",
			selfCheckHint: "Run fixed queries against master-scope memory to verify retrieval after migration or import. Separate queries with spaces or commas. This checks retrieval rather than generating chat-model answers, and also runs after import.",
			selfCheckQueries: "Questions",
			runSelfCheck: "Run self-check",
			selfCheckMatches: "Found {n} candidate memories. These are source excerpts, not model-generated answers.",
			selfCheckMatchMeta: "Memory #{id} · retrieval relevance {score}",
			selfCheckExcerpt: "Showing up to the first 200 characters. Full records are available in Memory & archives.",
			selfCheckNone: "No candidate memory found; this does not establish that the fact is absent.",
			personaGuardHintField: "Master switch for persona self-edit validation, enabled by default. Disabling bypasses this validation workflow; direct UI edits already bypass it.",
			personaEditMaxCharsHint: "Maximum added non-whitespace characters per model persona edit, default 300, minimum 10. Limits net growth rather than equal-length replacement, when self-edit validation is enabled.",
			personaAllowedHint: "Allowed-content criteria for persona-edit review, one per line. Describe stable identity, personality, and expression; the reviewer considers both allow and deny lists.",
			personaForbiddenHint: "Disallowed-content criteria for persona-edit review, one per line. Constrains model self-edits, not long-term-memory management or direct UI edits.",
			archiveEnabledHint: "Master QQ-archive switch, enabled by default. Disabling stops new message and archive-image writes and affects archive-dependent context, extraction, and diary input. Existing data is not immediately deleted. This switch does not control protocol-message caches maintained by SnowLuma or the QQ client.",
			archiveDaysMasterHint: "Retention days for administrator QQ private-message archives, default 365, minimum 1. Maintenance handles expiry; master memories and diaries do not automatically expire with these messages.",
			archiveDaysOthersHint: "Default retention days for other private and group message archives, default 5, minimum 1. Per-peer rules can override it; bridge archive permission is still required.",
			recallEnabledHint: "Master switch for automatic long-term-memory recall, enabled by default. Disabling stops per-turn recall attachments; persona, core memory, and active-memory tools have separate controls.",
			importanceWeightHint: "Weight of effective importance in recall ranking, from 0 to 1, default 0.2. Higher values favor important memories without changing relevance admission thresholds.",
			recencyWeightHint: "Weight of recency in recall ranking, from 0 to 1, default 0.1. Higher values favor newer memories; recency decays according to the half-life setting.",
			embedBatchHint: "Memories per embedding request, from 1 to 64, default 16. Larger batches reduce request count but increase request size; respect the provider's batch limits.",
			graphEnabledHint: "Enable graph-memory extraction and retrieval, disabled by default. Requires a relation-extraction model; backfilling existing memories adds requests. Disabling does not mean existing graph data is deleted.",
			graphBatchHint: "Memories processed per relation-extraction batch, from 1 to 30, default 8. Larger batches increase input size; consider the model's context and output capacity.",
			masterForgetHint: "Default forgetting mode for master-scope memories, normally reversible forgetting. Purge may be selected. Message-archive expiry is separate from long-term-memory forgetting.",
			privateForgetHint: "Default forgetting mode for other private-chat memories, default purge. Purge removes text and retains a fingerprint; normal forgetting preserves text for restoration in the memory list.",
			groupForgetHint: "Default forgetting mode for group long-term memories, default purge, overridable per group. Does not control group-message archive retention days.",
			diaryEnabledHint: "Enable daily diary generation, on by default, requiring a diary model and master chat data. Disabling does not delete existing diaries or stop separate archive-expiry maintenance.",
			monthlyEnabledHint: "Enable monthly overviews from existing diaries, on by default. Generation runs within diary maintenance and requires diary generation and an available model.",
			timezoneHint: "IANA timezone for diaries, maintenance, backups, and proactive quiet hours, default Asia/Shanghai. Does not change the system clock or bridge's separate time-note setting.",
			diaryOnNewSessionHint: "Attach recent diaries and monthly overviews when a master session starts, enabled by default. Day/month ranges and the diary context budget limit the attachment.",
			diaryDaysHint: "Recent diary days eligible for new master sessions, default 30. Zero omits diaries. Older files are not deleted; attached material remains subject to the context budget.",
			overviewMonthsHint: "Recent overview months eligible for new master sessions, default 12. Zero omits overviews without changing file retention.",
			rotateSessionsHint: "Rotate sessions after their applicable archive-retention period and archive the old sessions, enabled by default. Recent messages can be carried over. Long-term memories and diaries are not deleted.",
			carryMessagesHint: "Recent messages carried into an automatically rotated session, default 10. Zero carries none. This provides continuity rather than migrating the entire old history.",
			proactiveEnabledHint: "Master proactive-chat switch, enabled by default. Only eligible QQ conversations passing allowlists, category switches, activity, and time conditions receive requests. The normal model decides whether to speak.",
			proactiveMinMinutesHint: "Minimum randomized interval for administrator-private proactive chat, in minutes, default 60, minimum 10. Used with the maximum and subject to recent-reply and quiet-hour conditions.",
			proactiveMaxMinutesHint: "Maximum randomized interval for administrator-private proactive chat, in minutes, default 240, minimum 10. Should not be below the minimum; quiet hours or recent replies can defer it further.",
			proactivePrivateHint: "Allow proactive non-administrator private chats, enabled by default. The peer must pass private allowlist and recent-activity conditions; the master proactive switch still applies.",
			proactiveGroupHint: "Allow proactive group chat, enabled by default. The group must pass its current allowlist and cannot inherit an earlier administrator exemption. Activity and quiet-hour conditions still apply.",
			proactiveRecentMinutesHint: "Suppress proactive requests after a recent bot reply in the same conversation, in minutes, default 30. Zero disables this recent-reply suppression.",
			proactiveGroupContextHint: "Recent same-group archive messages attached to proactive requests, default 15. Zero omits them. Media follows existing context conversion rules; other groups' records are excluded.",
			proactiveActiveDaysHint: "Recent-activity window in days for other private and group proactive chat, default 7, minimum 1. Administrator private chats do not use this activity-day filter.",
			autoCleanupHint: "Periodically process memories that are both stale and below the effective-importance threshold, enabled by default. Forgetting follows scope settings; diaries are excluded.",
			autoCleanupDaysHint: "No-recall age condition for automatic cleanup, in days, default 90, minimum 1. The effective-importance condition must also be met.",
			autoCleanupImportanceHint: "Effective-importance threshold for automatic cleanup, from 0 to 1, default 0.2. Used together with no-recall age; the score includes time decay.",
			careIntervalDaysHint: "Interval for automatic cleanup and consolidation in days, default 7, minimum 1. Checked by daily maintenance rather than run on every incoming message.",
			purgeForgottenHint: "Automatically purge memories that have remained normally forgotten beyond the configured age, disabled by default. Removes text while retaining content fingerprints.",
			purgeForgottenDaysHint: "Days before normally forgotten memories are automatically purged, default 180, minimum 1. Applies only when automatic purging is enabled.",
			consolidateEnabledHint: "Enable periodic model consolidation of similar memories, on by default. Originals are marked superseded, with undo information for the latest consolidation. Adds model requests.",
			consolidateGroupsHint: "Maximum candidate groups processed per care run, default 20, minimum 1. Bounds a run's size rather than the number of memories per group.",
			backupEnabledHint: "Enable scheduled daily backups, on by default, using the configured time, items, and retention. Manual backups remain available when disabled.",
			backupTimeHint: "Scheduled daily backup time in 24-hour HH:MM format, default 04:00 in this plugin's timezone. Configured separately from diary and archive maintenance.",
			selfCheckQueriesHint: "Master-memory queries used for migration checks, separated by spaces or commas. Verifies expected retrieval results without editing persona or conversation history.",
			dropRoundsHint: "Oldest user rounds processed per compaction pass, default 20, minimum 1. Uses the selected truncate or summarize mode while retaining necessary recent context.",
			modeHint: "Truncate removes old rounds from model context; summarize requests a recollection to replace them. Neither directly deletes archives, diaries, or long-term memories.",
			kindHint: "Target type for an override rule. QQ ID matches the private-chat peer; group ID matches the group.",
			targetHint: "Full QQ or group ID matching the selected rule type. Blank-target rules are ignored. Do not use a dsh session ID here.",
			archiveDaysHint: "Archive-retention override for this target, in days. Blank or zero inherits the category default. Maintenance handles expiry; the archive switch and bridge permissions still apply.",
			archiveUnwokenHint: "Override unwoken-message archiving for this group; blank inherits the global setting. Enabling it still requires the master archive switch and group archive permission.",
			forgetModeHint: "Override the target's long-term-memory forgetting mode; blank inherits its category. Normal forgetting preserves restorable text; purge removes text and retains a fingerprint.",
			proactiveHint: "Override proactive-chat participation for this target; blank inherits category defaults. Enabling cannot bypass the master switch, bridge allowlist, quiet hours, or other scheduling conditions.",
			noteHint: "Optional description of the rule's purpose. Does not affect matching or permissions.",
		};

		var CSS = [
            ".sc-image-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 14px;flex-wrap:wrap}",
            ".sc-image-service{display:flex;gap:8px;align-items:center;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px}",
            ".sc-image-service strong{color:var(--dsw-alias-label-primary);font-size:13px;overflow-wrap:anywhere}",
            ".sc-image-badge{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l3);border-radius:999px;padding:4px 9px;font-size:11px;color:var(--dsw-alias-label-secondary)}",
            ".sc-image-tabs{display:flex;gap:4px;padding:4px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);margin-bottom:20px}",
            ".sc-image-tabs button{flex:1;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:9px 12px;cursor:pointer}",
            ".sc-image-tabs button[aria-selected=true]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 4px #00000012;font-weight:600}",
            ".sc-image-stack{display:grid;gap:18px;min-width:0}.sc-image-stack[hidden]{display:none}",
            ".sc-image-card{border:1px solid var(--dsw-alias-border-l3);border-radius:14px;padding:16px;min-width:0}",
            ".sc-image-card h4{font-size:13px;margin:0 0 6px;color:var(--dsw-alias-label-primary)}",
            ".sc-image-card>.compc-hint{margin:0 0 14px}.sc-image-card .compc-select{width:100%}",
            ".sc-image-fields{display:grid;gap:16px}.sc-image-fields>.compc-grid{align-items:start}",
            ".sc-image-fold>summary{cursor:pointer;display:flex;justify-content:space-between;align-items:center;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;list-style:none}",
            ".sc-image-fold>summary:after{content:'\uff0b';color:var(--dsw-alias-label-tertiary)}.sc-image-fold[open]>summary:after{content:'\u2212'}",
            ".sc-image-fold[open]>.sc-image-fields{margin-top:16px}.sc-image-fold .compc-textarea{font-family:ui-monospace,monospace;font-size:12px;min-height:170px}",
            ".sc-image-primary{border:0;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 16px;font:inherit;font-size:13px;cursor:pointer}",
            ".sc-image-primary:disabled{opacity:.4;cursor:default}.sc-image-prompt{min-height:130px!important;resize:vertical}",
            ".sc-image-note{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary);margin:0}",
            ".sc-image-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}",
            ".sc-image-result{display:grid;gap:12px}.sc-image-result-head{display:flex;align-items:center;justify-content:space-between;gap:12px}",
            ".sc-image-result-head h4{margin:0}.sc-image-result-head a{font-size:12px;color:var(--dsw-alias-label-secondary)}",
            ".sc-image-canvas{display:flex;align-items:center;justify-content:center;min-height:240px;max-height:440px;overflow:hidden;border:1px dashed var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);border-radius:12px}",
            ".sc-image-canvas img{display:block;max-width:100%;max-height:440px;width:auto;height:auto;object-fit:contain}",
            ".sc-image-empty{text-align:center;max-width:290px;padding:24px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.7}.sc-image-empty strong{display:block;color:var(--dsw-alias-label-secondary);font-size:13px;margin:8px 0}",
            ".sc-image-empty-icon{display:inline-flex;width:42px;height:42px;align-items:center;justify-content:center;font-size:24px;border:1px solid var(--dsw-alias-border-l3);border-radius:12px}",
            ".sc-image-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}",
            ".sc-image-gallery button{padding:3px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;aspect-ratio:1;min-width:0;overflow:hidden}",
            ".sc-image-gallery button[aria-pressed=true]{border:2px solid var(--dsw-alias-label-primary);padding:2px}",
            ".sc-image-gallery img{width:100%;height:100%;object-fit:contain;border-radius:6px}.sc-image-meta{font-size:11px;color:var(--dsw-alias-label-tertiary)}",
            ".sc-image-message{font-size:12px;line-height:1.6;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);overflow-wrap:anywhere}",
            ".sc-image-message[data-tone=error]{border-left:3px solid #d85959}.sc-image-message[data-tone=ok]{border-left:3px solid #39906d}",
            ".sc-image-progress{width:100%;height:4px;accent-color:var(--dsw-alias-label-secondary)}",
            "@media(max-width:520px){.sc-image-card{padding:12px}.sc-image-fields .compc-grid{grid-template-columns:1fr}.sc-image-canvas{min-height:190px;max-height:320px}.sc-image-canvas img{max-height:320px}.sc-image-tabs button{padding:9px 6px}}",

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
			".compc-testBtn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-label-primary);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;cursor:pointer}",
			".compc-testBtn:hover:not(:disabled){background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff))}",
			".compc-testBtn:disabled{opacity:.55;cursor:default}",
			".compc-testBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:2px}",
			".compc-testIcon{font-size:14px;line-height:1}",
			".compc-pCurrent{display:inline-flex;align-items:center;gap:10px;min-width:220px;max-width:100%;height:38px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}",
			".compc-pCurrent:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".compc-pCurrent .compc-pName{flex:1;text-align:left}",
			".compc-pCaret{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".compc-pIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:6px;object-fit:contain}",
			".compc-pIconMono{background-color:var(--dsw-alias-label-primary);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}",
			".compc-pIconText{background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.18));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));font-size:12px;font-weight:600}",
			".compc-pPanel{display:grid;gap:10px;margin-top:4px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1,transparent)}",
			".compc-pSearch{width:100%;box-sizing:border-box}",
			".compc-pGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}",
			".compc-pCard{display:flex;align-items:center;gap:10px;min-width:0;height:46px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}",
			".compc-pCard:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-color:var(--dsw-alias-label-tertiary)}",
			".compc-pCard.compc-pOn{border-color:var(--dsw-alias-label-primary);font-weight:600}",
			".compc-pCard .compc-pName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".compc-pCard:focus-visible,.compc-pCurrent:focus-visible,.compc-pBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".compc-pModel{min-width:240px;max-width:100%;flex:1 1 240px}",
			".compc-pBtn{height:35px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}",
			".compc-pBtn:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".compc-pBtn:disabled{opacity:.55;cursor:default}",
			".compc-link{text-decoration:underline;text-underline-offset:2px}",
			"@media (max-width:520px){.compc-pCurrent{width:100%}.compc-pGrid{grid-template-columns:1fr 1fr}}",
			".compc-llm{gap:10px}",
			".compc-saveBar{position:sticky;bottom:12px;z-index:5;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:16px;padding:10px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#1e1e1e));box-shadow:0 4px 18px rgba(0,0,0,.25);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}",
			".compc-saveBtns{display:flex;gap:8px}",
			".compc-pill{display:inline-block;margin:0;padding:6px 10px;border-radius:8px;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".compc-pill.compc-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 14%,transparent)}",
			".compc-pill.compc-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e03131) 14%,transparent)}",
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
			".compc-checkGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}",
			".compc-checkItem{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px);cursor:pointer;min-width:0}",
			".compc-checkItem.compc-on{border-color:var(--dsw-alias-label-tertiary)}",
			".compc-checkItem input{margin:3px 0 0;flex:none;width:15px;height:15px;accent-color:var(--dsw-alias-label-primary)}",
			".compc-checkItem:focus-within{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".compc-checkText{display:grid;gap:2px;min-width:0}",
			".compc-checkTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1.5}",
			".compc-checkDesc{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5;overflow-wrap:anywhere}",
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

		var LOG_LEVELS = ["debug", "info", "warn", "error"];
		var BOOLS = ["imageGenEnabled","imageGenPrivate","imageGenGroup","archiveEnabled","archiveUnwoken","rotateSessions","deleteOldSessions","archiveImages","proactiveEnabled","proactivePrivate","proactiveGroup","backupEnabled"];
		var TEXTS = ["imageGenApiUrl","imageGenModel","imageGenOptions","imageGenCommand","timezone","quietStart","quietEnd","silenceToken","backupTime"];
		var SECRETS = ["imageGenApiKey"];
		var FLOATS = [];

		var LISTS = ["backupItems"];
		/** 一行一条 */
		var LINE_LISTS = [];
		var INTS = [["imageGenTimeoutSeconds",10,1800],["imageGenMaxImages",1,4],["imageGenMaxMB",1,50],["imageGenKeepDays",1,365],["archiveDaysMaster", 1],["archiveDaysOthers", 1],["groupContextCount", 0],["carryMessages", 0],["proactiveMinMinutes", 10],["proactiveMaxMinutes", 10],["proactiveOthersMinMinutes", 10],["proactiveOthersMaxMinutes", 10],["proactiveRecentMinutes", 0],["proactiveGroupContext", 0],["proactiveActiveDays", 1],["backupKeep", 1, 5]];
		var ENUMS = [["imageGenProvider", ["openai", "azure", "modelscope", "dashscope", "gemini", "imagen", "vertex", "openrouter", "bfl", "fal", "replicate", "stability", "ideogram", "huggingface", "a1111", "comfyui", "custom", "command"]]];
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
		function createForm(scope, sharedForm) {
			var specs = INTS.map(function (x) { return intField(x[0], x[1], x[2] === void 0 ? Number.MAX_SAFE_INTEGER : x[2]); })
				.concat(ENUMS.map(function (x) { return enumField(x[0], x[1]); }), LISTS.map(listField), LINE_LISTS.map(lineListField), BOOLS.map(boolField),
					TEXTS.map(function (f) { return P.settingsTextField(f); }), FLOATS.map(floatField), [rulesField("qqRules")]);
			var secrets = SECRETS.map(function (field) {
				return { field: field, write: function (text) { return scope.mutate([{ op: "set", path: [field], value: text }]); } };
			});
			var form = sharedForm || new P.SettingsFormModel(scope, specs, secrets);
			var all = INTS.map(function (x) { return x[0]; }).concat(ENUMS.map(function (x) { return x[0]; }), LISTS, LINE_LISTS, BOOLS, TEXTS, FLOATS, SECRETS, ["qqRules"]);
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
				specs: specs, secrets: secrets,
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
			var Layout = require("dsh-qq-gateway/ui-layout");
			return h(Layout.Section, props, props.children);
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
		function apiUrl(path) { return new URL("api/qq-gateway/" + path, document.baseURI).href; }
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






		//#endregion

		//#region 例外规则表
		function RulesEditor(props) {
			var t = props.t;
			var rows;
			try { rows = JSON.parse(props.state.qqRules.text || "[]"); } catch (e) { rows = []; }
			if (!Array.isArray(rows)) rows = [];
			function write(next) { props.edit("qqRules", JSON.stringify(next)); }
			function set(i, key, value) {
				var next = rows.map(function (r, j) { return j === i ? Object.assign({}, r, { [key]: value }) : r; });
				write(next);
			}
			function num(i, key) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, h(Label, { text: t(key), hint: t(key + "Hint") })),
					h("input", { className: "compc-input", inputMode: "numeric", value: rows[i][key] === void 0 ? "" : String(rows[i][key]), placeholder: t("modeDefault"), disabled: props.disabled,
						onChange: function (e) { var v = e.target.value.trim(); set(i, key, v === "" ? void 0 : Number(v)); } }));
			}
			function sel(i, key, options) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, h(Label, { text: t(key), hint: t(key + "Hint") })),
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
								h("span", { className: "compc-hint" }, h(Label, { text: t("target"), hint: t("targetHint") })),
								h("input", { className: "compc-input", inputMode: "numeric", value: r.target || "", disabled: props.disabled, onChange: function (e) { set(i, "target", e.target.value.trim()); } })),
							null, null,
							null,
							num(i, "archiveDays"),
							r.kind === "group" ? sel(i, "archiveUnwoken", [["", t("modeDefault")], ["on", t("unwokenOn")], ["off", t("unwokenOff")]]) : null,
							null,
							sel(i, "proactive", [["", t("modeDefault")], ["on", t("proRuleOn")], ["off", t("proRuleOff")]]),
							h("label", { className: "compc-field" },
								h("span", { className: "compc-hint" }, h(Label, { text: t("note"), hint: t("noteHint") })),
								h("input", { className: "compc-input", value: r.note || "", disabled: props.disabled, onChange: function (e) { set(i, "note", e.target.value); } }))),
						h("div", { className: "compc-row" },
							h(P.Button, { size: "sm", disabled: props.disabled, onClick: function () { write(rows.filter(function (_r, j) { return j !== i; })); } }, t("removeRule"))));
				}),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: props.disabled, onClick: function () { write(rows.concat([{ kind: "group", target: "" }])); } }, t("addRule"))));
		}
		//#endregion

		//#region 记忆：整理、清理、向量索引、记忆列表

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





		/** 向量接口的「测试」（用保存过的设置算一句话的向量）。 */











		//#endregion

		//#region 日记、存档到期




		/** 和服务端一样的认日期规则（上传前预览用）。 */




		function ExpiryPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data) return null;
			var last = data.maintenance;
			var names = { archived: "stArchived", deleted: "stDeleted", failed: "stDeleteFailed" };
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




		function sizeText(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

		var BACKUP_ITEMS = ["archiveMaster", "sessionsMaster", "settingsBridge"];
				/** 一组勾选框：每项一个标题和一句说明 */
		function ItemChecks(props) {
			var t = props.t;
			return h("div", { className: "compc-checkGrid", role: "group", "aria-label": props.label },
				props.ids.map(function (id) {
					var on = props.value.indexOf(id) >= 0;
					return h("label", { key: id, "data-item": id, className: "compc-checkItem" + (on ? " compc-on" : "") },
						h("input", { type: "checkbox", checked: on, disabled: props.disabled, onChange: function (e) {
							var next = props.ids.filter(function (x) { return x === id ? e.target.checked : props.value.indexOf(x) >= 0; });
							props.onChange(next);
						} }),
						h("span", { className: "compc-checkText" },
							h("span", { className: "compc-checkTitle" }, t("bi_" + id)),
							h("span", { className: "compc-checkDesc" }, t("bi_" + id + "Desc"))));
				}));
		}
		/** 设置里的「备份哪些内容」 */
		function backupItemsOf(state) {
			var text = state.backupItems ? state.backupItems.text : "";
			return text.split(/[\s,，]+/).map(function (x) { return x === "archiveOthers" ? "sessionsMaster" : x; }).filter(function (x) { return BACKUP_ITEMS.indexOf(x) >= 0; });
		}
		function BackupItemsField(props) {
			var t = props.t;
			var value = backupItemsOf(props.state);
			return h("div", { className: "compc-field" },
				h("span", { className: "compc-label" }, h(Label, { text: t("backupItemsLabel"), hint: t("backupItemsHint") })),
				h(ItemChecks, { t: t, ids: BACKUP_ITEMS, value: value, label: t("backupItemsLabel"), disabled: props.disabled, onChange: function (next) { props.edit("backupItems", next.join(" ")); } }),
				value.length === 0 ? h("p", { className: "compc-result compc-warn" }, t("backupNoItems")) : null,
				h("p", { className: "compc-hint" }, t("backupNotIncluded")));
		}
		/** Confirm explicit categories after the server validates every payload file. */
		function RestoreChoice(props) {
			var t = props.t, contents = props.contents;
			var have = contents.map(function (entry) { return entry.item; });
			var [picked, setPicked] = React.useState([]);
			var hasSettings = picked.some(function (x) { return x.indexOf("settings") === 0; });
			return h("div", { className: "compc-field compc-restore-choice" },
				h("p", { className: "compc-label" }, t("restorePick")),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: props.busy, onClick: function () { setPicked(have); } }, t("restoreSelectAll")),
					h(P.Button, { size: "sm", disabled: props.busy || !picked.length, onClick: function () { setPicked([]); } }, t("restoreSelectNone"))),
				h(ItemChecks, { t: t, ids: have, value: picked, label: t("restorePick"), disabled: props.busy, onChange: setPicked }),
				h("details", { className: "compc-details compc-restore-files" },
					h("summary", null, t("restoreFiles")),
					contents.map(function (entry) {
						return h("div", { key: entry.item, className: "compc-card" },
							h("strong", null, t("bi_" + entry.item)),
							entry.files.length ? h("ul", null, entry.files.map(function (f) { return h("li", { key: f.path }, h("code", null, f.path), " · " + sizeText(f.size)); })) : h("p", { className: "compc-hint" }, t("restoreEmptyFiles")));
					})),
				h("p", { className: "compc-hint" }, t("restoreSharedDb")),
				hasSettings ? h("p", { className: "compc-hint" }, t("restoreSettingsNote")) : null,
				h("p", { className: "compc-result", role: "status" }, picked.length ? t("restoreSelection", { items: picked.map(function (id) { return t("bi_" + id); }).join("、") }) : t("restoreNothingSelected")),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: props.busy || picked.length === 0, onClick: function () { props.onConfirm(picked); } }, t("confirmImport")),
					h(P.Button, { size: "sm", disabled: props.busy, onClick: props.onCancel }, t("cancelImport"))));
		}

		function BackupExport(props) {
			var act = useAction(), t = props.t;
			return h("div", { className: "compc-field" },
				h(P.Button, { size: "sm", disabled: act.busy || !props.items.length, onClick: function () {
					act.run(function () { return api("POST", "backup/create", { items: props.items }).then(function (r) {
						props.onState(r.state); act.setMsg({ tone: "ok", text: t("exported", { name: r.name }) });
						var a = document.createElement("a"); a.href = apiUrl("backup/file/" + encodeURIComponent(r.name)); a.download = r.name; document.body.appendChild(a); a.click(); a.remove();
					}); });
				} }, act.busy ? t("running") : t("exportNow")),
				h(Status, { msg: act.msg }));
		}

		function BackupPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			var [asking, setAsking] = React.useState(null);
			var [waiting, setWaiting] = React.useState(false);
			var inputRef = React.useRef(null);
			var pollRef = React.useRef(null);
			React.useEffect(function () { return function () { clearInterval(pollRef.current); }; }, []);
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
			function confirmImport(id, items) {
				var before = data.lastImport ? data.lastImport.at : 0;
				act.run(function () {
					return api("POST", "backup/confirm", { id: id, items: items }).then(function () {
						setWaiting(true);
						var tries = 0;
						var timer = pollRef.current = setInterval(function () {
							tries += 1;
							api("GET", "state").then(function (st) {
								if (st.lastImport && st.lastImport.at !== before) { clearInterval(timer); setWaiting(false); props.onState(st); }
							}, function () {});
							if (tries > 60) { clearInterval(timer); setWaiting(false); act.setMsg({ tone: "warn", text: t("restorePending") }); }
						}, 1000);
					});
				});
			}
			var pend = data.importing;
			var m = pend && pend.manifest;
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-field" },
					h("span", { className: "compc-label" }, h(Label, { text: t("importFile"), hint: t("importFileHint") })),
					h("input", { ref: inputRef, type: "file", "aria-label": t("importFile"), accept: ".tar.gz,.tgz,application/gzip", hidden: true, onChange: upload }),
					h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: act.busy || waiting, onClick: function () { if (inputRef.current) inputRef.current.click(); } }, t("chooseFile")))),
				waiting ? h("p", { className: "compc-result compc-warn", role: "status" }, t("importing")) : null,
				h(Status, { msg: act.msg }),
				data.lastImport ? h("p", { className: "compc-result " + (data.lastImport.error ? "compc-error" : "compc-ok") }, data.lastImport.error ? t("importFailed", { error: data.lastImport.error }) : t("imported", { time: fmtTime(data.lastImport.at) })) : null,
				data.lastImport && !data.lastImport.error && data.lastImport.plan ? h("p", { className: "compc-hint" },
					t("importedItems", { items: data.lastImport.plan.items.map(function (x) { return t("bi_" + x); }).join("、") }) + ((data.lastImport.plan.notes || []).length ? "；" + data.lastImport.plan.notes.join("；") : "")) : null,
				m ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-label" }, t("previewTitle")),
					h("p", { className: "compc-hint" }, t("restoreVerified", { count: m.files.length })),
					h("p", { className: "compc-hint" }, t("previewLine", { plugin: m.plugin, time: fmtTime(m.createdAt), mem: m.counts.memories, days: m.counts.diaryDays, months: m.counts.months, msgs: m.counts.archiveMessages, sessions: m.counts.masterSessions || 0, media: m.counts.media, model: (m.embed && m.embed.model) || "—" })),
					m.settings && Object.keys(m.settings).length > 0 ? h("details", { className: "compc-details" },
						h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("previewSettings")),
						h("div", { className: "compc-detailsBody" }, h("pre", { className: "compc-pre" }, JSON.stringify(m.settings, null, 2)))) : null,
					h(RestoreChoice, { key: pend.id, t: t, contents: pend.contents, busy: act.busy || waiting, onConfirm: function (items) { confirmImport(pend.id, items); },
						onCancel: function () { act.run(function () { return api("POST", "backup/cancel", {}).then(props.onState); }); } })) : null,
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


		//#endregion

		//#region 页面


		//#region 服务商预设（地址、常用模型、logo）和模型列表
		// logo 来自 LobeHub 的 lobe-icons（MIT，见 NOTICE.md），以 data: 图片内嵌，不从外网加载；商标归各厂商所有。
		// 单色的 logo 用 CSS 遮罩染成文字颜色，深色、浅色主题都看得清。






		/** 选服务商：点开后是带搜索的格子，选一家就填好接口地址（模型不在这家的常用列表里时换成第一个） */

		/** 模型：下拉里是拉到的模型（拉不到就用这家的常用模型），也能手动填 */

		// 压缩 / 整理 / 抽关系用别家模型时的服务商（OpenAI 兼容的 /chat/completions）

		/** 别家的思考开关写法（和服务端 chat.ts 的 THINK_STYLES 一致），决定能选哪些等级 */




		/** 思考等级下拉（options：[{ id, name }]；没有可选的就说明一句） */

		/** dsh 里配置的模型（按服务商分组），加上这个模型的思考等级 */

		/** 写日记用的模型：就是和主人私聊用的那个（只显示，不在这里改），思考等级单独选 */

		/** 一个任务（压缩 / 整理 / 抽关系）用哪个模型 */

		//#endregion


		function Secret(props) {
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
		function Lines(props) {
			var t = props.t, field = props.state[props.field];
			return h("div", { className: "compc-field" },
				h("label", { className: "compc-label", htmlFor: "companion-core-" + props.field }, h(Label, { text: props.label, hint: props.hint })),
				h("textarea", { id: "companion-core-" + props.field, className: "compc-textarea compc-small", value: field.text, disabled: props.disabled, onChange: function (e) { props.edit(props.field, e.target.value); } }),
				field.overridden ? h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: function () { props.resetField(props.field); } }, t("reset"))) : null);
		}
        function ImageGeneration(props) {
          var t = props.t, [catalog, setCatalog] = React.useState({ providers: {}, images: [] });
          var [prompt, setPrompt] = React.useState(""), [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState(null);
          var [tab, setTab] = React.useState("connection"), [selected, setSelected] = React.useState(null), [seconds, setSeconds] = React.useState(0);
          var controller = React.useRef(null);
          function refresh() { return api("GET", "images").then(setCatalog, e => setMessage({tone:"error",text:e.message})); }
          React.useEffect(() => { refresh(); return () => { if (controller.current) controller.current.abort(); }; }, []);
          React.useEffect(() => { if (!busy) return; setSeconds(0); var started=Date.now(), timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer); }, [busy]);
          function generate() {
            var abort = new AbortController(); controller.current = abort; setBusy(true); setMessage(null);
            fetch(apiUrl("images/generate"), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: prompt, count: 1 }), signal: abort.signal })
              .then(async response => { var result = await response.json(); if (!response.ok) throw new Error(result.error || "HTTP " + response.status);setSelected(result.images[0]?.id || null);setMessage({tone:result.warning?"error":"ok",text:result.warning || t("imageGenSuccess")}); await refresh(); })
              .catch(e => setMessage({tone:e.name === "AbortError"?"warn":"error",text:e.name === "AbortError" ? t("imageGenCanceled") : e.message}))
              .finally(() => { controller.current = null; setBusy(false); });
          }
          var provider = props.state.imageGenProvider.text || "modelscope", preset=catalog.providers[provider];
          var enabled=props.state.imageGenEnabled.text === "true", current=catalog.images.find(i=>i.id===selected)||catalog.images[0];
          var local=provider === "command", needsKey=!["command","comfyui","a1111","custom"].includes(provider);
          function choose(event) {
            var id = event.target.value, preset = catalog.providers[id]; props.edit("imageGenProvider", id);
            if (preset) { props.edit("imageGenApiUrl", preset[1]); props.edit("imageGenModel", preset[2]); }
            props.edit("imageGenOptions", "{}");
          }
          function field(name, hint, numeric) { return h(Value, Object.assign({field:name,label:t(name),hint:t(hint||name+"Hint"),numeric:!!numeric},props)); }
          function fold(title, body) {return h("details",{className:"sc-image-card sc-image-fold",name:"snowluma-image-options"},h("summary",null,title),h("div",{className:"sc-image-fields"},body));}
          return h(Section, { sectionId: "companion-image-generation", category: "media", title: t("imageGenTitle"), hint: t("imageGenConfigHint") },
            h("div",{className:"sc-image-top"},h("div",{className:"sc-image-service"},h("span",null,t("imageGenActiveService")),h("strong",null,preset?preset[0]:provider)),
              h("span",{className:"sc-image-badge"},!enabled?t("imageGenOff"):needsKey&&!props.state.secretSet?.imageGenApiKey?t("imageGenNoKey"):t("imageGenReady"))),
            h(Toggle, Object.assign({ field: "imageGenEnabled", label: t("imageGenEnabled"),hint:t("imageGenHint") }, props)),
            h("div",{className:"sc-image-tabs",role:"tablist","aria-label":t("imageGenTitle")},[["connection","imageGenConnection"],["studio","imageGenStudio"]].map(([id,key])=>h("button",{key:id,type:"button",role:"tab",id:"image-gen-tab-"+id,"aria-controls":"image-gen-panel-"+id,"aria-selected":tab===id,onClick:()=>setTab(id)},t(key)))),
            h("div",{id:"image-gen-panel-connection",role:"tabpanel","aria-labelledby":"image-gen-tab-connection",className:"sc-image-stack",hidden:tab!=="connection"},
              h("div",{className:"sc-image-card sc-image-fields"},
                h("div",{className:"compc-field"},h("label",{className:"compc-label",htmlFor:"image-gen-provider"},t("imageGenProvider")),h("select",{id:"image-gen-provider",className:"compc-select",value:provider,disabled:props.disabled,onChange:choose},
                  [false,true].map(isLocal=>h("optgroup",{key:String(isLocal),label:t(isLocal?"imageGenProviderLocal":"imageGenProviderCloud")},Object.entries(catalog.providers).filter(([id])=>["command","comfyui","a1111","custom"].includes(id)===isLocal).map(([id,p])=>h("option",{key:id,value:id},p[0])))))),
                !local?field("imageGenApiUrl"):null, field("imageGenModel"),
                h(Secret,Object.assign({field:"imageGenApiKey",label:t("imageGenApiKey"),hint:t("imageGenKeyHint"),setLabel:t("apiKeySet"),unsetLabel:t("apiKeyUnset")},props)),
                local?h(Lines,Object.assign({field:"imageGenCommand",label:t("imageGenCommand"),hint:t("imageGenCommandHint")},props)):null),
              fold(t("imageGenAccess"),h(React.Fragment,null,h("p",{className:"sc-image-note"},t("imageGenAccessHint")),h("span",{className:"sc-image-badge"},t("imageGenOwnerAccess")),
                h(Toggle,Object.assign({field:"imageGenPrivate",label:t("imageGenPrivate"),hint:t("imageGenPrivateHint")},props)),h(Toggle,Object.assign({field:"imageGenGroup",label:t("imageGenGroup"),hint:t("imageGenGroupHint")},props)))),
              fold(t("imageGenLimits"),h("div",{className:"compc-grid"},["imageGenTimeoutSeconds","imageGenMaxImages","imageGenMaxMB","imageGenKeepDays"].map(name=>h(React.Fragment,{key:name},field(name,name==="imageGenKeepDays"?"imageGenKeepHint":"imageGenLimitsHint",true))))),
              fold(t("imageGenAdvanced"),h(React.Fragment,null,h("p",{className:"sc-image-note"},t("imageGenAdvancedHint")),h(Lines,Object.assign({field:"imageGenOptions",label:t("imageGenOptions"),hint:t("imageGenOptionsHint")},props)),h("a",{className:"sc-image-meta",href:"https://github.com/Geng-zy/dsh-snowluma-companion/blob/main/docs/IMAGE-GENERATION.md",target:"_blank",rel:"noreferrer"},t("imageGenDocs"))))),
            h("div",{id:"image-gen-panel-studio",role:"tabpanel","aria-labelledby":"image-gen-tab-studio",className:"sc-image-stack",hidden:tab!=="studio"},
              h("div",{className:"sc-image-card"},h("label",{className:"compc-label",htmlFor:"image-gen-prompt"},t("imageGenPrompt")),
                h("textarea",{id:"image-gen-prompt",className:"compc-textarea sc-image-prompt",value:prompt,placeholder:t("imageGenPromptPlaceholder"),disabled:busy||props.disabled,maxLength:12000,onChange:e=>setPrompt(e.target.value)}),
                h("div",{className:"sc-image-actions"},h("button",{type:"button",className:"sc-image-primary",disabled:busy||props.disabled||!prompt.trim()||props.state.dirty||!enabled,onClick:generate},t("imageGenGenerate")),
                  busy?h(P.Button,{onClick:()=>controller.current&&controller.current.abort()},t("imageGenCancel")):null,h("span",{className:"sc-image-meta"},busy?t("imageGenWaiting",{seconds:seconds}):t("imageGenSavedShort"))),
                h("p",{className:"sc-image-note",style:{marginTop:"10px"}},props.state.dirty?t("imageGenDraftNotice"):t("imageGenQuotaNotice")),
                busy?h("progress",{className:"sc-image-progress","aria-label":t("imageGenWorking")}):null,
                message?h("div",{className:"sc-image-message","data-tone":message.tone,role:"status"},message.text):null),
              h("div",{className:"sc-image-card sc-image-result"},h("div",{className:"sc-image-result-head"},h("h4",null,t("imageGenResults")),current?h("a",{href:apiUrl("images/"+current.id),target:"_blank",rel:"noreferrer"},t("imageGenOpenImage")):null),
                h("div",{className:"sc-image-canvas"},current?h("img",{src:apiUrl("images/"+current.id),alt:t("imageGenResults")}):h("div",{className:"sc-image-empty"},h("span",{className:"sc-image-empty-icon","aria-hidden":true},"▧"),h("strong",null,t("imageGenResultEmpty")),t("imageGenResultEmptyHint"))),
                current?h("span",{className:"sc-image-meta"},new Date(current.createdAt).toLocaleString()+" · "+(current.bytes/1024/1024).toFixed(2)+" MB"):null),
              h("div",{className:"sc-image-result-head"},h("h4",null,t("imageGenHistory")),h(P.Button,{disabled:busy,onClick:refresh},t("imageGenRefresh"))),
              h("div",{className:"sc-image-gallery"},catalog.images.slice(0,20).map((image,index)=>h("button",{key:image.id,type:"button","aria-label":t("imageGenSelectImage",{index:index+1}),"aria-pressed":current?.id===image.id,onClick:()=>setSelected(image.id)},h("img",{src:apiUrl("images/"+image.id),alt:"",loading:"lazy"}))))))
        }

		/** 有改动还没保存时，贴在页面底部的保存栏（dsh 自带的保存按钮在整页最下面，改完上面的设置容易找不到） */
		function SettingsPage(props) {
			var t = props.t;
			if (props.view === "summary") return t("summary");
			var state = props.useCompanionForm(function (s) { return s; });
			var disabled = !state.writable || state.saving;
			var common = { t: t, state: state, disabled: disabled, edit: props.edit, resetField: props.resetField };
			var [data, setData] = React.useState(null);
			var [err, setErr] = React.useState(null);
			var [memVersion, setMemVersion] = React.useState(0);

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
					h("p", { key: "n", className: "compc-result " + (data.snowluma ? "compc-ok" : "compc-warn") }, t(data.snowluma ? "snowlumaOn" : "snowlumaOff")),
					stats ? h("p", { key: "a", className: "compc-hint" }, t("archiveCount", { total: stats.total, private: (stats.byKind && stats.byKind.private) || 0, group: (stats.byKind && stats.byKind.group) || 0 })) : null,
					h("p", { key: "d", className: "compc-hint" }, t("dataDir", { dir: data.dataDir }))
				];
			return h(React.Fragment, null, h(React.Fragment, null,
                h(ImageGeneration, common),
				h(Section, { sectionId: "companion-status", category: "overview", title: t("status"), hint: t("statusHint") },
					statusLines,
					h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: load }, t("refresh")))),
				null,
				null,
				null,
				null,
				null,
				h(Section, { sectionId: "companion-rules", category: "connection", title: t("rules"), hint: t("rulesHint") },
					h(RulesEditor, { t: t, state: state, edit: props.edit, disabled: disabled })),
				h(Section, { sectionId: "companion-archive", category: "memory", title: t("archive"), hint: t("archiveHint") },
					h(Toggle, Object.assign({ field: "archiveEnabled", label: t("archiveEnabled"), hint: t("archiveEnabledHint") }, common)),
					h(Toggle, Object.assign({ field: "archiveImages", label: t("archiveImages"), hint: t("archiveImagesHint") }, common)),
					h(Toggle, Object.assign({ field: "archiveUnwoken", label: t("archiveUnwokenAll"), hint: t("archiveUnwokenAllHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "archiveDaysMaster", label: t("archiveDaysMaster"), hint: t("archiveDaysMasterHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "archiveDaysOthers", label: t("archiveDaysOthers"), hint: t("archiveDaysOthersHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)))),
				h(Section, { sectionId: "companion-groupCtx", category: "chat", title: t("groupCtx"), hint: t("groupCtxHint") },
					state.archiveUnwoken.text === "false" ? h("p", { className: "compc-result compc-warn" }, t("groupCtxOff")) : null,
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({}, common, { field: "groupContextCount", label: t("groupContextCount"), hint: t("groupContextCountHint"), numeric: true, invalidLabel: t("invalidCount"), disabled: disabled || state.archiveUnwoken.text === "false" })),)),
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				h(Section, { sectionId: "companion-expirySec", category: "maintenance", title: t("expirySec"), hint: t("expirySecHint") },
					h(Toggle, Object.assign({ field: "rotateSessions", label: t("rotateSessions"), hint: t("rotateSessionsHint") }, common)),
					h(Toggle, Object.assign({ field: "deleteOldSessions", label: t("deleteOldSessions"), hint: t("deleteOldSessionsHint") }, common)),
					h(Value, Object.assign({ field: "carryMessages", label: t("carryMessages"), hint: t("carryMessagesHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
					h(ExpiryPanel, { t: t, data: data, onState: setData })),
				h(Section, { sectionId: "companion-proSec", category: "life", title: t("proSec"), hint: t("proSecHint") },
					h(Toggle, Object.assign({ field: "proactiveEnabled", label: t("proactiveEnabled"), hint: t("proactiveEnabledHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "proactiveMinMinutes", label: t("proactiveMinMinutes"), hint: t("proactiveMinMinutesHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveMaxMinutes", label: t("proactiveMaxMinutes"), hint: t("proactiveMaxMinutesHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveOthersMinMinutes", label: t("proactiveOthersMinMinutes"), hint: t("proIntervalHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveOthersMaxMinutes", label: t("proactiveOthersMaxMinutes"), hint: t("proIntervalHint"), numeric: true, invalidLabel: t("invalid") }, common))),
					h(Toggle, Object.assign({ field: "proactivePrivate", label: t("proactivePrivate"), hint: t("proactivePrivateHint") }, common)),
					h(Toggle, Object.assign({ field: "proactiveGroup", label: t("proactiveGroup"), hint: t("proactiveGroupHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "quietStart", label: t("quietStart"), hint: t("quietHint") }, common)),
						h(Value, Object.assign({ field: "quietEnd", label: t("quietEnd"), hint: t("quietHint") }, common)),
						h(Value, Object.assign({ field: "proactiveRecentMinutes", label: t("proactiveRecentMinutes"), hint: t("proactiveRecentMinutesHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "proactiveGroupContext", label: t("proactiveGroupContext"), hint: t("proactiveGroupContextHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "proactiveActiveDays", label: t("proactiveActiveDays"), hint: t("proactiveActiveDaysHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h("p", { className: "compc-hint" }, t("sharedSilence"))),
					h(ProactivePanel, { t: t, data: data, onState: setData })),
				null,
				h(Section, { sectionId: "companion-backupSec", category: "backup", title: t("backupSec"), hint: t("backupSecHint") },
					h(Toggle, Object.assign({ field: "backupEnabled", label: t("backupEnabled"), hint: t("backupEnabledHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "backupTime", label: t("backupTime"), hint: t("backupTimeHint") }, common)),
						h(Value, Object.assign({ field: "backupKeep", label: t("backupKeep"), hint: t("backupKeepHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(BackupItemsField, common),
					h(BackupExport, { t: t, data: data, onState: setData, items: backupItemsOf(state) })),
				h(Section, { sectionId: "companion-restoreSec", category: "backup", title: t("restoreSec"), hint: t("restoreSecHint") },
					h(BackupPanel, { t: t, data: data, onState: setData })),
				null,
				null,
				h(Section, { sectionId: "companion-log", category: "maintenance", title: t("log") },
					h("details", { className: "compc-details" },
						h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("recentLogs")),
						h("div", { className: "compc-detailsBody" },
							data && data.logs && data.logs.length > 0
								? h("pre", { className: "compc-pre" }, data.logs.slice().reverse().map(function (l) { return fmtTime(l.time) + " [" + l.level + "] " + l.message; }).join("\n"))
								: h("p", { className: "compc-hint" }, t("noLogs")))))));
		}
		//#endregion

		exports.createForm = createForm;
		exports.SettingsPage = SettingsPage;
		exports.dictionaries = { zh: zh, en: en };
		exports.namespace = NS;
		return exports;
	}
});
