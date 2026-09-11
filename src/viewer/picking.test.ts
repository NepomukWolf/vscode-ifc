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
    resolvePickSourceId(index, { productId: 100, geometryItemId: 104 }, "geometry"),
    104,
  );
});

test("product picking ignores the part id", () => {
  assert.equal(resolvePickSourceId(index, { productId: 100, geometryItemId: 104 }, "product"), 100);
});

test("unknown or absent representation item ids fall back to the product", () => {
  assert.equal(
    resolvePickSourceId(index, { productId: 100, geometryItemId: 9001 }, "geometry"),
    100,
  );
  assert.equal(resolvePickSourceId(index, { productId: 100 }, "geometry"), 100);
});

test("geometry focus is a no-op because representation items cannot be isolated", () => {
  assert.equal(
    resolveFocusSourceId({ productId: 500, geometryItemId: 504 }, "geometry"),
    undefined,
  );
});

test("product focus ignores the representation item", () => {
  assert.equal(resolveFocusSourceId({ productId: 100, geometryItemId: 104 }, "product"), 100);
});
