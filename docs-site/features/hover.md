# Hover

Hover support helps you inspect IFC STEP files without leaving the editor.

## STEP ID Hover

Hover over an identifier such as `#12345` to preview the referenced definition.

TODO: Replace this placeholder with a screenshot showing STEP ID hover.

![TODO: STEP ID hover screenshot](/assets/hover-step-id.svg)

## IFC Entity Documentation

Hover over IFC entity names such as `IFCWALL` to view schema documentation from the language server. Entity hover includes a link to the official buildingSMART documentation for the schema version selected for the open file.

TODO: Replace this placeholder with a screenshot showing IFC entity hover documentation.

![TODO: IFC entity hover screenshot](/assets/hover-entity-docs.svg)

## Derived-Value Hover

For supported entities and schemas, hover can include derived values calculated by the language server. This is useful when an IFC attribute is not written directly in the STEP line but can be resolved from schema rules and related data.

TODO: Replace this placeholder with a screenshot showing derived-value hover.

![TODO: Derived-value hover screenshot](/assets/hover-derived-values.svg)

## Limitations

Hover content depends on the IFC language server and the schema selected for the open file. Very large files may use a reduced analysis mode for AST-backed features, so derived-value hover can be unavailable above `ifc.analysis.astFileSizeLimitMb`.
