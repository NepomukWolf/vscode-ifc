# Changelog

## Unreleased

- Include doors, windows, and other hosted opening fillings in their host's 3D preview
- Add contextual double-click navigation into products and source-backed geometry parts
- Add Back and Forward history that restores both the preview context and IFC source position
- Preserve the camera direction when switching preview contexts and avoid transient viewer resizing
- Improve the viewer HUD with the source path and clearer included-element information

## 0.5.1

- Disable IFC inlay hints by default while keeping them available on demand

## 0.5.0

- Update to IFC Language Server `v0.6.0`
- Improve diagnostics and recovery guidance for stale custom language-server paths
- Reorganize VS Code settings into user-facing and debugging sections

## 0.4.2

- Update to IFC Language Server `v0.5.0`
- Add language-server support for enum hover, signature help, and local STEP ID document highlights

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
