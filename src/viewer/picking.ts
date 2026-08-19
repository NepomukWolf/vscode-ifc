import type { PickMode, PickTarget } from "./protocol";
import type { StepFileIndex } from "./stepIndex";

/** Resolve a mesh pick to a real source STEP id at the current preview granularity. */
export function resolvePickSourceId(
  index: StepFileIndex,
  target: PickTarget,
  pickMode: PickMode,
  pickRemap: ReadonlyMap<number, number>,
): number {
  if (pickMode === "geometry" && index.hasId(target.geometryId)) {
    return target.geometryId;
  }
  return pickRemap.get(target.productId) ?? target.productId;
}
