import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { resolveExpressIdAtCursor } from "./expressId";
import { LruCache } from "./lruCache";
import { IfcViewerPanel } from "./panel";
import { LoadMessage } from "./protocol";
import { StepFileIndex } from "./stepIndex";
import { extractSubModel } from "./subModel";

const MB = 1024 * 1024;

/**
 * Cheap per-line pre-filter for the "Preview in 3D" CodeLens: any `#id = IFC…`
 * definition start. Whether a lens is actually offered is decided by
 * `StepFileIndex.hasRenderableRepresentation` (would the engine mesh this?), which
 * is schema-agnostic and covers every product type — MEP, furniture, proxies,
 * assemblies, reinforcement — not a fixed list of entity-type names, while
 * rejecting non-products and curve/annotation-only reps that render empty.
 */
const LENS_CANDIDATE_RE = /^\s*#(\d+)\s*=\s*IFC/i;
/** Files at or below this many lines get a lens on every renderable element;
 *  larger files are limited to the viewport (± a margin) so cost stays bounded. */
const LENS_WHOLE_FILE_MAX_LINES = 6000;
/** Lines scanned beyond the viewport so small scrolls don't churn lenses. */
const LENS_VIEWPORT_MARGIN = 200;
/** Defensive ceiling on lenses returned from one pass. */
const LENS_MAX = 2000;
/** Keep memory bounded while allowing quick switching between a few open models. */
const INDEX_CACHE_MAX_ENTRIES = 3;

interface ViewerConfig {
  includeChildren: boolean;
  includeHostedElements: boolean;
  codeLens: boolean;
  maxFileSizeMb: number;
}

function readConfig(): ViewerConfig {
  const c = vscode.workspace.getConfiguration("ifc");
  return {
    includeChildren: c.get<boolean>("viewer.includeChildren", true),
    includeHostedElements: c.get<boolean>("viewer.includeHostedElements", true),
    codeLens: c.get<boolean>("viewer.codeLens", true),
    maxFileSizeMb: c.get<number>("viewer.maxFileSizeMb", 400),
  };
}

interface CacheEntry {
  mtimeMs: number;
  size: number;
  index: StepFileIndex;
}

/**
 * Coordinates the 3D preview: resolves the element under the cursor, builds (and
 * caches) a STEP index, extracts a tiny self-contained sub-model, and hands it to
 * the webview. Also serves CodeLenses and pick-to-reveal.
 */
