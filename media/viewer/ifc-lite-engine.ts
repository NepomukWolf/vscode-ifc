import { decodeInstancedShard, GeometryProcessor, type MeshData } from "@ifc-lite/geometry";
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
  private rendererReady: Promise<void> | undefined;
  private geometryReady: Promise<void> | undefined;
  private backendStartedAt = 0;
  private modelKey: string | undefined;
  private isolatedIds = new Set<number>();
  private selectedIds = new Set<number>();
  private readonly background = cssBackground();
  private loading = false;
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
    if (navigator.gpu) {
      this.prepareBackend();
    }
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

    const loadStartedAt = performance.now();
    this.isolatedIds = new Set(load.renderIds);
    this.selectedIds.clear();

    const replacingModel = this.modelKey !== load.modelKey;
    if (replacingModel) {
      if (!load.bytes) {
        throw new Error("The requested IFC model is not resident and no model bytes were supplied.");
      }
      await this.loadModel(load.modelKey, load.bytes);
    } else {
      this.log(`isolate: ${this.isolatedIds.size} product id${this.isolatedIds.size === 1 ? "" : "s"}`);
    }

    this.requestRender();
    if (replacingModel) {
      await this.reset();
    } else {
      await this.fit();
    }
    this.renderRequestedFrame();
    if (replacingModel) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      this.log(`load: first complete frame in ${Math.round(performance.now() - loadStartedAt)} ms`);
    }
    return this.visibleStats();
  }

  private async loadModel(modelKey: string, bytes: Uint8Array): Promise<void> {
    this.log(`load: initializing ifc-lite (${bytes.byteLength.toLocaleString()} bytes)`);
    if (this.modelKey !== undefined || this.loading) {
      this.releaseModel();
      this.prepareBackend();
    } else if (!this.renderer || !this.geometry) {
      this.prepareBackend();
    }
    const renderer = this.renderer;
    const geometry = this.geometry;
    const rendererReady = this.rendererReady;
    const geometryReady = this.geometryReady;
    if (!renderer || !geometry || !rendererReady || !geometryReady) {
      throw new Error("ifc-lite failed to initialize its rendering backend.");
    }
    this.loading = true;

    await geometryReady;
    if (this.disposed || this.renderer !== renderer) {
      return;
    }
    const initializedAt = performance.now();
    this.log(`load: initialized in ${Math.round(initializedAt - this.backendStartedAt)} ms`);

    const meshes: MeshData[] = [];
    const instancedShards: ArrayBuffer[] = [];
    const wasmUrl = new URL("./ifc-lite_bg.wasm", import.meta.url).href;
    const processingStartedAt = performance.now();
    for await (const event of geometry.processAdaptive(bytes, { wasmUrls: { wasm: wasmUrl } })) {
      if (this.disposed || this.renderer !== renderer) {
        return;
      }
      if (event.type === "batch") {
        for (const mesh of event.meshes) {
          if ((mesh.geometryClass ?? 0) !== 2) {
            meshes.push(mesh);
          }
        }
        for (const shard of event.instancedShards ?? []) {
          instancedShards.push(shard);
        }
      }
    }
    const processedAt = performance.now();
    this.log(
      `load: geometry processed in ${Math.round(processedAt - processingStartedAt)} ms — ${meshes.length.toLocaleString()} flat meshes, ${instancedShards.length.toLocaleString()} instance shards`,
    );

    await rendererReady;
    if (this.disposed || this.renderer !== renderer) {
      return;
    }
    this.resize(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);

    const flatUploadStartedAt = performance.now();
    renderer.loadGeometry(meshes);
    const flatUploadedAt = performance.now();
    this.log(`load: flat geometry uploaded in ${Math.round(flatUploadedAt - flatUploadStartedAt)} ms`);

    const device = renderer.getGPUDevice();
    if (!device) {
      throw new Error("ifc-lite initialized without a WebGPU device.");
    }
    const instancedUploadStartedAt = performance.now();
    let instancedOccurrences = 0;
    for (const payload of instancedShards) {
      const shard = decodeInstancedShard(new Uint8Array(payload));
      instancedOccurrences += shard.instances.length;
      renderer.getScene().addInstancedShard(device, shard);
    }
    const instancedUploadedAt = performance.now();
    this.log(
      `load: instanced geometry uploaded in ${Math.round(instancedUploadedAt - instancedUploadStartedAt)} ms — ${instancedOccurrences.toLocaleString()} occurrences`,
    );

    this.loading = false;
    this.modelKey = modelKey;
    renderer.ensureMeshResources();
    this.log(
      `load: complete in ${Math.round(instancedUploadedAt - processingStartedAt)} ms`,
    );
    this.requestRender();
  }

  private visibleBounds(): Bounds | undefined {
    const bounds = emptyBounds();
    const scene = this.renderer?.getScene();
    if (!scene) {
      return undefined;
    }
    for (const id of this.isolatedIds) {
      const entityBounds = scene.getEntityBoundingBox(id);
      if (entityBounds) {
        extendBounds(bounds, entityBounds);
      }
    }
    return isFiniteBounds(bounds) ? bounds : undefined;
  }

  private visibleStats(): RenderStats {
    const scene = this.renderer?.getScene();
    let renderableEntities = 0;
    for (const id of this.isolatedIds) {
      if (scene?.getEntityBoundingBox(id)) {
        renderableEntities++;
      }
    }
    return { meshes: renderableEntities };
  }

  private renderOptions(): RenderOptions {
    return {
      clearColor: this.background,
      isolatedIds: this.isolatedIds,
      selectedIds: this.selectedIds,
      isStreaming: this.loading,
    };
  }

  async fit(): Promise<void> {
    const bounds = this.visibleBounds();
    const renderer = this.renderer;
    if (!bounds || !renderer) {
      return;
    }
    const camera = renderer.getCamera();
    const center = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
    };
    const currentPosition = camera.getPosition();
    const currentTarget = camera.getTarget();
    let dx = currentPosition.x - currentTarget.x;
    let dy = currentPosition.y - currentTarget.y;
    let dz = currentPosition.z - currentTarget.z;
    let directionLength = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(directionLength) || directionLength < 1e-9) {
      dx = 1.45;
      dy = 1.8;
      dz = 0.9;
      directionLength = Math.hypot(dx, dy, dz);
    }
    dx /= directionLength;
    dy /= directionLength;
    dz /= directionLength;

    const extentX = bounds.max.x - bounds.min.x;
    const extentY = bounds.max.y - bounds.min.y;
    const extentZ = bounds.max.z - bounds.min.z;
    const radius = Math.max(0.01, Math.hypot(extentX, extentY, extentZ) / 2);
    const aspect = Math.max(0.01, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));

    if (camera.getProjectionMode() === "orthographic") {
      const halfHeight = Math.max(extentY / 2, extentX / (2 * aspect), extentZ / 2);
      camera.setOrthoSize(Math.max(0.01, halfHeight * 1.25));
      camera.setTarget(center.x, center.y, center.z);
      camera.setPosition(
        center.x + dx * directionLength,
        center.y + dy * directionLength,
        center.z + dz * directionLength,
      );
    } else {
      const verticalFov = camera.getFOV();
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const fitFov = Math.max(0.01, Math.min(verticalFov, horizontalFov));
      const distance = (radius / Math.sin(fitFov / 2)) * 1.25;
      camera.setTarget(center.x, center.y, center.z);
      camera.setPosition(
        center.x + dx * distance,
        center.y + dy * distance,
        center.z + dz * distance,
      );
    }
    camera.setOrbitAnchorBounds(bounds);
    camera.setOrbitCenter(center);
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
    camera.fitBoundsAdaptive(bounds, {
      animate: false,
      viewportShortPx: Math.max(
        1,
        Math.min(this.canvas.clientWidth, this.canvas.clientHeight),
      ),
    });
    camera.setOrbitAnchorBounds(bounds);
    camera.setOrbitCenter({
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
    });
    this.requestRender();
  }

  async pick(clientX: number, clientY: number): Promise<PickTarget | undefined> {
    const renderer = this.renderer;
    if (!renderer || this.loading) {
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
    const cameraAnimating = renderer.getCamera().update(deltaMs);
    if (cameraAnimating) {
      renderer.requestRender();
    }
    if (renderer.consumeRenderRequest()) {
      renderer.render(this.renderOptions());
    }
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
    this.rendererReady = undefined;
    this.geometryReady = undefined;
    this.modelKey = undefined;
    this.loading = false;
  }

  private prepareBackend(): void {
    const renderer = new Renderer(this.canvas);
    const geometry = new GeometryProcessor();
    this.renderer = renderer;
    this.geometry = geometry;
    this.backendStartedAt = performance.now();
    this.rendererReady = renderer.init();
    this.geometryReady = geometry.init();
    void this.rendererReady.catch(() => undefined);
    void this.geometryReady.catch(() => undefined);
    this.logParallelCapabilities();
  }

  private renderRequestedFrame(): void {
    const renderer = this.renderer;
    if (!renderer) {
      return;
    }
    renderer.consumeRenderRequest();
    renderer.render(this.renderOptions());
  }

  private logParallelCapabilities(): void {
    const sharedMemory = typeof SharedArrayBuffer !== "undefined";
    const workers = typeof Worker !== "undefined";
    const cores = navigator.hardwareConcurrency ?? 1;
    const isolated = globalThis.crossOriginIsolated === true;
    this.log(
      `diagnostic: parallel capability — SharedArrayBuffer=${sharedMemory}, Worker=${workers}, hardwareConcurrency=${cores}, crossOriginIsolated=${isolated}`,
    );
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
