# pi-prompt-filter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A standalone [Pi](https://github.com/earendil-works/pi) extension that prevents configured interactive prompts from being sent to the model when they match a regular expression. It is useful for catching commands such as `ls` or `pwd` that were typed into Pi without the shell-command prefix.

The extension only examines input whose source is `interactive`. It does not alter extension-injected messages, non-interactive prompts, or tool calls.

## Installation

### Global installation

Install from GitHub for use in every project. Pi records the package in `~/.pi/agent/settings.json`:

```sh
pi install git:github.com/datfinesoul/pi-prompt-filter
```

Alternatively, install a local checkout:

```sh
pi install /path/to/pi-prompt-filter
```

### Project installation

From the target project directory, add `--local` (or `-l`) to record the package in `.pi/settings.json` for that project only:

```sh
pi install --local git:github.com/datfinesoul/pi-prompt-filter
```

A local checkout can also be installed at project scope:

```sh
pi install --local /path/to/pi-prompt-filter
```

Project packages load only after Pi grants project trust. Run `/reload` in an existing Pi session or start a new session after either type of installation.

To try the extension without adding it to Pi's settings:

```sh
pi --no-extensions --extension ./extensions/prompt-filter/index.ts
```

> [!NOTE]
> If this package replaces a manually installed `~/.pi/agent/extensions/prompt-filter` directory, remove or relocate the old copy after installing the package so Pi does not load both copies.

## Configuration

The bundled defaults are stored as named rules in [`extensions/prompt-filter/config.json`](extensions/prompt-filter/config.json):

```json
{
  "rules": [
    { "id": "ls", "pattern": "^ls$" },
    { "id": "pwd", "pattern": "^pwd$" },
    { "id": "git-simple", "pattern": "^git\\s+\\S+$" }
  ]
}
```

Add personal configuration in `$XDG_CONFIG_HOME/pi/prompt-filter.json`, or `~/.config/pi/prompt-filter.json` when `XDG_CONFIG_HOME` is unset. User rules are merged with bundled rules by `id`: an existing ID overrides that default in place, a new ID appends a rule, and `"enabled": false` disables the named rule.

### Disable a default rule

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

Disabling an ID that does not exist has no effect. The remaining defaults continue to apply.

### Override a default and add a rule

```json
{
  "rules": [
    {
      "id": "git-simple",
      "pattern": "^git\\s+(?:status|diff)$",
      "flags": "i"
    },
    {
      "id": "vim",
      "pattern": "^vim(?:\\s|$)",
      "flags": "i"
    }
  ]
}
```

Named rule fields are:

- `id` (required): A unique identifier beginning with an alphanumeric character and containing only letters, numbers, dots, underscores, or hyphens.
- `pattern`: A JavaScript regular-expression source string. It is required for a new enabled rule and optional when overriding an existing rule.
- `flags`: JavaScript regular-expression flags such as `i`, `m`, or `u`. An override inherits the default flags when this field is omitted; set it to `""` to clear inherited flags.
- `enabled`: Set to `false` to disable the rule. It defaults to `true`.

### Legacy configuration

The original `patterns` format remains supported so existing personal configuration continues to work:

```json
{
  "patterns": [
    {
      "pattern": "^vim(?:\\s|$)",
      "flags": "i"
    }
  ]
}
```

Legacy patterns are appended after named rules and cannot disable or override a default. Use named `rules` for new configuration.

Patterns are tested against the complete input exactly as entered; input is not trimmed or normalized. Run `/reload` after changing configuration. Invalid JSON, invalid rules, or invalid regular expressions prevent the extension from loading and are reported by Pi.

## How it works

When an interactive prompt matches any configured expression, the extension marks the input as handled and displays a warning. Pi therefore does not send that input to the model. This convenience filter is not a security boundary: anyone who can edit its configuration or extension files can change its behavior.

## Development

The package requires no runtime dependencies beyond the Pi host. Run the test suite and inspect the publishable package with:

```sh
npm test
npm run pack:check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](LICENSE) © Philip Hadviger
