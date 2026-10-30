// Shared accordion for both settings entry points. Collapsing retains mounted editors.
window.__ModuleLoader__.load({
  id: "dsh-snowluma-companion/ui-layout",
  factory: require => {
    var R = require("react"), React = R.createElement ? R : R.default, h = React.createElement;
    var Context = React.createContext({ category: "overview", query: "", activeSection: "companion-status", setActiveSection: () => {} });
    function readActiveSection() {
      try { return window.localStorage.getItem("snowluma-companion:active-section") ?? "companion-status"; } catch (_) { return "companion-status"; }
    }
    function searchable(node) {
      if (node == null || typeof node === "boolean") return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(searchable).join(" ");
      var p = node.props || {};
      return [p.label, p.hint, p.field, p.modelField, p.title, searchable(p.children)].filter(x => typeof x === "string").join(" ");
    }
    function Section(props) {
      var view = React.useContext(Context), id = props.sectionId, open = view.activeSection === id;
      var [visited, setVisited] = React.useState(open);
      React.useEffect(() => { if (open) setVisited(true); }, [open]);
      var query = view.query.trim().toLowerCase();
      var matches = !query || (String(props.title) + " " + String(props.hint || "") + " " + searchable(props.children)).toLowerCase().includes(query);
      var visible = query ? matches : view.category === props.category;
      return h("details", { className: "sc-section", "data-section": id, hidden: !visible, open: open },
        h("summary", { className: "sc-section-head", onClick: e => { e.preventDefault(); view.setActiveSection(open ? "" : id); } },
          h("span", { className: "sc-section-heading" }, h("span", { className: "sc-section-title" }, props.title), props.hint ? h("span", { className: "sc-section-description" }, props.hint) : null),
          h("span", { className: "sc-chevron", "aria-hidden": true })),
        visited || open ? h("div", { className: "sc-section-body" }, props.hint ? h("p", { className: "sc-section-help" }, props.hint) : null, props.children) : null);
    }
    return { Context: Context, Section: Section, readActiveSection: readActiveSection };
  }
});
