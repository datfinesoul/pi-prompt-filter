import { existsSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILE_NAME = "prompt-filter.json";

/**
 * @typedef {{
 *   agentDir: string,
 *   cwd: string,
 *   projectTrusted: boolean,
 *   exists?: (path: string) => boolean,
 * }} ResolveOptions
 * @typedef {{
 *   global: string | undefined,
 *   project: string | undefined,
 * }} ConfigPaths
 */

/**
 * Resolve the existing override configuration files, lowest precedence first.
 *
 * - Global: `<agentDir>/prompt-filter.json`.
 * - Project: `<cwd>/.pi/prompt-filter.json`, used only for trusted projects.
 *
 * @param {ResolveOptions} options
 * @returns {ConfigPaths}
 */
export function resolveConfigPaths({ agentDir, cwd, projectTrusted, exists = existsSync }) {
  const existing = (/** @type {string} */ path) => (exists(path) ? path : undefined);

  const global = existing(join(agentDir, CONFIG_FILE_NAME));
  const project = projectTrusted ? existing(join(cwd, ".pi", CONFIG_FILE_NAME)) : undefined;

  return { global, project };
}
