# Configuration

Most users do not need to change settings. Advanced settings are available for development, schema experiments, troubleshooting, and viewer behavior.

TODO: Replace this placeholder with a screenshot showing IFC settings in VS Code.

![TODO: Settings screenshot](/assets/settings.svg)

## Language Server

- `ifc.server.path`: absolute path to a custom IFC language server binary
- `ifc.server.args`: extra command-line arguments passed to the server
- `ifc.server.versionOverride`: Git tag to download instead of the extension-pinned version
- `ifc.server.githubRepository`: GitHub repository used for language server downloads
- `ifc.server.downloadAssetPattern`: substring used to narrow the selected release asset
- `ifc.trace.server`: trace level for language server protocol traffic

## Schema

- `ifc.schema.overwriteExpSchemaWithLocal`: force diagnostics and hover to use a local `.exp` schema file
- `ifc.schema.addLocalSchemaToSelection`: add local `.exp` files or directories to schema selection

## Analysis

- `ifc.analysis.astFileSizeLimitMb`: maximum file size in MiB for AST-backed language-server features
- `ifc.semanticTokens.enabled`: enable range-based semantic tokens

## Viewer

- `ifc.viewer.includeChildren`: include decomposition or assembly children in 3D preview
- `ifc.viewer.codeLens`: show `Preview in 3D` CodeLens above elements with geometry
- `ifc.viewer.maxFileSizeMb`: maximum IFC file size the 3D preview will index

Changes to IFC settings restart the language server automatically.
