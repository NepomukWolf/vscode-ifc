import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as vscode from "vscode";
import AdmZip from "adm-zip";
import * as tar from "tar";
import { getTargetPlatform } from "./platform";

export interface DownloadOptions {
  context: vscode.ExtensionContext;
  repository: string;
  version: string;
  assetPattern: string;
  output: vscode.LogOutputChannel;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

export async function downloadIfcLanguageServer(options: DownloadOptions): Promise<string> {
  const target = getTargetPlatform();
  const normalizedVersion = normalizeVersionTag(options.version);
  options.output.info(
    `Fetching GitHub release metadata for ${options.repository}@${normalizedVersion} (${target.platform}-${target.arch}).`,
  );
  const release = await fetchReleaseByTag(options.repository, normalizedVersion);
  const asset = pickAsset(release.assets, target, options.assetPattern);

  if (!asset) {
    throw new Error(
      `No release asset matched ${target.platform}/${target.arch} in ${options.repository}@${normalizedVersion}.`,
    );
  }

  options.output.info(
    `Downloading IFC language server asset ${asset.name} from release ${release.tag_name}.`,
  );

  const installDir = path.join(
    options.context.globalStorageUri.fsPath,
    "language-server",
    `${target.platform}-${target.arch}`,
    normalizedVersion,
  );

  await fs.mkdir(installDir, { recursive: true });

  const downloadedFile = path.join(installDir, asset.name);
  await downloadToFile(asset.browser_download_url, downloadedFile);
  options.output.info(`Downloaded asset to ${downloadedFile}.`);

  const binaryPath = await installAsset(downloadedFile, installDir, target.binaryNames);
  if (process.platform !== "win32") {
    await fs.chmod(binaryPath, 0o755);
  }
  options.output.info(`Installed IFC language server binary to ${binaryPath}.`);

  const metadataPath = path.join(installDir, "release.json");
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        repository: options.repository,
        tag: release.tag_name,
        asset: asset.name,
        installedBinary: path.basename(binaryPath),
      },
      null,
      2,
    ),
    "utf8",
  );

  return binaryPath;
}

export async function cleanupOldLanguageServers(
  context: vscode.ExtensionContext,
  output: vscode.LogOutputChannel,
  keepVersion: string,
): Promise<void> {
  const target = getTargetPlatform();
  const platformRoot = path.join(
    context.globalStorageUri.fsPath,
    "language-server",
    `${target.platform}-${target.arch}`,
  );

  try {
    const entries = await fs.readdir(platformRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === keepVersion) {
        continue;
      }

      const fullPath = path.join(platformRoot, entry.name);
      output.info(`Removing stale cached IFC language server: ${fullPath}`);
      await fs.rm(fullPath, { recursive: true, force: true });
    }
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function fetchReleaseByTag(repository: string, version: string): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(version)}`;
  return requestJson<GitHubRelease>(url);
}

function pickAsset(
  assets: GitHubAsset[],
  target: ReturnType<typeof getTargetPlatform>,
  assetPattern: string,
): GitHubAsset | undefined {
  const filteredAssets = assetPattern
    ? assets.filter((asset) => asset.name.toLowerCase().includes(assetPattern.toLowerCase()))
    : assets;

  if (filteredAssets.length === 0) {
    return undefined;
  }

  const scored = filteredAssets
    .map((asset) => ({
      asset,
      score: scoreAsset(asset.name.toLowerCase(), target),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.asset;
}

function scoreAsset(name: string, target: ReturnType<typeof getTargetPlatform>): number {
  const hasPlatform = target.platformTokens.some((token) => name.includes(token));
  const hasArch = target.archTokens.some((token) => name.includes(token));

  if (!hasPlatform || !hasArch) {
    return 0;
  }

  const platformScore = 10;
  const archScore = 10;
  const binaryHintScore = target.binaryNames.some((binary) =>
    name.includes(binary.replace(".exe", "")),
  )
    ? 4
    : 0;
  const archiveScore =
    name.endsWith(".zip") || name.endsWith(".tar.gz") || name.endsWith(".tgz") ? 2 : 1;

  return platformScore + archScore + binaryHintScore + archiveScore;
}

function normalizeVersionTag(version: string): string {
  const trimmed = version.trim();
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

async function installAsset(
  downloadedFile: string,
  installDir: string,
  binaryNames: string[],
): Promise<string> {
  const lowerName = downloadedFile.toLowerCase();

  if (binaryNames.some((binaryName) => lowerName.endsWith(binaryName.toLowerCase()))) {
    return downloadedFile;
  }

  if (lowerName.endsWith(".zip")) {
    const zip = new AdmZip(downloadedFile);
    zip.extractAllTo(installDir, true);
    return findInstalledBinary(installDir, binaryNames);
  }

  if (lowerName.endsWith(".tar.gz") || lowerName.endsWith(".tgz")) {
    await tar.extract({
      file: downloadedFile,
      cwd: installDir,
    });
    return findInstalledBinary(installDir, binaryNames);
  }

  throw new Error(`Unsupported release asset format: ${path.basename(downloadedFile)}`);
}

async function findInstalledBinary(installDir: string, binaryNames: string[]): Promise<string> {
  const queue = [installDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (binaryNames.includes(entry.name)) {
        return fullPath;
      }
    }
  }

  throw new Error(`Downloaded archive did not contain ${binaryNames.join(" or ")}.`);
}

async function downloadToFile(url: string, destination: string): Promise<void> {
  const response = await requestBuffer(url);
  const tempFile = path.join(os.tmpdir(), `${path.basename(destination)}.${Date.now()}`);

  await fs.writeFile(tempFile, response);
  await fs.copyFile(tempFile, destination);
  await fs.rm(tempFile, { force: true });
}

async function requestJson<T>(url: string): Promise<T> {
  const body = await requestBuffer(url);
  return JSON.parse(body.toString("utf8")) as T;
}

function requestBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = require("node:https").get(
      url,
      {
        headers: {
          "User-Agent": "vscode-ifc",
          Accept: "application/vnd.github+json",
        },
      },
      (response: import("node:http").IncomingMessage) => {
        const statusCode = response.statusCode ?? 0;

        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          const location = response.headers.location;
          response.resume();
          if (!location) {
            reject(new Error(`Redirect without location for ${url}`));
            return;
          }

          resolve(requestBuffer(location));
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => {
            reject(
              new Error(
                `Request failed with status ${statusCode}: ${Buffer.concat(chunks).toString("utf8")}`,
              ),
            );
          });
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );

    request.on("error", reject);
  });
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null;
}
