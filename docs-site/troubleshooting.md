# Troubleshooting

## Language Server Download Fails

Run `IFC: Download Language Server` from the Command Palette to retry the download.

If you need to use a local server binary, set:

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

