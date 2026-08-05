import * as vscode from "vscode";
import { IfcLanguageClientManager } from "./client";
import { registerVisibleIdHighlight } from "./idHighlight";
import { createOutputChannel } from "./logging";
import { isConfiguredServerPathError, resolveServer } from "./serverPath";
import { registerViewer } from "./viewer";

const DOWNLOAD_LANGUAGE_SERVER = "Download Language Server";
const OPEN_SETTINGS = "Open Settings";

/** Configuration sections that require a language-server restart when changed. */
const SERVER_CONFIG_SECTIONS = [
  "ifc.server",
  "ifc.schema",
  "ifc.analysis",
  "ifc.semanticTokens",
  "ifc.trace",
];

let manager: IfcLanguageClientManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = createOutputChannel();
  const nextManager = new IfcLanguageClientManager(context, output);
  manager = nextManager;

  context.subscriptions.push(output);
  registerVisibleIdHighlight(context);

  registerViewer(context, output);

  context.subscriptions.push(
    vscode.commands.registerCommand("ifc.downloadLanguageServer", async () => {
      try {
        await nextManager.stop();
        await nextManager.start({ forceDownload: true });
        void vscode.window.showInformationMessage("IFC language server downloaded and started.");
      } catch (error) {
        await handleError("Failed to download IFC language server.", error, output);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ifc.restartLanguageServer", async () => {
      try {
        await nextManager.restart();
        void vscode.window.showInformationMessage("IFC language server restarted.");
      } catch (error) {
        await handleError("Failed to restart IFC language server.", error, output);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ifc.showResolvedServer", async () => {
      try {
        const resolved = await resolveServer(context, output);
        const message =
          `IFC language server: ${resolved.command} (${resolved.source}` +
          (resolved.version ? `, ${resolved.version}` : "") +
          `)` +
          (resolved.args.length > 0 ? ` args=${JSON.stringify(resolved.args)}` : "");
        output.info(message);
        void vscode.window.showInformationMessage(message);
      } catch (error) {
        await handleError("Failed to resolve IFC language server.", error, output);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      const affectsServer = SERVER_CONFIG_SECTIONS.some((section) =>
        event.affectsConfiguration(section),
      );
      if (!affectsServer) {
        return;
      }

      output.info("IFC configuration changed. Restarting language server.");
      try {
        await nextManager.restart();
      } catch (error) {
        await handleError(
          "Failed to restart IFC language server after configuration change.",
          error,
          output,
        );
      }
    }),
  );

  try {
    await nextManager.start();
  } catch (error) {
    if (isConfiguredServerPathError(error)) {
      await handleError("Failed to start IFC language server.", error, output);
      return;
    }

    output.error(`Initial IFC language server startup failed: ${asMessage(error)}`);
    const action = await vscode.window.showWarningMessage(
      asMessage(error),
      DOWNLOAD_LANGUAGE_SERVER,
    );

    if (action === DOWNLOAD_LANGUAGE_SERVER) {
      try {
        await nextManager.start({ forceDownload: true });
      } catch (downloadError) {
        await handleError("Failed to start IFC language server.", downloadError, output);
      }
      return;
    }

    await handleError("Failed to start IFC language server.", error, output);
  }
}

export async function deactivate(): Promise<void> {
  await manager?.stop();
  manager = undefined;
}

async function handleError(
  prefix: string,
  error: unknown,
  output: vscode.LogOutputChannel,
): Promise<void> {
  const message = `${prefix} ${asMessage(error)}`;
  output.error(message);

  if (isConfiguredServerPathError(error)) {
    const action = await vscode.window.showWarningMessage(message, OPEN_SETTINGS);
    if (action === OPEN_SETTINGS) {
      await vscode.commands.executeCommand("workbench.action.openSettings", "ifc.server.path");
    }
    return;
  }

  void vscode.window.showErrorMessage(message);
}

function asMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
