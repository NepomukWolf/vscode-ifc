import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { getIfcConfig } from "./config";
import { cleanupOldLanguageServers, downloadIfcLanguageServer } from "./installer";
import { getTargetPlatform } from "./platform";

export interface ResolvedServer {
  command: string;
  args: string[];
  version: string | null;
  source: "configured" | "downloaded";
}

export class ConfiguredServerPathError extends Error {
  public constructor(
    public readonly configuredPath: string,
    public readonly reason: "missing" | "not-file",
    public readonly cause?: unknown,
  ) {
    super(toConfiguredServerPathMessage(configuredPath, reason));
    this.name = "ConfiguredServerPathError";
  }
}

export function isConfiguredServerPathError(error: unknown): error is ConfiguredServerPathError {
  return error instanceof ConfiguredServerPathError;
}

export async function resolveServer(
  context: vscode.ExtensionContext,
  output: vscode.LogOutputChannel,
  options?: { forceDownload?: boolean },
): Promise<ResolvedServer> {
  const config = getIfcConfig();
  const target = getTargetPlatform();
  const selectedVersion = config.versionOverride || config.pinnedVersion;
  output.info(
    `Resolving IFC language server for ${target.platform}-${target.arch} ` +
      `(targetVersion=${selectedVersion}, pinnedVersion=${config.pinnedVersion}).`,
  );

  if (config.serverPath) {
    output.info(`Checking configured server path: ${config.serverPath}`);
    const configuredPath = await requireExecutable(config.serverPath);
    output.info(`Using configured IFC language server: ${configuredPath}`);
    return {
      command: configuredPath,
      args: config.serverArgs,
      version: null,
      source: "configured",
    };
  }

  if (!options?.forceDownload) {
    output.info(`Checking download cache for IFC language server version ${selectedVersion}.`);
    const cached = await findCachedDownload(context, target.binaryNames, selectedVersion);
    if (cached) {
      output.info(`Using cached IFC language server: ${cached}`);
      return {
        command: cached,
        args: config.serverArgs,
        version: selectedVersion,
        source: "downloaded",
      };
    }
  }

  output.info(
    `Downloading IFC language server version ${selectedVersion} from ${config.githubRepository}.`,
  );
  const downloadedPath = await downloadIfcLanguageServer({
    context,
    repository: config.githubRepository,
    version: selectedVersion,
    assetPattern: config.downloadAssetPattern,
    output,
  });

  await cleanupOldLanguageServers(context, output, selectedVersion);

  output.info(`Using downloaded IFC language server: ${downloadedPath}`);
  return {
    command: downloadedPath,
    args: config.serverArgs,
    version: selectedVersion,
    source: "downloaded",
  };
}

async function requireExecutable(candidatePath: string): Promise<string> {
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(candidatePath);
  } catch (error) {
    throw new ConfiguredServerPathError(candidatePath, "missing", error);
  }

  if (!stat.isFile()) {
    throw new ConfiguredServerPathError(candidatePath, "not-file");
  }

  return candidatePath;
}

function toConfiguredServerPathMessage(
  configuredPath: string,
  reason: ConfiguredServerPathError["reason"],
): string {
  const problem = reason === "not-file" ? "is not a file" : "does not exist";

  return (
    `The configured IFC language server path ${problem}: ${configuredPath}. ` +
    "This path comes from the `ifc.server.path` VS Code setting. " +
    "Clear `ifc.server.path` to use the extension-managed language server."
  );
}

async function findCachedDownload(
  context: vscode.ExtensionContext,
  binaryNames: string[],
  version: string,
): Promise<string | undefined> {
  const targetDir = path.join(
    context.globalStorageUri.fsPath,
    "language-server",
    `${process.platform}-${process.arch}`,
    version,
  );

  for (const binaryName of binaryNames) {
    const candidate = path.join(targetDir, binaryName);
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function exists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
