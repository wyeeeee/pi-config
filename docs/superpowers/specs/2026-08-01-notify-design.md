# Design: `notify` — Cross-Platform Desktop Notifications

**Date:** 2026-08-01
**Status:** Approved (brainstorming complete, pending implementation plan)
**Target package:** `pi-config`

## 1. Goal

Send a native desktop notification when pi:

1. **Completes** a task (agent run settles).
2. **Asks the user a question** (via the `question` / `questionnaire` tools).
3. **Errors** during a run.

Notifications must work across **Windows, macOS, and Linux**, must **not** fire for spawned
**subagent** children, must be **zero-dependency**, and must **never** disrupt pi's main flow.

## 2. Non-Goals (YAGNI)

- No click-to-focus / action-button callbacks.
- No custom icons or app identity registration.
- No push to mobile / webhook / chat integration (option C deferred).
- No per-event enable/disable matrix — a single on/off toggle suffices for v1.

## 3. Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Triggers | complete + question + error | Matches user intent; the three "pi needs you" moments. |
| Mechanism | **A — zero-dependency native commands** | node-notifier (B) is 4 years stale, bundles all-platform binaries with non-MIT licenses, is broken on Apple Silicon, and its Windows `SnoreToast` is the flakiest part — worst on the user's primary platform (Windows). Native commands deliver toasts + sound with zero binary friction. |
| Subagent filter | **env-var marker** `PI_SUBAGENT=1` on child spawn | Explicit, mode-independent, decoupled from run mode. `ctx.mode !== "tui"` was rejected because it would suppress legitimate `pi -p` batch notifications. |
| Config | **A — default on + `/notify` command** | Aligns with the repo's existing command style (`/tavily-key`); allows toggling and per-platform testing. |

## 4. Architecture

A single-file extension `extensions/notify.ts` plus a one-line addition to the subagent
extension. The subagent env-var marker is the only coupling between the two extensions.

```
pi (TUI / print / json — the human-facing process)
 │
 ├─ notify.ts loaded
 │   ├─ if process.env.PI_SUBAGENT === "1" → return (register nothing)
 │   ├─ load enabled state from ~/.pi/agent/notify.json
 │   ├─ on("tool_execution_start")  → question notification
 │   ├─ on("tool_result","message_end") → set errorFlag during run
 │   ├─ on("agent_settled")         → complete OR error notification (reset flag)
 │   ├─ registerCommand("notify")   → on | off | test | status
 │   └─ Notifier backend dispatches native command by process.platform
 │
 └─ subagent tool spawns child:  pi --mode json -p --no-session ...
        env: { ...process.env, PI_SUBAGENT: "1" }   ← child loads notify.ts but self-disables
```

### 4.1 Subagent suppression

The subagent extension spawns each child `pi` process with `spawn(cmd, args, opts)`.
Add `env: { ...process.env, PI_SUBAGENT: "1" }` to the existing spawn options in
`extensions/subagent/index.ts` (single existing `spawn` call site).

The notify extension short-circuits at the top of its factory:

```ts
export default function (pi: ExtensionAPI) {
  if (process.env.PI_SUBAGENT === "1") return;
  // ... register handlers and command
}
```

This guarantees nested subagents (subagent-of-subagent) are also suppressed, since the
marker is inherited through the process tree.

### 4.2 Mode behavior

- Notifications fire in **all** modes (`tui`, `print`, `json`, `rpc`) for the human-facing
  process, so a `pi -p "long task"` run can still ping the user.
- The `question` / `questionnaire` tools only function in `tui` mode, so question
  notifications are effectively `tui`-only in practice — no extra guard needed.
- Suppression relies solely on the `PI_SUBAGENT` marker, **not** on `ctx.mode`.

## 5. Notifier backends (zero-dependency)

All backends use `child_process` (`spawn`/`execFile`), are **fire-and-forget**, are wrapped
in `try/catch`, and are **not awaited**. A failed notification must never throw into pi.

### 5.1 macOS (`darwin`)

```
osascript -e 'display notification "<body>" with title "<title>" subtitle "<sub>" sound name "Glass"'
```

Built into macOS. Supports title, subtitle, body, and sound name. `osascript` returns
non-zero / writes to stderr if blocked; swallow it.

### 5.2 Linux (`linux`)

```
notify-send --app-name=pi --urgency=normal --icon=utilities-terminal "<title>" "<body>"
```

`notify-send` (libnotify) is common on desktop distros. It does **not** play a sound;
sound is an explicit non-goal beyond the OS default. If `notify-send` is missing it errors
on stdout — swallow and fall back (see 5.4).

### 5.3 Windows (`win32`)

```
powershell.exe -NoProfile -NonInteractive -Command "<WinRT toast script>"
```

