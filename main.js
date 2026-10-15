var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BorderlessTabPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var BORDERLESS_CLASS = "borderless-tab-enabled";
var BorderlessTabPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.borderlessLeaves = /* @__PURE__ */ new WeakSet();
  }
  onload() {
    this.patchPaneMenu();
    this.registerEvent(this.app.workspace.on("layout-change", () => this.restoreBorderlessClasses()));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, view) => {
      if (view instanceof import_obsidian.MarkdownView) this.addPaneMenuItem(menu, view.leaf);
    }));
    this.addCommand({
      id: "toggle-borderless-tab",
      name: "Toggle borderless tab",
      checkCallback: (checking) => {
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return false;
        if (!checking) this.toggleLeaf(leaf);
        return true;
      }
    });
  }
  onunload() {
    this.app.workspace.iterateAllLeaves((leaf) => this.setLeafBorderless(leaf, false));
  }
  patchPaneMenu() {
    const originalOnPaneMenu = import_obsidian.View.prototype.onPaneMenu;
    const plugin = this;
    import_obsidian.View.prototype.onPaneMenu = function(menu, source) {
      originalOnPaneMenu.call(this, menu, source);
      if (source === "tab-header" || source === "more-options") {
        plugin.addPaneMenuItem(menu, this.leaf);
      }
    };
    this.register(() => {
      import_obsidian.View.prototype.onPaneMenu = originalOnPaneMenu;
    });
  }
  addPaneMenuItem(menu, leaf) {
    const enabled = this.borderlessLeaves.has(leaf);
    menu.addItem((item) => {
      item.setTitle(enabled ? "Restore tab borders" : "Make tab borderless").setIcon(enabled ? "panels-top-left" : "square-dashed").setChecked(enabled).onClick(() => this.toggleLeaf(leaf));
    });
  }
  toggleLeaf(leaf) {
    this.setLeafBorderless(leaf, !this.borderlessLeaves.has(leaf));
  }
  restoreBorderlessClasses() {
    window.requestAnimationFrame(() => {
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (this.borderlessLeaves.has(leaf)) this.setLeafBorderless(leaf, true);
      });
    });
  }
  setLeafBorderless(leaf, enabled) {
    if (enabled) {
      this.borderlessLeaves.add(leaf);
    } else {
      this.borderlessLeaves.delete(leaf);
    }
    const leafElement = this.findAncestor(leaf.view.containerEl, "workspace-leaf");
    const tabs = this.findAncestor(leafElement != null ? leafElement : leaf.view.containerEl, "workspace-tabs");
    leaf.view.containerEl.classList.toggle(BORDERLESS_CLASS, enabled);
    leafElement == null ? void 0 : leafElement.classList.toggle(BORDERLESS_CLASS, enabled);
    tabs == null ? void 0 : tabs.classList.toggle(BORDERLESS_CLASS, enabled);
  }
  findAncestor(element, className) {
    let current = element;
    while (current) {
      if (current.classList.contains(className)) return current;
      current = current.parentElement;
    }
    return null;
  }
};
