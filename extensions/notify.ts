/**
 * notify — cross-platform desktop notifications.
 *
 * Fires a native OS notification when pi:
 *   - completes a run            (agent_settled, no error)
 *   - asks the user a question   (question / questionnaire tool starts)
 *   - errors during a run        (agent_settled after an error)
 *
 * Backends are zero-dependency: they shell out to each platform's native
 * command (osascript / notify-send / Windows PowerShell). A failing or
 * unsupported backend degrades to a terminal bell + in-app toast and never
 * throws into pi.
 *
 * Spawned subagent children self-disable via the PI_SUBAGENT env marker that
 * the subagent extension sets on child spawns (see extensions/subagent/index.ts).
 *
 * Usage:
 *   /notify              show status (enabled + detected backend)
 *   /notify on|off       enable / disable, persisted to ~/.pi/agent/notify.json
 *   /notify test         fire a test notification immediately
 *
 * State defaults to enabled.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATE_FILE = path.join(getAgentDir(), "notify.json");
const BODY_MAX = 120;

type Level = "complete" | "question" | "error" | "test";

// ───────────────────────── state ─────────────────────────

interface NotifyState {
	enabled: boolean;
}

function readState(): NotifyState {
	try {
		const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
		if (parsed && typeof parsed.enabled === "boolean") return { enabled: parsed.enabled };
	} catch {
		/* missing / corrupt → default */
	}
	return { enabled: true };
}

function writeState(state: NotifyState): void {
	try {
		fs.mkdirSync(getAgentDir(), { recursive: true });
		fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
	} catch {
		/* best-effort */
	}
}

function isEnabled(): boolean {
	return readState().enabled;
}

// ───────────────────────── text helpers ─────────────────────────

