# Getting Started

## Install the Extension

The extension is available on the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=wolfnepomuk.vscode-ifc) and can be installed from VS Code's built-in Extensions view.

1. Open VS Code.
2. Open the Extensions view.
3. Search for `IFC Language Tools`.
4. Select the extension published by `wolfnepomuk`.
5. Click **Install**.

The extension is also available on [Open VSX](https://open-vsx.org/extension/wolfnepomuk/vscode-ifc).

## Install from a VSIX Release

If you prefer a manual install, prebuilt `.vsix` packages are available on the GitHub releases page:

<https://github.com/NepomukWolf/vscode-ifc/releases>

To install a `.vsix` release:

1. Download the latest `.vsix` file from the release assets.
2. Open VS Code.
3. Run `Extensions: Install from VSIX...` from the Command Palette.
4. Select the downloaded `.vsix` file.
5. Reload VS Code if prompted.

## Open an IFC File

Open any `.ifc`, `.step`, or `.stp` file in VS Code. For normal use, the extension automatically downloads the IFC language server version pinned by the installed extension release.

## First Things to Try

- Hover over a STEP identifier such as `#12345`.
- Hover over an IFC entity name such as `IFCWALL`.
- Use `F12` or Ctrl/Cmd-click on a STEP identifier.
- Use `Shift+F12` to find references.
- Run `IFC: Preview Element in 3D` while your cursor is on an element.
