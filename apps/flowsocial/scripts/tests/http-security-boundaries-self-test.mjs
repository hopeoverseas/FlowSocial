import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PUBLIC_STATIC_ASSETS } from "../../http/static-assets.mjs";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const marker = "synthetic-private-http-canary";

async function copySourceModules(from, to, extensions = [".mjs"]) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.isDirectory()) await copySourceModules(join(from, entry.name), join(to, entry.name), extensions);
    else if (entry.isFile() && extensions.includes(extname(entry.name))) await copyFile(join(from, entry.name), join(to, entry.name));
  }
}

async function runWorker(appRoot) {
  let externalCalls = 0;
  globalThis.__httpBoundaryProviderCalls = 0;
  globalThis.__httpBoundaryTextCalls = 0;
  globalThis.__httpBoundaryStoreReads = 0;
  globalThis.__httpBoundaryStoreWrites = 0;
  // This child receives no provider credentials; any external attempt still
  // fails immediately, including native socket calls that bypass fetch.
  globalThis.fetch = async () => { externalCalls += 1; throw new Error("Offline HTTP boundary test"); };
  const allowedHost = (host) => ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
  for (const transport of [http, https]) {
    for (const method of ["request", "get"]) {
      const original = transport[method];
      transport[method] = function (input, ...args) {
        const options = typeof input === "string" || input instanceof URL ? new URL(input) : input;
        if (!allowedHost(options.hostname || options.host || "localhost")) {
          externalCalls += 1; throw new Error("External HTTP is forbidden in this test");
        }
        return original.call(this, input, ...args);
      };
    }
  }
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const options = Array.isArray(args[0]) ? args[0][0] : args[0];
    const host = options && typeof options === "object" ? options.host : args[1];
    if (host && typeof host === "string" && !allowedHost(host)) {
      externalCalls += 1; throw new Error("External socket is forbidden in this test");
    }
    return connect.apply(this, args);
  };
  syncBuiltinESMExports();

  process.env.FLOWSOCIAL_DATA_DIR = join(appRoot, "data");
  process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
  process.env.FLOWSOCIAL_TEST_MODE = "1";
  const { server, setUnifiedContentServerDependenciesForTest } = await import(pathToFileURL(join(appRoot, "server.mjs")));
  const { database, getStorageStatus } = await import(pathToFileURL(join(appRoot, "storage.mjs")));
  let governedCalls = 0;
  setUnifiedContentServerDependenciesForTest({
    xhsProviderTransport: async () => { governedCalls += 1; throw new Error("Unexpected governed provider call"); },
    xhsProviderTransportContext: { mode: "test", networked: false }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = server.address().port;
  function request(path, method = "GET", body = "") {
    return new Promise((resolveResponse, reject) => {
      const req = http.request({ hostname: "127.0.0.1", port, path, method, headers: { "Content-Type": "application/json" } }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolveResponse({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.end(body);
    });
  }
  try {
    const index = await readFile(join(appRoot, "index.html"), "utf8");
    const referenced = [...index.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((match) => match[1].split("?", 1)[0])
      .filter((path) => !/^(?:https?:)?\/\//.test(path));
    for (const resource of referenced) assert.ok(PUBLIC_STATIC_ASSETS.includes(resource), `index resource must have explicit public authority: ${resource}`);
    for (const resource of ["", ...PUBLIC_STATIC_ASSETS]) {
      const response = await request(`/${resource}?version=fixture`);
      assert.equal(response.status, 200, `public resource /${resource}`);
      assert.ok(response.bytes.length > 0);
      assert.equal(response.headers["x-content-type-options"], "nosniff");
    }
    const head = await request("/styles.css", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.bytes.length, 0);
    assert.ok(Number(head.headers["content-length"]) > 0);
    assert.equal((await request("/index.html", "POST", "{}")).status, 405);

    for (const path of [
      "/data/private-canary.txt", "/data/uploads/private-canary.txt", "/data/private-canary.db",
      "/uploads/private-canary.txt", "/artifacts/private-canary.txt", "/providers.mjs", "/storage.mjs",
      "/package.json", "/scripts/tests/private-canary.txt", "/.env.local", "/.platform-integrations.local.json",
      "/ui", "/ui/private-canary.js", "/%2e%2e/index.html", "/ui/../app.js", "/ui/%2e%2e/app.js",
      "/%2e/styles.css", "/ui%5c..%5capp.js", "/ui%2f../app.js", "/%ZZ"
    ]) {
      const response = await request(path);
      assert.equal(response.status, 404, `non-public or traversing path must be unavailable: ${path}`);
      assert.equal(response.bytes.includes(Buffer.from(marker)), false);
    }

    const cssPath = join(appRoot, "styles.css");
    const css = await readFile(cssPath);
    await unlink(cssPath);
    await symlink(join(appRoot, "../private-canary.txt"), cssPath);
    assert.equal((await request("/styles.css")).status, 404, "public filename must not follow an escaping symlink");
    await unlink(cssPath);
    await symlink(join(appRoot, "providers.mjs"), cssPath);
    assert.equal((await request("/styles.css")).status, 404, "public filename must not follow a private file within root");
    await unlink(cssPath);
    await writeFile(cssPath, css);
    await rename(join(appRoot, "ui"), join(appRoot, "ui-original"));
    await symlink(join(appRoot, "../private-ui"), join(appRoot, "ui"));
    assert.equal((await request("/ui/application-bootstrap.js")).status, 404, "public directory must not follow an escaping symlink");
    await unlink(join(appRoot, "ui"));
    await rename(join(appRoot, "ui-original"), join(appRoot, "ui"));
    assert.equal((await request("/ui/application-bootstrap.js")).status, 200);

    const revision = getStorageStatus().revision;
    const storeReads = globalThis.__httpBoundaryStoreReads;
    const storeWrites = globalThis.__httpBoundaryStoreWrites;
    for (const body of ['{"prompt":"synthetic fixture prompt"}', "{malformed", "{}"] ) {
      const response = await request("/api/v1/images/generate", "POST", body);
      assert.equal(response.status, 410, "retired generation must fail before parsing or calling a provider");
      const result = JSON.parse(response.bytes);
      assert.equal(result.code, "UNGOVERNED_IMAGE_GENERATION_REMOVED");
      assert.match(result.replacement, /\/provider-executions$/);
      assert.deepEqual(result.requiredGates, ["exact content version", "provider plan", "human approval", "call and credit budget"]);
    }
    for (const path of [
      "/api/v1/content-tasks/fixture/assets/generate",
      "/api/v1/content-tasks/fixture/visual-candidates/P1/retry",
      "/api/v1/content-tasks/fixture/revise"
    ]) {
      for (const body of ['{"instruction":"修改图片文字","prompt":"fixture","force":true,"approvedAdditionalCalls":99}', "{malformed", "{}"] ) {
        const response = await request(path, "POST", body);
        assert.equal(response.status, 410, `${path} must retire before reading or mutating business state`);
        const result = JSON.parse(response.bytes);
        assert.equal(result.code, "LEGACY_PAID_CONTENT_GENERATION_REMOVED");
        assert.ok(result.replacement.startsWith("/api/v1/"));
        assert.match(result.imageRevision, /\/light-revision-plans$/);
      }
    }
    const oldRun = await request("/api/v1/content-agent/runs/legacy-fixture/trace");
    assert.equal(oldRun.status, 410, "existing retired ContentRun route must remain fail closed");
    assert.equal(JSON.parse(oldRun.bytes).code, "LEGACY_CONTENT_RUN_COMPATIBILITY_REMOVED");
    assert.equal(globalThis.__httpBoundaryStoreReads, storeReads, "retired paths must perform zero business state reads");
    assert.equal(globalThis.__httpBoundaryStoreWrites, storeWrites, "retired paths must perform zero persistence calls");
    process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1 = "0";
    let response = await request("/api/v1/unified-content-projects/fixture/platforms/xiaohongshu/provider-executions", "POST", "{}");
    assert.equal(response.status, 404, "governed execution still obeys its feature gate");
    process.env.UNIFIED_CONTENT_XHS_PROVIDER_EXECUTION_V1 = "1";
    response = await request("/api/v1/unified-content-projects/fixture/platforms/xiaohongshu/provider-executions", "POST", "{}");
    assert.equal(response.status, 400, "missing exact authority and approval cannot execute the governed provider");
    assert.equal(getStorageStatus().revision, revision, "rejected image requests must not persist state");
    assert.equal(globalThis.__httpBoundaryProviderCalls, 0);
    assert.equal(globalThis.__httpBoundaryTextCalls, 0);
    assert.equal(governedCalls, 0);
    assert.equal(externalCalls, 0);
    console.log("http-security-boundaries-self-test: ok (11 explicit public assets; private paths, traversal and symlinks refused; retired generic/revise/generate/retry/ContentRun reads 0; provider calls 0; external calls 0; rejected-request writes 0)");
  } finally {
    server.closeAllConnections();
    await new Promise((close) => server.close(close));
    database.close();
  }
}

if (process.argv[2] === "--isolated-worker") {
  await runWorker(process.argv[3]);
} else {
  const temp = await mkdtemp(join(tmpdir(), "flowsocial-http-boundaries-"));
  try {
    const appRoot = join(temp, "app");
    await mkdir(appRoot);
    for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
      if (entry.isFile() && extname(entry.name) === ".mjs") await copyFile(join(sourceRoot, entry.name), join(appRoot, entry.name));
    }
    for (const directory of ["contracts", "content-agent", "strategy-agent", "http", "llm", "image-providers"]) {
      await copySourceModules(join(sourceRoot, directory), join(appRoot, directory));
    }
    await copySourceModules(join(sourceRoot, "skills"), join(appRoot, "skills"), [".mjs", ".json", ".md"]);
    for (const resource of PUBLIC_STATIC_ASSETS) {
      await mkdir(dirname(join(appRoot, resource)), { recursive: true });
      await copyFile(join(sourceRoot, resource), join(appRoot, resource));
    }
    await writeFile(join(appRoot, "package.json"), JSON.stringify({ type: "module" }));
    await symlink(join(sourceRoot, "node_modules"), join(appRoot, "node_modules"), "dir");
    await mkdir(join(appRoot, "data/uploads"), { recursive: true });
    await writeFile(join(appRoot, "data/store.json"), JSON.stringify({ accounts: [], contentTasks: [], opportunities: [], users: [], workspaces: [], workspaceMemberships: [] }));
    for (const relative of ["data/private-canary.txt", "data/uploads/private-canary.txt", "data/private-canary.db", "uploads/private-canary.txt", "artifacts/private-canary.txt", "scripts/tests/private-canary.txt", "ui/private-canary.js"]) {
      await mkdir(dirname(join(appRoot, relative)), { recursive: true });
      await writeFile(join(appRoot, relative), marker);
    }
    await writeFile(join(temp, "private-canary.txt"), marker);
    await mkdir(join(temp, "private-ui"));
    await writeFile(join(temp, "private-ui/application-bootstrap.js"), marker);
    const providerFile = join(appRoot, "providers.mjs");
    await rename(providerFile, join(appRoot, "providers-fixture-implementation.mjs"));
    await writeFile(providerFile, 'export * from "./providers-fixture-implementation.mjs";\nexport async function generateImage() { globalThis.__httpBoundaryProviderCalls += 1; throw new Error("Unexpected generic image provider call"); }\nexport async function generateText() { globalThis.__httpBoundaryTextCalls += 1; throw new Error("Unexpected paid text provider call"); }\nexport const generateAtomicText = generateText;\n');
    const storageFile = join(appRoot, "storage.mjs");
    await rename(storageFile, join(appRoot, "storage-fixture-implementation.mjs"));
    await writeFile(storageFile, 'export * from "./storage-fixture-implementation.mjs";\nimport { readStore as readOriginal, writeStore as writeOriginal } from "./storage-fixture-implementation.mjs";\nexport function readStore() { globalThis.__httpBoundaryStoreReads += 1; return readOriginal(); }\nexport function writeStore(store) { globalThis.__httpBoundaryStoreWrites += 1; return writeOriginal(store); }\n');
    const cleanEnv = { CI: "1" };
    for (const name of ["PATH", "TMPDIR", "LANG", "SystemRoot", "WINDIR"]) if (process.env[name]) cleanEnv[name] = process.env[name];
    const worker = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--isolated-worker", appRoot], { env: cleanEnv, stdio: "inherit", timeout: 60000 });
    assert.equal(worker.error, undefined, "isolated HTTP worker must complete");
    assert.equal(worker.status, 0, "isolated HTTP boundary assertions must pass");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
