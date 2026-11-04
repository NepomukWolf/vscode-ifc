import * as vscode from "vscode";
import { Trace } from "vscode-languageclient/node";
import { PINNED_LANGUAGE_SERVER_VERSION } from "./constants";

export interface IfcExtensionConfig {
  serverPath: string;
  serverArgs: string[];
  pinnedVersion: string;
  versionOverride: string;
  githubRepository: string;
  downloadAssetPattern: string;
  overwriteExpSchemaWithLocal: string;
  addLocalSchemaToSelection: string[];
  astFileSizeLimitMb: number | undefined;
  semanticTokensEnabled: boolean;
  trace: Trace;
}

export function getIfcConfig(): IfcExtensionConfig {
  const config = vscode.workspace.getConfiguration("ifc");

  return {
    serverPath: config.get<string>("server.path", "").trim(),
    serverArgs: config.get<string[]>("server.args", []),
    pinnedVersion: PINNED_LANGUAGE_SERVER_VERSION,
    versionOverride: config.get<string>("server.versionOverride", "").trim(),
    githubRepository: config.get<string>(
      "server.githubRepository",
      "NepomukWolf/IFC-Language-Server",
    ),
    downloadAssetPattern: config.get<string>("server.downloadAssetPattern", "").trim(),
    overwriteExpSchemaWithLocal: config
      .get<string>("schema.overwriteExpSchemaWithLocal", "")
      .trim(),
    addLocalSchemaToSelection: config
      .get<string[]>("schema.addLocalSchemaToSelection", [])
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
    astFileSizeLimitMb: config.get<number | null>("analysis.astFileSizeLimitMb") ?? undefined,
    semanticTokensEnabled: config.get<boolean>("semanticTokens.enabled", true),
    trace: toTrace(config.get<string>("trace.server", "off")),
  };
}

function toTrace(value: string): Trace {
  switch (value) {
    case "messages":
      return Trace.Messages;
    case "verbose":
      return Trace.Verbose;
    default:
      return Trace.Off;
  }
}
