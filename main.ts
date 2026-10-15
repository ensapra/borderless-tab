import { Plugin, WorkspaceLeaf, setIcon } from "obsidian";

const BORDERLESS_CLASS = "borderless-tab-enabled";
const TOGGLE_CLASS = "borderless-tab-toggle";

export default class BorderlessTabPlugin extends Plugin {
	private readonly borderlessLeaves = new WeakSet<WorkspaceLeaf>();
	private readonly tabButtons = new WeakMap<WorkspaceLeaf, HTMLButtonElement>();
	private layoutChangeHandler = (): void => this.refreshTabToggles();

	async onload(): Promise<void> {
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

	onunload(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			leaf.view.containerEl.removeClass(BORDERLESS_CLASS);
			this.tabButtons.get(leaf)?.remove();
		});
	}

	private refreshTabToggles(): void {
		window.requestAnimationFrame(() => {
			this.app.workspace.iterateAllLeaves((leaf) => this.ensureTabToggle(leaf));
		});
	}

	private ensureTabToggle(leaf: WorkspaceLeaf): void {
		const header = this.findTabHeader(leaf);
		if (!header || this.tabButtons.has(leaf)) return;

		const buttonHost = header.querySelector<HTMLElement>(".workspace-tab-header-inner") ?? header;
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

	private toggleLeaf(leaf: WorkspaceLeaf): void {
		if (this.borderlessLeaves.has(leaf)) {
			this.borderlessLeaves.delete(leaf);
		} else {
			this.borderlessLeaves.add(leaf);
		}
		leaf.view.containerEl.toggleClass(BORDERLESS_CLASS, this.borderlessLeaves.has(leaf));
		this.updateButton(leaf);
	}

	private updateButton(leaf: WorkspaceLeaf): void {
		const button = this.tabButtons.get(leaf);
		if (!button) return;
		const enabled = this.borderlessLeaves.has(leaf);
		setIcon(button, enabled ? "panels-top-left" : "square-dashed");
		button.toggleClass("is-enabled", enabled);
		button.setAttribute("aria-pressed", String(enabled));
		button.setAttribute("title", enabled ? "Restore tab borders" : "Make tab borderless");
	}

	private findTabHeader(leaf: WorkspaceLeaf): HTMLElement | null {
		const leafElement = leaf.view.containerEl.closest<HTMLElement>(".workspace-leaf");
		const tabs = leafElement?.closest<HTMLElement>(".workspace-tabs");
		if (!tabs) return null;

		const leaves = Array.from(tabs.querySelectorAll<HTMLElement>(".workspace-leaf"));
		const leafIndex = leaves.indexOf(leafElement as HTMLElement);
		if (leafIndex < 0) return null;

		const headers = Array.from(tabs.querySelectorAll<HTMLElement>(".workspace-tab-header"));
		return headers[leafIndex] ?? null;
	}

}
