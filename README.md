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

The bundled defaults are stored in [`extensions/prompt-filter/config.json`](extensions/prompt-filter/config.json):

```json
{
  "patterns": [
    { "pattern": "^ls$" },
    { "pattern": "^pwd$" },
    { "pattern": "^git\\s+\\S+$" }
  ]
}
```

Add personal rules in `$XDG_CONFIG_HOME/pi/prompt-filter.json`, or `~/.config/pi/prompt-filter.json` when `XDG_CONFIG_HOME` is unset. Personal rules are appended to the bundled defaults.

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

Each entry supports:

- `pattern` (required): A JavaScript regular-expression source string.
- `flags` (optional): JavaScript regular-expression flags such as `i`, `m`, or `u`.

Patterns are tested against the complete input exactly as entered; input is not trimmed or normalized. Run `/reload` after changing configuration. Invalid JSON or regular expressions prevent the extension from loading and are reported by Pi.

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
