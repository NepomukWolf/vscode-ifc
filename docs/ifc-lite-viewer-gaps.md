# Experimental ifc-lite viewer: known gaps

This branch loads the complete current IFC through `@ifc-lite/geometry`, keeps
the resulting WebGPU model alive with the preview panel, and changes previews
with the renderer's product-id isolation filter. It intentionally uses only
ifc-lite's public APIs.

Known differences from the previous web-ifc viewer:

- Picking identifies the owning IFC product only. ifc-lite does not currently
  expose the originating representation-item id, so a focused product cannot
  drill down to an `IfcFacetedBrep`, `IfcExtrudedAreaSolid`, or similar item.
- Bare representation items are not advertised through Preview CodeLenses and
  cannot be isolated independently because the rendered meshes are keyed by
  owning product ids.
- An `IfcOpeningElement` can participate in the host's boolean cut without
  producing its own visible mesh. Its filling may still appear when hosted
  elements are enabled.
- WebGPU is required. There is deliberately no WebGL/legacy-renderer fallback
  on this feasibility branch.
- The panel retains one complete model. Switching files or loading a changed
  revision replaces and reparses the resident model rather than caching several
  full GPU scenes.
- Lighting, transparency, camera motion, and selection styling follow
  ifc-lite's renderer and are therefore similar, not pixel-identical, to the
  previous ThatOpen/Three.js presentation.

No synthetic proxy products, extracted STEP submodels, private renderer hooks,
or triangle-to-source heuristics are used to close these gaps.
