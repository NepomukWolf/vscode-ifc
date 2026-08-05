# Troubleshooting

## Failed to Start: ENOENT

An error such as `Failed to start IFC language server. ENOENT: no such file or directory, stat ...` means the extension tried to start a language-server executable that does not exist at the configured path.

Check `ifc.server.path` first. If this setting points to a deleted or moved binary, the extension will keep trying that path instead of using the extension-managed downloaded language server.

To recover:

1. Open VS Code Settings.
2. Search for `ifc.server.path`.
3. Clear the setting unless you intentionally use a custom local language-server binary.
4. Run `IFC: Restart Language Server`.
5. If needed, run `IFC: Download Language Server`.
6. Run `IFC: Show Resolved Language Server` to confirm the extension is using the expected binary.

Do not point `ifc.server.path` at a binary inside VS Code's extension-managed global storage cache. Those downloaded binaries are managed by the extension and may be cleaned up during updates.

## Language Server Download Fails

Run `IFC: Download Language Server` from the Command Palette to retry the download.

Most users should leave `ifc.server.path` empty. If you are developing or debugging the language server itself and need to use a local server binary, set:

```json
{
  "ifc.server.path": "/absolute/path/to/ifc-language-server"
}
```

## Restart the Language Server

Run `IFC: Restart Language Server` after changing settings or when editor features stop responding.

## Check the Resolved Server

Run `IFC: Show Resolved Language Server` to inspect which language server binary the extension is using.

## Enable Protocol Tracing

Set `ifc.trace.server` to `messages` or `verbose` when you need language-client protocol logs for debugging.

## Local Schema Issues

Use `ifc.schema.overwriteExpSchemaWithLocal` to force one local `.exp` schema, or `ifc.schema.addLocalSchemaToSelection` to add one or more local schema files or directories to the server's schema lookup pool.
