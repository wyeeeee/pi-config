# pi-config

Personal [pi](https://github.com/earendil-works/pi) coding-agent extensions bundle.
One `pi install` brings up the full toolchain on any machine.

## Install

```bash
pi install git:github.com/<your-user>/pi-config
```

Reload or restart pi, then everything below is available.

### Tavily (optional web search)

This bundle includes the Tavily extension. Configure its API key once:

```
/tavily-key        # paste your tvly-... key
```

The key is stored at `~/.pi/agent/tavily-key` and injected into
`process.env.TAVILY_API_KEY` on every session start — no `export` needed,
no restart after setting. Also: `/tavily-key show` (masked) and
`/tavily-key clear`.

## Contents

### Extensions

| Extension | What it does |
|-----------|--------------|
| **subagents** | Autonomous Claude Code-style sub-agents — **vendored source** of [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) at `extensions/subagents/`, maintained locally (MIT; see [`VENDORED.md`](extensions/subagents/VENDORED.md)). Foreground/background agents, mid-run steering, session resume, `/agents` menu, fleet view, live widget, scheduling, custom agent types (`.pi/agents/*.md` or `~/.pi/agent/agents/`). Tools: `Agent`, `get_subagent_result`, `steer_subagent`. Runtime deps `@sinclair/typebox`, `croner`, `nanoid`. |
| **plan-mode** | Read-only planning mode: `/plan`, `Ctrl+Alt+P`, `--plan`. Disables edit/write, read-only bash allowlist, numbered-plan extraction with progress widget. |
| **tavily-auth** | `/tavily-key` command to configure the Tavily API key; persists to disk and injects into `process.env` on every session start. |
| **todo** | Todo list tool. |
| **question** | Ask-the-user question tool. |
| **questionnaire** | Structured questionnaire tool. |
| **built-in-tool-renderer** | Custom rendering for built-in tools. |
| **notify** | Cross-platform desktop notifications on task completion / question / error. Zero-dependency native backends (macOS `osascript`, Linux `notify-send`, Windows PowerShell). `/notify on\|off\|test\|status`; suppresses in-process subagents via the vendored subagents' AsyncLocalStorage child-session marker. |
| **tavily** | Web search tools (bundled via `vendor/`; see [vendor/README.md](vendor/README.md)). Requires `/tavily-key`. |

## Design notes

- **subagents is vendored source** (not an npm dependency): a local fork of
  `@tintinweb/pi-subagents` lives at `extensions/subagents/` (MIT; attribution
  in `LICENSE` + `VENDORED.md`). Loaded by pi via jiti straight from the TS
  source (no build step) — jiti resolves the `.js` relative imports back to
  `.ts`. Re-sync from upstream by diffing/merging its `src/` and updating the
  commit SHA in `VENDORED.md`.
- Sources: `plan-mode` originates from pi's official `examples/extensions/`
  (modified); the single-file extensions are upstream examples, unmodified.
  `tavily-auth` and `notify` are custom.
- **Third-party packages live in [`vendor/`](vendor/)**: each is a one-line shim
  re-exporting the package's default, auto-discovered via the `vendor/*.ts` glob
  in `pi.extensions`. Add or remove packages without touching the extensions
  list — see [vendor/README.md](vendor/README.md). `dependencies` in
  package.json still lists them (an npm requirement).

## Update after changes

Push to git, then on each machine:

```bash
pi update --extensions
```
