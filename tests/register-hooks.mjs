/** Registers the resolve hook for the test run. See resolve-hooks.mjs. */
import { register } from "node:module";
register("./resolve-hooks.mjs", import.meta.url);
