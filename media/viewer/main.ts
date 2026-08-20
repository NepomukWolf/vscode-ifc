import "./viewer.css";
import { render as renderHtml } from "lit-html";
import type { RenderEngine } from "./engine";
import { ThatOpenEngine } from "./thatopen-engine";
import { viewerTemplate, type ViewerTemplateState } from "./template";
import type {
  HostToWebview,
  LoadMessage,
  PickMode,
  WebviewToHost,
} from "../../src/viewer/protocol";

declare function acquireVsCodeApi(): { postMessage(message: WebviewToHost): void };

const vscode = acquireVsCodeApi();

function post(message: WebviewToHost): void {
  vscode.postMessage(message);
}

class Viewer {
  private readonly root: HTMLElement;
  private readonly canvasHost: HTMLElement;

  private engine: RenderEngine | undefined;
  private renderSeq = 0;
  private lastFrame = performance.now();
  private activeLoadStage = "";
  private resizeObserver: ResizeObserver | undefined;
  private animationFrame = 0;
  private currentPickMode: PickMode = "product";

  private hudPath = "";
  private hudTitle = "";
  private hudSub = "";
  private hudInfo = "";
  private hudInfoTitle = "";
  private hudSelection = "";
  private hudWarn = "";
  private overlayText = "";
  private overlayBusy = false;
  private canGoBack = false;
  private canGoForward = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.renderChrome();
    this.canvasHost = this.findCanvasHost();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvasHost);
    this.resize();
    this.tick();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.animationFrame);
    this.engine?.dispose();
  }

  async render(message: LoadMessage): Promise<void> {
    this.renderChrome();
    await this.renderWith(message);
  }

  setNavigationState(canGoBack: boolean, canGoForward: boolean): void {
    this.canGoBack = canGoBack;
    this.canGoForward = canGoForward;
    this.renderChrome();
  }

  private async renderWith(message: LoadMessage): Promise<void> {
    const seq = ++this.renderSeq;
    this.activeLoadStage = "";
    this.setOverlay("Loading…", true);
    this.setHud(message);
    const started = performance.now();
    try {
      const engine = this.getEngine();
      const stats = await engine.load({
        bytes: new Uint8Array(message.ifcBytes),
        rootId: message.rootId,
        renderIds: message.renderIds,
        pickMode: message.pickMode,
      });
      if (seq !== this.renderSeq) {
        return;
      }
      if (stats.meshes === 0) {
        this.setOverlay("No renderable geometry for this element.", false);
        post({
          type: "status",
          token: message.token,
          state: "empty",
          message: `#${message.rootId} ${message.rootType ?? ""} produced no geometry.`,
        });
        return;
      }

      this.setOverlay("", false);
      const elapsedMs = Math.round(performance.now() - started);
      post({
        type: "status",
        token: message.token,
        state: "rendered",
        meshes: stats.meshes,
        triangles: stats.triangles,
        elapsedMs,
      });
    } catch (error) {
      if (seq !== this.renderSeq) {
        return;
      }
      const text = error instanceof Error ? error.message : String(error);
      this.setOverlay(`Render failed: ${text}`, false);
      post({ type: "status", token: message.token, state: "error", message: text });
      post({ type: "log", level: "error", message: text });
    }
  }

  private getEngine(): RenderEngine {
    if (this.engine) {
      return this.engine;
    }
    const engine = new ThatOpenEngine(this.canvasHost, {
      log: (message) => this.logEngine(message),
    });
    this.engine = engine;
    this.resizeEngine(engine);
    return engine;
  }

  private logEngine(message: string): void {
    post({ type: "log", level: "info", message });
    if (message.startsWith("load:")) {
      this.activeLoadStage = message.slice("load:".length).trim();
      this.setOverlay(`Loading… ${this.activeLoadStage}`, true);
    }
  }

  private currentEngine(): RenderEngine | undefined {
    return this.engine;
  }

  private findCanvasHost(): HTMLElement {
    const canvasHost = this.root.querySelector<HTMLElement>(".viewer-canvas");
    if (!canvasHost) {
      throw new Error("Viewer canvas host is not mounted.");
    }
    return canvasHost;
  }

  private readonly fit = (): void => {
    void this.currentEngine()?.fit();
  };

  private readonly reset = (): void => {
    void this.currentEngine()?.reset();
  };

  private readonly back = (): void => {
    if (this.canGoBack) {
      post({ type: "historyBack" });
    }
  };

  private readonly forward = (): void => {
    if (this.canGoForward) {
      post({ type: "historyForward" });
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const canvas = this.currentEngine()?.canvas;
    if (!canvas) {
      return;
    }
    canvas.dataset.pointerDownX = String(event.clientX);
    canvas.dataset.pointerDownY = String(event.clientY);
  };

  private readonly onPointerUp = async (event: PointerEvent): Promise<void> => {
    const engine = this.currentEngine();
    if (!engine) {
      return;
    }
    const downX = Number(engine.canvas.dataset.pointerDownX);
    const downY = Number(engine.canvas.dataset.pointerDownY);
    if (Number.isFinite(downX) && Math.hypot(event.clientX - downX, event.clientY - downY) > 5) {
      return;
    }
    const target = await engine.pick(event.clientX, event.clientY);
    if (target) {
      this.hudSelection =
        this.currentPickMode === "geometry" ? `Selected geometry #${target.geometryId}` : "";
      this.renderChrome();
      post({ type: "pick", target });
    }
  };

  private readonly onDoubleClick = async (event: MouseEvent): Promise<void> => {
    const engine = this.currentEngine();
    if (!engine) {
      return;
    }
    const target = await engine.pick(event.clientX, event.clientY);
    if (target) {
      post({ type: "focus", target });
    }
  };

  private setHud(message: LoadMessage): void {
    this.currentPickMode = message.pickMode;
    this.hudPath = message.displayPath;
    this.hudTitle = `${message.rootType ?? "Element"} #${message.rootId}`;
    this.hudSub = message.rootName ?? "";
    this.hudSelection = "";
    const includedElements = message.childCount + message.hostedCount;
    this.hudInfo =
      includedElements > 0
        ? `Includes ${includedElements} element${includedElements === 1 ? "" : "s"}`
        : "";
    const includedBy: string[] = [];
    if (message.childCount > 0) {
      includedBy.push("decomposition descendants (ifc.viewer.includeChildren)");
    }
    if (message.hostedCount > 0) {
      includedBy.push("hosted opening fillings (ifc.viewer.includeHostedElements)");
    }
    this.hudInfoTitle = includedBy.length > 0 ? `Includes ${includedBy.join(" and ")}.` : "";
    const warnings: string[] = [];
    if (message.truncated) {
      warnings.push("⚠ extraction truncated (very large element)");
    }
    this.hudWarn = warnings.join(" · ");
    this.renderChrome();
  }

  private setOverlay(text: string, busy: boolean): void {
    this.overlayText = text;
    this.overlayBusy = busy;
    this.renderChrome();
  }

  private resize(): void {
    if (this.engine) {
      this.resizeEngine(this.engine);
    }
  }

  private resizeEngine(engine: RenderEngine): void {
    engine.resize(this.canvasHost.clientWidth || 1, this.canvasHost.clientHeight || 1);
  }

  private tick = (): void => {
    this.animationFrame = requestAnimationFrame(this.tick);
    const now = performance.now();
    const delta = now - this.lastFrame;
    this.lastFrame = now;
    this.currentEngine()?.update(delta);
  };

  private renderChrome(): void {
    renderHtml(
      viewerTemplate(this.templateState(), {
        onPointerDown: this.onPointerDown,
        onPointerUp: this.onPointerUp,
        onDoubleClick: this.onDoubleClick,
        onBack: this.back,
        onForward: this.forward,
        onFit: this.fit,
        onReset: this.reset,
      }),
      this.root,
    );
  }

  private templateState(): ViewerTemplateState {
    return {
      hudPath: this.hudPath,
      hudTitle: this.hudTitle,
      hudSub: this.hudSub,
      hudInfo: this.hudInfo,
      hudInfoTitle: this.hudInfoTitle,
      hudSelection: this.hudSelection,
      canGoBack: this.canGoBack,
      canGoForward: this.canGoForward,
      hudWarn: this.hudWarn,
      overlayText: this.overlayText,
      overlayBusy: this.overlayBusy,
    };
  }
}

const app = document.getElementById("app");
if (app) {
  const viewer = new Viewer(app);
  window.addEventListener("message", (event: MessageEvent<HostToWebview>) => {
    const message = event.data;
    if (message.type === "load") {
      void viewer.render(message);
    } else if (message.type === "navigationState") {
      viewer.setNavigationState(message.canGoBack, message.canGoForward);
    }
  });
  window.addEventListener("unload", () => viewer.dispose());
  post({ type: "ready" });
}
