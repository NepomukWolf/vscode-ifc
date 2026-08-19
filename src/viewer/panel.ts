import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { HostToWebview, LoadMessage, PickTarget, StatusMessage, WebviewToHost } from "./protocol";

/**
 * Owns the single "IFC 3D Preview" webview panel: lifecycle, HTML/CSP, and the
 * message bridge to the bundled three.js viewer. The host posts `load` messages
 * and surfaces `pick`/`status` back to the caller via events.
 */
export class IfcViewerPanel {
  private static instance: IfcViewerPanel | undefined;
  private static readonly viewType = "ifc.viewer";

  private ready = false;
  private pending: LoadMessage | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private readonly pickEmitter = new vscode.EventEmitter<PickTarget>();
  /** Fires with the product and geometry ids clicked in the 3D scene. */
  readonly onPick = this.pickEmitter.event;

  private readonly focusEmitter = new vscode.EventEmitter<PickTarget>();
  /** Fires with the product and geometry ids double-clicked in the 3D scene. */
  readonly onFocus = this.focusEmitter.event;

  private readonly statusEmitter = new vscode.EventEmitter<StatusMessage>();
  readonly onStatus = this.statusEmitter.event;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly output: vscode.LogOutputChannel,
  ) {
    this.panel.webview.html = this.buildHtml();

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToHost) => this.handleMessage(message),
      undefined,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
  }

  static show(extensionUri: vscode.Uri, output: vscode.LogOutputChannel): IfcViewerPanel {
    const column = vscode.ViewColumn.Beside;
    if (IfcViewerPanel.instance) {
      IfcViewerPanel.instance.panel.reveal(column, true);
      return IfcViewerPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      IfcViewerPanel.viewType,
      "IFC 3D Preview",
      { viewColumn: column, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      },
    );

    IfcViewerPanel.instance = new IfcViewerPanel(panel, extensionUri, output);
    return IfcViewerPanel.instance;
  }

  /** Render a sub-model. Buffers until the webview signals it is ready. */
  load(message: LoadMessage): void {
    this.panel.title = `IFC 3D: ${message.fileName}`;
    if (this.ready) {
      this.post(message);
    } else {
      this.pending = message;
    }
    this.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  private post(message: HostToWebview): void {
    void this.panel.webview.postMessage(message);
  }

  private handleMessage(message: WebviewToHost): void {
    switch (message.type) {
      case "ready":
        this.ready = true;
        if (this.pending) {
          this.post(this.pending);
          this.pending = undefined;
        }
        break;
      case "pick":
        this.pickEmitter.fire(message.target);
        break;
      case "focus":
        this.focusEmitter.fire(message.target);
        break;
      case "status":
        this.statusEmitter.fire(message);
        break;
      case "log":
        this.output[
          message.level === "error" ? "error" : message.level === "warn" ? "warn" : "info"
        ](`[viewer] ${message.message}`);
        break;
    }
  }

  private buildHtml(): string {
    const webview = this.panel.webview;
    const base = vscode.Uri.joinPath(this.extensionUri, "out", "webview");
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(base, "viewer.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(base, "viewer.css"));
    const wasmBase = `${webview.asWebviewUri(base)}/`;
    const nonce = makeNonce();
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} blob: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}' 'wasm-unsafe-eval' ${webview.cspSource} blob:`,
      `connect-src ${webview.cspSource} blob: data:`,
      `worker-src ${webview.cspSource} blob:`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>IFC 3D Preview</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}">window.__IFC_WASM_BASE__ = ${JSON.stringify(wasmBase)};</script>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    IfcViewerPanel.instance = undefined;
    this.pickEmitter.dispose();
    this.focusEmitter.dispose();
    this.statusEmitter.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
    this.panel.dispose();
  }
}

/** Cryptographically-random CSP nonce (gates the webview's `script-src`). */
function makeNonce(): string {
  return randomBytes(16).toString("base64");
}
