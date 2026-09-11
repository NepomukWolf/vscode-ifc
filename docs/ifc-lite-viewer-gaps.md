# Experimental ifc-lite viewer: known gaps

This branch loads the complete current IFC through `@ifc-lite/geometry`, keeps
the resulting WebGPU model alive with the preview panel, and changes previews
with the renderer's product-id isolation filter. It intentionally uses only
ifc-lite's public APIs.

## Testing the upstream item-picking snapshot

The representation-item picking changes are merged upstream but not yet
published. Representation-item highlighting is currently an upstream-ready
local renderer change on top of commit `d33deb93`. For this proof of concept,
build and link the three matching packages from that checkout:

```sh
git checkout d33deb93
pnpm install
pnpm build:wasm
pnpm --filter @ifc-lite/renderer... build

cd /path/to/vscode-ifc
npm link --no-save \
  /path/to/ifc-lite/packages/wasm \
  /path/to/ifc-lite/packages/geometry \
  /path/to/ifc-lite/packages/renderer
```

The upstream build requires a supported Node.js version (Node 24), pnpm 10,
the repository's pinned Rust toolchain, and `wasm-pack`. These local links and
their generated build artifacts must not be committed. A normal `npm install`
restores the published dependencies.

## Known differences from the previous web-ifc viewer

- A sole focused product supports source navigation to the picked
  `IfcRepresentationItem`, such as an `IfcFacetedBrep` or
  `IfcExtrudedAreaSolid`. Multi-product contexts deliberately resolve picks to
  owning products instead.
- Picks without a `geometryItemId` fall back to the owning product.
- Bare representation items are not advertised through Preview CodeLenses and
  cannot be isolated independently because the rendered meshes are keyed by
  owning product ids.
- The linked renderer snapshot accepts a representation-item selection and
  highlights every flat or instanced piece belonging to that item. This API is
  not part of the published renderer package yet.
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
