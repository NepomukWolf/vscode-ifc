export type EngineLog = (message: string) => void;

export interface EngineOptions {
  log?: EngineLog;
}

export interface RenderStats {
  meshes: number;
  triangles?: number;
}

export interface RenderLoad {
  bytes: Uint8Array;
  rootId: number;
  renderIds: readonly number[];
}

export interface RenderEngine {
  readonly canvas: HTMLCanvasElement;
  load(load: RenderLoad): Promise<RenderStats>;
  fit(): Promise<void> | void;
  reset(): Promise<void> | void;
  pick(clientX: number, clientY: number): Promise<number | undefined>;
  resize(width: number, height: number): void;
  update(deltaMs: number): void;
  dispose(): void;
}
