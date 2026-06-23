import * as vscode from "vscode";

/** Maximum lines to scan upward looking for the enclosing instance. */
const MAX_UPWARD_SCAN = 20000;

/**
 * Resolve the STEP express id relevant to the cursor:
 *  1. the `#<digits>` token directly under the cursor (a definition or a
 *     reference), else
 *  2. the id of the instance that encloses the cursor (nearest preceding
 *     `#<id>=` line).
 */
export function resolveExpressIdAtCursor(editor: vscode.TextEditor): number | undefined {
  const { document, selection } = editor;
  const position = selection.active;

  const tokenRange = document.getWordRangeAtPosition(position, /#\d+/);
  if (tokenRange) {
    const value = Number.parseInt(document.getText(tokenRange).slice(1), 10);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  const lowerBound = Math.max(0, position.line - MAX_UPWARD_SCAN);
  for (let line = position.line; line >= lowerBound; line--) {
    const match = /^\s*#(\d+)\s*=/.exec(document.lineAt(line).text);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }
  return undefined;
}
