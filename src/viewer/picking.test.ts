import { readFileSync } from "node:fs";
import * as path from "node:path";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveFocusSourceId, resolvePickSourceId } from "./picking";
import { StepFileIndex } from "./stepIndex";

const index = StepFileIndex.build(
  readFileSync(path.resolve(process.cwd(), "fixtures", "representation-gate.ifc")),
);

test("geometry picking navigates to a source representation item", () => {
  assert.equal(
    resolvePickSourceId(index, { productId: 100, geometryId: 104 }, "geometry", new Map()),
    104,
  );
});

test("product picking ignores the part id", () => {
  assert.equal(
    resolvePickSourceId(index, { productId: 100, geometryId: 104 }, "product", new Map()),
    100,
  );
});

test("generated geometry ids fall back through the product remap", () => {
  assert.equal(
    resolvePickSourceId(
      index,
      { productId: 9000, geometryId: 9001 },
      "geometry",
      new Map([[9000, 1100]]),
    ),
    1100,
  );
});

test("geometry focus previews a source-backed renderable representation item", () => {
  assert.equal(
    resolveFocusSourceId(index, { productId: 500, geometryId: 504 }, "geometry", new Map()),
    504,
  );
  assert.equal(
    resolveFocusSourceId(index, { productId: 100, geometryId: 104 }, "geometry", new Map()),
    104,
  );
});

test("geometry focus does nothing for unsupported or generated geometry", () => {
  // #204 is a curve-only IfcPolyline; #9001 does not exist in the source STEP.
  assert.equal(
    resolveFocusSourceId(index, { productId: 200, geometryId: 204 }, "geometry", new Map()),
    undefined,
  );
  assert.equal(
    resolveFocusSourceId(index, { productId: 100, geometryId: 9001 }, "geometry", new Map()),
    undefined,
  );
});

test("product focus ignores geometry and preserves synthetic wrapper remapping", () => {
  assert.equal(
    resolveFocusSourceId(
      index,
      { productId: 9000, geometryId: 504 },
      "product",
      new Map([[9000, 1100]]),
    ),
    1100,
  );
});
