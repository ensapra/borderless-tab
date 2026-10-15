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
var TOGGLE_CLASS = "borderless-tab-toggle";
var BorderlessTabPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.borderlessLeaves = /* @__PURE__ */ new WeakSet();
    this.tabButtons = /* @__PURE__ */ new WeakMap();
    this.layoutChangeHandler = () => this.refreshTabToggles();
  }
  async onload() {
    this.registerEvent(this.app.workspace.on("layout-change", this.layoutChangeHandler));
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.layoutChangeHandler));
    this.addCommand({
      id: "toggle-borderless-tab",
      name: "Toggle borderless tab",
      checkCallback: (checking) => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        if (!leaf) return false;
        if (!checking) this.toggleLeaf(leaf);
        return true;
      }
    });
    this.refreshTabToggles();
  }
  onunload() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      var _a;
      leaf.view.containerEl.removeClass(BORDERLESS_CLASS);
      (_a = this.tabButtons.get(leaf)) == null ? void 0 : _a.remove();
    });
  }
  refreshTabToggles() {
    window.requestAnimationFrame(() => {
      this.app.workspace.iterateAllLeaves((leaf) => this.ensureTabToggle(leaf));
    });
  }
  ensureTabToggle(leaf) {
    var _a;
    const header = this.findTabHeader(leaf);
    if (!header || this.tabButtons.has(leaf)) return;
    const buttonHost = (_a = header.querySelector(".workspace-tab-header-inner")) != null ? _a : header;
    const button = buttonHost.createEl("button", {
      cls: TOGGLE_CLASS,
      attr: {
        "aria-label": "Toggle borderless tab",
        title: "Toggle borderless tab"
      }
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleLeaf(leaf);
    });
    this.tabButtons.set(leaf, button);
    this.updateButton(leaf);
  }
  toggleLeaf(leaf) {
    if (this.borderlessLeaves.has(leaf)) {
      this.borderlessLeaves.delete(leaf);
    } else {
      this.borderlessLeaves.add(leaf);
    }
    leaf.view.containerEl.toggleClass(BORDERLESS_CLASS, this.borderlessLeaves.has(leaf));
    this.updateButton(leaf);
  }
  updateButton(leaf) {
    const button = this.tabButtons.get(leaf);
    if (!button) return;
    const enabled = this.borderlessLeaves.has(leaf);
    (0, import_obsidian.setIcon)(button, enabled ? "panels-top-left" : "square-dashed");
    button.toggleClass("is-enabled", enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("title", enabled ? "Restore tab borders" : "Make tab borderless");
  }
  findTabHeader(leaf) {
    var _a;
    const leafElement = leaf.view.containerEl.closest(".workspace-leaf");
    const tabs = leafElement == null ? void 0 : leafElement.closest(".workspace-tabs");
    if (!tabs) return null;
    const leaves = Array.from(tabs.querySelectorAll(".workspace-leaf"));
    const leafIndex = leaves.indexOf(leafElement);
    if (leafIndex < 0) return null;
    const headers = Array.from(tabs.querySelectorAll(".workspace-tab-header"));
    return (_a = headers[leafIndex]) != null ? _a : null;
  }
};
