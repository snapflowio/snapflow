import * as _path from "path";

/**
 * Prefixes a relative path with the given prefix, handling special cases for '~' and '~/'
 * Returns absolute paths unchanged.
 */
export function prefixRelativePath(prefix: string, path?: string): string {
  if (!path) return prefix;

  const trimmed = path.trim();
  if (trimmed === "~") return prefix;
  if (trimmed.startsWith("~/")) return _path.join(prefix, trimmed.slice(2));
  if (_path.isAbsolute(trimmed)) return trimmed;
  return _path.join(prefix, trimmed);
}