function truncate(text: string, max = BODY_MAX): string {
	const clean = (text ?? "").replace(/\s+/g, " ").trim();
	return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function copyFor(level: Level, body: string): { title: string; bodyText: string } {
	const b = truncate(body);
	switch (level) {
		case "complete":
			return { title: "pi · 完成", bodyText: b || "任务已完成" };
		case "question":
			return { title: "pi · 需要回答", bodyText: b || "pi 正在等你选择" };
		case "error":
			return { title: "pi · 出错", bodyText: b || "运行中出错" };
		case "test":
			return { title: "pi · 测试", bodyText: b || "通知测试" };
	}
}

function backendName(): string {
	switch (process.platform) {
		case "darwin":
			return "osascript (macOS Notification Center)";
		case "linux":
			return "notify-send (libnotify)";
		case "win32":
			return "PowerShell NotifyIcon (Windows)";
		default:
			return `unsupported (${process.platform}) → 仅终端铃 + 应用内提示`;
	}
}

// ───────────────────────── notifier backends ─────────────────────────

/** Escape a string for use inside a double-quoted AppleScript string. */
function appleEscape(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Wrap a string as a PowerShell single-quoted literal. */
function psSingleQuote(s: string): string {
	return `'${s.replace(/'/g, "''")}'`;
}

function notifyOs(title: string, body: string, ctx: ExtensionContext): void {
	switch (process.platform) {
		case "darwin": {
			const line = `display notification "${appleEscape(body)}" with title "${appleEscape(
				title,
			)}" sound name "Glass"`;
			spawnNative("osascript", ["-e", line], ctx, title, body);
			return;
		}
		case "linux": {
			spawnNative(
				"notify-send",
				["--app-name=pi", "--urgency=normal", "--icon=utilities-terminal", title, body],
				ctx,
				title,
				body,
			);
			return;
		}
		case "win32": {
			// NotifyIcon balloon via Windows PowerShell 5.1 (always present on Windows).
			// On Win10/11 balloons render as native toasts in Action Center. Zero binary,
			// zero registry, zero AppID registration. -EncodedCommand transports the
			// script as UTF-16LE base64 to avoid any quoting / Unicode pitfalls.
			const script = [
				"Add-Type -AssemblyName System.Windows.Forms, System.Drawing",
				"$n = New-Object System.Windows.Forms.NotifyIcon",
				"$n.Icon = [System.Drawing.SystemIcons]::Information",
				`$n.BalloonTipTitle = ${psSingleQuote(title)}`,
				`$n.BalloonTipText = ${psSingleQuote(body)}`,
				"$n.Visible = $true",
				"$n.ShowBalloonTip(5000)",
				"Start-Sleep -Seconds 3",
				"$n.Dispose()",
			].join("\n");
			const encoded = Buffer.from(script, "utf16le").toString("base64");
			spawnNative("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], ctx, title, body);
			return;
		}
		default:
			fallback(ctx, title, body, "unsupported platform");
	}
}

function spawnNative(
	cmd: string,
	args: string[],
	ctx: ExtensionContext,
	title: string,
	body: string,
): void {
	let child;
	try {
		child = spawn(cmd, args, { stdio: "ignore", shell: false, windowsHide: true });
	} catch {
		fallback(ctx, title, body, `spawn threw: ${cmd}`);
		return;
	}
	child.on("error", () => fallback(ctx, title, body, `not found: ${cmd}`));
	child.unref(); // never keep pi alive for a notification
}

function fallback(ctx: ExtensionContext, title: string, body: string, _reason: string): void {
	try {
		process.stdout.write("\u0007"); // terminal bell
	} catch {
		/* ignore */
	}
	try {
		ctx.ui.notify(body ? `${title} — ${body}` : title, "info");
	} catch {
		/* ignore */
	}
}

// ───────────────────────── fire ─────────────────────────

function fire(level: Level, ctx: ExtensionContext, body: string, force = false): void {
	if (!force && !isEnabled()) return;
	const { title, bodyText } = copyFor(level, body);
	notifyOs(title, bodyText, ctx);
}

// ───────────────────────── extension ─────────────────────────

export default function (pi: ExtensionAPI) {
	// Spawned subagent children self-disable so they never notify.
	if (process.env.PI_SUBAGENT === "1") return;

	// Per-run error tracking. Set by tool_result(message_end) on error, cleared by a
	// later normal assistant completion, consumed & reset at agent_settled.
	let errorFlag = false;
	let lastErrorText = "";

	pi.on("tool_execution_start", async (event, ctx) => {
		if (event.toolName !== "question" && event.toolName !== "questionnaire") return;
		const args = (event.args ?? {}) as Record<string, any>;
		const body =
			(typeof args.question === "string" && args.question) ||
			(Array.isArray(args.questions) && typeof args.questions[0]?.prompt === "string" && args.questions[0].prompt) ||
			"";
		fire("question", ctx, body);
	});

	pi.on("tool_result", async (event) => {
		if (event.isError) {
			errorFlag = true;
			const textPart = Array.isArray(event.content)
				? (event.content.find((c: any) => c && c.type === "text") as any)
				: undefined;
			lastErrorText = textPart?.text ?? "";
		}
	});

	pi.on("message_end", async (event) => {
		const msg = event.message as any;
		if (!msg || msg.role !== "assistant") return;
		if (msg.stopReason === "error") {
			errorFlag = true;
			lastErrorText = msg.errorMessage ?? lastErrorText;
		} else {
			// A later normal completion overrides an earlier tool/model error in the same run.
			errorFlag = false;
			lastErrorText = "";
		}
	});

	pi.on("agent_settled", async (_event, ctx) => {
		const where = path.basename(ctx.cwd) || "pi";
		if (errorFlag) fire("error", ctx, lastErrorText || where);
		else fire("complete", ctx, where);
		errorFlag = false;
		lastErrorText = "";
	});

	pi.registerCommand("notify", {
		description: "桌面通知: /notify [on|off|test|status]",
		handler: async (args, ctx) => {
			const sub = (args ?? "").trim().toLowerCase();

			if (sub === "on" || sub === "off") {
				const enabled = sub === "on";
				writeState({ enabled });
				ctx.ui.notify(`桌面通知已${enabled ? "开启" : "关闭"}`, "info");
				return;
			}

			if (sub === "test") {
				fire("test", ctx, `当前时间 ${new Date().toLocaleTimeString()}`, true);
				ctx.ui.notify("已发送测试通知（请同时查看系统通知中心）", "info");
				return;
			}

			// status (default)
			const st = readState();
			ctx.ui.notify(`桌面通知：${st.enabled ? "开启" : "关闭"} · 后端：${backendName()}`, "info");
		},
	});
}
