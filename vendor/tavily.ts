// Re-export the Tavily extension so pi loads it via the `vendor/*.ts` glob
// declared in the root package.json. pi calls the default export as an extension.
//
// To bundle another third-party pi package, add a shim here:
//   vendor/<name>.ts  ->  export { default } from "<npm-package>";
// and add "<npm-package>": "^x.y.z" to `dependencies` in the root package.json.
export { default } from "@tavily/pi-extension";
