/**
 * tavily-auth — configure the Tavily API key via the `/tavily-key` command.
 *
 * Tavily reads `process.env.TAVILY_API_KEY` on every tool call (it does not
 * cache at load time), so this extension simply:
 *   1. persists the key to disk
 *   2. injects it into process.env immediately (no pi restart needed)
 *   3. re-injects it on every session_start so Tavily works out of the box
 *
 * Usage:
 *   /tavily-key            — prompt to set/update the key
 *   /tavily-key show       — show configured status (masked)
 *   /tavily-key clear      — delete the stored key
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ENV_VAR = "TAVILY_API_KEY";
const KEY_FILE = path.join(getAgentDir(), "tavily-key");

function readStoredKey(): string | undefined {
	try {
		const raw = fs.readFileSync(KEY_FILE, "utf8").trim();
		return raw || undefined;
	} catch {
		return undefined;
	}
}

function writeStoredKey(key: string): void {
	fs.mkdirSync(getAgentDir(), { recursive: true });
	fs.writeFileSync(KEY_FILE, `${key.trim()}\n`, { mode: 0o600 });
}

function removeStoredKey(): boolean {
	try {
		fs.unlinkSync(KEY_FILE);
		return true;
	} catch {
		return false;
	}
}

/** Mask a key, showing only the last 4 characters. */
function mask(key: string): string {
	const trimmed = key.trim();
	if (trimmed.length <= 4) return "****";
	return `${"•".repeat(Math.min(12, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export default function (pi: ExtensionAPI) {
	// Re-inject on every session start so Tavily works without manual export.
	pi.on("session_start", () => {
		const key = readStoredKey();
		if (key) process.env[ENV_VAR] = key;
	});

	// Also inject at load time — covers the current session right after install,
	// before any session_start fires for it.
	const initial = readStoredKey();
	if (initial) process.env[ENV_VAR] = initial;

	pi.registerCommand("tavily-key", {
		description: "Configure the Tavily API key (set | show | clear)",
		handler: async (args, ctx) => {
			const sub = (args ?? "").trim().toLowerCase();

			if (sub === "clear") {
				const had = removeStoredKey();
				delete process.env[ENV_VAR];
				ctx.ui.notify(had ? "Tavily key cleared." : "No Tavily key was stored.", "info");
				return;
			}

			if (sub === "show") {
				const key = readStoredKey() ?? process.env[ENV_VAR];
				ctx.ui.notify(
					key
						? `Tavily key configured: ${mask(key)}`
						: "No Tavily key configured. Run /tavily-key to set one.",
					"info",
				);
				return;
			}

			// Default (and "/tavily-key set"): prompt for the key.
			const input = await ctx.ui.input("Tavily API Key", "tvly-...");
			if (input === undefined) {
				ctx.ui.notify("Cancelled.", "info");
				return;
			}
			const key = input.trim();
			if (!key) {
				ctx.ui.notify("Empty key — nothing saved.", "warning");
				return;
			}
			writeStoredKey(key);
			process.env[ENV_VAR] = key;
			ctx.ui.notify(`Tavily key saved (${mask(key)}). Tavily tools are ready.`, "info");
		},
	});
}
