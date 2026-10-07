import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPatterns, matchesAnyPattern, parseConfig } from "../src/patterns.js";

function temporaryConfig(contents) {
  const directory = mkdtempSync(join(tmpdir(), "pi-prompt-filter-"));
  const path = join(directory, "config.json");
  writeFileSync(path, contents);
  return path;
}

test("parseConfig validates the top-level rules array", () => {
  assert.throws(() => parseConfig("{}", "test.json"), /must define a "rules" array/);
  assert.throws(() => parseConfig('{"rules":{}}', "test.json"), /must define a "rules" array/);
});

test("parseConfig rejects unknown top-level keys", () => {
  assert.throws(() => parseConfig('{"rules":[],"patterns":[]}', "test.json"), /unknown configuration key\(s\): "patterns"/);
});

test("parseConfig validates named rule fields", () => {
  assert.throws(
    () => parseConfig('{"rules":[{"id":"bad id","pattern":"x"}]}', "test.json"),
    /rule 0.*"id"/,
  );
  assert.throws(
    () => parseConfig('{"rules":[{"id":"x","pattern":42}]}', "test.json"),
    /rule "x".*"pattern" must be a string/,
  );
  assert.throws(
    () => parseConfig('{"rules":[{"id":"x","enabled":"no"}]}', "test.json"),
    /rule "x".*"enabled" must be a boolean/,
  );
});

test("parseConfig rejects duplicate rule IDs", () => {
  assert.throws(
    () => parseConfig('{"rules":[{"id":"x","pattern":"x"},{"id":"x","pattern":"y"}]}', "test.json"),
    /duplicate rule id "x"/,
  );
});

test("user rules can disable, override, and add named rules", () => {
  const defaults = temporaryConfig(
    '{"rules":[{"id":"ls","pattern":"^ls$"},{"id":"git-simple","pattern":"^git\\\\s+\\\\S+$"},{"id":"case","pattern":"^hello$","flags":"i"}]}',
  );
  const user = temporaryConfig(
    '{"rules":[{"id":"ls","enabled":false},{"id":"git-simple","pattern":"^git\\\\s+(?:status|diff)$"},{"id":"case","pattern":"^goodbye$"},{"id":"vim","pattern":"^vim(?:\\\\s|$)","flags":"i"}]}',
  );

  const patterns = loadPatterns(defaults, user);
  assert.equal(matchesAnyPattern("ls", patterns), false);
  assert.equal(matchesAnyPattern("git status", patterns), true);
  assert.equal(matchesAnyPattern("git checkout", patterns), false);
  assert.equal(matchesAnyPattern("GOODBYE", patterns), true, "an omitted flags field preserves the default flags");
  assert.equal(matchesAnyPattern("VIM file.txt", patterns), true);
});

test("an empty flags string clears inherited flags", () => {
  const defaults = temporaryConfig('{"rules":[{"id":"case","pattern":"^hello$","flags":"i"}]}');
  const user = temporaryConfig('{"rules":[{"id":"case","flags":""}]}');
  const patterns = loadPatterns(defaults, user);

  assert.equal(matchesAnyPattern("hello", patterns), true);
  assert.equal(matchesAnyPattern("HELLO", patterns), false);
});

test("new enabled rules must define a pattern", () => {
  const defaults = temporaryConfig('{"rules":[]}');
  const user = temporaryConfig('{"rules":[{"id":"missing"}]}');
  assert.throws(() => loadPatterns(defaults, user), /rule "missing" must define "pattern"/);
});

test("matchesAnyPattern resets global regular expressions", () => {
  const patterns = [/^pwd$/g];
  assert.equal(matchesAnyPattern("pwd", patterns), true);
  assert.equal(matchesAnyPattern("pwd", patterns), true);
});

test("loadPatterns reports the ID of an invalid named rule", () => {
  const config = temporaryConfig('{"rules":[{"id":"broken","pattern":"["}]}');
  assert.throws(() => loadPatterns(config), /rule "broken": invalid regular expression/);
});

test("project rules override global rules, which override bundled rules", () => {
  const defaults = temporaryConfig('{"rules":[{"id":"ls","pattern":"^ls$"},{"id":"pwd","pattern":"^pwd$"}]}');
  const global = temporaryConfig('{"rules":[{"id":"ls","pattern":"^ls -la$"},{"id":"vim","pattern":"^vim$"}]}');
  const project = temporaryConfig('{"rules":[{"id":"pwd","enabled":false},{"id":"ls","pattern":"^ls -l$"}]}');
  const patterns = loadPatterns(defaults, global, project);

  assert.equal(matchesAnyPattern("ls -l", patterns), true, "project override wins");
  assert.equal(matchesAnyPattern("ls -la", patterns), false);
  assert.equal(matchesAnyPattern("pwd", patterns), false, "project can disable a bundled rule");
  assert.equal(matchesAnyPattern("vim", patterns), true, "global additions remain");
});

test("undefined override layers are skipped", () => {
  const defaults = temporaryConfig('{"rules":[{"id":"ls","pattern":"^ls$"}]}');
  const project = temporaryConfig('{"rules":[{"id":"pwd","pattern":"^pwd$"}]}');
  const patterns = loadPatterns(defaults, undefined, project);
  assert.equal(matchesAnyPattern("ls", patterns), true);
  assert.equal(matchesAnyPattern("pwd", patterns), true);
});
