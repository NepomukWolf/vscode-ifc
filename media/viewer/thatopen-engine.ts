import * as OBC from "@thatopen/components";
import * as WebIFC from "web-ifc";
import * as THREE from "three";
import type { EngineOptions, RenderEngine, RenderLoad, RenderStats } from "./engine";

function wasmBase(): string {
  return (globalThis as unknown as { __IFC_WASM_BASE__?: string }).__IFC_WASM_BASE__ ?? "";
}

function colorFromCssVar(name: string, fallback: string): THREE.Color {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return new THREE.Color(value || fallback);
}

function normalizedCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
}

async function withTimeout<T>(label: string, promise: Promise<T>, timeoutMs = 20_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

const SELECTION_COLOR = 0x4ea1ff;
const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(1.45, 1.8, 0.9).normalize();
const DEFAULT_VIEW_PADDING = 1.35;

/**
 * web-ifc geometry, rendered directly through ThatOpen's world/renderer stack.
 *
 * We deliberately bypass ThatOpen's Fragments pipeline (IfcImporter + fragments
 * worker): for our read-only viewer it only adds a worker round-trip that tends
 * to hang. Instead we stream meshes straight out of web-ifc and add plain THREE
 * objects to the ThatOpen scene — the classic web-ifc-three approach.
 */
export class ThatOpenEngine implements RenderEngine {
  private readonly components = new OBC.Components();
  private readonly world: OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>;
  private readonly raycaster = new THREE.Raycaster();
  private ifcApi: WebIFC.IfcAPI | undefined;
  private modelGroup: THREE.Group | undefined;
  private readonly geometryCache = new Map<number, THREE.BufferGeometry>();
  private readonly materialCache = new Map<string, THREE.Material>();
  private selected: { mesh: THREE.Mesh; material: THREE.Material } | undefined;
  private sequence = 0;
  private readonly ready: Promise<void>;

  constructor(container: HTMLElement, private readonly options: EngineOptions = {}) {
    this.log("setup: creating world");
    const worlds = this.components.get(OBC.Worlds);
    this.world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
    this.world.scene = new OBC.SimpleScene(this.components);
    this.world.renderer = new OBC.SimpleRenderer(this.components, container, {
      antialias: true,
      alpha: false,
    });
    this.world.renderer.showLogo = false;
    this.world.camera = new OBC.SimpleCamera(this.components);
    this.world.scene.three.background = colorFromCssVar("--vscode-editor-background", "#1e1e1e");
    this.world.scene.setup();
    this.components.init();
    this.configureControls();

    this.ready = this.setup();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.three.domElement;
  }

  private get renderer(): OBC.SimpleRenderer {
    const renderer = this.world.renderer;
    if (!renderer) {
      throw new Error("ThatOpen renderer is not initialized.");
    }
    return renderer;
  }

  /**
   * ThatOpen's SimpleCamera defaults to dolly-to-cursor + infinity dolly, which
   * drags the orbit target toward the mouse on zoom (off-center pivot) and makes
   * zoom feel jumpy. We want a fixed pivot at the model center and gentler zoom.
   */
  private configureControls(): void {
    const controls = this.world.camera.controls;
    controls.dollyToCursor = false;
    controls.infinityDolly = false;
    controls.dollySpeed = 0.5;
    controls.minDistance = 0.5;

    // SimpleCamera defaults to near=1 (clips anything within 1m of the camera,
    // slicing the object on close views) and far=1e3. Pull the near plane in and
    // push far out so you can zoom right up to geometry of any scale.
    const camera = this.world.camera.three;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = 0.01;
      camera.far = 1e5;
      camera.updateProjectionMatrix();
    }
  }

  private async setup(): Promise<void> {
    const base = wasmBase();
    this.log(`setup: web-ifc wasm base ${base}`);
    const api = new WebIFC.IfcAPI();
    api.SetWasmPath(base, true);
    // Force single-thread: we only ship web-ifc.wasm (not web-ifc-mt.wasm), and
    // single-thread avoids the pthread worker/blob path entirely.
    await withTimeout("web-ifc init", api.Init(undefined, true), 20_000);
    this.ifcApi = api;
    this.log("setup: ready");
  }

  async load(load: RenderLoad): Promise<RenderStats> {
    const renderIds = load.renderIds.length > 0 ? load.renderIds : [load.rootId];
    this.log(`load: waiting for setup (${load.bytes.byteLength.toLocaleString()} bytes, ${renderIds.length} render id${renderIds.length === 1 ? "" : "s"})`);
    await this.ready;
    const api = this.ifcApi;
    if (!api) {
      throw new Error("web-ifc is not initialized.");
    }

    this.log("load: clearing previous model");
    this.clearModel();

    const modelId = `model-${++this.sequence}`;
    this.log(`load: opening IFC (${modelId})`);
    const handle = api.OpenModel(load.bytes, { COORDINATE_TO_ORIGIN: true });

    try {
      const onlyIds = renderIds.length === 1 && renderIds[0] === load.rootId ? undefined : new Set(renderIds);
      const stats = this.buildMeshes(api, handle, onlyIds);
      this.log(`load: built ${stats.meshes} mesh${stats.meshes === 1 ? "" : "es"} (${stats.triangles.toLocaleString()} triangles)`);
    } finally {
      api.CloseModel(handle);
    }

    this.log("load: fitting camera");
    await this.fit();
    this.renderer.needsUpdate = true;
    const meshes = this.modelGroup ? countRenderableObjects(this.modelGroup) : 0;
    return { meshes };
  }

  /** Streams every mesh out of web-ifc into a THREE group attached to the scene. */
  private buildMeshes(api: WebIFC.IfcAPI, handle: number, onlyIds: Set<number> | undefined): { meshes: number; triangles: number } {
    const group = new THREE.Group();
    group.name = "web-ifc-model";
    const coordination = new THREE.Matrix4().fromArray(api.GetCoordinationMatrix(handle));
    group.matrix.copy(coordination);
    group.matrixAutoUpdate = false;

    const transform = new THREE.Matrix4();
    let meshCount = 0;
    let triangleCount = 0;

    api.StreamAllMeshes(handle, (flatMesh) => {
      const expressID = flatMesh.expressID;
      if (onlyIds && !onlyIds.has(expressID)) {
        return;
      }
      const placed = flatMesh.geometries;
      for (let i = 0; i < placed.size(); i++) {
        const placement = placed.get(i);
        const geometry = this.getGeometry(api, handle, placement.geometryExpressID);
        if (!geometry) {
          continue;
        }
        const material = this.getMaterial(placement.color);
        const mesh = new THREE.Mesh(geometry, material);
        transform.fromArray(placement.flatTransformation);
        mesh.applyMatrix4(transform);
        mesh.userData.expressID = expressID;
        group.add(mesh);
        meshCount += 1;
        const index = geometry.getIndex();
        triangleCount += index ? index.count / 3 : 0;
      }
    });

    this.modelGroup = group;
    this.world.scene.three.add(group);
    return { meshes: meshCount, triangles: triangleCount };
  }

  /** Builds (and caches) a BufferGeometry from web-ifc's interleaved vertex buffer. */
  private getGeometry(api: WebIFC.IfcAPI, handle: number, geometryExpressID: number): THREE.BufferGeometry | undefined {
    const cached = this.geometryCache.get(geometryExpressID);
    if (cached) {
      return cached;
    }
    const ifcGeometry = api.GetGeometry(handle, geometryExpressID);
    const vertexPtr = ifcGeometry.GetVertexData();
    const vertexSize = ifcGeometry.GetVertexDataSize();
    const indexPtr = ifcGeometry.GetIndexData();
    const indexSize = ifcGeometry.GetIndexDataSize();
    // web-ifc packs 6 floats per vertex: position (xyz) then normal (xyz).
    const vertices = api.GetVertexArray(vertexPtr, vertexSize);
    const indices = api.GetIndexArray(indexPtr, indexSize);
    ifcGeometry.delete();

    if (vertices.length === 0 || indices.length === 0) {
      return undefined;
    }

    const interleaved = new THREE.InterleavedBuffer(new Float32Array(vertices), 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute("normal", new THREE.InterleavedBufferAttribute(interleaved, 3, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    this.geometryCache.set(geometryExpressID, geometry);
    return geometry;
  }

  /** Caches one material per distinct IFC color (rgba). */
  private getMaterial(color: WebIFC.Color): THREE.Material {
    const key = `${color.x.toFixed(3)},${color.y.toFixed(3)},${color.z.toFixed(3)},${color.w.toFixed(3)}`;
    const cached = this.materialCache.get(key);
    if (cached) {
      return cached;
    }
    const transparent = color.w < 1;
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color.x, color.y, color.z),
      side: THREE.DoubleSide,
      transparent,
      opacity: color.w,
      depthWrite: !transparent,
    });
    this.materialCache.set(key, material);
    return material;
  }

  async fit(): Promise<void> {
    if (!this.modelGroup) {
      return;
    }
    await withTimeout("camera fit", this.fitDefaultView(), 5_000);
    this.renderer.needsUpdate = true;
  }

  private async fitDefaultView(): Promise<void> {
    const group = this.modelGroup;
    if (!group) {
      return;
    }
    const camera = this.world.camera.three;
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      await this.world.camera.controls.fitToBox(group, false);
      return;
    }

    this.world.scene.three.updateMatrixWorld(true);
    group.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) {
      return;
    }

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const radius = Math.max(sphere.radius, 1);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const fitFov = Math.min(verticalFov, horizontalFov);
    const distance = (radius / Math.sin(fitFov / 2)) * DEFAULT_VIEW_PADDING;
    const position = center.clone().addScaledVector(DEFAULT_VIEW_DIRECTION, distance);

    await this.world.camera.controls.setLookAt(
      position.x,
      position.y,
      position.z,
      center.x,
      center.y,
      center.z,
      false,
    );
    this.world.camera.controls.normalizeRotations();
  }

  async reset(): Promise<void> {
    await this.fit();
  }

  async pick(clientX: number, clientY: number): Promise<number | undefined> {
    if (!this.modelGroup) {
      return undefined;
    }
    this.clearSelection();
    this.raycaster.setFromCamera(normalizedCanvasPoint(this.canvas, clientX, clientY), this.world.camera.three);
    const hits = this.raycaster.intersectObject(this.modelGroup, true);
    const hit = hits.find((entry) => entry.object instanceof THREE.Mesh);
    if (!hit) {
      return undefined;
    }
    const mesh = hit.object as THREE.Mesh;
    const expressID = mesh.userData.expressID as number | undefined;
    this.applySelection(mesh);
    this.renderer.needsUpdate = true;
    return expressID;
  }

  private applySelection(mesh: THREE.Mesh): void {
    const original = mesh.material as THREE.Material;
    mesh.material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(SELECTION_COLOR),
      side: THREE.DoubleSide,
    });
    this.selected = { mesh, material: original };
  }

  private clearSelection(): void {
    if (!this.selected) {
      return;
    }
    (this.selected.mesh.material as THREE.Material).dispose();
    this.selected.mesh.material = this.selected.material;
    this.selected = undefined;
  }

  resize(_width: number, _height: number): void {
    this.renderer.resize();
    this.world.camera.updateAspect();
    this.renderer.needsUpdate = true;
  }

  update(_deltaMs: number): void {
    // Components drives the ThatOpen world update loop after components.init().
  }

  dispose(): void {
    const canvas = this.world.renderer?.three.domElement;
    this.clearModel();
    this.ifcApi = undefined;
    this.components.dispose();
    canvas?.remove();
  }

  private log(message: string): void {
    this.options.log?.(message);
  }

  private clearModel(): void {
    this.clearSelection();
    if (this.modelGroup) {
      this.world.scene.three.remove(this.modelGroup);
      this.modelGroup = undefined;
    }
    for (const geometry of this.geometryCache.values()) {
      geometry.dispose();
    }
    this.geometryCache.clear();
    for (const material of this.materialCache.values()) {
      material.dispose();
    }
    this.materialCache.clear();
  }
}

function countRenderableObjects(object: THREE.Object3D): number {
  let count = 0;
  object.traverse((child) => {
    if ("isMesh" in child || "isLine" in child || "isPoints" in child) {
      count += 1;
    }
  });
  return count;
}
