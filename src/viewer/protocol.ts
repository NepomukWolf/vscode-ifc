/**
 * Message contract between the extension host and the 3D viewer webview.
 * Pure types (no imports) so both the Node host build and the DOM webview build
 * can share it.
 */

/** Preview granularity retained for compatibility with legacy pick resolution. */
export type PickMode = "product" | "geometry";

/** Source identities exposed by a rendered pick. */
export interface PickTarget {
  /** The IFC product that owns the rendered geometry. */
  productId: number;
  /** The originating representation item, when a renderer exposes it. */
  geometryItemId?: number;
}

export interface LoadMessage {
  type: "load";
  /** Correlates the async render result with this request. */
  token: number;
  /** Full IFC bytes. An ArrayBuffer survives webview structured cloning as binary. */
  /** Stable source + revision identity of the full model retained by the panel. */
  modelKey: string;
  /** Present only when the panel must load or replace its resident model. */
  ifcBytes?: ArrayBuffer;
  rootId: number;
  /** IFC product ids to show through ifc-lite's isolation filter. */
  renderIds: number[];
  /** Whether picks resolve to whole products or individual representation items. */
  pickMode: PickMode;
  rootType?: string;
  rootName?: string;
  fileName: string;
  /** Workspace-relative source path formatted for display in the viewer HUD. */
  displayPath: string;
  childCount: number;
  hostedCount: number;
}

export interface NavigationStateMessage {
  type: "navigationState";
  canGoBack: boolean;
  canGoForward: boolean;
}

export type HostToWebview = LoadMessage | NavigationStateMessage;

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

export interface HistoryBackMessage {
  type: "historyBack";
}

export interface HistoryForwardMessage {
  type: "historyForward";
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

export type WebviewToHost =
  | ReadyMessage
  | PickMessage
  | FocusMessage
  | HistoryBackMessage
  | HistoryForwardMessage
  | StatusMessage
  | LogMessage;
