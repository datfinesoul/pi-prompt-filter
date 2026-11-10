import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPatterns, matchesAnyPattern, parseConfig } from "../src/patterns.ts";

const bundledConfigPath = new URL("../extensions/prompt-filter/config.json", import.meta.url);

test("bundled rules block agreed accidental commands", () => {
  const patterns = loadPatterns(bundledConfigPath);
  for (const text of [
    "ls", "pwd", "git status", "exit", "quit", "/exit",
    "cd", "cd ..", "cd relative/path", "cd a path with spaces", 'cd "a path"',
    " cd .. ", "\tcd\t..\t", "cd ", "cd explain this",
    ":q", ":wq", ":q!", ":wq!", ":qa", ":qa!", ":wqa", ":wqa!", ":x", ":x!",
  ]) {
    assert.equal(matchesAnyPattern(text, patterns), true, JSON.stringify(text));
  }
});

test("new bundled rules preserve ordinary prompts and command boundaries", () => {
  const patterns = loadPatterns(bundledConfigPath);
  for (const text of [
    "/quit", "/reload", "/help", "/exit now", "/exit!", "/cd", "/q",
    "EXIT", "QUIT", "CD", ":Q", " exit", "exit ", "quit\t", " :q", ":q ",
    "exit now", "quit please", "exiting", "cdrom", "cd..", ":q!!", ":write",
    "Explain cd ..", "How do I exit?",
  ]) {
    assert.equal(matchesAnyPattern(text, patterns), false, JSON.stringify(text));
  }
  for (const separator of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
    for (const command of ["exit", "quit", "/exit", "cd", "cd ..", ":q", ":wqa!"]) {
      for (const text of [command + separator, command + separator + "hello", separator + command]) {
        assert.equal(matchesAnyPattern(text, patterns), false, JSON.stringify(text));
      }
    }
  }
});

test("personal rules retain precedence over the new bundled defaults", () => {
  const global = temporaryConfig(JSON.stringify({ rules: [
    { id: "exit", pattern: "^(?:/?exit|quit)$" },
    { id: "cd", pattern: "^cd(?:\\s+.+)?$" },
    { id: "vim-quit", pattern: "^:(?:q|wq)$" },
  ] }));
  const patterns = loadPatterns(bundledConfigPath, global);
  assert.equal(matchesAnyPattern(":q!", patterns), false);
  assert.equal(matchesAnyPattern(" cd .. ", patterns), false);
  assert.equal(matchesAnyPattern("cd\nhello", patterns), true);
  assert.equal(matchesAnyPattern("ls", patterns), true);
});

test("projects can disable the new bundled rules by ID", () => {
  const project = temporaryConfig(JSON.stringify({ rules: [
    { id: "exit", enabled: false },
    { id: "cd", enabled: false },
    { id: "vim-quit", enabled: false },
  ] }));
  const patterns = loadPatterns(bundledConfigPath, undefined, project);
  for (const text of ["exit", "quit", "/exit", "cd ..", ":q", ":x!"]) {
    assert.equal(matchesAnyPattern(text, patterns), false, text);
  }
  assert.equal(matchesAnyPattern("pwd", patterns), true);
});

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
