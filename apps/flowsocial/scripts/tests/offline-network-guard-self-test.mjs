import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { once } from "node:events";
import "../maintenance/offline-network-guard.mjs";

const blocked = { code: "FLOWSOCIAL_OFFLINE_NETWORK_BLOCKED" };
assert.throws(() => fetch("https://provider.invalid/tasks"), blocked);
assert.throws(() => http.get("http://provider.invalid/tasks"), blocked);
assert.throws(() => https.request({ hostname: "provider.invalid", path: "/tasks" }), blocked);
assert.throws(() => http.request("http://127.0.0.1/", { hostname: "provider.invalid" }), blocked);
// Mock the underlying socket to prove rejection without risking an external
// connection even if a future guard regression occurs.
const guardedConnect = net.Socket.prototype.connect;
let delegatedConnections = 0;
net.Socket.prototype.connect = function () { delegatedConnections += 1; return this; };
await import(new URL("../maintenance/offline-network-guard.mjs?socket-contract", import.meta.url));
const socket = new net.Socket();
try {
  assert.throws(() => socket.connect({ host: "192.0.2.1", port: 443 }), blocked);
  assert.throws(() => socket.connect("443", "192.0.2.1"), blocked);
  for (const port of [" 443 ", "443.0", "0x1bb", "4.43e2"]) {
    assert.throws(() => socket.connect(port, "192.0.2.1"), blocked, `Node TCP port form ${port}`);
  }
  assert.throws(() => socket.connect(["443", "192.0.2.1"]), blocked);
  assert.equal(delegatedConnections, 0);
} finally {
  socket.destroy();
  net.Socket.prototype.connect = guardedConnect;
}

const server = http.createServer((request, response) => response.end("offline-loopback-ok"));
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "offline-loopback-ok");
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
console.log("offline-network-guard-self-test: ok (external blocked, loopback allowed)");
