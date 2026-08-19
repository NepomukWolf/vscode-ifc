/**
 * Builds a minimal, self-contained IFC STEP model for a single element by walking
 * the reference graph around it. This is what makes per-element preview cheap even
 * on huge files: instead of handing a 180 MB model to the geometry engine, we emit
 * a few dozen lines containing only the element's geometry/placement closure.
 *
 * Original `#id` numbers are preserved verbatim, so the engine's express ids map
 * 1:1 back to the source STEP ids (reliable pick-to-reveal, "render exactly #N").
 *
 * Pure Node (no `vscode`): unit-testable against `test-files/`.
 */
import { REL_FILLS, REL_VOIDS, STYLED_ITEM, StepFileIndex, collectRefs } from "./stepIndex";
import type { PickMode } from "./protocol";

export interface SubModelOptions {
  /** Include decomposition/assembly descendants (IfcRelAggregates/IfcRelNests). */
  includeChildren?: boolean;
  /** Include renderable products that fill hosted openings (doors, windows, etc.). */
  includeHostedElements?: boolean;
  /** Include IfcStyledItem closures so surfaces keep their authored colors. */
  includeStyles?: boolean;
  /** Safety cap on collected instances; extraction stops and flags truncation. */
  maxInstances?: number;
}

export interface SubModelResult {
  /** A self-contained STEP file as raw bytes (passed verbatim to the engine).
   *  An ArrayBuffer (not a Buffer/Uint8Array) so it survives `webview.postMessage`
   *  structured cloning as binary rather than being mangled into a plain object. */
  ifcBytes: ArrayBuffer;
  rootId: number;
  /** Product/element ids intended for rendering, excluding helper closure ids. */
  renderIds: number[];
  /** Source-navigation granularity appropriate for this preview context. */
  pickMode: PickMode;
  rootType: string | undefined;
  schema: string | undefined;
  includedIds: number[];
  /** Number of decomposition descendants pulled in (excludes the root). */
  childCount: number;
  /** Number of additional renderable products pulled in as opening fillings. */
  hostedCount: number;
  /** True if the instance cap was hit (result may be incomplete). */
  truncated: boolean;
  /**
   * Maps a rendered express id back to the source id whose line should be
   * revealed on pick. Empty for ordinary products (their rendered id *is* the
   * source id); for a previewed bare geometry item it maps the synthetic wrapper
   * product to the real item, so pick-to-reveal still lands on the source line.
   */
  pickRemap: Map<number, number>;
}

// A logical upper bound from some perf tests. Maybe useful to tune later.
const DEFAULT_MAX_INSTANCES = 500_000;
const ARG_RELATING = 4; // RelatingObject / RelatingBuildingElement
const ARG_RELATED = 5; // RelatedObjects / RelatedOpeningElement
/** A valid-charset 22-char IFC GlobalId for synthetic wrapper products. */
const PREVIEW_GUID = "0previewprimitive00000";
/**
 * Non-physical products that web-ifc's `StreamAllMeshes` skips even though they
 * carry real `Body` geometry — openings are subtractions, spaces are void volumes.
 * Re-present their shape under a synthetic proxy so direct previews still render
 * their volume.
 */
const WEB_IFC_SKIPPED_PRODUCT_TYPES = new Set([
  "IFCOPENINGELEMENT",
  "IFCOPENINGSTANDARDCASE",
  "IFCSPACE",
  "IFCSPATIALZONE",
]);

function firstRef(arg: string | undefined): number | undefined {
  if (!arg) {
    return undefined;
  }
  return collectRefs(arg)[0];
}

