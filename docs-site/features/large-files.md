# Large Files

IFC files can become very large. A detailed building or federated model may contain hundreds of thousands or millions of STEP lines, and that is a challenge for general-purpose text editors and language features.

The extension is designed to keep as many workflows available as possible on large files. Instead of treating every feature as all-or-nothing, it separates lightweight text-indexed features from expensive AST-backed analysis.

## What Still Works

For very large files, the extension tries to keep lightweight features available where possible:

- basic hover for local STEP identifiers
- go to definition and find references
- document highlight for local STEP identifiers
- signature help
- inlay hints
- range-based semantic tokens

These features are still bounded by VS Code performance and the size of the file, but they are designed to avoid the most expensive full-document analysis path.

## Analysis Limit

`ifc.analysis.astFileSizeLimitMb` controls the maximum file size for AST-backed language-server features.

Files above this limit keep lighter features available where possible, such as basic hover, navigation, document highlight, signature help, inlay hints, and semantic tokens, but may skip schema diagnostics, derived-value hover, and the spatial Outline.

Increase this limit only when you need those AST-backed features for larger files and your machine has enough memory and CPU headroom.

## VS Code Large-File Behavior

VS Code also has its own large-file behavior, independent of this extension. VS Code's large-file optimizations are meant to reduce memory pressure and keep the editor usable. The VS Code 1.15 release notes describe large files as files over 30 MB or over 300,000 lines and explain that VS Code may disable or reduce features such as tokenization, line guides, wrapping, folding, and web-worker features like diff information, link detection, or word-based completions.

When VS Code opens a very large file, it may show a prompt about large-file optimizations. VS Code maintainers have also documented that this behavior can affect word wrap and can be forced off with:

```json
{
  "editor.largeFileOptimizations": false
}
```

Disabling VS Code's large-file optimizations can make huge files slower or less stable. Prefer leaving them enabled unless you have a specific reason to trade performance for more editor features.

## 3D Preview Limit

`ifc.viewer.maxFileSizeMb` controls the maximum IFC file size the 3D preview will index. The preview renders only the selected element, but the extension still scans the file once to extract the element and its references.

## Recommended Use

Keep the default extension limits unless a project requires deeper analysis for larger files and your machine can handle the extra cost.

If a huge IFC file feels slow, first lower extension analysis limits or use the lightweight editor features. Only disable VS Code's own large-file optimizations after testing on the specific file and machine.

## Related VS Code References

- [VS Code 1.15 release notes: Large file support](https://code.visualstudio.com/updates/v1_15#_large-file-support)
- [VS Code issue comment about word wrap and large-file optimizations](https://github.com/microsoft/vscode/issues/108326#issuecomment-707059577)
