# Navigation

Navigation features help you move between references and definitions in IFC STEP files.

## Go to Definition

Use `F12` or Ctrl/Cmd-click on a STEP identifier such as `#12345` to jump to its definition.

TODO: Replace this placeholder with a screenshot showing go to definition.

![TODO: Go to definition screenshot](/assets/go-to-definition.svg)

## Find References

Use `Shift+F12` on a STEP identifier to locate references to that entity.

TODO: Replace this placeholder with a screenshot showing find references.

![TODO: Find references screenshot](/assets/find-references.svg)

## Document Highlight

Place the cursor on a local STEP identifier such as `#12345` to highlight same-document occurrences of that identifier. This helps trace where an entity is defined and referenced without opening the full references view.

TODO: Replace this placeholder with a screenshot showing document highlights for a STEP identifier.

![TODO: Document highlight screenshot](/assets/document-highlight.svg)

## Limitations

Navigation results depend on the language server's understanding of the current document. Unsaved changes and very large files can affect which advanced analysis features are available.
