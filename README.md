# Borderless Tab

An Obsidian plugin that adds a borderless toggle to every open tab.

> **AI disclosure:** This plugin was fully made by AI, including the source code, styling, configuration, and documentation.

## Features

- Toggle borderless mode independently for each open tab.
- Remove borders, outlines, and shadows from tab content.
- Use the command palette with **Toggle borderless tab** as an alternative.

## Usage

1. Enable **Borderless Tab** in Obsidian’s community plugins settings.
2. Click the square toggle icon in any tab header.
3. Click it again to restore the tab’s borders.

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
