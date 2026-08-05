# Development

## Run the Extension Locally

Install dependencies and compile the extension:

```bash
npm install
npm run compile
```

Then open `src/extension.ts`, press `F5`, and choose `VS Code Extension Development Host`.

## Package a Local VSIX

```bash
npm run package
```

Install the generated `.vsix` through `Extensions: Install from VSIX...` in VS Code.

## Use a Local Language Server Build

Set `ifc.server.path` in the Extension Development Host settings:

```json
{
  "ifc.server.path": "/absolute/path/to/ifc-language-server"
}
```

