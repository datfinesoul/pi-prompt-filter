import { readFileSync } from "node:fs";

/**
 * @typedef {{ pattern: string, flags?: string }} PatternConfig
 */

/**
 * Parse and validate a prompt-filter configuration document.
 *
 * @param {string} contents
 * @param {string} source
 * @returns {PatternConfig[]}
 */
export function parseConfig(contents, source) {
  let config;

  try {
    config = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${source}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (config === null || typeof config !== "object" || !Array.isArray(config.patterns)) {
    throw new Error(`${source}: "patterns" must be an array`);
  }

  return config.patterns.map((entry, index) => {
    if (entry === null || typeof entry !== "object" || typeof entry.pattern !== "string") {
      throw new Error(`${source}: pattern ${index}: "pattern" must be a string`);
    }

    if (entry.flags !== undefined && typeof entry.flags !== "string") {
      throw new Error(`${source}: pattern ${index}: "flags" must be a string when provided`);
    }

    return { pattern: entry.pattern, ...(entry.flags === undefined ? {} : { flags: entry.flags }) };
  });
}

/**
 * Read and validate one configuration file.
 *
 * @param {string} configPath
 * @returns {PatternConfig[]}
 */
export function readConfig(configPath) {
  return parseConfig(readFileSync(configPath, "utf8"), configPath);
}

/**
 * Compile default patterns and optional user patterns.
 *
 * @param {string} defaultConfigPath
 * @param {string | undefined} userConfigPath
 * @returns {RegExp[]}
 */
export function loadPatterns(defaultConfigPath, userConfigPath) {
  const configuredPatterns = readConfig(defaultConfigPath);

  if (userConfigPath !== undefined) {
    configuredPatterns.push(...readConfig(userConfigPath));
  }

  return configuredPatterns.map((entry, index) => {
    try {
      return new RegExp(entry.pattern, entry.flags ?? "");
    } catch (error) {
      throw new Error(`prompt-filter pattern ${index}: invalid regular expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * Test text against every pattern while safely resetting stateful expressions.
 *
 * @param {string} text
 * @param {RegExp[]} patterns
 * @returns {boolean}
 */
export function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}
