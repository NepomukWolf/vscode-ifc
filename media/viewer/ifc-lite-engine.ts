import { GeometryProcessor, type MeshData } from "@ifc-lite/geometry";
import { Renderer, type RenderOptions } from "@ifc-lite/renderer";
import type { PickTarget } from "../../src/viewer/protocol";
import type { EngineOptions, RenderEngine, RenderLoad, RenderStats } from "./engine";

interface Bounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

function emptyBounds(): Bounds {
  return {
    min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
    max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
  };
}

function isFiniteBounds(bounds: Bounds): boolean {
  return (
    Number.isFinite(bounds.min.x) &&
    Number.isFinite(bounds.min.y) &&
    Number.isFinite(bounds.min.z) &&
    Number.isFinite(bounds.max.x) &&
    Number.isFinite(bounds.max.y) &&
    Number.isFinite(bounds.max.z)
  );
}

function extendBounds(target: Bounds, source: Bounds): void {
  target.min.x = Math.min(target.min.x, source.min.x);
  target.min.y = Math.min(target.min.y, source.min.y);
  target.min.z = Math.min(target.min.z, source.min.z);
  target.max.x = Math.max(target.max.x, source.max.x);
  target.max.y = Math.max(target.max.y, source.max.y);
  target.max.z = Math.max(target.max.z, source.max.z);
}

function meshBounds(mesh: MeshData): Bounds | undefined {
  const positions = mesh.positions;
  if (positions.length < 3) {
    return undefined;
  }
  const bounds = emptyBounds();
  const origin = mesh.origin ?? [0, 0, 0];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i] + origin[0];
    const y = positions[i + 1] + origin[1];
    const z = positions[i + 2] + origin[2];
    bounds.min.x = Math.min(bounds.min.x, x);
    bounds.min.y = Math.min(bounds.min.y, y);
    bounds.min.z = Math.min(bounds.min.z, z);
    bounds.max.x = Math.max(bounds.max.x, x);
    bounds.max.y = Math.max(bounds.max.y, y);
    bounds.max.z = Math.max(bounds.max.z, z);
  }
  return isFiniteBounds(bounds) ? bounds : undefined;
}

function cssBackground(): [number, number, number, number] {
  const fallback: [number, number, number, number] = [0.118, 0.118, 0.118, 1];
  const value = getComputedStyle(document.body)
    .getPropertyValue("--vscode-editor-background")
    .trim();
  if (!value) {
    return fallback;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return fallback;
  }
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255, a / 255];
}

/** Full-model ifc-lite WebGPU engine; preview changes are visibility filters. */
export class IfcLiteEngine implements RenderEngine {
  readonly canvas = document.createElement("canvas");

  private renderer: Renderer | undefined;
  private geometry: GeometryProcessor | undefined;
  private modelKey: string | undefined;
  private isolatedIds = new Set<number>();
  private selectedIds = new Set<number>();
  private readonly boundsById = new Map<number, Bounds>();
  private readonly meshCountsById = new Map<number, number>();
  private triangleCount = 0;
  private readonly background = cssBackground();
  private streaming = false;
  private disposed = false;
  private pointerId: number | undefined;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private panGesture = false;

  constructor(container: HTMLElement, private readonly options: EngineOptions = {}) {
    this.canvas.className = "ifc-lite-canvas";
    this.canvas.tabIndex = 0;
    container.append(this.canvas);
    this.installControls();
  }

  async load(load: RenderLoad): Promise<RenderStats> {
    if (this.disposed) {
      throw new Error("The IFC viewer has been disposed.");
    }
    if (!navigator.gpu) {
      throw new Error(
        "This experimental IFC viewer requires WebGPU, but this VS Code webview does not expose navigator.gpu.",
      );
    }

    this.isolatedIds = new Set(load.renderIds);
    this.selectedIds.clear();

    if (this.modelKey !== load.modelKey) {
      if (!load.bytes) {
        throw new Error("The requested IFC model is not resident and no model bytes were supplied.");
      }
      await this.loadModel(load.modelKey, load.bytes);
    } else {
      this.log(`isolate: ${this.isolatedIds.size} product id${this.isolatedIds.size === 1 ? "" : "s"}`);
    }

    this.requestRender();
    await this.fit();
    return this.visibleStats();
  }

  private async loadModel(modelKey: string, bytes: Uint8Array): Promise<void> {
    this.log(`load: initializing ifc-lite (${bytes.byteLength.toLocaleString()} bytes)`);
    this.releaseModel();
    const renderer = new Renderer(this.canvas);
    // Keep every occurrence on the documented MeshData/addMeshes path. The
    // optional shard path needs separate renderer plumbing and is not part of
    // this feasibility experiment.
    const geometry = new GeometryProcessor({ enableInstancing: false });
    this.renderer = renderer;
    this.geometry = geometry;
    this.boundsById.clear();
    this.meshCountsById.clear();
    this.triangleCount = 0;
    this.streaming = true;

    await Promise.all([renderer.init(), geometry.init()]);
    if (this.disposed || this.renderer !== renderer) {
      return;
    }
    this.resize(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);

    let totalMeshes = 0;
    let lastLoggedMeshes = 0;
    const wasmUrl = new URL("./ifc-lite_bg.wasm", import.meta.url).href;
    for await (const event of geometry.processAdaptive(bytes, { wasmUrls: { wasm: wasmUrl } })) {
      if (this.disposed || this.renderer !== renderer) {
        return;
      }
      if (event.type === "batch") {
        const meshes = event.meshes.filter((mesh) => (mesh.geometryClass ?? 0) !== 2);
        if (meshes.length > 0) {
          this.recordMeshes(meshes);
          renderer.addMeshes(meshes, true);
          totalMeshes += meshes.length;
          renderer.render(this.renderOptions());
        }
        if (totalMeshes - lastLoggedMeshes >= 250) {
          this.log(`load: streamed ${totalMeshes.toLocaleString()} meshes`);
          lastLoggedMeshes = totalMeshes;
        }
      }
    }
    const device = renderer.getGPUDevice();
    const pipeline = renderer.getPipeline();
    if (device && pipeline) {
      await renderer.getScene().finalizeStreamingAsync(device, pipeline);
    }
    this.streaming = false;
    this.modelKey = modelKey;
    renderer.ensureMeshResources();
    this.log(
      `load: complete — ${totalMeshes.toLocaleString()} meshes, ${this.triangleCount.toLocaleString()} triangles`,
    );
    this.requestRender();
  }

