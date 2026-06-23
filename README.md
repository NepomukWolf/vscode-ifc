# IFC Language Support for VS Code

[![Visual Studio Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

This extension adds language support for IFC STEP files (`.ifc`, `.step`, `.stp`) in Visual Studio Code and is powered by the [IFC Language Server](https://github.com/NepomukWolf/IFC-Language-Server).

For normal use, install the extension and open an IFC file. The extension automatically installs the language server version pinned by the current extension release.

It combines local editor support with the IFC Language Server to provide:

- Syntax highlighting
- Bracket matching and colored bracket pairs
- Diagnostics
- Hover information
- Go to definition
- Find references
- Semantic tokens
- 3D preview of individual elements

## Installation

No manual language-server setup is required for normal use.

### Install from a `.vsix` Release

Prebuilt `.vsix` packages are available on the GitHub releases page:

<https://github.com/NepomukWolf/vscode-ifc/releases>

To install the extension from a release:

1. Open the releases page.
2. Download the latest `.vsix` file from the release assets.
3. Open VS Code.
4. Press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) to open the Command Palette.
5. Search for `Install from VSIX` and select `Extensions: Install from VSIX...`.
6. Choose the downloaded `.vsix` file.
7. Reload VS Code if prompted.

## Features

### Hover Preview for Step IDs

Hover over STEP identifiers such as `#12345` to preview their definitions.

![Hover Preview](resources/reference_hover.png)

### IFC Entity Documentation on Hover

Hover over IFC entity names such as `IFCWALL` to view schema documentation.

![Entity Hover](resources/entity_hover.png)

### Diagnostics

The language server validates IFC entities and attribute values directly in the editor against the correct IFC schema.

It reports issues such as invalid references, wrong primitive value types, unknown entity names, and invalid enumeration values, incorrect cardinalities.

![Diagnostics](resources/diagnostics1.png)

![Diagnostics](resources/diagnostics2.png)

### Go to Definition

Use `F12` or Ctrl/Cmd-click on STEP identifiers such as `#12345` to jump directly to their definitions.

### Find All References

Use `Shift + F12` to locate all references to an entity.

![Find References](resources/go_to_reference.png)

### Syntax Highlighting

Clean syntax highlighting for IFC STEP files.

![Syntax Highlighting](resources/syntax_highlighting.png)

### 3D Element Preview

Render any IFC element in 3D without leaving the editor. Place the cursor on an element (or use the `Preview in 3D` CodeLens above any element with geometry) and run **IFC: Preview Element in 3D**. A side panel renders that element and its assembly children; orbit, zoom, and click geometry to jump back to its source line.

Rather than loading the whole model, the extension extracts just the selected element's reference closure into a tiny sub-model, so a single element renders quickly even from very large federated files. Geometry is produced by [web-ifc](https://github.com/ThatOpen/engine_web-ifc) and drawn with [three.js](https://threejs.org/).

After installation, open an IFC file and the extension will automatically download the required IFC language server.

## Usage

1. Open an IFC file (`.ifc`, `.step`, or `.stp`) in Visual Studio Code.
2. Review diagnostics directly in the editor and Problems view.
3. Hover over STEP IDs such as `#12345` or IFC entity names such as `IFCWALL`.
4. Use `F12` or Ctrl/Cmd-click for go to definition.
5. Use `Shift + F12` for find references.

## Settings

Most users do not need to change anything. Advanced settings are available for development and troubleshooting:

- `ifc.server.path`: Absolute path to a custom IFC language server binary.
- `ifc.server.args`: Extra command-line arguments passed to the server.
- `ifc.server.versionOverride`: Advanced override for the Git tag to download instead of the extension-pinned version.
- `ifc.server.githubRepository`: GitHub repository used for IFC language server downloads, in `owner/repo` form.
- `ifc.server.downloadAssetPattern`: Optional substring used to narrow the selected release asset.
- `ifc.schema.overwriteExpSchemaWithLocal`: Absolute path to a local `.exp` schema file to force for diagnostics and hover.
- `ifc.schema.addLocalSchemaToSelection`: List of local `.exp` files or directories containing `.exp` files that the language server may use for schema selection.
- `ifc.analysis.astFileSizeLimitMb`: Maximum file size in MiB for AST-backed language-server features. Larger files keep basic hover, navigation, and semantic tokens available, but skip schema diagnostics and derived-value hover.
- `ifc.semanticTokens.enabled`: Enable range-based semantic tokens provided by the language server.
- `ifc.trace.server`: Trace level for the VS Code language client.
- `ifc.viewer.includeChildren`: Include an element's decomposition/assembly children in the 3D preview.
- `ifc.viewer.codeLens`: Show the `Preview in 3D` CodeLens above any element that has geometry (follows the viewport on large files).
- `ifc.viewer.maxFileSizeMb`: Maximum IFC file size the 3D preview will index to extract an element.

Changes to IFC settings restart the language server automatically.

## Commands

- `IFC: Download Language Server`
- `IFC: Restart Language Server`
- `IFC: Show Resolved Language Server`
- `IFC: Preview Element in 3D`

## Editor Configuration

For IFC files, the extension enables these defaults:

- `editor.colorDecorators`: disabled
- `editor.matchBrackets`: always
- `editor.bracketPairColorization.enabled`: enabled

You can override these in your own VS Code settings if desired.

## Development

### Running the Extension

```bash
npm install
npm run compile
```

Then open `src/extension.ts`, press `F5`, and choose `VS Code Extension Development Host`.
A new VS Code window will open.

Alternatively, you can package the extension as a `.vsix` and install it locally:

```bash
npm run package
```

This creates a `.vsix` file. In VS Code, press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS), search for `Install from VSIX`, and choose the generated `.vsix` file.

### Using a Local Language Server Build

If you are developing the language server itself, point the extension at a local build with:

```json
{
  "ifc.server.path": "/absolute/path/to/ifc-language-server"
}
```

The easiest place to set this while testing is the Extension Development Host's settings JSON.

### Using Local `.exp` Schemas

The extension passes local schema settings to the IFC Language Server through LSP initialization options.

```json
{
  "ifc.schema.overwriteExpSchemaWithLocal": "/absolute/path/to/IFC4x2.exp",
  "ifc.analysis.astFileSizeLimitMb": 128,
  "ifc.semanticTokens.enabled": true,
  "ifc.schema.addLocalSchemaToSelection": [
    "/absolute/path/to/IFC4x1.exp",
    "/absolute/path/to/custom-schemas"
  ]
}
```

Use `ifc.schema.overwriteExpSchemaWithLocal` to force one schema. Use `ifc.schema.addLocalSchemaToSelection` to add individual `.exp` files or directories to the server's schema lookup pool.

## Language Server

This extension is powered by the [IFC Language Server](https://github.com/NepomukWolf/IFC-Language-Server).

For normal use, the extension automatically installs the language server version pinned by the current extension release.

For release packaging, the extension expects platform-specific GitHub release assets whose names include operating-system and architecture hints such as `macos-arm64`, `linux-x64`, or `windows-x64`. Supported asset formats are raw executables, `.zip`, `.tar.gz`, and `.tgz`. Archives should contain either `ifc-language-server` or `ifc-lsp`, with `.exe` on Windows.

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
