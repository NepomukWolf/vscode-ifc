const esbuild = require("esbuild");
const fs = require("node:fs/promises");

const watch = process.argv.includes("--watch");

/** The extension host bundle (Node/CommonJS). */
const extensionBuild = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: "out/extension.js",
  external: ["vscode"],
  sourcemap: true,
  minify: false,
  sourcesContent: true,
  logLevel: "info",
};

/** The webview bundle (browser/ESM): three.js + web-ifc geometry. */
const webviewBuild = {
  entryPoints: ["media/viewer/main.ts"],
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  outfile: "out/webview/viewer.js",
  sourcemap: true,
  // Minified for packaging (the bundle includes three + web-ifc);
  // the sourcemap stays for dev and is excluded from the VSIX via .vscodeignore.
  minify: true,
  sourcesContent: true,
  logLevel: "info",
};

/** WASM assets that must sit beside the webview bundle so it can fetch them. */
const wasmCopies = [[require.resolve("web-ifc/web-ifc.wasm"), "out/webview/web-ifc.wasm"]];

async function copyWasm() {
  await fs.mkdir("out/webview", { recursive: true });
  for (const [from, to] of wasmCopies) {
    await fs.copyFile(from, to);
  }
}

async function cleanOutDir() {
  await fs.rm("out", { recursive: true, force: true });
}

async function main() {
  if (watch) {
    const extensionContext = await esbuild.context(extensionBuild);
    const webviewContext = await esbuild.context(webviewBuild);
    await fs.mkdir("out/webview", { recursive: true });
    await Promise.all([extensionContext.watch(), webviewContext.watch()]);
    await copyWasm();
    console.log("Watching extension + webview bundles...");
    return;
  }

  await cleanOutDir();
  await Promise.all([esbuild.build(extensionBuild), esbuild.build(webviewBuild)]);
  await copyWasm();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