The script loads `[Windows.UI.Notifications.ToastNotificationManager, ...]` WinRT types,
builds a toast from a minimal XML template (`ToastText02`: title + body), and shows it. A
modern Win10/11 toast is produced with the **default system sound** and **no binary, no
AppID registration, no Start Menu pollution** (contrast with node-notifier's SnoreToast).

This is the highest-care implementation surface; the script must:
- Be passed as a single `-Command` string, with all arguments quoted safely.
- Use the built-in `Windows.UI.Notifications` + `Windows.Data.Xml.Dom` (both in-box).
- Tolerate older Windows by wrapping in a `try/catch` inside PowerShell; on failure the
  outer Node `try/catch` falls back (5.4).

### 5.4 Fallback

If `process.platform` is unrecognized, or the native command is unavailable / errors:
- Emit a terminal bell `\u0007` (best-effort).
- Call `ctx.ui.notify(<message>, <level>)` for an in-app toast.

This guarantees graceful degradation and that the user is always reachable.

## 6. Event wiring

### 6.1 Question trigger

`pi.on("tool_execution_start", ...)` — observation-only lifecycle event that fires when
execution begins (before the blocking question UI opens). When `event.toolName` is
`"question"` or `"questionnaire"`:

- Title: `pi · 需要回答`
- Body: the question text from `event.args.question` (or summary), truncated to ~120 chars.

### 6.2 Complete vs error trigger

Track a module-level `errorFlag` (reset at the start of each run / on each settle):

- `pi.on("tool_result", ...)` → if `event.isError === true`, set `errorFlag = true`.
- `pi.on("message_end", ...)` → if assistant message `stopReason === "error"`, set `errorFlag = true`.
- `pi.on("agent_settled", ...)`:
  - if `errorFlag` → **error** notification (`pi · 出错`, body = error snippet).
  - else → **complete** notification (`pi · 完成`, body = cwd basename or session name).
  - reset `errorFlag = false`.

This is intentionally heuristic: a transient tool error that the agent recovered from will
classify as "error". That is acceptable for v1 (it still means "something went wrong, you
may want to look"). Refinements (e.g. only flag error when the *final* state is an error)
can follow from real-world testing.

### 6.3 Enable gate

Every handler reads the persisted `enabled` state (cheap file read, or an in-memory cache
refreshed on `/notify` changes). When disabled, handlers return immediately. The env-var
short-circuit (4.1) takes precedence.

## 7. `/notify` command

Mirrors `tavily-auth.ts`: read/write a JSON file under `getAgentDir()`, give `ctx.ui.notify`
feedback. State file: `~/.pi/agent/notify.json` → `{ "enabled": true }` (default `true`).

| Invocation | Behavior |
|------------|----------|
| `/notify` or `/notify status` | Show enabled state + detected platform backend. |
| `/notify on` / `/notify off` | Toggle, persist immediately. |
| `/notify test` | Fire one test notification right now (title `pi · 测试`, body current time). Used to verify the per-platform command works. |

## 8. Notification copy (concise)

| Trigger | Title | Body |
|---------|-------|------|
| Complete | `pi · 完成` | cwd basename / session name |
| Question | `pi · 需要回答` | question text (truncated ~120) |
| Error | `pi · 出错` | error snippet (truncated ~120) |

## 9. Files changed

| File | Change |
|------|--------|
| `extensions/notify.ts` | **New.** Backends + event wiring + `/notify` command. |
| `extensions/subagent/index.ts` | Add `env: { ...process.env, PI_SUBAGENT: "1" }` to the `spawn` options. |
| `package.json` | Add `"extensions/notify.ts"` to `pi.extensions`. |
| `README.md` | Add a row to the Extensions table; mention `/notify`. |

No `vendor/` change, no new npm dependency, no `node_modules` impact.

## 10. Testing & verification

The repo has no test framework. Verification is manual, following the
verification-before-completion process:

1. `/notify test` produces a real toast on each target platform (primary: Windows).
2. Triggering a real `question` tool call fires the question notification.
3. Letting a task finish fires the complete notification.
4. Dispatching a `subagent` does **not** fire any notification from the child.
5. `/notify off` suppresses everything; `/notify on` restores.
6. A failing backend (e.g. no `notify-send`) falls back to bell + in-app toast without
   throwing.

## 11. Open items / risks

- **Windows WinRT toast script**: the highest-complexity piece; must be validated on a real
  Windows box (the dev machine). If WinRT proves unreliable, the NotifyIcon balloon
  (`System.Windows.Forms`, also zero-binary) is a documented fallback within the same file.
- **Error heuristic**: may over-report; refine after real usage.
- **`agent_settled` ordering vs `tool_execution_start`**: confirmed non-overlapping in time
  (a blocking question suspends the run before settle), but verify during implementation.
