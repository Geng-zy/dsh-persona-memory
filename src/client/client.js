// One package, one settings entry. Internal namespaces retain existing user settings.
window.__ModuleLoader__.load({
  id: "dsh-snowluma-companion",
  factory: require => {
    var R = require("react"), React = R.createElement ? R : R.default, h = React.createElement;
    var P = require("@deepseek-ai/dsh-client-ui-primitives");
    var Bridge = require("dsh-snowluma-companion/ui-bridge"), Companion = require("dsh-snowluma-companion/ui-companion");
    var Layout = require("dsh-snowluma-companion/ui-layout");
    var PACKAGE = "dsh-snowluma-companion", NS = "snowlumaCompanion";
    var categories = ["overview", "connection", "chat", "persona", "memory", "life", "media", "backup", "maintenance"];
    var zh = {
      documentsDirty: "有未保存的文档草稿", renderFailed: "设置页显示出错，可刷新页面重试。", reloadPage: "刷新页面", language: "zh", summary: "QQ 连接、人格与记忆、主动聊天和备份，在一个地方管理。",
      title: "SnowLuma 陪伴助手", eyebrow: "SNOWLUMA COMPANION", subtitle: "连接、表达与记忆，井然有序。",
      overview: "运行概览", connection: "连接与权限", chat: "聊天与回复", persona: "人格与核心记忆", memory: "记忆与存档", life: "日记与主动聊天", media: "图片、语音与视频", backup: "备份与迁移", maintenance: "维护与通知",
      overviewHint: "查看连接、存储状态与常用入口。", connectionHint: "管理 QQ 接入、主人权限、白名单与会话例外规则。", chatHint: "从唤醒、模型到上下文和回复节奏，按聊天流程集中设置。", personaHint: "编辑人格和核心记忆，配置生效范围与自主修改规则。", memoryHint: "管理消息存档、长期记忆、向量召回与关系图。", lifeHint: "安排日记与主动聊天，设置间隔和免打扰时段。", mediaHint: "集中配置图片输入、语音识别、语音合成和视频抽帧。", backupHint: "选择备份内容、下载或导入已有备份。", maintenanceHint: "管理掉线通知、数据到期、记忆保养与运行日志。",
      search: "搜索设置名称或说明…", searchLabel: "搜索全部设置", searchResults: "搜索结果", searchHint: "搜索全部分组，展开卡片查看具体设置。", expand: "全部展开", collapse: "全部收起", save: "保存所有设置", discard: "放弃设置改动", saved: "设置已保存", dirty: "有未保存的设置", clean: "所有设置已保存", unavailable: "设置暂不可用", readOnly: "当前设置只读", saveFailed: "保存失败", saving: "正在保存…", documentHint: "人格、核心记忆和日记正文使用编辑器中的保存按钮。", privacy: "白名单约束本插件存档；QQ 和 SnowLuma 的协议缓存独立管理。", quick: "从这里开始", quickHint: "每组设置均可折叠；展开状态会保存在当前浏览器。", noResults: "未找到匹配的设置，请尝试“白名单”“语音”或“备份”。", back: "返回分组"
    };
    var en = {
      documentsDirty: "Unsaved document drafts", renderFailed: "Settings could not render. Reload to try again.", reloadPage: "Reload page", language: "en", summary: "QQ connectivity, persona, memory, proactive chat and backups in one place.", title: "SnowLuma Companion", eyebrow: "SNOWLUMA COMPANION", subtitle: "A considered home for connection, expression and memory.",
      overview: "Overview", connection: "Connection & access", chat: "Chat & replies", persona: "Persona & core memory", memory: "Memory & archives", life: "Diary & proactive chat", media: "Images, voice & video", backup: "Backup & migration", maintenance: "Maintenance & alerts",
      overviewHint: "Connection, storage and common destinations.", connectionHint: "QQ access, owners, allowlists and conversation overrides.", chatHint: "Wake triggers, models, context and reply pacing in conversation order.", personaHint: "Persona, core memory, preset scope and self-edit rules.", memoryHint: "Archives, long-term memory, vector recall and graph relations.", lifeHint: "Diaries, proactive intervals and quiet hours.", mediaHint: "Image input, speech recognition, synthesis and video frames.", backupHint: "Choose content, download or import backups.", maintenanceHint: "Offline alerts, expiry, memory care and runtime logs.",
      search: "Search settings and descriptions…", searchLabel: "Search all settings", searchResults: "Search results", searchHint: "Search spans all groups. Expand a card to inspect its settings.", expand: "Expand all", collapse: "Collapse all", save: "Save all settings", discard: "Discard setting changes", saved: "Settings saved", dirty: "Unsaved settings", clean: "All settings saved", unavailable: "Settings unavailable", readOnly: "Settings are read-only", saveFailed: "Save failed", saving: "Saving…", documentHint: "Save persona, core memory and diary text using their editor buttons.", privacy: "Allowlists govern plugin archives; QQ and SnowLuma protocol caches are managed separately.", quick: "Start here", quickHint: "Each settings group collapses independently. This browser remembers its state.", noResults: "No matching settings. Try allowlist, voice or backup.", back: "Back to groups"
    };
    function readCategory() { try { var v = localStorage.getItem("snowluma-companion:category"); return categories.includes(v) ? v : "overview"; } catch (_) { return "overview"; } }
    function SettingsPage(props) {
      var t = props.t;
      if (props.view === "summary") return t("summary");
      return h(SettingsBoundary, { t: props.t }, h(Editor, props));
    }
    class SettingsBoundary extends React.Component {
      constructor(props) { super(props); this.state = { error: null }; }
      static getDerivedStateFromError(error) { return { error: error }; }
      render() {
        if (!this.state.error) return this.props.children;
        return h("div", { role: "alert", className: "sc-app" }, h("p", null, this.props.t("renderFailed")),
          h("p", null, this.state.error.message), h("button", { type: "button", onClick: () => window.location.reload() }, this.props.t("reloadPage")));
      }
    }
    function Editor(props) {
      var t = props.t, b = props.useSnowlumaForm(s => s), c = props.useCompanionForm(s => s);
      var [category, setCategory] = React.useState(readCategory), [query, setQuery] = React.useState(""), [expansion, setExpansion] = React.useState(null);

      var [documentDrafts, setDocumentDrafts] = React.useState({});
      var documentChanged = React.useCallback((name, value) => { setDocumentDrafts(previous => previous[name] === value ? previous : Object.assign({}, previous, { [name]: value })); }, []);
      var documentDirty = Object.values(documentDrafts).some(Boolean);
      var dirty = b.dirty || c.dirty, saving = b.saving || c.saving, writable = b.writable && c.writable;
      function navigate(id) { setCategory(id); setQuery(""); try { localStorage.setItem("snowluma-companion:category", id); } catch (_) {} }
      React.useEffect(() => {
        var warn = e => { if (dirty || documentDirty) { e.preventDefault(); e.returnValue = ""; } };
        window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
      }, [dirty, documentDirty]);
      var english = t("language") === "en";
      function translator(ui) { return (key, vars) => String(ui.dictionaries[english ? "en" : "zh"][key] || key).replace(/\{(\w+)\}/g, (match, name) => vars && vars[name] !== undefined ? String(vars[name]) : match); }
      var bt = translator(Bridge), ct = translator(Companion);
      var shell = Object.assign({}, b, { dirty: dirty, saving: saving, writable: writable, available: b.available && c.available, invalid: b.invalid || c.invalid, failed: b.failed || c.failed });
      return h("div", { className: "sc-app" },
        h("header", { className: "sc-hero" }, h("div", { className: "sc-brand-mark", "aria-hidden": true }, "S"),
          h("div", null, h("p", { className: "sc-eyebrow" }, t("eyebrow")), h("h2", null, t("title")), h("p", { className: "sc-subtitle" }, t("subtitle"))),
          h("span", { className: "sc-badge" }, "QQ · dsh")),
        h("div", { className: "sc-layout" },
          h("nav", { className: "sc-nav", "aria-label": t("title") }, categories.map((id, i) => h("button", { key: id, type: "button", className: "sc-nav-item" + (category === id && !query ? " sc-active" : ""), "aria-current": category === id && !query ? "page" : undefined, onClick: () => navigate(id) }, h("span", { className: "sc-nav-number", "aria-hidden": true }, String(i + 1).padStart(2, "0")), t(id)))),
          h("main", { className: "sc-main" },
            h("div", { className: "sc-search-row" }, h("input", { type: "search", className: "sc-search", placeholder: t("search"), "aria-label": t("searchLabel"), value: query, onChange: e => setQuery(e.target.value) }),
              h("button", { type: "button", className: "sc-tool", onClick: () => setExpansion({ open: true, at: Date.now() }) }, t("expand")),
              h("button", { type: "button", className: "sc-tool", onClick: () => setExpansion({ open: false, at: Date.now() }) }, t("collapse"))),
            h("div", { className: "sc-page-heading" }, h("h3", null, query ? t("searchResults") : t(category)), h("p", null, query ? t("searchHint") : t(category + "Hint"))),
            category === "overview" && !query ? h("div", { className: "sc-quick" }, ["connection", "persona", "memory", "backup"].map(id => h("button", { type: "button", key: id, onClick: () => navigate(id) }, h("strong", null, t(id)), h("span", null, t(id + "Hint")), h("span", { "aria-hidden": true }, "↗")))) : null,
            h("div", { className: "sc-settings", "data-searching": query ? "true" : "false", "data-empty-text": t("noResults") },
              !shell.available ? h("p", { role: "status" }, t("unavailable")) : null,
              !shell.writable ? h("p", { role: "status" }, t("readOnly")) : null,
              shell.failed ? h("p", { role: "alert", className: "compc-error" }, t("saveFailed")) : null,
              shell.available ? h(Layout.Context.Provider, { value: { category: category, query: query, expansion: expansion, documentChanged: documentChanged } },
                h(Bridge.SettingsPage, { t: bt, useSnowlumaForm: props.useSnowlumaForm, edit: props.bridgeEdit, resetField: props.bridgeReset }),
                h(Companion.SettingsPage, { t: ct, useCompanionForm: props.useCompanionForm, edit: props.companionEdit, resetField: props.companionReset })) : null),
            h("p", { className: "sc-footnote" }, t("privacy")))),
        h("footer", { className: "sc-save" + (dirty || documentDirty ? " sc-dirty" : " sc-clean") }, h("div", null, h("span", { className: "sc-save-dot" + (dirty || documentDirty ? " sc-unsaved" : "") }), h("strong", null, saving ? t("saving") : dirty ? t("dirty") : documentDirty ? t("documentsDirty") : t("clean")), h("p", null, t("documentHint"))),
          h("div", { className: "sc-save-actions" }, h(P.Button, { size: "sm", disabled: saving || !dirty, onClick: props.discardAll }, t("discard")), h(P.Button, { size: "sm", disabled: saving || !dirty || !writable || shell.invalid, onClick: props.saveAll }, t("save")))),
        null);
    }
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: zh, en: en }), "companion: unified dictionaries");
      [Bridge, Companion].forEach(ui => ctx.effect(() => ctx.locale.register(ui.namespace, ui.dictionaries), "companion: dictionaries " + ui.namespace));
      var scopes = [ctx.configForms.get("snowluma-bridge"), ctx.configForms.get("companion-core")];
      var models = [Bridge.createForm(scopes[0]), Companion.createForm(scopes[1])];
      var actions = models.map(m => m.form.actions()), disposed = false;
      ctx.effect(() => () => { disposed = true; models.forEach(m => m.form.dispose()); }, "companion: unified forms");
      function refreshSecrets() {
        ctx.remote.settings.describe().then(response => {
          if (disposed || !response.ok) return;
          ["snowluma-bridge", "companion-core"].forEach((ns, i) => {
            var row = response.value.namespaces.find(n => n.ns === ns), flags = {};
            ((row && row.secrets) || []).forEach(x => { if (x.path.length === 1) flags[x.path[0]] = x.set === true; });
            models[i].setSecrets(flags);
          });
        }, () => {});
      }
      refreshSecrets(); scopes.forEach(scope => ctx.effect(() => scope.subscribe(refreshSecrets), "companion: secret state"));
      var editBridge = (field, text) => { actions[0].edit(field, text); if (field === "silenceToken") actions[1].edit(field, text); };
      ctx.effect(() => ctx.configForms.whileServed(["snowluma-bridge", "companion-core"], () => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({ name: "plugins.bundle.config", key: PACKAGE, locale: NS,
        inject: () => ({ hooks: { snowlumaForm: models[0].store, companionForm: models[1].store },
          bridgeEdit: editBridge, companionEdit: actions[1].edit, bridgeReset: field => { actions[0].resetField(field); if (field === "silenceToken") actions[1].resetField(field); }, companionReset: actions[1].resetField,
          saveAll: async () => { if (models.some(m => m.form.shell().invalid || !m.form.shell().writable)) return; for (var model of models) { await model.form.save(); if (model.form.shell().failed) return; } }, discardAll: () => { actions.forEach(a => a.discard()); }
        })
      }, SettingsPage))), "companion: unified settings page");
    }
    return { inject: ["slots", "locale", "configForms", "remote", "remote.settings"], apply: apply, SettingsPage: SettingsPage };
  }
});
