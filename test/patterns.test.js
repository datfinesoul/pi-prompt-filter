import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPatterns, matchesAnyPattern, parseConfig } from "../src/patterns.js";

test("parseConfig validates the top-level patterns array", () => {
  assert.throws(() => parseConfig("{}", "test.json"), /patterns.*must be an array/);
});

test("parseConfig validates pattern fields", () => {
  assert.throws(
    () => parseConfig('{"patterns":[{"pattern":42}]}', "test.json"),
    /pattern 0.*pattern.*must be a string/,
  );
  assert.throws(
    () => parseConfig('{"patterns":[{"pattern":"x","flags":42}]}', "test.json"),
    /pattern 0.*flags.*must be a string/,
  );
});

test("loadPatterns appends user patterns to defaults", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-prompt-filter-"));
  const defaults = join(directory, "defaults.json");
  const user = join(directory, "user.json");

  writeFileSync(defaults, '{"patterns":[{"pattern":"^ls$"}]}');
  writeFileSync(user, '{"patterns":[{"pattern":"^vim(?:\\\\s|$)","flags":"i"}]}');

  const patterns = loadPatterns(defaults, user);
  assert.equal(matchesAnyPattern("ls", patterns), true);
  assert.equal(matchesAnyPattern("VIM file.txt", patterns), true);
  assert.equal(matchesAnyPattern("explain ls", patterns), false);
});

test("matchesAnyPattern resets global regular expressions", () => {
  const patterns = [/^pwd$/g];
  assert.equal(matchesAnyPattern("pwd", patterns), true);
  assert.equal(matchesAnyPattern("pwd", patterns), true);
});

test("loadPatterns reports invalid regular expressions", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-prompt-filter-"));
  const config = join(directory, "config.json");
  writeFileSync(config, '{"patterns":[{"pattern":"["}]}');

  assert.throws(() => loadPatterns(config), /invalid regular expression/);
});
