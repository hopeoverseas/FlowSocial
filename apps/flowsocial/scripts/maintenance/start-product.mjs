import { applyLocalProductMode } from "./product-mode-flags.mjs";

applyLocalProductMode(process.env);
await import("./start-server.mjs");
