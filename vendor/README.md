# vendor/

Third-party pi packages bundled into pi-config. Each package is a one-line shim
that re-exports the package's default extension entry. The `vendor/*.ts` glob in
the root [`package.json`](../package.json) picks them all up automatically — no
need to edit the extensions list when adding or removing a package.

## Add a package

1. Create a shim here, e.g. `vendor/foo.ts`:
   ```ts
   export { default } from "<npm-package-name>";
   ```
2. Add `"<npm-package-name>": "^x.y.z"` to `dependencies` in the root
   [package.json](../package.json).
3. Commit, push, and on each machine run:
   ```bash
   pi update --extensions
   ```

## Remove a package

1. Delete the shim file under `vendor/`.
2. Remove its line from `dependencies` in the root package.json.

## Current packages

| Shim | Package |
|------|---------|
| `tavily.ts` | `@tavily/pi-extension` |
