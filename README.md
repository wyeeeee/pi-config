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
| **subagent** | Delegate tasks to isolated-context subagents (single / parallel / chain). **Modified: subagents follow the parent session's current model** (`ctx.model`) instead of a hardcoded one; falls back to pi's default model. Agent definitions are bundled in `extensions/subagent/agents/`. **Hardened against hangs:** resolves via `waitForChildProcess` (no more `on('close')` deadlock from detached descendants), idle-timeout kills a stuck subagent (default 600s, agent-customizable via the `timeout` param), and abort/timeout return the partial output + reason to the main agent. Forensic logs at `~/.pi/agent/logs/subagent/`. |
| **plan-mode** | Read-only planning mode: `/plan`, `Ctrl+Alt+P`, `--plan`. Disables edit/write, read-only bash allowlist, numbered-plan extraction with progress widget. |
| **tavily-auth** | `/tavily-key` command to configure the Tavily API key; persists to disk and injects into `process.env` on every session start. |
| **todo** | Todo list tool. |
| **question** | Ask-the-user question tool. |
| **questionnaire** | Structured questionnaire tool. |
| **built-in-tool-renderer** | Custom rendering for built-in tools. |
| **notify** | Cross-platform desktop notifications on task completion / question / error. Zero-dependency native backends (macOS `osascript`, Linux `notify-send`, Windows PowerShell). `/notify on\|off\|test\|status`; suppresses spawned subagents via `PI_SUBAGENT`. |
| **tavily** | Web search tools (bundled via `vendor/`; see [vendor/README.md](vendor/README.md)). Requires `/tavily-key`. |

### Prompts (`prompts/`)

Subagent workflow commands: `/implement`, `/implement-and-review`, `/scout-and-plan`.

### Bundled agents (`extensions/subagent/agents/`)

`scout`, `worker`, `planner`, `reviewer`. These ship **without** a `model:` field —
they always follow whatever model the parent session is currently using.

## Design notes

- **subagent model tracking**: `index.ts` reads `ctx.model` (the parent session's
  current model) and passes `provider/id` to each spawned child via `--model`.
  Switch models with `Ctrl+P` and the next subagent dispatch follows instantly.
- **bundled agent discovery**: `agents.ts` was extended to load agents from the
  directory next to the extension (`extensions/subagent/agents/`) as the
  lowest-priority source, so `~/.pi/agent/agents/` still overrides per-machine.
- Sources: `subagent` and `plan-mode` originate from pi's official
  `examples/extensions/` (modified as noted); the single-file extensions are
  upstream examples, unmodified. `tavily-auth` is custom.
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
