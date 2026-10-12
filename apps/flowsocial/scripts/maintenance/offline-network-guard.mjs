// Preloaded by test:offline in every Node child. Allow local API tests only.
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
function requireLoopback(host = "localhost") {
  if (!loopbackHosts.has(String(host).toLowerCase())) {
    throw Object.assign(new Error("Offline tests may only connect to loopback"), {
      code: "FLOWSOCIAL_OFFLINE_NETWORK_BLOCKED"
    });
  }
}

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const parameters = Array.isArray(args[0]) ? args[0] : args;
  const first = parameters[0];
  if (first && typeof first === "object") {
    if (!first.path) requireLoopback(first.host);
  } else if (typeof first === "number" || (typeof first === "string" && Number(first) >= 0)) {
    requireLoopback(typeof parameters[1] === "string" ? parameters[1] : undefined);
  }
  return Reflect.apply(connect, this, args);
};

for (const transport of [http, https]) {
  for (const method of ["request", "get"]) {
    const original = transport[method];
    transport[method] = function (...args) {
      const first = args[0];
      if (typeof first === "string" || first instanceof URL) {
        requireLoopback(new URL(first).hostname);
        if (args[1] && typeof args[1] === "object" && !args[1].socketPath) {
          requireLoopback(args[1].hostname || args[1].host || new URL(first).hostname);
        }
      } else if (first && !first.socketPath) {
        requireLoopback(first.hostname || first.host);
      }
      return Reflect.apply(original, this, args);
    };
  }
}

const fetch = globalThis.fetch;
globalThis.fetch = function (input, ...args) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  requireLoopback(url.hostname);
  return Reflect.apply(fetch, this, [input, ...args]);
};
syncBuiltinESMExports();
