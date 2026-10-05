import { readFileSync } from "node:fs";

/**
 * @typedef {{ id: string, pattern?: string, flags?: string, enabled?: boolean }} RuleConfig
 * @typedef {{ pattern: string, flags?: string }} LegacyPatternConfig
 * @typedef {{ rules: RuleConfig[], patterns: LegacyPatternConfig[] }} ParsedConfig
 */

const RULE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Parse and validate a prompt-filter configuration document.
 *
 * The legacy `patterns` array remains supported for compatibility. Legacy
 * patterns are always appended and cannot override named rules.
 *
 * @param {string} contents
 * @param {string} source
 * @returns {ParsedConfig}
 */
export function parseConfig(contents, source) {
  let config;

  try {
    config = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${source}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${source}: configuration must be an object`);
  }

  if (config.rules === undefined && config.patterns === undefined) {
    throw new Error(`${source}: configuration must define a "rules" array`);
  }

  if (config.rules !== undefined && !Array.isArray(config.rules)) {
    throw new Error(`${source}: "rules" must be an array`);
  }

  if (config.patterns !== undefined && !Array.isArray(config.patterns)) {
    throw new Error(`${source}: "patterns" must be an array`);
  }

  const seenIds = new Set();
  const rules = (config.rules ?? []).map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${source}: rule ${index} must be an object`);
    }

    if (typeof entry.id !== "string" || !RULE_ID_PATTERN.test(entry.id)) {
      throw new Error(`${source}: rule ${index}: "id" must start with an alphanumeric character and contain only letters, numbers, dots, underscores, or hyphens`);
    }

    if (seenIds.has(entry.id)) {
      throw new Error(`${source}: duplicate rule id "${entry.id}"`);
    }
    seenIds.add(entry.id);

    if (entry.pattern !== undefined && typeof entry.pattern !== "string") {
      throw new Error(`${source}: rule "${entry.id}": "pattern" must be a string when provided`);
    }

    if (entry.flags !== undefined && typeof entry.flags !== "string") {
      throw new Error(`${source}: rule "${entry.id}": "flags" must be a string when provided`);
    }

    if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
      throw new Error(`${source}: rule "${entry.id}": "enabled" must be a boolean when provided`);
    }

    return {
      id: entry.id,
      ...(entry.pattern === undefined ? {} : { pattern: entry.pattern }),
      ...(entry.flags === undefined ? {} : { flags: entry.flags }),
      ...(entry.enabled === undefined ? {} : { enabled: entry.enabled }),
    };
  });

  const patterns = (config.patterns ?? []).map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry) || typeof entry.pattern !== "string") {
      throw new Error(`${source}: legacy pattern ${index}: "pattern" must be a string`);
    }

    if (entry.flags !== undefined && typeof entry.flags !== "string") {
      throw new Error(`${source}: legacy pattern ${index}: "flags" must be a string when provided`);
    }

    return { pattern: entry.pattern, ...(entry.flags === undefined ? {} : { flags: entry.flags }) };
  });

  return { rules, patterns };
}

/**
 * Read and validate one configuration file.
 *
 * @param {string} configPath
 * @returns {ParsedConfig}
 */
export function readConfig(configPath) {
  return parseConfig(readFileSync(configPath, "utf8"), configPath);
}

/**
 * Apply named rules from one configuration in declaration order.
 * Existing rules are merged in place, new rules are appended, and disabled
 * rules are removed.
 *
 * @param {Map<string, RuleConfig>} effectiveRules
 * @param {RuleConfig[]} configuredRules
 * @param {string} source
 */
function applyRules(effectiveRules, configuredRules, source) {
  for (const rule of configuredRules) {
    if (rule.enabled === false) {
      effectiveRules.delete(rule.id);
      continue;
    }

    const existing = effectiveRules.get(rule.id);
    const merged = { ...existing, ...rule };
    delete merged.enabled;

    if (merged.pattern === undefined) {
      throw new Error(`${source}: rule "${rule.id}" must define "pattern" because it does not override an existing rule`);
    }

    effectiveRules.set(rule.id, merged);
  }
}

/**
 * Compile default rules, user overrides, and backward-compatible legacy
 * patterns.
 *
 * @param {string} defaultConfigPath
 * @param {string | undefined} userConfigPath
 * @returns {RegExp[]}
 */
export function loadPatterns(defaultConfigPath, userConfigPath) {
  const defaultConfig = readConfig(defaultConfigPath);
  const userConfig = userConfigPath === undefined ? { rules: [], patterns: [] } : readConfig(userConfigPath);
  const effectiveRules = new Map();

  applyRules(effectiveRules, defaultConfig.rules, defaultConfigPath);
  applyRules(effectiveRules, userConfig.rules, userConfigPath ?? "user configuration");

  const configuredPatterns = [
    ...effectiveRules.values(),
    ...defaultConfig.patterns,
    ...userConfig.patterns,
  ];

  return configuredPatterns.map((entry, index) => {
    try {
      return new RegExp(entry.pattern, entry.flags ?? "");
    } catch (error) {
      const label = "id" in entry ? `rule "${entry.id}"` : `legacy pattern ${index}`;
      throw new Error(`prompt-filter ${label}: invalid regular expression: ${error instanceof Error ? error.message : String(error)}`);
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
