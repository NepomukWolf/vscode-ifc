export interface TargetPlatform {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  binaryNames: string[];
  platformTokens: string[];
  archTokens: string[];
}

export function getTargetPlatform(): TargetPlatform {
  const platform = process.platform;
  const arch = process.arch;

  return {
    platform,
    arch,
    binaryNames:
      platform === "win32"
        ? ["ifc-language-server.exe", "ifc-lsp.exe"]
        : ["ifc-language-server", "ifc-lsp"],
    platformTokens: getPlatformTokens(platform),
    archTokens: getArchTokens(arch),
  };
}

function getPlatformTokens(platform: NodeJS.Platform): string[] {
  switch (platform) {
    case "darwin":
      return ["darwin", "macos", "mac", "apple"];
    case "win32":
      return ["windows", "win32", "win"];
    default:
      return ["linux"];
  }
}

function getArchTokens(arch: NodeJS.Architecture): string[] {
  switch (arch) {
    case "arm64":
      return ["arm64", "aarch64"];
    case "x64":
      return ["x64", "x86_64", "amd64"];
    default:
      return [arch];
  }
}
