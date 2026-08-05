# Editing Assistance

The language server provides schema-backed editing assistance for IFC entity arguments and file scaffolding.

These features are especially useful in education, when learning how IFC STEP files are structured, and for people working with unpublished or experimental schema extensions where manually inspecting entity arguments is part of the workflow.

## Signature Help

While editing an IFC entity argument list, VS Code can show signature help when you type `(` or `,`. The signature shows the entity's attribute names and highlights the active argument.

Parameter documentation can include the expected type, whether the attribute is optional, and whether it may be omitted with `*`.

![Signature help inside an IFC entity argument list](/assets/signature-help.png)

## IFC File Scaffold

The extension can generate IFC file scaffold content through two VS Code surfaces:

- completion snippets for `!ifc`, `!!ifc`, and `!!!ifc`
- source code actions in an empty IFC document

Both surfaces insert scaffold templates for starting an IFC STEP file. The completions are useful when typing, while the empty-file code actions are useful when starting from a blank document.

![IFC scaffold completions](/assets/ifc-scaffold-completion.png)

![Empty-file scaffold source actions](/assets/ifc-scaffold-code-action.png)
