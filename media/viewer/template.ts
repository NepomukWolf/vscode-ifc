import { html, type TemplateResult } from "lit-html";

export type ViewerTemplateState = {
  hudPath: string;
  hudTitle: string;
  hudSub: string;
  hudInfo: string;
  hudWarn: string;
  overlayText: string;
  overlayBusy: boolean;
  hudInfoTitle: string;
  hudSelection: string;
};

export type ViewerTemplateActions = {
  onPointerDown(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void | Promise<void>;
  onDoubleClick(event: MouseEvent): void | Promise<void>;
  onFit(): void;
  onReset(): void;
};

export function viewerTemplate(state: ViewerTemplateState, actions: ViewerTemplateActions): TemplateResult {
  return html`
    <div
      class="viewer-canvas"
      @pointerdown=${actions.onPointerDown}
      @pointerup=${actions.onPointerUp}
      @dblclick=${actions.onDoubleClick}
    ></div>
    <div class="hud">
      <div class="hud-path">${state.hudPath}</div>
      <div class="hud-title">${state.hudTitle}</div>
      <div class="hud-sub">${state.hudSub}</div>
      <div class="hud-selection">${state.hudSelection}</div>
      <div
        class="hud-info"
        title=${state.hudInfoTitle}
      >
        ${state.hudInfo}
      </div>
      <div class="hud-warn">${state.hudWarn}</div>
    </div>
    <div class="toolbar">
      <button class="tool-button" title="Frame the element" @click=${actions.onFit}>Fit</button>
      <button class="tool-button" title="Reset the camera" @click=${actions.onReset}>Reset</button>
    </div>
    <div
      class=${state.overlayBusy ? "state-overlay busy" : "state-overlay"}
      style=${state.overlayText || state.overlayBusy ? "display: flex" : "display: none"}
    >
      ${state.overlayText}
    </div>
    <div class="hint">Click to jump to source · double-click to preview · drag to orbit · scroll to zoom</div>
  `;
}
