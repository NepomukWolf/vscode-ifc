# 3D Preview

The 3D preview renders an individual IFC element without opening the whole model in a dedicated BIM viewer.

## Open the Preview

Place the cursor on an element and use one of these entry points:

- run `IFC: Preview Element in 3D` from the Command Palette
- use the editor context menu
- use the `Preview in 3D` CodeLens above an element with geometry

TODO: Replace this placeholder with a screenshot showing the 3D preview panel.

![TODO: 3D preview panel screenshot](/assets/three-d-preview-panel.svg)

TODO: Replace this placeholder with a screenshot showing the Preview in 3D CodeLens.

![TODO: 3D preview CodeLens screenshot](/assets/three-d-preview-codelens.svg)

## Behavior

The extension extracts the selected element's reference closure into a small sub-model. Geometry is produced by `web-ifc` and rendered with `three.js`.

When `ifc.viewer.includeChildren` is enabled, the preview also includes decomposition or assembly children where available.

Click an element in the 3D viewer to jump back to the code line where that element is defined in the IFC STEP file.

## Limitations

The preview is bounded by `ifc.viewer.maxFileSizeMb`. Only the selected element and related references are rendered, but the source file still needs to be scanned.
