import { readFileSync } from "node:fs";
import * as path from "node:path";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { StepFileIndex } from "./stepIndex";
import { extractSubModel } from "./subModel";

function fixture(name: string): StepFileIndex {
  return StepFileIndex.build(readFileSync(path.resolve(process.cwd(), "fixtures", name)));
}

const gate = fixture("representation-gate.ifc");

function text(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("latin1");
}

test("extractSubModel: ordinary product has no pick remap and renders its own id", () => {
  const sub = extractSubModel(gate, 100);
  assert.equal(sub.pickRemap.size, 0);
  assert.deepEqual(sub.renderIds, [100]);
  // The verbatim source instance is carried through.
  assert.match(text(sub.ifcBytes), /#100=\s*IFCWALL/);
});

test("extractSubModel: bare brep is wrapped in a synthetic product for web-ifc", () => {
  const sub = extractSubModel(gate, 504); // #504 IfcFacetedBrep
  const out = text(sub.ifcBytes);

  // Exactly one synthetic wrapper product, rendered, mapped back to the brep.
  assert.equal(sub.renderIds.length, 1);
  const productId = sub.renderIds[0];
  assert.ok(productId > gate.maxExpressId(), "wrapper id must not collide with source ids");
  assert.equal(sub.pickRemap.get(productId), 504);

  // The wrapper chain: proxy -> product-definition-shape -> shape-rep -> the brep,
  // anchored in the file's existing geometric context (#9), tagged Brep.
  assert.match(out, /IFCBUILDINGELEMENTPROXY/);
  assert.match(out, new RegExp(`#${productId}=IFCBUILDINGELEMENTPROXY`));
  assert.match(out, /IFCSHAPEREPRESENTATION\(#9,'Body','Brep',\(#504\)\)/);
  // The real geometry item is preserved verbatim under its source id.
  assert.match(out, /#504=\s*IFCFACETEDBREP/);
  // rootType still reports the item, not the wrapper.
  assert.equal(sub.rootType, "IFCFACETEDBREP");
});

test("extractSubModel: a swept solid item gets the SweptSolid representation type", () => {
  const sub = extractSubModel(gate, 104); // #104 IfcExtrudedAreaSolid
  assert.match(text(sub.ifcBytes), /IFCSHAPEREPRESENTATION\(#9,'Body','SweptSolid',\(#104\)\)/);
  assert.equal(sub.pickRemap.get(sub.renderIds[0]), 104);
});

test("extractSubModel: an opening is re-presented under a proxy for web-ifc parity", () => {
  const sub = extractSubModel(gate, 1100); // #1100 IfcOpeningElement
  const out = text(sub.ifcBytes);
  // A synthetic proxy reuses the opening's existing shape (#1102) and placement (#1101).
  assert.equal(sub.renderIds.length, 1);
  const productId = sub.renderIds[0];
  assert.ok(productId > gate.maxExpressId());
  assert.match(out, new RegExp(`#${productId}=IFCBUILDINGELEMENTPROXY\\([^)]*#1101,#1102`));
  assert.equal(sub.pickRemap.get(productId), 1100);
  assert.equal(sub.rootType, "IFCOPENINGELEMENT");
  // The opening's real geometry is carried through verbatim.
  assert.match(out, /#1104=\s*IFCEXTRUDEDAREASOLID/);
});

test("extractSubModel: an assembly renders its decomposition children (the flight)", () => {
  const sub = extractSubModel(gate, 700); // #700 IfcStair, geometry lives in flight #710
  assert.equal(sub.rootType, "IFCSTAIR");
  assert.equal(sub.childCount, 1);
  // The flight is rendered (not the geometry-less stair), with no remap needed.
  assert.ok(sub.renderIds.includes(710));
  assert.equal(sub.pickRemap.size, 0);
  assert.match(text(sub.ifcBytes), /#714=\s*IFCEXTRUDEDAREASOLID/);
});

test("extractSubModel: a storey renders contained elements via spatial containment, not its spaces", () => {
  const sub = extractSubModel(gate, 900); // #900 IfcBuildingStorey
  // The wall (#100), contained via IfcRelContainedInSpatialStructure, is rendered.
  assert.ok(sub.renderIds.includes(100));
  // The aggregated space (#930) is recursed through but never drawn — and its
  // volume must not leak into the file.
  assert.ok(!sub.renderIds.includes(930));
  assert.ok(!text(sub.ifcBytes).includes("#934="));
  assert.equal(sub.childCount, 1);
});
