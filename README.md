# Request Injector

A Magpie plugin for customizing outgoing request payloads.
Manage request settings from one page, with controls organized by feature.
More input customization controls are planned.

Open **Request Injector** from your Magpie menu.

## Installation

Requires a Magpie version that supports middleware and plugin pages. No build step or runtime dependencies are required.
Install locally from the repository root:

```sh
magpie plugin add "$(pwd)"
magpie plugin on magpie-request-injector
```

Open **Request Injector** in Magpie’s menu to configure the available controls.
The plugin itself must also be enabled in Magpie.

## Usage

Choose a section and adjust its settings. Changes save automatically and apply to subsequent requests after saving.
The summary shows the last confirmed settings. If a save cannot be confirmed, retry or use **Load saved** to discard unsaved changes.

## Current controls

### Codex Service Tier

- Fills in a missing `service_tier` for matching GPT requests.
- **ON/OFF**: Controls this section and defaults to ON. OFF preserves the client request unchanged, including any existing `service_tier`.
- **Fast** (default): Adds `service_tier: "priority"` when the field is missing.
- **Ultrafast**: Adds `service_tier: "ultrafast"` when selected and the field is missing.
- You can select a tier for later while injection is OFF.

Applies when either the client’s model name or the provider’s resolved model name starts with `gpt-`.
Provider prefixes such as `codex/gpt-5-codex` and aliases that resolve to GPT models are supported.
Only `chat` and `responses` protocols are handled. ON fills in a missing `service_tier`.
If the request already contains `service_tier`, its value is preserved, including `null` or an empty string.
Unsupported protocols, unsupported models, and invalid settings leave requests unchanged.

Providers may reject unsupported tiers. Processing speed is not guaranteed.
Magpie’s built-in group Fast rules run after the middleware and can override the injected value.
The saved setting does not indicate the provider’s actual processing result.

## Configuration

Settings are stored as this plugin’s options in Magpie’s `plugins.json`.
The current options configure **Codex Service Tier**:

```json
{ "enabled": true, "tier": "priority" }
```

New installations and missing settings default to ON with Fast (`priority`). Explicitly saved settings take precedence, including OFF and Ultrafast.
Configured `enabled` values must be booleans, and `tier` must be `priority` or `ultrafast`. Malformed settings leave requests unchanged.
The page uses only the Magpie bridge, with no additional read permissions or external requests.
Saves run sequentially and respect the one-second write limit. Other options are read again immediately before each save and preserved.
Magpie does not provide atomic get/set operations. Avoid editing settings from another window or the CLI at the same time.

## Development and checks

```sh
npm test
npm run check
npm pack --dry-run
```

The settings page requires Magpie’s `_magpie/bridge.js`. Opening the HTML file directly displays a connection error.

## License

Licensed under the [MIT License](LICENSE).
Copyright (c) 2026 Korio.
