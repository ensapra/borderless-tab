import {
	App,
	MarkdownView,
	Menu,
	Plugin,
	PluginSettingTab,
	SettingDefinitionItem,
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
	autoPdf: boolean;
	autoWebview: boolean;
	autoMarkdown: boolean;
	autoOther: boolean;
}

const DEFAULT_SETTINGS: BorderlessSettings = {
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

const BORDERLESS_SETTING_KEYS: Array<keyof BorderlessSettings> = [
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isBorderlessSettingKey(key: string): key is keyof BorderlessSettings {
	return BORDERLESS_SETTING_KEYS.some((settingKey) => settingKey === key);
}

function readSettings(data: unknown): Partial<BorderlessSettings> {
	if (!isRecord(data)) return {};

	const settings: Partial<BorderlessSettings> = {};
	for (const key of BORDERLESS_SETTING_KEYS) {
		if (typeof data[key] === "boolean") settings[key] = data[key];
	}
	return settings;
}

export default class BorderlessTabPlugin extends Plugin {
	settings: BorderlessSettings = { ...DEFAULT_SETTINGS };
	private readonly borderlessLeaves = new WeakSet<WorkspaceLeaf>();
	private readonly automaticBorderlessDisabledLeaves = new WeakSet<WorkspaceLeaf>();
	private readonly revealZones = new WeakSet<HTMLElement>();
	private readonly revealTimers = new WeakMap<HTMLElement, number>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new BorderlessTabSettingTab(this.app, this));
		this.patchPaneMenu();
		this.registerEvent(this.app.workspace.on("layout-change", () => this.restoreBorderlessClasses()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.restoreBorderlessClasses()));
		this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, view) => {
			if (view instanceof MarkdownView) this.addPaneMenuItem(menu, view.leaf);
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

	onunload(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const tabs = this.findTabs(leaf);
			if (tabs) this.clearWorkspaceClasses(tabs);
		});
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData() as unknown;
		this.settings = { ...DEFAULT_SETTINGS, ...readSettings(data) };
	}

	async updateSettings(changes: Partial<BorderlessSettings>): Promise<void> {
		Object.assign(this.settings, changes);
		await this.saveData(this.settings);
		this.restoreBorderlessClasses();
	}

	private patchPaneMenu(): void {
		const originalOnPaneMenu = View.prototype.onPaneMenu.bind(View.prototype);
		const addPaneMenuItem = this.addPaneMenuItem.bind(this);

		View.prototype.onPaneMenu = function (this: View, menu: Menu, source: string): void {
			originalOnPaneMenu(menu, source);
			if (source === "tab-header" || source === "more-options") {
				addPaneMenuItem(menu, this.leaf);
			}
		};

		this.register(() => {
			View.prototype.onPaneMenu = originalOnPaneMenu;
		});
	}

	private addPaneMenuItem(menu: Menu, leaf: WorkspaceLeaf): void {
		const enabled = this.isLeafBorderless(leaf);
		menu.addItem((item) => {
			item
				.setTitle(enabled ? "Restore tab borders" : "Make tab borderless")
				.setIcon(enabled ? "panels-top-left" : "square-dashed")
				.setChecked(enabled)
				.onClick(() => this.toggleLeaf(leaf));
		});
	}

	private toggleLeaf(leaf: WorkspaceLeaf): void {
		this.setLeafBorderless(leaf, !this.isLeafBorderless(leaf));
	}

	private restoreBorderlessClasses(): void {
		window.requestAnimationFrame(() => {
			const workspaceTabs = new Set<HTMLElement>();
			const borderlessTabs = new Set<HTMLElement>();
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

	private setLeafBorderless(leaf: WorkspaceLeaf, enabled: boolean): void {
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

	private applyWorkspaceState(tabs: HTMLElement): void {
		tabs.classList.add(BORDERLESS_CLASS);
		this.applySettingsClasses(tabs, true);
		this.ensureRevealZone(tabs);
	}

	private isLeafBorderless(leaf: WorkspaceLeaf): boolean {
		return this.borderlessLeaves.has(leaf) || (
			!this.automaticBorderlessDisabledLeaves.has(leaf) && this.isAutomaticallyBorderless(leaf)
		);
	}

	private isAutomaticallyBorderless(leaf: WorkspaceLeaf): boolean {
		const view = leaf.view;
		const viewType = view.getViewType().toLowerCase();
		const extension = view instanceof MarkdownView ? view.file?.extension.toLowerCase() : undefined;
		const isPdf = extension === "pdf" || viewType === "pdf" || viewType.includes("pdf");
		if (isPdf) return this.settings.autoPdf;

		const isWebview = viewType.includes("webview") || viewType.includes("web-view") ||
			viewType.includes("webviewer") || viewType.includes("browser") ||
			view.containerEl.classList.contains("webviewer") ||
			view.containerEl.classList.contains("webview");
		if (isWebview) return this.settings.autoWebview;

		if (view instanceof MarkdownView || extension === "md" || extension === "markdown") {
			return this.settings.autoMarkdown;
		}

		return this.settings.autoOther;
	}

	private clearWorkspaceClasses(tabs: HTMLElement): void {
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

	private findTabs(leaf: WorkspaceLeaf): HTMLElement | null {
		const leafElement = this.findAncestor(leaf.view.containerEl, "workspace-leaf");
		return this.findAncestor(leafElement ?? leaf.view.containerEl, "workspace-tabs");
	}

	private applySettingsClasses(tabs: HTMLElement, enabled: boolean): void {
		const classes: ReadonlyArray<readonly [string, boolean]> = [
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

	private ensureRevealZone(tabs: HTMLElement): void {
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

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Borderless behavior",
				items: [
					this.toggleDefinition("Reveal headers on hover", "Show hidden headers when the pointer reaches the top of the tab group.", "revealOnHover"),
					this.toggleDefinition("Animate header transitions", "Animate headers when they hide and reveal.", "animate", () => !this.plugin.settings.revealOnHover)
				]
			},
			{
				name: "Hidden in borderless mode",
				items: [
					this.toggleDefinition("Tab header", "Hide the workspace tab strip.", "hideTabHeader"),
					this.toggleDefinition("View header", "Hide the note title and back/forward controls.", "hideViewHeader"),
					this.toggleDefinition("PDF toolbar", "Hide the toolbar in Obsidian's built-in PDF viewer.", "hidePdfToolbar")
				]
			},
			{
				name: "Automatic borderless files",
				items: [
					this.toggleDefinition("PDF files", "Automatically make PDF views borderless.", "autoPdf"),
					this.toggleDefinition("Web views", "Automatically make web views and browser views borderless.", "autoWebview"),
					this.toggleDefinition("Markdown files", "Automatically make Markdown notes borderless.", "autoMarkdown"),
					this.toggleDefinition("Other views", "Automatically make all other view types borderless.", "autoOther")
				]
			}
		];
	}

	getControlValue(key: string): unknown {
		return isBorderlessSettingKey(key) ? this.plugin.settings[key] : undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (!isBorderlessSettingKey(key) || typeof value !== "boolean") return;
		await this.plugin.updateSettings({ [key]: value });
		this.refreshDomState();
	}

	private toggleDefinition(
		name: string,
		desc: string,
		key: keyof BorderlessSettings,
		disabled?: () => boolean
	): SettingDefinitionItem {
		return {
			name,
			desc,
			control: { type: "toggle", key, defaultValue: DEFAULT_SETTINGS[key], disabled }
		};
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
		new Setting(containerEl)
			.setName("Automatic borderless files")
			.setHeading();
		this.addAutomaticSetting(containerEl, "PDF files", "Automatically make PDF views borderless.", "autoPdf");
		this.addAutomaticSetting(containerEl, "Web views", "Automatically make web views and browser views borderless.", "autoWebview");
		this.addAutomaticSetting(containerEl, "Markdown files", "Automatically make Markdown notes borderless.", "autoMarkdown");
		this.addAutomaticSetting(containerEl, "Other views", "Automatically make all other view types borderless.", "autoOther");
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

	private addAutomaticSetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		key: "autoPdf" | "autoWebview" | "autoMarkdown" | "autoOther"
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
