import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { resolveConfigPaths } from "../src/config-paths.js";

const agentDir = "/home/me/.pi/agent";
const cwd = "/work/project";
const globalPath = join(agentDir, "prompt-filter.json");
const projectPath = join(cwd, ".pi", "prompt-filter.json");

const existing = (...paths) => (path) => paths.includes(path);

test("resolves global and trusted project configuration", () => {
  const paths = resolveConfigPaths({ agentDir, cwd, projectTrusted: true, exists: existing(globalPath, projectPath) });
  assert.deepEqual(paths, { global: globalPath, project: projectPath });
});

test("ignores project configuration when the project is not trusted", () => {
  const paths = resolveConfigPaths({ agentDir, cwd, projectTrusted: false, exists: existing(projectPath) });
  assert.equal(paths.project, undefined);
});

test("missing files resolve to undefined", () => {
  assert.deepEqual(resolveConfigPaths({ agentDir, cwd, projectTrusted: true, exists: () => false }), {
    global: undefined,
    project: undefined,
  });
});
