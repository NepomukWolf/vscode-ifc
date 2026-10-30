import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the AST size limit setting is unset by default, so the server's default applies", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const setting = packageJson.contributes.configuration
    .map((section: { properties: Record<string, { default?: unknown }> }) => section.properties)
    .find((properties: Record<string, unknown>) => "ifc.analysis.astFileSizeLimitMb" in properties)[
    "ifc.analysis.astFileSizeLimitMb"
  ];

  assert.equal(setting.default, null);
});
