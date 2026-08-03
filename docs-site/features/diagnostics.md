# Diagnostics

Diagnostics report IFC schema and reference issues directly in the editor and the VS Code Problems view.

The language server can report issues such as:

- unknown entity names
- invalid references
- wrong primitive value types
- invalid enumeration values
- incorrect cardinalities

TODO: Replace this placeholder with a screenshot showing diagnostics in the editor and Problems view.

![TODO: Diagnostics screenshot](/assets/diagnostics-problems-view.svg)

## Limitations

Diagnostics depend on schema selection and AST-backed analysis. Files larger than `ifc.analysis.astFileSizeLimitMb` keep lighter editor features available, but schema diagnostics may be skipped.
