import { readFileSync } from "node:fs";

/**
 * @typedef {{ id: string, pattern?: string, flags?: string, enabled?: boolean }} RuleConfig
 * @typedef {{ rules: RuleConfig[] }} ParsedConfig
 */

const RULE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Parse and validate a prompt-filter configuration document.
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

  const unknownKeys = Object.keys(config).filter((key) => key !== "rules");
  if (unknownKeys.length > 0) {
    throw new Error(`${source}: unknown configuration key(s): ${unknownKeys.map((key) => `"${key}"`).join(", ")}`);
  }

  if (!Array.isArray(config.rules)) {
    throw new Error(`${source}: configuration must define a "rules" array`);
  }

  const seenIds = new Set();
  const rules = config.rules.map((entry, index) => {
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

  return { rules };
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
 * Compile bundled rules and override layers. Override layers are applied in
 * order, so later paths take precedence. Undefined override paths are skipped.
 *
 * @param {string} defaultConfigPath
 * @param {...(string | undefined)} overrideConfigPaths
 * @returns {RegExp[]}
 */
export function loadPatterns(defaultConfigPath, ...overrideConfigPaths) {
  const configPaths = [defaultConfigPath, ...overrideConfigPaths.filter((path) => path !== undefined)];
  const effectiveRules = new Map();

  for (const configPath of configPaths) {
    applyRules(effectiveRules, readConfig(configPath).rules, configPath);
  }

  return [...effectiveRules.values()].map((rule) => {
    try {
      return new RegExp(rule.pattern, rule.flags ?? "");
    } catch (error) {
      throw new Error(`prompt-filter rule "${rule.id}": invalid regular expression: ${error instanceof Error ? error.message : String(error)}`);
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
