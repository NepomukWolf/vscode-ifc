# Hover

Hover support helps you inspect IFC STEP files without leaving the editor.

## STEP ID Hover

Hover over an identifier such as `#12345` to preview the referenced definition.

![STEP ID hover preview](/assets/hover-step-id.png)

## IFC Entity Documentation

Hover over IFC entity names such as `IFCWALL` to view schema documentation from the language server. Entity hover includes a link to the official buildingSMART documentation for the schema version selected for the open file.

![IFC entity hover documentation](/assets/hover-entity-docs.png)

## Derived-Value Hover

For supported entities and schemas, hover can include derived values calculated by the language server. This is useful when an IFC attribute is not written directly in the STEP line but can be resolved from schema rules and related data.

![Derived-value hover](/assets/hover-derived-value.png)

## Limitations

Hover content depends on the IFC language server and the schema selected for the open file. Very large files may use a reduced analysis mode for AST-backed features, so derived-value hover can be unavailable above `ifc.analysis.astFileSizeLimitMb`.
