# Editing Assistance

The language server provides schema-backed editing assistance for IFC entity arguments and file scaffolding.

These features are especially useful in education, when learning how IFC STEP files are structured, and for people working with unpublished or experimental schema extensions where manually inspecting entity arguments is part of the workflow.

## Signature Help

While editing an IFC entity argument list, VS Code can show signature help when you type `(` or `,`. The signature shows the entity's attribute names and highlights the active argument.

Parameter documentation can include the expected type, whether the attribute is optional, and whether it may be omitted with `*`.

TODO: Replace this placeholder with a screenshot showing signature help inside an IFC entity argument list.

![TODO: Signature help screenshot](/assets/signature-help.svg)

## IFC File Scaffold

The extension can generate IFC file scaffold content through two VS Code surfaces:

- completion snippets for `!ifc`, `!!ifc`, and `!!!ifc`
- source code actions in an empty IFC document

Both surfaces insert scaffold templates for starting an IFC STEP file. The completions are useful when typing, while the empty-file code actions are useful when starting from a blank document.

TODO: Replace this placeholder with a screenshot showing IFC scaffold completions.

![TODO: IFC scaffold completion screenshot](/assets/ifc-scaffold-completion.svg)

TODO: Replace this placeholder with a screenshot showing empty-file scaffold source actions.

![TODO: IFC scaffold code action screenshot](/assets/ifc-scaffold-code-action.svg)

## Limitations

Signature help depends on the schema selected for the open file. Scaffold generation is currently limited to the built-in IFC scaffold templates.
