# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-07

### Added

- Project rules in `.pi/prompt-filter.json`, loaded only when Pi grants project trust and merged over global rules by ID.

### Changed

- Global rules now live in `~/.pi/agent/prompt-filter.json`, following `PI_CODING_AGENT_DIR`, to match Pi's own global and project configuration locations. The XDG configuration location is no longer read.
- Configuration files accept only the named `rules` format. The original `patterns` array and unknown top-level keys are rejected.
- Configuration is read at session start. Invalid global or project configuration is reported as an error and only the bundled rules apply, instead of preventing the extension from loading.

## [0.1.0] - 2026-10-05

### Added

- Initial standalone Pi package.
- Configurable filtering of regular-expression matches from interactive input.
- Bundled rules for `ls`, `pwd`, and simple two-token `git` commands.
- Optional user configuration through the XDG configuration directory.
- Named rules that user configuration can disable, override, or extend by ID.
- Backward compatibility with the original append-only `patterns` configuration.
- Automated tests and open source project documentation.

[Unreleased]: https://github.com/datfinesoul/pi-prompt-filter/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/datfinesoul/pi-prompt-filter/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/datfinesoul/pi-prompt-filter/releases/tag/v0.1.0
