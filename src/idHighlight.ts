import * as vscode from "vscode";

const IFC_LANGUAGE_ID = "ifc";
const STEP_ID_PATTERN = /#\d+\b/g;

export function registerVisibleIdHighlight(context: vscode.ExtensionContext): void {
  const highlighter = new VisibleIdHighlighter();
  context.subscriptions.push(
    highlighter,
    vscode.window.onDidChangeActiveTextEditor(() => highlighter.update()),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        highlighter.update();
      }
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        highlighter.update();
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        highlighter.update();
      }
    }),
  );

  highlighter.update();
}

class VisibleIdHighlighter implements vscode.Disposable {
  private readonly decoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
    border: "1px solid",
    borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

  private disposed = false;
  private decoratedEditor: vscode.TextEditor | undefined;

  update(): void {
    if (this.disposed) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== IFC_LANGUAGE_ID) {
      this.clear();
      return;
    }

    if (this.decoratedEditor && this.decoratedEditor !== editor) {
      this.clear(this.decoratedEditor);
    }
    this.decoratedEditor = editor;

    const activeId = idAtPosition(editor.document, editor.selection.active);
    if (!activeId) {
      this.clear(editor);
      return;
    }

    editor.setDecorations(
      this.decoration,
      visibleIdRanges(editor.document, editor.visibleRanges, activeId),
    );
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
    this.decoration.dispose();
  }

  private clear(editor = this.decoratedEditor): void {
    editor?.setDecorations(this.decoration, []);
    if (!editor || editor === this.decoratedEditor) {
      this.decoratedEditor = undefined;
    }
  }
}

function idAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | undefined {
  const line = document.lineAt(position.line).text;
  const character = position.character;
  STEP_ID_PATTERN.lastIndex = 0;

  for (const match of line.matchAll(STEP_ID_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (character >= start && character <= end) {
      return match[0];
    }
  }

  return undefined;
}

function visibleIdRanges(
  document: vscode.TextDocument,
  visibleRanges: readonly vscode.Range[],
  id: string,
): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  const seen = new Set<string>();

  for (const visibleRange of visibleRanges) {
    const startLine = Math.max(visibleRange.start.line, 0);
    const endLine = Math.min(visibleRange.end.line, document.lineCount - 1);

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const line = document.lineAt(lineNumber).text;
      STEP_ID_PATTERN.lastIndex = 0;

      for (const match of line.matchAll(STEP_ID_PATTERN)) {
        if (match[0] !== id) {
          continue;
        }

        const startCharacter = match.index ?? 0;
        const endCharacter = startCharacter + id.length;
        const key = `${lineNumber}:${startCharacter}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        ranges.push(new vscode.Range(lineNumber, startCharacter, lineNumber, endCharacter));
      }
    }
  }

  return ranges;
}
