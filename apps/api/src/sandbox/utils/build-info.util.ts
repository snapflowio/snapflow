import { createHash } from "crypto";

export function generateBuildInfoHash(
  dockerfileContent: string,
  contextHashes: string[] = []
): string {
  const sortedContextHashes = [...contextHashes].sort() || [];
  const combined = dockerfileContent + sortedContextHashes.join("");
  const hash = createHash("sha256").update(combined).digest("hex");
  return `snapflow-${hash}:snapflow`;
}
