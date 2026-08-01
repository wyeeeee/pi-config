# Vendored: @tintinweb/pi-subagents

This directory is a **source vendoring** (fork) of [`tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents),
integrated into pi-config and maintained locally. It is **no longer** pulled as an npm dependency.

- **Upstream**: https://github.com/tintinweb/pi-subagents
- **Vendored at commit**: `2966cd5a33c0640de9698b56a39c11f83207a835`
- **Upstream version (at vendoring)**: 0.14.3
- **License**: MIT — see [`LICENSE`](./LICENSE) (Copyright (c) 2026 tintinweb). The MIT notice
  and this attribution are retained as required by the license.

## Runtime dependencies (declared in the root `package.json`)

- `@sinclair/typebox` — schema definitions
- `croner` — cron scheduling (`schedule.ts` / `schedule-store.ts`)
- `nanoid` — id generation

## Notes

- TypeScript source is loaded directly by pi via jiti (no build step). jiti resolves the
  `.js` relative imports in these files back to their `.ts` sources.
- Entry point: [`index.ts`](./index.ts).
- To re-sync from upstream later: diff/merge `src/` from a fresh clone of the upstream repo
  into this directory and update the commit SHA above.
