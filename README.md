# Borderless Tab

An Obsidian plugin that adds a borderless toggle to every open tab.

> **AI disclosure:** This plugin was fully made by AI, including the source code, styling, configuration, and documentation.

## Features

- Toggle borderless mode independently for each open tab from Obsidian’s native pane menu.
- Remove borders, outlines, and shadows from tab content.
- Hide the tab strip and view header, including the note title and back/forward controls.
- Reveal the hidden headers temporarily by moving the pointer to the top of the tab group.
- Optionally hide the built-in PDF toolbar.
- Configure animation, hover reveal, and hidden elements from the plugin settings.
- Use the command palette with **Toggle borderless tab** as an alternative.

![Uploading image.png…]()

## Usage

1. Enable **Borderless Tab** in Obsidian’s community plugins settings.
2. Right-click inside the note view, open the tab’s right-click menu, or use the three-dot pane menu—the same menu containing **Split right** and **Split down**—then choose **Make tab borderless**.
3. Use **Restore tab borders** from that menu to undo it.

The setting applies only to the current open tab and is reset when that tab is closed.


## Development

Install dependencies and build the plugin:

```bash
npm install
npm run build
```

For continuous development builds:

```bash
npm run dev
```

The generated `main.js`, along with `manifest.json` and `styles.css`, is loaded directly by Obsidian.
