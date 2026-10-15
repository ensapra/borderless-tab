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
var DEFAULT_SETTINGS = {
  animate: true,
  revealOnHover: true,
  hideTabHeader: true,
  hideViewHeader: true,
  hidePdfToolbar: false,
  autoPdf: false,
  autoWebview: false,
  autoMarkdown: false,
  autoOther: false
};
var BORDERLESS_SETTING_KEYS = [
  "animate",
  "revealOnHover",
  "hideTabHeader",
  "hideViewHeader",
  "hidePdfToolbar",
  "autoPdf",
  "autoWebview",
  "autoMarkdown",
  "autoOther"
];
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function isBorderlessSettingKey(key) {
  return BORDERLESS_SETTING_KEYS.some((settingKey) => settingKey === key);
}
function readSettings(data) {
  if (!isRecord(data)) return {};
  const settings = {};
  for (const key of BORDERLESS_SETTING_KEYS) {
    if (typeof data[key] === "boolean") settings[key] = data[key];
  }
  return settings;
}
var BorderlessTabPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.borderlessLeaves = /* @__PURE__ */ new WeakSet();
    this.automaticBorderlessDisabledLeaves = /* @__PURE__ */ new WeakSet();
    this.revealZones = /* @__PURE__ */ new WeakSet();
    this.revealTimers = /* @__PURE__ */ new WeakMap();
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new BorderlessTabSettingTab(this.app, this));
    this.patchPaneMenu();
    this.registerEvent(this.app.workspace.on("layout-change", () => this.restoreBorderlessClasses()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.restoreBorderlessClasses()));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, view) => {
      if (view instanceof import_obsidian.MarkdownView) this.addPaneMenuItem(menu, view.leaf);
    }));
    this.addCommand({
      id: "toggle",
      name: "Toggle borderless",
      checkCallback: (checking) => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        if (!leaf) return false;
        if (!checking) this.toggleLeaf(leaf);
        return true;
      }
    });
  }
  onunload() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const tabs = this.findTabs(leaf);
      if (tabs) this.clearWorkspaceClasses(tabs);
    });
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...readSettings(data) };
  }
  async updateSettings(changes) {
    Object.assign(this.settings, changes);
    await this.saveData(this.settings);
    this.restoreBorderlessClasses();
  }
  patchPaneMenu() {
    const originalOnPaneMenu = import_obsidian.View.prototype.onPaneMenu.bind(import_obsidian.View.prototype);
    const addPaneMenuItem = this.addPaneMenuItem.bind(this);
    import_obsidian.View.prototype.onPaneMenu = function(menu, source) {
      originalOnPaneMenu(menu, source);
      if (source === "tab-header" || source === "more-options") {
        addPaneMenuItem(menu, this.leaf);
      }
    };
    this.register(() => {
      import_obsidian.View.prototype.onPaneMenu = originalOnPaneMenu;
    });
  }
  addPaneMenuItem(menu, leaf) {
    const enabled = this.isLeafBorderless(leaf);
    menu.addItem((item) => {
      item.setTitle(enabled ? "Restore tab borders" : "Make tab borderless").setIcon(enabled ? "panels-top-left" : "square-dashed").setChecked(enabled).onClick(() => this.toggleLeaf(leaf));
    });
  }
  toggleLeaf(leaf) {
    this.setLeafBorderless(leaf, !this.isLeafBorderless(leaf));
  }
  restoreBorderlessClasses() {
    window.requestAnimationFrame(() => {
      const workspaceTabs = /* @__PURE__ */ new Set();
      const borderlessTabs = /* @__PURE__ */ new Set();
      this.app.workspace.iterateAllLeaves((leaf) => {
        const tabs = this.findTabs(leaf);
        if (!tabs) return;
        workspaceTabs.add(tabs);
        if (this.isLeafBorderless(leaf)) borderlessTabs.add(tabs);
      });
      workspaceTabs.forEach((tabs) => this.clearWorkspaceClasses(tabs));
      borderlessTabs.forEach((tabs) => this.applyWorkspaceState(tabs));
    });
  }
  setLeafBorderless(leaf, enabled) {
    if (enabled) {
      this.automaticBorderlessDisabledLeaves.delete(leaf);
      this.borderlessLeaves.add(leaf);
    } else {
      this.borderlessLeaves.delete(leaf);
      if (this.isAutomaticallyBorderless(leaf)) {
        this.automaticBorderlessDisabledLeaves.add(leaf);
      }
    }
    this.restoreBorderlessClasses();
  }
  applyWorkspaceState(tabs) {
    tabs.classList.add(BORDERLESS_CLASS);
    this.applySettingsClasses(tabs, true);
    this.ensureRevealZone(tabs);
  }
  isLeafBorderless(leaf) {
    return this.borderlessLeaves.has(leaf) || !this.automaticBorderlessDisabledLeaves.has(leaf) && this.isAutomaticallyBorderless(leaf);
  }
  isAutomaticallyBorderless(leaf) {
    var _a;
    const view = leaf.view;
    const viewType = view.getViewType().toLowerCase();
    const extension = view instanceof import_obsidian.MarkdownView ? (_a = view.file) == null ? void 0 : _a.extension.toLowerCase() : void 0;
    const isPdf = extension === "pdf" || viewType === "pdf" || viewType.includes("pdf");
    if (isPdf) return this.settings.autoPdf;
    const isWebview = viewType.includes("webview") || viewType.includes("web-view") || viewType.includes("webviewer") || viewType.includes("browser") || view.containerEl.classList.contains("webviewer") || view.containerEl.classList.contains("webview");
    if (isWebview) return this.settings.autoWebview;
    if (view instanceof import_obsidian.MarkdownView || extension === "md" || extension === "markdown") {
      return this.settings.autoMarkdown;
    }
    return this.settings.autoOther;
  }
  clearWorkspaceClasses(tabs) {
    tabs.classList.remove(
      BORDERLESS_CLASS,
      "borderless-tab-animated",
      "borderless-tab-hover-reveal",
      "borderless-tab-hide-tab-header",
      "borderless-tab-hide-view-header",
      "borderless-tab-hide-pdf-toolbar",
      "borderless-tab-revealed"
    );
    this.setHeadersRevealed(tabs, false);
  }
  findTabs(leaf) {
    const leafElement = this.findAncestor(leaf.view.containerEl, "workspace-leaf");
    return this.findAncestor(leafElement != null ? leafElement : leaf.view.containerEl, "workspace-tabs");
  }
  applySettingsClasses(tabs, enabled) {
    const classes = [
      ["borderless-tab-animated", this.settings.animate && this.settings.revealOnHover],
      ["borderless-tab-hover-reveal", this.settings.revealOnHover],
      ["borderless-tab-hide-tab-header", this.settings.hideTabHeader],
      ["borderless-tab-hide-view-header", this.settings.hideViewHeader],
      ["borderless-tab-hide-pdf-toolbar", this.settings.hidePdfToolbar]
    ];
    for (const [className, settingEnabled] of classes) {
      tabs.classList.toggle(className, enabled && settingEnabled);
    }
    if (!enabled || !this.settings.revealOnHover) this.setHeadersRevealed(tabs, false);
  }
  ensureRevealZone(tabs) {
    if (this.revealZones.has(tabs)) return;
    this.revealZones.add(tabs);
    const revealZone = tabs.createDiv({ cls: "borderless-tab-reveal-zone" });
    this.registerDomEvent(revealZone, "mouseenter", () => {
      if (this.settings.revealOnHover && tabs.classList.contains("borderless-tab-hover-reveal")) {
        this.setHeadersRevealed(tabs, true);
      }
    });
    this.registerDomEvent(revealZone, "mouseleave", () => {
      if (!this.settings.revealOnHover || !tabs.classList.contains("borderless-tab-hover-reveal")) return;
      const timer = window.setTimeout(() => {
        this.revealTimers.delete(tabs);
        this.setHeadersRevealed(tabs, false);
      }, 1e3);
      this.revealTimers.set(tabs, timer);
    });
    this.registerDomEvent(tabs, "mousemove", (event) => {
      if (!this.settings.revealOnHover || !tabs.classList.contains(BORDERLESS_CLASS) || !tabs.classList.contains("borderless-tab-hover-reveal")) return;
      const rect = tabs.getBoundingClientRect();
      const pointerIsAtTop = event.clientY - rect.top <= 18;
      const target = event.target;
      const pointerIsOverHeader = target !== null && target.closest(
        ".workspace-tab-header-container, .view-header"
      ) !== null;
      if (pointerIsAtTop || pointerIsOverHeader) {
        this.setHeadersRevealed(tabs, true);
      } else if (!this.revealTimers.has(tabs)) {
        const timer = window.setTimeout(() => {
          this.revealTimers.delete(tabs);
          this.setHeadersRevealed(tabs, false);
        }, 600);
        this.revealTimers.set(tabs, timer);
      }
    });
  }
  setHeadersRevealed(tabs, revealed) {
    if (revealed && !this.settings.revealOnHover) revealed = false;
    const timer = this.revealTimers.get(tabs);
    if (timer !== void 0) {
      window.clearTimeout(timer);
      this.revealTimers.delete(tabs);
    }
    tabs.classList.toggle("borderless-tab-revealed", revealed);
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
var BorderlessTabSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  getSettingDefinitions() {
    return [
      {
        type: "group",
        heading: "Borderless behavior",
        items: [
          this.toggleDefinition("Reveal headers on hover", "Show hidden headers when the pointer reaches the top of the tab group.", "revealOnHover"),
          this.toggleDefinition("Animate header transitions", "Animate headers when they hide and reveal.", "animate", () => !this.plugin.settings.revealOnHover)
        ]
      },
      {
        type: "group",
        heading: "Hidden in borderless mode",
        items: [
          this.toggleDefinition("Tab header", "Hide the workspace tab strip.", "hideTabHeader"),
          this.toggleDefinition("View header", "Hide the note title and back/forward controls.", "hideViewHeader"),
          this.toggleDefinition("PDF toolbar", "Hide the toolbar in Obsidian's built-in PDF viewer.", "hidePdfToolbar")
        ]
      },
      {
        type: "group",
        heading: "Automatic borderless files",
        items: [
          this.toggleDefinition("PDF files", "Automatically make PDF views borderless.", "autoPdf"),
          this.toggleDefinition("Web views", "Automatically make web views and browser views borderless.", "autoWebview"),
          this.toggleDefinition("Markdown files", "Automatically make Markdown notes borderless.", "autoMarkdown"),
          this.toggleDefinition("Other views", "Automatically make all other view types borderless.", "autoOther")
        ]
      }
    ];
  }
  getControlValue(key) {
    return isBorderlessSettingKey(key) ? this.plugin.settings[key] : void 0;
  }
  async setControlValue(key, value) {
    if (!isBorderlessSettingKey(key) || typeof value !== "boolean") return;
    await this.plugin.updateSettings({ [key]: value });
    this.refreshDomState();
  }
  toggleDefinition(name, desc, key, disabled) {
    return {
      name,
      desc,
      control: { type: "toggle", key, defaultValue: DEFAULT_SETTINGS[key], disabled }
    };
  }
};
