# VS Code Extension Docs Site Plan

This is a handoff note for adding a real documentation site to the VS Code IFC extension repository.

## Goal

Create a small, maintainable documentation site for the VS Code extension where users can browse
features by task and learn how to access them inside VS Code.

The repository README should stay focused on:

- what the extension is
- installation and local development
- required language-server setup
- links to docs, issues, and releases

The docs site should cover user-facing workflows in more detail.

## Recommended Approach

Use GitHub Pages for hosting and VitePress for the docs site.

Reasons:

- GitHub Pages is free and works directly from the repository.
- VitePress produces a static site with sidebar navigation from Markdown files.
- The VS Code extension repo likely already uses a Node/TypeScript toolchain.
- The setup is small enough to maintain without adding much project overhead.

## Suggested Structure

Add a dedicated docs site folder:

```text
docs-site/
  package.json
  index.md
  getting-started.md
  configuration.md
  troubleshooting.md
  features/
    hover.md
    navigation.md
    outline.md
    boilerplate.md
    diagnostics.md
    semantic-highlighting.md
    3d-view.md
  .vitepress/
    config.ts
```

## First Documentation Scope

Start with concise pages for the workflows users already see in VS Code:

- Getting started
- Opening IFC files
- Hover information
- Go to definition and references
- Outline / document symbols
- IFC boilerplate snippets and code actions
- Diagnostics
- Semantic highlighting
- 3D view / geometry commands
- Configuration
- Troubleshooting

Each feature page should answer:

- what the feature does
- how to invoke it in VS Code
- what limitations currently apply

Keep the first version short. The main value is stable, linkable pages for common workflows.

## VitePress Configuration

For GitHub Pages under the repository URL, configure the base path to the repo name:

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/vscode-ifc/',
  title: 'IFC for VS Code',
  description: 'VS Code extension documentation for IFC STEP files',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Features', link: '/features/hover' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Troubleshooting', link: '/troubleshooting' }
        ]
      },
      {
        text: 'Features',
        items: [
          { text: 'Hover', link: '/features/hover' },
          { text: 'Navigation', link: '/features/navigation' },
          { text: 'Outline', link: '/features/outline' },
          { text: 'Boilerplate', link: '/features/boilerplate' },
          { text: 'Diagnostics', link: '/features/diagnostics' },
          { text: 'Semantic Highlighting', link: '/features/semantic-highlighting' },
          { text: '3D View', link: '/features/3d-view' }
        ]
      }
    ]
  }
})
```

If the final repository name or Pages path is different, update `base`.

## Package Scripts

Example `docs-site/package.json`:

```json
{
  "private": true,
  "scripts": {
    "docs:dev": "vitepress dev",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.6.0"
  }
}
```

Use the current VitePress version when implementing.

## GitHub Pages Deployment

Add a GitHub Actions workflow such as `.github/workflows/deploy-docs.yml`:

```yaml
name: Deploy Docs

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: docs-site/package-lock.json
      - run: npm ci
        working-directory: docs-site
      - run: npm run docs:build
        working-directory: docs-site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs-site/.vitepress/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then enable Pages in GitHub:

```text
Settings -> Pages -> Source -> GitHub Actions
```

The default public URL should be:

```text
https://NepomukWolf.github.io/vscode-ifc/
```

## README Integration

After the docs site exists, update the extension README with a short docs link:

```md
## Documentation

User documentation is available at:

https://NepomukWolf.github.io/vscode-ifc/
```

The README should not duplicate every feature page. It should point users to the docs site for
feature usage and troubleshooting.

## Implementation Notes

- Keep documentation updates part of future feature PRs.
- Prefer screenshots or short GIFs for VS Code-only workflows once the first text version exists.
- Avoid documenting language-server internals in the extension docs unless they affect user behavior.
- Keep limitations explicit so users understand what is implemented in the extension and what comes
  from the language server.
