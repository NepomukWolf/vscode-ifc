import { readFileSync } from "node:fs";
import * as path from "node:path";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolvePickSourceId } from "./picking";
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
