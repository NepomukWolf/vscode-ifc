# Changelog

## 0.4.1

- Update extension build and packaging dependencies
- Resolve dependency audit findings in archive extraction packages
- Pin VS Code API typings to the minimum supported VS Code version

## 0.4.0

- Add 3D previews for IFC elements directly in VS Code
- Add `Preview in 3D` CodeLens, editor actions, and Command Palette support
- Include assembly children and spatially contained elements in previews
- Add click-to-reveal navigation from viewer geometry back to the IFC source
- Add settings for CodeLens visibility, child inclusion, and maximum preview file size

## 0.3.3

- Update to IFC Language Server `v0.4.1`
- Add automatic language-server installation support for Intel Macs

## 0.3.0

- Update to IFC Language Server `v0.4.0`
- Add settings for AST file size limit and semantic-token enablement

## 0.2.0

- Update to IFC Language Server `v0.3.0`
- Add diagnostics powered by the language server
- Add settings for local `.exp` schema override and schema selection

## 0.1.0

- Initial release
- Syntax highlighting for IFC STEP files
- Bracket matching and colored bracket pairs
- Hover support through the IFC Language Server
- Go to definition through the IFC Language Server
- Find references through the IFC Language Server
- Automatic installation of the extension-pinned IFC Language Server release
- Commands for downloading, restarting, and inspecting the configured language server
