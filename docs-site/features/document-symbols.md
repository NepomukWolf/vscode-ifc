# Document Symbols

The language server provides document symbols for VS Code's Outline view, breadcrumbs, and go-to-symbol navigation.

## Outline

Open VS Code's Outline view while editing an IFC STEP file to browse a curated IFC spatial hierarchy. The outline is built from project, spatial, and product relationships rather than showing every raw STEP line as a flat list.

![IFC spatial hierarchy in VS Code Outline](/assets/document-symbols-outline.png)

## Breadcrumbs and Go to Symbol

Document symbols also power editor breadcrumbs and `Go to Symbol in Editor...`.

Use VS Code's symbol navigation to jump to project, spatial, and product entities exposed by the language server.

## Limitations

The spatial outline is an AST-backed feature. If an IFC file exceeds `ifc.analysis.astFileSizeLimitMb`, the Outline can show a message explaining that the IFC AST was skipped and that the size limit must be increased to enable the spatial outline.
