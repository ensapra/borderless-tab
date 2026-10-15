import { MarkdownView, Menu, Plugin, View, WorkspaceLeaf } from "obsidian";

const BORDERLESS_CLASS = "borderless-tab-enabled";

export default class BorderlessTabPlugin extends Plugin {
	private readonly borderlessLeaves = new WeakSet<WorkspaceLeaf>();

	onload(): void {
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
		tabs?.classList.toggle(BORDERLESS_CLASS, enabled);
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
