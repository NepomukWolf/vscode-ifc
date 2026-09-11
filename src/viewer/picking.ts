import type { PickMode, PickTarget } from "./protocol";
import type { StepFileIndex } from "./stepIndex";

/** Resolve a mesh pick to a real source STEP id at the current preview granularity. */
export function resolvePickSourceId(
  index: StepFileIndex,
  target: PickTarget,
  pickMode: PickMode,
): number {
  if (
    pickMode === "geometry" &&
    target.geometryItemId !== undefined &&
    index.hasId(target.geometryItemId)
  ) {
    return target.geometryItemId;
  }
  return target.productId;
}

/** Resolve a double-click to an independently previewable source entity. */
export function resolveFocusSourceId(target: PickTarget, pickMode: PickMode): number | undefined {
  // ifc-lite isolates owning products, not representation items. A detailed
  // double-click must therefore be a no-op rather than create a misleading
  // item context that still renders the complete product.
  if (pickMode === "geometry") {
    return undefined;
  }
  return target.productId;
}
