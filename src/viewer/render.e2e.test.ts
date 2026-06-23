import { readFileSync } from "node:fs";
import * as path from "node:path";
import { strict as assert } from "node:assert";
import { test, type TestContext } from "node:test";
import { IfcAPI } from "web-ifc";
import { StepFileIndex } from "./stepIndex";
import { extractSubModel } from "./subModel";

/**
 * End-to-end contract test: every element the extension advertises a "Preview in
 * 3D" lens for MUST actually produce geometry in web-ifc.
 *
 * It walks a real model the way the extension does — the same lens gate, the same
 * `extractSubModel` closure — then renders each sub-model through web-ifc in Node
 * using the identical `StreamAllMeshes` + `GetGeometry` path as `thatopen-engine`.
 * Zero triangles for a previewable element means the lens lies (e.g. the spatial-
 * container / assembly mismatches), so the test fails and names the offenders.
 *
 * The model is large and gitignored (local-only); the test skips when it is absent.
 */
const MODEL = path.resolve(process.cwd(), "fixtures", "models", "advanced-project.ifc");
const WASM_PATH = path.resolve(process.cwd(), "node_modules", "web-ifc") + path.sep;
const LENS_CANDIDATE_RE = /^\s*#(\d+)\s*=\s*IFC/i;

/** Triangles web-ifc tessellates for a sub-model, mirroring thatopen-engine. */
function renderTriangles(api: IfcAPI, sub: ReturnType<typeof extractSubModel>): number {
  const renderIds = sub.renderIds.length > 0 ? sub.renderIds : [sub.rootId];
  const onlyIds =
    renderIds.length === 1 && renderIds[0] === sub.rootId ? undefined : new Set(renderIds);
  const handle = api.OpenModel(new Uint8Array(sub.ifcBytes), { COORDINATE_TO_ORIGIN: true });
  let triangles = 0;
  try {
    api.StreamAllMeshes(handle, (flatMesh) => {
      if (onlyIds && !onlyIds.has(flatMesh.expressID)) {
        return;
      }
      const placed = flatMesh.geometries;
      for (let i = 0; i < placed.size(); i++) {
        const geometry = api.GetGeometry(handle, placed.get(i).geometryExpressID);
        const indices = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
        triangles += indices.length / 3;
        geometry.delete();
      }
    });
  } finally {
    api.CloseModel(handle);
  }
  return triangles;
}

test("every previewable element renders geometry in web-ifc", {
  timeout: 600_000,
}, async (t: TestContext) => {
  const buffer = readFileSync(MODEL);
  const index = StepFileIndex.build(buffer);

  // Enumerate every "has the button" element, exactly as the lens provider scans.
  const ids: number[] = [];
  for (const line of buffer.toString("latin1").split("\n")) {
    const match = LENS_CANDIDATE_RE.exec(line);
    if (match) {
      const id = Number.parseInt(match[1], 10);
      if (index.isPreviewable(id, true)) {
        ids.push(id);
      }
    }
  }
  assert.ok(ids.length > 0, "expected at least one previewable element in the model");

  const api = new IfcAPI();
  api.SetWasmPath(WASM_PATH, true);
  await api.Init(undefined, true);

  const empty: Array<{ id: number; type: string | undefined }> = [];
  for (const id of ids) {
    const sub = extractSubModel(index, id, { includeChildren: true });
    let triangles = 0;
    try {
      triangles = renderTriangles(api, sub);
    } catch (error) {
      empty.push({ id, type: index.getType(id) });
      t.diagnostic(`#${id} (${index.getType(id)}) threw: ${(error as Error).message}`);
      continue;
    }
    if (triangles <= 0) {
      empty.push({ id, type: index.getType(id) });
    }
  }

  t.diagnostic(`checked ${ids.length} previewable elements; ${empty.length} produced no geometry`);
  assert.equal(
    empty.length,
    0,
    `previewable elements that rendered empty:\n${empty
      .slice(0, 40)
      .map((e) => `  #${e.id} ${e.type}`)
      .join("\n")}${empty.length > 40 ? `\n  …and ${empty.length - 40} more` : ""}`,
  );
});
