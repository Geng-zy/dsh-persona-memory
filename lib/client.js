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
			contextHint: "每个会话超过「最多保留轮数」，或者上下文到了模型上限的百分比，就处理最早的几轮（哪个先到算哪个）。处理前先通知记忆（阶段 2 起会先把要紧内容写进记忆）。模型报「超出上限」时不管设的什么，都立刻按轮数截断再重试。一轮 = 一条人说的话加她的回复。",
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
			archiveHint: "QQ 上收到和发出的每条消息按原样存进数据库（和 dsh 的会话日志不是一回事）。保留天数到期后先整理再删除的功能在阶段 3 加上，现在先只存。",
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
			saveFailed: "没有保存成功，修改已保留，请检查后重试。"
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
			archiveHint: "Every QQ message received or sent, stored as is. Expiry cleanup arrives in phase 3.",
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
			saveFailed: "Not saved; your edits are kept for you to correct."
		};

		var CSS = [
			".compc-section{display:grid;gap:12px;padding:16px 0 8px;border-top:.5px solid var(--dsw-alias-border-l3)}",
			".compc-section:first-child{border-top:none;padding-top:4px}",
			".compc-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;margin:0}",
			".compc-subtitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;margin:4px 0 0}",
			".compc-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".compc-labelText{display:inline-flex;align-items:flex-start;gap:2px}",
			".compc-tip{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-top:-4px;border-radius:50%;border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary);font-size:9px;font-weight:600;line-height:1;cursor:help;user-select:none}",
			".compc-tip:hover,.compc-tip:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary);outline:none}",
			".compc-toggleRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
			".compc-field{display:grid;gap:6px;min-width:0}",
			".compc-label{color:var(--dsw-alias-label-primary);font-size:13px}",
			".compc-select,.compc-input{min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,6px);padding:6px 8px;font:inherit;font-size:13px;box-sizing:border-box}",
			".compc-select{justify-self:start;align-self:start;min-width:120px;max-width:100%}",
			".compc-ruleGrid .compc-select,.compc-ruleGrid .compc-input,.compc-grid .compc-select{width:100%;min-width:0}",
			".compc-textarea{width:100%;min-height:220px;resize:vertical;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,6px);padding:10px;font:inherit;font-size:13px;line-height:1.6}",
			".compc-textarea.compc-small{min-height:120px}",
			".compc-select:focus-visible,.compc-input:focus-visible,.compc-textarea:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".compc-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
			".compc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:start}",
			".compc-card{display:grid;gap:10px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px)}",
			".compc-ruleGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;align-items:start}",
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
			"@media (prefers-reduced-motion:reduce){.compc-chevron{transition:none}}"
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
			if (r.note) out.note = String(r.note);
			return out;
		}
		var MODES = ["truncate", "llm"];
		var LOG_LEVELS = ["debug", "info", "warn", "error"];
		var BOOLS = ["personaOnly", "selfEdit", "archiveEnabled", "archiveUnwoken"];
		var TEXTS = ["summaryModel"];
		var LISTS = ["excludedPresets"];
		var INTS = [
			["historyKeep", 0], ["coreMaxKB", 1], ["thresholdPercent", 10, 95],
			["masterMaxRounds", 0], ["masterDropRounds", 1], ["privateMaxRounds", 0], ["privateDropRounds", 1],
			["groupMaxRounds", 0], ["groupDropRounds", 1], ["archiveDaysMaster", 1], ["archiveDaysOthers", 1]
		];
		var ENUMS = [["masterMode", MODES], ["privateMode", MODES], ["groupMode", MODES], ["logLevel", LOG_LEVELS]];
		//#endregion

		//#region 表单模型
		function createForm(scope) {
			var specs = INTS.map(function (x) { return intField(x[0], x[1], x[2] === void 0 ? Number.MAX_SAFE_INTEGER : x[2]); })
				.concat(ENUMS.map(function (x) { return enumField(x[0], x[1]); }), LISTS.map(listField), BOOLS.map(boolField),
					TEXTS.map(function (f) { return P.settingsTextField(f); }), [rulesField("rules")]);
			var form = new P.SettingsFormModel(scope, specs, []);
			var all = INTS.map(function (x) { return x[0]; }).concat(ENUMS.map(function (x) { return x[0]; }), LISTS, BOOLS, TEXTS, ["rules"]);
			function compute() {
				var state = Object.assign({}, form.shell());
				all.forEach(function (f) { state[f] = form.field(f); });
				return state;
			}
			return { form: form, store: form.bind(compute) };
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
			return h("section", { className: "compc-section" },
				h("h3", { className: "compc-title" }, h(Label, { text: props.title, hint: props.hint })),
				props.children);
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
			function load() {
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
				h(Section, { title: t("scope"), hint: t("scopeHint") },
					h(Value, Object.assign({ field: "excludedPresets", label: t("excludedPresets"), hint: t("excludedPresetsHint") }, common)),
					h(Toggle, Object.assign({ field: "personaOnly", label: t("personaOnly"), hint: t("personaOnlyHint") }, common))),
				h(Section, { title: t("persona"), hint: t("personaHint") },
					data ? h(DocEditor, { t: t, name: "persona", doc: docs.persona, ariaLabel: t("persona"), saveLabel: t("savePersona"), onState: setData }) : null,
					h(Toggle, Object.assign({ field: "selfEdit", label: t("selfEdit"), hint: t("selfEditHint") }, common)),
					h(Value, Object.assign({ field: "historyKeep", label: t("historyKeep"), hint: t("historyKeepHint"), numeric: true, invalidLabel: t("invalidCount") }, common))),
				h(Section, { title: t("core"), hint: t("coreHint") },
					data ? h(DocEditor, { t: t, name: "core-master", title: t("coreMaster"), small: true, doc: docs["core-master"], saveLabel: t("saveCore"), onState: setData }) : null,
					data ? h(DocEditor, { t: t, name: "core-public", title: t("corePublic"), small: true, doc: docs["core-public"], saveLabel: t("saveCore"), onState: setData }) : null,
					h(Value, Object.assign({ field: "coreMaxKB", label: t("coreMaxKB"), hint: t("coreMaxKBHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
				h(Section, { title: t("context"), hint: t("contextHint") },
					h(Value, Object.assign({ field: "thresholdPercent", label: t("thresholdPercent"), hint: t("thresholdPercentHint"), numeric: true, invalidLabel: t("invalid") }, common)),
					h(ContextRow, { t: t, common: common, prefix: "master", title: t("masterRow"), fallback: "llm" }),
					h(ContextRow, { t: t, common: common, prefix: "private", title: t("privateRow"), fallback: "truncate" }),
					h(ContextRow, { t: t, common: common, prefix: "group", title: t("groupRow"), fallback: "truncate" }),
					h(Value, Object.assign({ field: "summaryModel", label: t("summaryModel"), hint: t("summaryModelHint") }, common))),
				h(Section, { title: t("rules"), hint: t("rulesHint") },
					h(RulesEditor, { t: t, state: state, edit: props.edit, disabled: disabled })),
				h(Section, { title: t("archive"), hint: t("archiveHint") },
					h(Toggle, Object.assign({ field: "archiveEnabled", label: t("archiveEnabled") }, common)),
					h(Toggle, Object.assign({ field: "archiveUnwoken", label: t("archiveUnwokenAll"), hint: t("archiveUnwokenAllHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "archiveDaysMaster", label: t("archiveDaysMaster"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "archiveDaysOthers", label: t("archiveDaysOthers"), numeric: true, invalidLabel: t("invalidPositive") }, common)))),
				h(Section, { title: t("log") },
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
		var inject = ["slots", "locale", "configForms"];

		function apply(ctx) {
			ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "companion-core: dictionaries");
			var scope = ctx.configForms.get(SECTION);
			var model = createForm(scope);
			ctx.effect(function () { return function () { model.form.dispose(); }; }, "companion-core: form");
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
