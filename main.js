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
  hidePdfToolbar: false
};
var BorderlessTabPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.borderlessLeaves = /* @__PURE__ */ new WeakSet();
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
    this.app.workspace.iterateAllLeaves((leaf) => {
      const tabs = this.findTabs(leaf);
      if (tabs) this.clearWorkspaceClasses(tabs);
    });
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async updateSettings(changes) {
    Object.assign(this.settings, changes);
    await this.saveData(this.settings);
    this.restoreBorderlessClasses();
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
      const workspaceTabs = /* @__PURE__ */ new Set();
      this.app.workspace.iterateAllLeaves((leaf) => {
        const tabs = this.findTabs(leaf);
        if (tabs) workspaceTabs.add(tabs);
      });
      workspaceTabs.forEach((tabs) => this.clearWorkspaceClasses(tabs));
      const activeLeaf = this.app.workspace.activeLeaf;
      if (activeLeaf && this.borderlessLeaves.has(activeLeaf)) {
        this.applyWorkspaceState(activeLeaf);
      }
    });
  }
  setLeafBorderless(leaf, enabled) {
    if (enabled) {
      this.borderlessLeaves.add(leaf);
    } else {
      this.borderlessLeaves.delete(leaf);
    }
    this.restoreBorderlessClasses();
  }
  applyWorkspaceState(leaf) {
    const tabs = this.findTabs(leaf);
    if (!tabs) return;
    tabs.classList.add(BORDERLESS_CLASS);
    this.applySettingsClasses(tabs, true);
    this.ensureRevealZone(tabs);
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
    const classes = {
      "borderless-tab-animated": this.settings.animate && this.settings.revealOnHover,
      "borderless-tab-hover-reveal": this.settings.revealOnHover,
      "borderless-tab-hide-tab-header": this.settings.hideTabHeader,
      "borderless-tab-hide-view-header": this.settings.hideViewHeader,
      "borderless-tab-hide-pdf-toolbar": this.settings.hidePdfToolbar
    };
    for (const [className, settingEnabled] of Object.entries(classes)) {
      tabs.classList.toggle(className, enabled && settingEnabled);
    }
    if (!enabled || !this.settings.revealOnHover) this.setHeadersRevealed(tabs, false);
  }
  ensureRevealZone(tabs) {
    if (this.revealZones.has(tabs)) return;
    this.revealZones.add(tabs);
    const revealZone = document.createElement("div");
    revealZone.className = "borderless-tab-reveal-zone";
    tabs.appendChild(revealZone);
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
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Borderless behavior").setHeading();
    new import_obsidian.Setting(containerEl).setName("Reveal headers on hover").setDesc("Show hidden headers when the pointer reaches the top of the tab group.").addToggle((toggle) => toggle.setValue(this.plugin.settings.revealOnHover).onChange(async (value) => {
      animateToggle == null ? void 0 : animateToggle.setDisabled(!value);
      await this.plugin.updateSettings({ revealOnHover: value });
    }));
    let animateToggle;
    new import_obsidian.Setting(containerEl).setName("Animate header transitions").setDesc("Animate headers when they hide and reveal.").addToggle((toggle) => {
      animateToggle = toggle;
      toggle.setDisabled(!this.plugin.settings.revealOnHover).setValue(this.plugin.settings.animate).onChange(async (value) => {
        await this.plugin.updateSettings({ animate: value });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Hidden in borderless mode").setHeading();
    this.addVisibilitySetting(containerEl, "Tab header", "Hide the workspace tab strip.", "hideTabHeader");
    this.addVisibilitySetting(containerEl, "View header", "Hide the note title and back/forward controls.", "hideViewHeader");
    this.addVisibilitySetting(containerEl, "PDF toolbar", "Hide the toolbar in Obsidian\u2019s built-in PDF viewer.", "hidePdfToolbar");
  }
  addVisibilitySetting(containerEl, name, description, key) {
    new import_obsidian.Setting(containerEl).setName(name).setDesc(description).addToggle((toggle) => toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
      await this.plugin.updateSettings({ [key]: value });
    }));
  }
};