export function extractSubModel(
  index: StepFileIndex,
  rootId: number,
  options: SubModelOptions = {},
): SubModelResult {
  const includeChildren = options.includeChildren ?? true;
  const includeHostedElements = options.includeHostedElements ?? true;
  const includeStyles = options.includeStyles ?? true;
  const maxInstances = options.maxInstances ?? DEFAULT_MAX_INSTANCES;

  if (!index.hasId(rootId)) {
    throw new Error(`#${rootId} is not defined in this file.`);
  }

  const included = new Set<number>();
  let truncated = false;

  /** BFS the forward `#ref` closure of the given seeds into `included`. */
  const addClosure = (seeds: number[]): void => {
    const queue = [...seeds];
    while (queue.length > 0) {
      const id = queue.pop() as number;
      if (included.has(id) || !index.hasId(id)) {
        continue;
      }
      if (included.size >= maxInstances) {
        truncated = true;
        return;
      }
      included.add(id);
      for (const ref of index.refsOf(id)) {
        if (!included.has(ref)) {
          queue.push(ref);
        }
      }
    }
  };

  // 1. The element itself (placement chain, representation, profiles, points...).
  const renderIds = new Set<number>([rootId]);
  addClosure([rootId]);

  // 2. The singleton IfcProject closure: units, geometric contexts, true north.
  if (index.projectId !== undefined) {
    addClosure([index.projectId]);
  }

  // 3. Descendants. BFS the combined decomposition + spatial-containment graph:
  //    assembly parts (IfcStair -> flights) and, for a spatial container, every
  //    physical element on it (IfcRelContainedInSpatialStructure). Spatial
  //    containers/spaces are recursed *through* but never rendered — they are
  //    organizational/void volumes that would obscure the physical elements.
  let childCount = 0;
  if (includeChildren && !truncated) {
    const visited = new Set<number>([rootId]);
    const queue = [rootId];
    while (queue.length > 0 && !truncated) {
      const parent = queue.shift() as number;
      for (const child of index.decompositionChildrenOf(parent)) {
        if (visited.has(child) || !index.hasId(child)) {
          continue;
        }
        visited.add(child);
        queue.push(child); // recurse even through containers, to reach their contents
        if (!index.isSpatialContainer(child)) {
          renderIds.add(child);
          childCount++;
          addClosure([child]);
          if (included.size >= maxInstances) {
            truncated = true;
            break;
          }
        }
      }
    }
  }

  // 4. Openings: always include the void relationship + opening geometry so solids show
  //    their cut-outs (web-ifc performs the boolean when both are present).
  if (!truncated) {
    for (const relId of index.relIdsOfType(REL_VOIDS)) {
      const args = index.argsOf(relId);
      const relating = firstRef(args[ARG_RELATING]);
      if (relating !== undefined && included.has(relating)) {
        const opening = firstRef(args[ARG_RELATED]);
        included.add(relId);
        if (opening !== undefined) {
          addClosure([opening]);
        }
      }
    }
  }

  // 5. Hosted products: included openings can be filled by doors, windows, or
  //    other products. Render only fillings with meshable geometry, preserve the
  //    relationship, and don't count products already reached as descendants.
  let hostedCount = 0;
  if (includeHostedElements && !truncated) {
    for (const relId of index.relIdsOfType(REL_FILLS)) {
      const args = index.argsOf(relId);
      const opening = firstRef(args[ARG_RELATING]);
      if (opening === undefined || !included.has(opening)) {
        continue;
      }
      const filling = firstRef(args[ARG_RELATED]);
      if (filling === undefined || !index.hasRenderableRepresentation(filling)) {
        continue;
      }
      included.add(relId);
      if (!renderIds.has(filling)) {
        renderIds.add(filling);
        hostedCount++;
        addClosure([filling]);
      }
    }
  }

  // 6. Styles/colors: include styled items whose target representation item is in
  //    scope, plus their style closure (IfcSurfaceStyle -> colour).
  if (includeStyles && !truncated) {
    for (const relId of index.relIdsOfType(STYLED_ITEM)) {
      const args = index.argsOf(relId);
      const item = firstRef(args[0]); // IfcStyledItem.Item
      if (item !== undefined && included.has(item)) {
        addClosure([relId]);
      }
    }
  }

  // 7. Bare geometry item (a brep/solid/tessellation, not a product). web-ifc
  //    streams product meshes, so wrap the item in a synthetic IfcBuildingElementProxy
  //    + shape representation. The item keeps its real id (so its closure renders
  //    unchanged); pick-to-reveal maps the wrapper back to it via `pickRemap`.
  const pickRemap = new Map<number, number>();
  const extraLines: string[] = [];
  const itemRepType = index.geometryItemRepType(rootId);
  if (itemRepType !== undefined && !truncated) {
    let nextId = index.maxExpressId() + 1;
    const alloc = (): number => nextId++;

    // Anchor in an existing 3D context if the file has one (pulled in via the
    // project closure); otherwise mint a minimal context so the rep stands alone.
    let contextId = index.geometricContextId();
    if (contextId !== undefined) {
      addClosure([contextId]);
    } else {
      const originId = alloc();
      const wcsId = alloc();
      contextId = alloc();
      extraLines.push(`#${originId}=IFCCARTESIANPOINT((0.,0.,0.));`);
      extraLines.push(`#${wcsId}=IFCAXIS2PLACEMENT3D(#${originId},$,$);`);
      extraLines.push(
        `#${contextId}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#${wcsId},$);`,
      );
    }

    const shapeRepId = alloc();
    const prodDefId = alloc();
    const productId = alloc();
    extraLines.push(
      `#${shapeRepId}=IFCSHAPEREPRESENTATION(#${contextId},'Body','${itemRepType}',(#${rootId}));`,
    );
    extraLines.push(`#${prodDefId}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}));`);
    extraLines.push(
      `#${productId}=IFCBUILDINGELEMENTPROXY('${PREVIEW_GUID}',$,'Geometry Preview',$,$,$,#${prodDefId},$,$);`,
    );

    renderIds.clear();
    renderIds.add(productId);
    pickRemap.set(productId, rootId);
  }

  // 8. Openings/spaces: products with real geometry that web-ifc won't stream.
  //    Re-present their existing shape + placement under a synthetic proxy so the
  //    direct preview renders the opening as its solid "plug"; pick-to-reveal maps
  //    the proxy back to the source.
  const rootType = index.getType(rootId);
  if (
    itemRepType === undefined &&
    !truncated &&
    rootType &&
    WEB_IFC_SKIPPED_PRODUCT_TYPES.has(rootType)
  ) {
    const args = index.argsOf(rootId);
    const shapeRef = collectRefs(args[6] ?? "")[0]; // Representation -> IfcProductDefinitionShape
    if (shapeRef !== undefined && index.hasId(shapeRef)) {
      const placement = args[5]?.startsWith("#") ? args[5] : "$"; // reuse ObjectPlacement if present
      const productId = index.maxExpressId() + 1;
      extraLines.push(
        `#${productId}=IFCBUILDINGELEMENTPROXY('${PREVIEW_GUID}',$,'Geometry Preview',$,$,${placement},#${shapeRef},$,$);`,
      );
      // Drop the original space/opening instance; the proxy reuses its
      // still-present shape + placement. Any contained elements stay in renderIds.
      included.delete(rootId);
      renderIds.delete(rootId);
      renderIds.add(productId);
      pickRemap.set(productId, rootId);
    }
  }

  const includedIds = [...included].sort((a, b) => a - b);
  const ifcBytes = assemble(index, includedIds, extraLines);
  const soleRenderedId = renderIds.size === 1 ? renderIds.values().next().value : undefined;
  const pickMode: PickMode =
    soleRenderedId !== undefined && (pickRemap.get(soleRenderedId) ?? soleRenderedId) === rootId
      ? "geometry"
      : "product";

  return {
    ifcBytes,
    rootId,
    renderIds: [...renderIds].sort((a, b) => a - b),
    pickMode,
    rootType: index.getType(rootId),
    schema: index.schema,
    includedIds,
    childCount,
    hostedCount,
    truncated,
    pickRemap,
  };
}

/** Stitch the header + selected instance bytes into a valid STEP file, preserving
 *  the original bytes verbatim (no latin1/UTF-8 round-trip) so non-ASCII content
 *  survives intact on its way to the geometry engine. Returns an exact-sized
 *  ArrayBuffer (Buffer.concat may sit in a shared pool, so slice to our bytes). */
function assemble(
  index: StepFileIndex,
  ids: number[],
  extraLines: readonly string[] = [],
): ArrayBuffer {
  const NL = Buffer.from("\n");
  const parts: Buffer[] = [index.headerBytes()];
  for (const id of ids) {
    const bytes = index.sliceInstanceBytes(id);
    if (bytes) {
      parts.push(NL, bytes);
    }
  }
  // Synthetic wrapper instances (ASCII-only) appended after the verbatim source.
  for (const line of extraLines) {
    parts.push(NL, Buffer.from(line, "latin1"));
  }
  parts.push(Buffer.from("\nENDSEC;\nEND-ISO-10303-21;\n"));
  const out = Buffer.concat(parts);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}
