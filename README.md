# pi-prompt-filter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A standalone [Pi](https://github.com/earendil-works/pi) extension that prevents configured interactive prompts from being sent to the model when they match a regular expression. It is useful for catching commands such as `ls` or `pwd` that were typed into Pi without the shell-command prefix.

## Installation

### Global installation

Install from GitHub for use in every project. Pi records the package in `~/.pi/agent/settings.json`:

```sh
pi install git:github.com/datfinesoul/pi-prompt-filter
```

### Project installation

From the target project directory, add `--local` (or `-l`) to record the package in `.pi/settings.json` for that project only:

```sh
pi install --local git:github.com/datfinesoul/pi-prompt-filter
```

Project packages load only after Pi grants project trust. Run `/reload` in an existing Pi session or start a new session after either type of installation.

Where the extension is installed and where rules come from are independent. A global installation still reads a trusted project's rules, and a project installation still reads your global rules. See [Configuration layers](#configuration-layers).

> [!NOTE]
> Pi identifies a package by where it was installed from. Installing pi-prompt-filter globally and for a project from the same source is fine: the project installation replaces the global one. Installing it from different locations, such as GitHub globally and a local checkout for a project, loads both copies, and Pi does not reconcile them.

<details>
<summary>Install from a local checkout</summary>

Install a local checkout globally:

```sh
pi install /path/to/pi-prompt-filter
```

Or for the current project only:

```sh
pi install --local /path/to/pi-prompt-filter
```

To try the extension from a checkout without adding it to Pi's settings:

```sh
pi --no-extensions --extension ./extensions/prompt-filter/index.ts
```

> [!NOTE]
> If this package replaces a manually installed `~/.pi/agent/extensions/prompt-filter` directory, remove or relocate the old copy after installing the package so Pi does not load both copies.

</details>

## Usage

- Type a prompt as usual. If it matches an enabled rule, Pi shows a warning and does not send it to the model.
- Only `interactive` input is examined. Extension-injected messages, non-interactive prompts, and tool calls are never filtered.
- Patterns are tested against the complete input exactly as entered; input is not trimmed or normalized.

## Configuration layers

Rules are merged from three files, from lowest to highest precedence:

| Layer | File | Notes |
|---|---|---|
| Bundled | [`extensions/prompt-filter/config.json`](extensions/prompt-filter/config.json) | Defaults shipped with the package |
| Global | `~/.pi/agent/prompt-filter.json` | Personal rules for every project; follows `PI_CODING_AGENT_DIR` |
| Project | `<project>/.pi/prompt-filter.json` | Loaded from the working directory only after Pi grants project trust |

Rules are identified by `id`. A rule whose ID already exists in a lower layer overrides that rule field by field:

- Fields it declares replace the inherited values; omitted fields are inherited.
- `"enabled": false` disables the rule. A higher layer can restore it by declaring the ID again with a `pattern`.

A rule with a new ID adds a rule.

The bundled defaults are:

```json
{
  "rules": [
    { "id": "ls", "pattern": "^ls$" },
    { "id": "pwd", "pattern": "^pwd$" },
    { "id": "git-simple", "pattern": "^git\\s+\\S+$" }
  ]
}
```

### Add a rule

Create `~/.pi/agent/prompt-filter.json`, or `.pi/prompt-filter.json` to share it with a project:

```json
{
  "rules": [
    {
      "id": "vim",
      "pattern": "^vim(?:\\s|$)",
      "flags": "i"
    }
  ]
}
```

### Change a bundled rule

Override only the fields you want to change. This example narrows the bundled `git-simple` rule and makes it case-insensitive:

```json
{
  "rules": [
    {
      "id": "git-simple",
      "pattern": "^git\\s+(?:status|diff)$",
      "flags": "i"
    }
  ]
}
```

### Disable a rule

Disable the bundled `git-simple` rule for one project with `.pi/prompt-filter.json`:

```json
{
  "rules": [
    {
      "id": "git-simple",
      "enabled": false
    }
  ]
}
```

Disabling an ID that does not exist has no effect. The remaining rules continue to apply.

### Rule fields

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Starts with a letter or digit and contains only letters, digits, dots, underscores, or hyphens; must be unique within a file |
| `pattern` | For new rules | JavaScript regular-expression source string; optional when overriding an existing rule |
| `flags` | No | JavaScript regular-expression flags such as `i`, `m`, or `u`; inherited when omitted, and `""` clears inherited flags |
| `enabled` | No | Set to `false` to disable the rule; defaults to `true` |

Configuration is read at session start; run `/reload` after changing it. Invalid JSON, unknown top-level keys, invalid rules, or invalid regular expressions in the global or project file are reported as an error, and only the bundled rules apply until the problem is fixed.

## How it works

When an interactive prompt matches any configured expression, the extension marks the input as handled and displays a warning. Pi therefore does not send that input to the model. This convenience filter is not a security boundary: anyone who can edit its configuration or extension files can change its behavior. See [SECURITY.md](SECURITY.md).

## Development

The package requires no runtime dependencies beyond the Pi host. Run the test suite and inspect the publishable package with:

```sh
npm test
npm run pack:check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](LICENSE) © Philip Hadviger
