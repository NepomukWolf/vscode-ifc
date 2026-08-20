import { collectRefs, REL_FILLS, REL_VOIDS, type StepFileIndex } from "./stepIndex";

export interface PreviewSelectionOptions {
  includeChildren?: boolean;
  includeHostedElements?: boolean;
}

export interface PreviewSelection {
  renderIds: number[];
  childCount: number;
  hostedCount: number;
}

const ARG_RELATING = 4;
const ARG_RELATED = 5;

/**
 * Resolve the product ids that an ifc-lite full-model view should isolate.
 *
 * Unlike the legacy sub-model extractor this deliberately does not copy STEP
 * dependency closures or synthesize proxy products. ifc-lite has already
 * processed the complete model; navigation only changes its product-id filter.
 */
export function resolvePreviewSelection(
  index: StepFileIndex,
  rootId: number,
  options: PreviewSelectionOptions = {},
): PreviewSelection {
  const includeChildren = options.includeChildren ?? true;
  const includeHostedElements = options.includeHostedElements ?? true;
  const renderIds = new Set<number>();

  if (index.hasRenderableRepresentation(rootId)) {
    renderIds.add(rootId);
  }

  let childCount = 0;
  if (includeChildren) {
    const visited = new Set<number>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const parent = queue.shift() as number;
      for (const child of index.decompositionChildrenOf(parent)) {
        if (visited.has(child) || !index.hasId(child)) {
          continue;
        }
        visited.add(child);
        queue.push(child);
        if (!index.isSpatialContainer(child) && index.hasRenderableRepresentation(child)) {
          if (!renderIds.has(child)) {
            renderIds.add(child);
            childCount++;
          }
        }
      }
    }
  }

  let hostedCount = 0;
  if (includeHostedElements) {
    const openings = new Set<number>();
    for (const relId of index.relIdsOfType(REL_VOIDS)) {
      const args = index.argsOf(relId);
      const host = collectRefs(args[ARG_RELATING] ?? "")[0];
      if (host === undefined || !renderIds.has(host)) {
        continue;
      }
      const opening = collectRefs(args[ARG_RELATED] ?? "")[0];
      if (opening !== undefined) {
        openings.add(opening);
      }
    }

    // A directly focused opening can still expose its filling even though
    // ifc-lite commonly uses the opening only as a boolean cutter.
    if (index.getType(rootId) === "IFCOPENINGELEMENT") {
      openings.add(rootId);
    }

    for (const relId of index.relIdsOfType(REL_FILLS)) {
      const args = index.argsOf(relId);
      const opening = collectRefs(args[ARG_RELATING] ?? "")[0];
      if (opening === undefined || !openings.has(opening)) {
        continue;
      }
      const filling = collectRefs(args[ARG_RELATED] ?? "")[0];
      if (filling === undefined || !index.hasRenderableRepresentation(filling)) {
        continue;
      }
      if (!renderIds.has(filling)) {
        renderIds.add(filling);
        hostedCount++;
      }
    }
  }

  return {
    renderIds: [...renderIds].sort((left, right) => left - right),
    childCount,
    hostedCount,
  };
}