  private recordMeshes(meshes: readonly MeshData[]): void {
    for (const mesh of meshes) {
      this.meshCountsById.set(mesh.expressId, (this.meshCountsById.get(mesh.expressId) ?? 0) + 1);
      this.triangleCount += Math.floor(mesh.indices.length / 3);
      const bounds = meshBounds(mesh);
      if (!bounds) {
        continue;
      }
      const existing = this.boundsById.get(mesh.expressId);
      if (existing) {
        extendBounds(existing, bounds);
      } else {
        this.boundsById.set(mesh.expressId, bounds);
      }
    }
  }

  private visibleBounds(): Bounds | undefined {
    const bounds = emptyBounds();
    for (const id of this.isolatedIds) {
      const entityBounds = this.boundsById.get(id);
      if (entityBounds) {
        extendBounds(bounds, entityBounds);
      }
    }
    return isFiniteBounds(bounds) ? bounds : undefined;
  }

  private visibleStats(): RenderStats {
    let meshes = 0;
    for (const id of this.isolatedIds) {
      meshes += this.meshCountsById.get(id) ?? 0;
    }
    return { meshes, triangles: this.triangleCount };
  }

  private renderOptions(): RenderOptions {
    return {
      clearColor: this.background,
      isolatedIds: this.isolatedIds,
      selectedIds: this.selectedIds,
      isStreaming: this.streaming,
    };
  }

  async fit(): Promise<void> {
    const bounds = this.visibleBounds();
    const renderer = this.renderer;
    if (!bounds || !renderer) {
      return;
    }
    await renderer.getCamera().frameBounds(bounds.min, bounds.max, 0);
    renderer.getCamera().setOrbitCenter({
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
    });
    this.requestRender();
  }

  async reset(): Promise<void> {
    const bounds = this.visibleBounds();
    const renderer = this.renderer;
    if (!bounds || !renderer) {
      return;
    }
    const camera = renderer.getCamera();
    camera.reset();
    camera.fitToBounds(bounds.min, bounds.max);
    camera.setOrbitCenter({
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
    });
    this.requestRender();
  }

  async pick(clientX: number, clientY: number): Promise<PickTarget | undefined> {
    const renderer = this.renderer;
    if (!renderer || this.streaming) {
      return undefined;
    }
    const rect = this.canvas.getBoundingClientRect();
    const hit = await renderer.pick(clientX - rect.left, clientY - rect.top, {
      isolatedIds: this.isolatedIds,
    });
    if (!hit) {
      this.selectedIds.clear();
      this.requestRender();
      return undefined;
    }
    this.selectedIds = new Set([hit.expressId]);
    this.requestRender();
    return { productId: hit.expressId };
  }

  resize(width: number, height: number): void {
    this.renderer?.resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    this.renderer?.getCamera().setAspect(Math.max(1, width) / Math.max(1, height));
    this.requestRender();
  }

  update(deltaMs: number): void {
    const renderer = this.renderer;
    if (!renderer) {
      return;
    }
    renderer.getCamera().update(deltaMs);
    renderer.render(this.renderOptions());
  }

  dispose(): void {
    this.disposed = true;
    this.releaseModel();
    this.canvas.remove();
  }

  private releaseModel(): void {
    this.geometry?.dispose();
    this.geometry = undefined;
    this.renderer?.destroy();
    this.renderer = undefined;
    this.modelKey = undefined;
    this.streaming = false;
    this.boundsById.clear();
    this.meshCountsById.clear();
  }

  private requestRender(): void {
    this.renderer?.requestRender();
  }

  private log(message: string): void {
    this.options.log?.(message);
  }

  private installControls(): void {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) {
        return;
      }
      this.pointerId = event.pointerId;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      this.panGesture = event.button !== 0 || event.shiftKey;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.pointerId) {
        return;
      }
      const dx = event.clientX - this.lastPointerX;
      const dy = event.clientY - this.lastPointerY;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      const camera = this.renderer?.getCamera();
      if (!camera) {
        return;
      }
      if (this.panGesture) {
        camera.pan(dx, dy);
      } else {
        camera.orbit(dx, dy);
      }
      this.requestRender();
    });
    const finishPointer = (event: PointerEvent): void => {
      if (event.pointerId !== this.pointerId) {
        return;
      }
      this.pointerId = undefined;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };
    this.canvas.addEventListener("pointerup", finishPointer);
    this.canvas.addEventListener("pointercancel", finishPointer);
    this.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.renderer
          ?.getCamera()
          .zoom(
            event.deltaY,
            false,
            event.clientX - rect.left,
            event.clientY - rect.top,
            rect.width,
            rect.height,
          );
        this.requestRender();
      },
      { passive: false },
    );
  }
}