class ViewerController implements vscode.CodeLensProvider {
  private readonly indexCache = new LruCache<string, CacheEntry>(INDEX_CACHE_MAX_ENTRIES);
  private panel: IfcViewerPanel | undefined;
  private lastSourceUri: vscode.Uri | undefined;
  /** Rendered-id -> source-id for the current preview (see SubModelResult.pickRemap). */
  private lastPickRemap: Map<number, number> = new Map();
  private token = 0;
  private lensRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly lensChanged = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.lensChanged.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.LogOutputChannel,
  ) {}

  configChanged(): void {
    this.lensChanged.fire();
  }

  /** Re-query lenses after the viewport moves (debounced). Only matters for large
   *  files, which are viewport-limited; small files lens whole and don't move. */
  onVisibleRangesChanged(editor: vscode.TextEditor): void {
    if (
      editor.document.languageId !== "ifc" ||
      editor.document.lineCount <= LENS_WHOLE_FILE_MAX_LINES
    ) {
      return;
    }
    if (this.lensRefreshTimer) {
      clearTimeout(this.lensRefreshTimer);
    }
    this.lensRefreshTimer = setTimeout(() => this.lensChanged.fire(), 200);
  }

  onDocumentClosed(document: vscode.TextDocument): void {
    if (document.uri.scheme === "file") {
      this.indexCache.delete(document.uri.fsPath);
    }
  }

  /** Entry point for the `ifc.viewElement` command. */
  async viewElement(arg?: { uri?: vscode.Uri; id?: number }): Promise<void> {
    try {
      const target = this.resolveTarget(arg);
      if (!target) {
        void vscode.window.showInformationMessage(
          "IFC 3D: place the cursor on an element (a line like `#123=IFCWALL(...)`) and try again.",
        );
        return;
      }
      await this.render(target.uri, target.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.error(`IFC 3D preview failed: ${message}`);
      void vscode.window.showErrorMessage(`IFC 3D preview failed: ${message}`);
    }
  }

  private resolveTarget(arg?: {
    uri?: vscode.Uri;
    id?: number;
  }): { uri: vscode.Uri; id: number } | undefined {
    if (arg?.uri && typeof arg.id === "number") {
      return { uri: arg.uri, id: arg.id };
    }
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== "ifc") {
      return undefined;
    }
    const id = resolveExpressIdAtCursor(editor);
    return id === undefined ? undefined : { uri: editor.document.uri, id };
  }

  private async render(uri: vscode.Uri, id: number): Promise<void> {
    const config = readConfig();
    const message = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "IFC 3D: preparing preview…" },
      async (): Promise<LoadMessage> => {
        const index = await this.getIndex(uri, config.maxFileSizeMb);
        if (!index.hasId(id)) {
          throw new Error(`#${id} is not defined in ${path.basename(uri.fsPath)}.`);
        }
        if (!index.isPreviewable(id, config.includeChildren)) {
          const type = index.getType(id) ?? "element";
          throw new Error(
            `#${id} (${type}) has no renderable geometry — pick an element with geometry, ` +
              `or a container (storey/building) that holds some.`,
          );
        }
        const sub = extractSubModel(index, id, {
          includeChildren: config.includeChildren,
          includeHostedElements: config.includeHostedElements,
        });
        this.lastPickRemap = sub.pickRemap;
        return {
          type: "load",
          token: ++this.token,
          ifcBytes: sub.ifcBytes,
          rootId: sub.rootId,
          renderIds: sub.renderIds,
          rootType: sub.rootType,
          rootName: index.nameOf(id),
          schema: sub.schema,
          fileName: path.basename(uri.fsPath),
          displayPath: vscode.workspace.asRelativePath(uri, false).split(/[\\/]/).join(" › "),
          includedCount: sub.includedIds.length,
          childCount: sub.childCount,
          hostedCount: sub.hostedCount,
          truncated: sub.truncated,
        };
      },
    );

    this.lastSourceUri = uri;
    const panel = IfcViewerPanel.show(this.context.extensionUri, this.output);
    if (panel !== this.panel) {
      this.panel = panel;
      panel.onPick((expressId) => void this.reveal(expressId));
      panel.onFocus((expressId) => void this.focus(expressId));
    }
    panel.load(message);
  }

  private async getIndex(uri: vscode.Uri, maxFileSizeMb: number): Promise<StepFileIndex> {
    if (uri.scheme !== "file") {
      const doc = await vscode.workspace.openTextDocument(uri);
      return StepFileIndex.build(Buffer.from(doc.getText(), "utf8"));
    }

    const stat = await fs.stat(uri.fsPath);
    const cached = this.indexCache.get(uri.fsPath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached.index;
    }
    if (cached) {
      this.indexCache.delete(uri.fsPath);
    }
    if (stat.size > maxFileSizeMb * MB) {
      throw new Error(
        `File is ${(stat.size / MB).toFixed(0)} MB, above the ${maxFileSizeMb} MB preview limit ` +
          `(raise \`ifc.viewer.maxFileSizeMb\` to override).`,
      );
    }
    const buffer = await fs.readFile(uri.fsPath);
    const index = StepFileIndex.build(buffer);
    this.indexCache.set(uri.fsPath, { mtimeMs: stat.mtimeMs, size: stat.size, index });
    return index;
  }

  private async reveal(expressId: number): Promise<void> {
    const uri = this.lastSourceUri;
    if (!uri) {
      return;
    }
    try {
      // A picked synthetic wrapper resolves back to the real geometry item it previews.
      const sourceId = this.lastPickRemap.get(expressId) ?? expressId;
      const index = await this.getIndex(uri, readConfig().maxFileSizeMb);
      const pos = index.positionOf(sourceId);
      const editor = await vscode.window.showTextDocument(uri, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      });
      if (pos) {
        const position = new vscode.Position(pos.line, pos.character);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.error(`IFC 3D source reveal failed: ${message}`);
      void vscode.window.showErrorMessage(`IFC 3D source reveal failed: ${message}`);
    }
  }

  private async focus(expressId: number): Promise<void> {
    const uri = this.lastSourceUri;
    if (!uri) {
      return;
    }
    try {
      const sourceId = this.lastPickRemap.get(expressId) ?? expressId;
      await this.render(uri, sourceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.error(`IFC 3D focus failed: ${message}`);
      void vscode.window.showErrorMessage(`IFC 3D focus failed: ${message}`);
    }
  }

  // --- CodeLens -----------------------------------------------------------

  async provideCodeLenses(
    document: vscode.TextDocument,
    cancel: vscode.CancellationToken,
  ): Promise<vscode.CodeLens[]> {
    const config = readConfig();
    if (!config.codeLens) {
      return [];
    }
    // Reuse (and populate) the same index the preview command uses, so the work is
    // shared and `ifc.viewer.maxFileSizeMb` is the single size authority. A file
    // above that limit (or unreadable / not STEP) simply yields no lenses.
    let index: StepFileIndex;
    try {
      index = await this.getIndex(document.uri, config.maxFileSizeMb);
    } catch {
      return [];
    }
    if (cancel.isCancellationRequested) {
      return [];
    }
    // Only the visible window is parsed on large files, so per-call cost is
    // independent of file size; small files lens whole so lenses don't shift on
    // scroll. The index test (`hasRenderableRepresentation`) makes the gate broad
    // yet honest: it matches what the engine will actually render.
    const lenses: vscode.CodeLens[] = [];
    const seen = new Set<number>();
    for (const [from, to] of this.lensLineWindows(document)) {
      for (let line = from; line < to; line++) {
        if (cancel.isCancellationRequested) {
          return lenses;
        }
        if (seen.has(line)) {
          continue;
        }
        seen.add(line);
        const match = LENS_CANDIDATE_RE.exec(document.lineAt(line).text);
        if (!match) {
          continue;
        }
        const id = Number.parseInt(match[1], 10);
        if (!index.isPreviewable(id, config.includeChildren)) {
          continue;
        }
        lenses.push(
          new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
            title: "$(eye) Preview in 3D",
            command: "ifc.viewElement",
            arguments: [{ uri: document.uri, id }],
          }),
        );
        if (lenses.length >= LENS_MAX) {
          return lenses;
        }
      }
    }
    return lenses;
  }

  /** Line ranges to scan for lenses: the whole file when small, else the
   *  viewport (± a margin). Ranges may overlap; the caller dedupes by line. */
  private lensLineWindows(document: vscode.TextDocument): Array<[number, number]> {
    const lineCount = document.lineCount;
    if (lineCount <= LENS_WHOLE_FILE_MAX_LINES) {
      return [[0, lineCount]];
    }
    const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
    if (!editor || editor.visibleRanges.length === 0) {
      return [[0, Math.min(lineCount, LENS_WHOLE_FILE_MAX_LINES)]];
    }
    return editor.visibleRanges.map(
      (r) =>
        [
          Math.max(0, r.start.line - LENS_VIEWPORT_MARGIN),
          Math.min(lineCount, r.end.line + LENS_VIEWPORT_MARGIN + 1),
        ] as [number, number],
    );
  }

  dispose(): void {
    if (this.lensRefreshTimer) {
      clearTimeout(this.lensRefreshTimer);
    }
    this.lensChanged.dispose();
    this.indexCache.clear();
  }
}

export function registerViewer(
  context: vscode.ExtensionContext,
  output: vscode.LogOutputChannel,
): void {
  const controller = new ViewerController(context, output);

  context.subscriptions.push(
    vscode.commands.registerCommand("ifc.viewElement", (arg) => controller.viewElement(arg)),
    vscode.languages.registerCodeLensProvider({ language: "ifc" }, controller),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) =>
      controller.onVisibleRangesChanged(event.textEditor),
    ),
    vscode.workspace.onDidCloseTextDocument((document) => controller.onDocumentClosed(document)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("ifc.viewer")) {
        controller.configChanged();
      }
    }),
    controller,
  );
}
