# Diagnostics

Diagnostics report IFC schema and reference issues directly in the editor and the VS Code Problems view.

The language server can report issues such as:

- unknown entity names
- invalid references
- wrong primitive value types
- invalid enumeration values
- incorrect cardinalities

![Diagnostics in the editor and Problems view](/assets/diagnostics-problems-view.png)

## Limitations

Diagnostics depend on schema selection and AST-backed analysis. Files larger than `ifc.analysis.astFileSizeLimitMb` keep lighter editor features available, but schema diagnostics may be skipped.
