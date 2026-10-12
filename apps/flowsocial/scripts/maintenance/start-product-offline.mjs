// Start the local-package product surface without a paid model preflight.
// Runtime generation actions still use their normal server-side approvals;
// this entry point only makes offline/local regression deterministic.
import { applyLocalProductMode } from "./product-mode-flags.mjs";

applyLocalProductMode(process.env);
process.env.FLOWSOCIAL_OFFLINE_START = "1";
await import("./start-server.mjs");
