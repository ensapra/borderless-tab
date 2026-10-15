import {
	App,
	MarkdownView,
	Menu,
	Plugin,
	PluginSettingTab,
	ToggleComponent,
	Setting,
	View,
	WorkspaceLeaf
} from "obsidian";

const BORDERLESS_CLASS = "borderless-tab-enabled";

interface BorderlessSettings {
	animate: boolean;
	revealOnHover: boolean;
	hideTabHeader: boolean;
	hideViewHeader: boolean;
	hidePdfToolbar: boolean;
}

const DEFAULT_SETTINGS: BorderlessSettings = {
	animate: true,
	revealOnHover: true,
	hideTabHeader: true,
	hideViewHeader: true,
	hidePdfToolbar: false
};

export default class BorderlessTabPlugin extends Plugin {
	settings: BorderlessSettings = { ...DEFAULT_SETTINGS };
	private readonly borderlessLeaves = new WeakSet<WorkspaceLeaf>();
	private readonly revealZones = new WeakSet<HTMLElement>();
	private readonly revealTimers = new WeakMap<HTMLElement, number>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new BorderlessTabSettingTab(this.app, this));
		this.patchPaneMenu();
		this.registerEvent(this.app.workspace.on("layout-change", () => this.restoreBorderlessClasses()));
		this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, view) => {
			if (view instanceof MarkdownView) this.addPaneMenuItem(menu, view.leaf);
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

	onunload(): void {
		this.app.workspace.iterateAllLeaves((leaf) => this.setLeafBorderless(leaf, false));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async updateSettings(changes: Partial<BorderlessSettings>): Promise<void> {
		Object.assign(this.settings, changes);
		await this.saveData(this.settings);

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (this.borderlessLeaves.has(leaf)) this.setLeafBorderless(leaf, true);
		});
	}

	private patchPaneMenu(): void {
		const originalOnPaneMenu = View.prototype.onPaneMenu;
		const plugin = this;

		View.prototype.onPaneMenu = function (menu: Menu, source: string): void {
			originalOnPaneMenu.call(this, menu, source);
			if (source === "tab-header" || source === "more-options") {
				plugin.addPaneMenuItem(menu, this.leaf);
			}
		};

		this.register(() => {
			View.prototype.onPaneMenu = originalOnPaneMenu;
		});
	}

	private addPaneMenuItem(menu: Menu, leaf: WorkspaceLeaf): void {
		const enabled = this.borderlessLeaves.has(leaf);
		menu.addItem((item) => {
			item
				.setTitle(enabled ? "Restore tab borders" : "Make tab borderless")
				.setIcon(enabled ? "panels-top-left" : "square-dashed")
				.setChecked(enabled)
				.onClick(() => this.toggleLeaf(leaf));
		});
	}

	private toggleLeaf(leaf: WorkspaceLeaf): void {
		this.setLeafBorderless(leaf, !this.borderlessLeaves.has(leaf));
	}

	private restoreBorderlessClasses(): void {
		window.requestAnimationFrame(() => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				if (this.borderlessLeaves.has(leaf)) this.setLeafBorderless(leaf, true);
			});
		});
	}

	private setLeafBorderless(leaf: WorkspaceLeaf, enabled: boolean): void {
		if (enabled) {
			this.borderlessLeaves.add(leaf);
		} else {
			this.borderlessLeaves.delete(leaf);
		}

		const leafElement = this.findAncestor(leaf.view.containerEl, "workspace-leaf");
		const tabs = this.findAncestor(leafElement ?? leaf.view.containerEl, "workspace-tabs");

		leaf.view.containerEl.classList.toggle(BORDERLESS_CLASS, enabled);
		leafElement?.classList.toggle(BORDERLESS_CLASS, enabled);
		if (tabs) {
			tabs.classList.toggle(BORDERLESS_CLASS, enabled);
			this.applySettingsClasses(tabs, enabled);
			this.ensureRevealZone(tabs);
			if (!enabled) this.setHeadersRevealed(tabs, false);
		}
	}

	private applySettingsClasses(tabs: HTMLElement, enabled: boolean): void {
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

	private ensureRevealZone(tabs: HTMLElement): void {
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
			}, 1000);
			this.revealTimers.set(tabs, timer);
		});

		this.registerDomEvent(tabs, "mousemove", (event) => {
			if (!this.settings.revealOnHover || !tabs.classList.contains(BORDERLESS_CLASS) || !tabs.classList.contains("borderless-tab-hover-reveal")) return;

			const rect = tabs.getBoundingClientRect();
			const pointerIsAtTop = event.clientY - rect.top <= 18;
			const target = event.target as Element | null;
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

	private setHeadersRevealed(tabs: HTMLElement, revealed: boolean): void {
		if (revealed && !this.settings.revealOnHover) revealed = false;
		const timer = this.revealTimers.get(tabs);
		if (timer !== undefined) {
			window.clearTimeout(timer);
			this.revealTimers.delete(tabs);
		}
		tabs.classList.toggle("borderless-tab-revealed", revealed);
	}

	private findAncestor(element: HTMLElement, className: string): HTMLElement | null {
		let current: HTMLElement | null = element;
		while (current) {
			if (current.classList.contains(className)) return current;
			current = current.parentElement;
		}
		return null;
	}
}

class BorderlessTabSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: BorderlessTabPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Borderless behavior")
			.setHeading();

		new Setting(containerEl)
			.setName("Reveal headers on hover")
			.setDesc("Show hidden headers when the pointer reaches the top of the tab group.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.revealOnHover)
				.onChange(async (value) => {
					animateToggle?.setDisabled(!value);
					await this.plugin.updateSettings({ revealOnHover: value });
				}));

		let animateToggle: ToggleComponent | undefined;
		new Setting(containerEl)
			.setName("Animate header transitions")
			.setDesc("Animate headers when they hide and reveal.")
			.addToggle((toggle) => {
				animateToggle = toggle;
				toggle
					.setDisabled(!this.plugin.settings.revealOnHover)
					.setValue(this.plugin.settings.animate)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ animate: value });
					});
			});

		new Setting(containerEl)
			.setName("Hidden in borderless mode")
			.setHeading();

		this.addVisibilitySetting(containerEl, "Tab header", "Hide the workspace tab strip.", "hideTabHeader");
		this.addVisibilitySetting(containerEl, "View header", "Hide the note title and back/forward controls.", "hideViewHeader");
		this.addVisibilitySetting(containerEl, "PDF toolbar", "Hide the toolbar in Obsidian’s built-in PDF viewer.", "hidePdfToolbar");
	}

	private addVisibilitySetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		key: "hideTabHeader" | "hideViewHeader" | "hidePdfToolbar"
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings[key])
				.onChange(async (value) => {
					await this.plugin.updateSettings({ [key]: value });
				}));
	}
}
