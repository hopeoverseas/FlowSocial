// Local product mode exposes the unified local-package workflow while keeping
// platform effects and experiments closed. The root policy is the source of truth.
import { LOCAL_PRODUCT_FLAG_DEFAULTS } from "../../product-capability-policy.mjs";

export const LOCAL_PRODUCT_FLAGS = LOCAL_PRODUCT_FLAG_DEFAULTS;

export function applyLocalProductMode(env = process.env) {
  for (const [name, value] of Object.entries(LOCAL_PRODUCT_FLAGS)) if (env[name] == null || env[name] === "") env[name] = value;
  env.FLOWSOCIAL_PRODUCT_MODE ||= "local-package";
  return env;
}
