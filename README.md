# pi-config

Personal [pi](https://github.com/earendil-works/pi) coding-agent extensions bundle.
One `pi install` brings up the full toolchain on any machine.

## Install

```bash
pi install git:github.com/<your-user>/pi-config
```

Reload or restart pi, then everything below is available.

## Contents

### Extensions

| Extension | What it does |
|-----------|--------------|
| **subagent** | Delegate tasks to isolated-context subagents (single / parallel / chain). **Modified: subagents follow the parent session's current model** (`ctx.model`) instead of a hardcoded one; falls back to pi's default model. Agent definitions are bundled in `extensions/subagent/agents/`. |
| **plan-mode** | Read-only planning mode: `/plan`, `Ctrl+Alt+P`, `--plan`. Disables edit/write, read-only bash allowlist, numbered-plan extraction with progress widget. |
| **todo** | Todo list tool. |
| **question** | Ask-the-user question tool. |
| **questionnaire** | Structured questionnaire tool. |
| **built-in-tool-renderer** | Custom rendering for built-in tools. |
| **minimal-mode** | Minimal UI mode. |
| **status-line** | Custom status line. |

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
  upstream examples, unmodified.

## Update after changes

Push to git, then on each machine:

```bash
pi update --extensions
```
