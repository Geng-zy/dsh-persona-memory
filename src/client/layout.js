// Shared layout for the single companion settings entry.
window.__ModuleLoader__.load({
  id: "dsh-snowluma-companion/ui-layout",
  factory: require => {
    var R = require("react"), React = R.createElement ? R : R.default, h = React.createElement;
    var Context = React.createContext({ category: "overview", query: "", expansion: null });
    function readOpen(id, fallback) {
      try { var value = window.localStorage.getItem("snowluma-companion:fold:" + id); return value === null ? fallback : value === "open"; } catch (_) { return false; }
    }
    function searchable(node) {
      if (node == null || typeof node === "boolean") return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(searchable).join(" ");
      var p = node.props || {};
      return [p.label, p.hint, p.field, p.modelField, p.title, searchable(p.children)].filter(x => typeof x === "string").join(" ");
    }
    function Section(props) {
      var view = React.useContext(Context), id = props.sectionId;
      var [open, setOpen] = React.useState(() => readOpen(id, props.category === "overview"));
      var [visited, setVisited] = React.useState(open);
      var query = view.query.trim().toLowerCase();
      var matches = !query || (String(props.title) + " " + String(props.hint || "") + " " + searchable(props.children)).toLowerCase().includes(query);
      var visible = query ? matches : view.category === props.category;
      React.useEffect(() => {
        if (visible && view.expansion) { setOpen(view.expansion.open); if (view.expansion.open) setVisited(true); }
      }, [view.expansion]);
      // Keep editors mounted after the first expansion so collapse/navigation retains drafts.
      return h("details", { className: "sc-section", "data-section": id, hidden: !visible, open: open,
        onToggle: e => {
          var next = e.currentTarget.open; setOpen(next); if (next) setVisited(true);
          try { window.localStorage.setItem("snowluma-companion:fold:" + id, next ? "open" : "closed"); } catch (_) {}
        }
      }, h("summary", { className: "sc-section-head" },
        h("span", { className: "sc-section-heading" }, h("span", { className: "sc-section-title" }, props.title), props.hint ? h("span", { className: "sc-section-description" }, props.hint) : null),
        h("span", { className: "sc-chevron", "aria-hidden": true }, "⌄")),
        visited || open ? h("div", { className: "sc-section-body" }, props.children) : null);
    }
    return { Context: Context, Section: Section };
  }
});
