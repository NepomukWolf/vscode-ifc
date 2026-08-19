/**
 * Message contract between the extension host and the 3D viewer webview.
 * Pure types (no imports) so both the Node host build and the DOM webview build
 * can share it.
 */

/** Host -> webview: render this self-contained sub-model. */
export type PickMode = "product" | "geometry";

/** Both identities carried by a rendered geometry part. */
export interface PickTarget {
  /** The IFC product that owns the rendered geometry. */
  productId: number;
  /** The representation item web-ifc tessellated for this mesh. */
  geometryId: number;
}

export interface LoadMessage {
  type: "load";
  /** Correlates the async render result with this request. */
  token: number;
  /** The self-contained sub-model as raw STEP bytes. An ArrayBuffer so it survives
   *  `webview.postMessage` structured cloning as binary (a Buffer/Uint8Array does
   *  not — it arrives as a plain object without `.subarray`). */
  ifcBytes: ArrayBuffer;
  rootId: number;
  /** IFC express ids that should be rendered as geometry, preserving source ids. */
  renderIds: number[];
  /** Whether picks resolve to whole products or individual representation items. */
  pickMode: PickMode;
  rootType?: string;
  rootName?: string;
  schema?: string;
  fileName: string;
  /** Workspace-relative source path formatted for display in the viewer HUD. */
  displayPath: string;
  includedCount: number;
  childCount: number;
  hostedCount: number;
  truncated: boolean;
}

export type HostToWebview = LoadMessage;

/** webview -> host: the page is ready to receive a load. */
export interface ReadyMessage {
  type: "ready";
}

/** webview -> host: the user clicked geometry; jump to its source line. */
export interface PickMessage {
  type: "pick";
  target: PickTarget;
}

/** webview -> host: the user double-clicked geometry; preview that element. */
export interface FocusMessage {
  type: "focus";
  target: PickTarget;
}

/** webview -> host: progress/outcome of a render. */
export interface StatusMessage {
  type: "status";
  token: number;
  state: "loading" | "rendered" | "empty" | "error";
  message?: string;
  meshes?: number;
  triangles?: number;
  elapsedMs?: number;
}

/** webview -> host: diagnostic logging routed to the output channel. */
export interface LogMessage {
  type: "log";
  level: "info" | "warn" | "error";
  message: string;
}

export type WebviewToHost = ReadyMessage | PickMessage | FocusMessage | StatusMessage | LogMessage;
