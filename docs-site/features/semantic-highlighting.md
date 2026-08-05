# Syntax And Semantic Highlighting

The extension provides TextMate grammar support for IFC STEP files and can request range-based semantic tokens from the IFC language server.

The language server uses semantic tokens as a range-based syntax-highlighting surface. This is useful for LSP clients that request semantic tokens independently from editor grammar highlighting.

In VS Code today, semantic tokens do not add much visible value for this extension. When VS Code disables its own TextMate-based syntax highlighting for very large files, it also appears to stop requesting semantic tokens for that document. In that state, the server-side range-based tokens cannot fill the gap.

Semantic tokens are still enabled by default:

```json
{
  "ifc.semanticTokens.enabled": true
}
```
