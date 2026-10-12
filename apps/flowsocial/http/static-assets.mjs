import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { extname, join } from "node:path";

// These are the local resources loaded by index.html. Runtime artifacts are
// available only through their existing scoped and versioned API routes.
export const PUBLIC_STATIC_ASSETS = Object.freeze([
  "index.html", "styles.css", "api-client.js", "app-foundation.js", "app.js",
  "ui/topic-adjustment-workbench.js", "ui/publishing-cycle-controls.js",
  "ui/strategy-adjustment-workbench.js", "ui/runtime-status.js",
  "ui/unified-artifact-workbench.js", "ui/application-bootstrap.js"
]);
const publicAssets = new Set(PUBLIC_STATIC_ASSETS);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

export async function servePublicStaticAsset({ req, res, root, sendJson }) {
  const missing = () => sendJson(res, 404, { error: "File not found" });
  // Inspect the original path before URL normalization can erase dot segments.
  let pathname;
  try { pathname = decodeURIComponent(String(req.url || "/").split(/[?#]/, 1)[0]); }
  catch { return missing(); }
  if (!pathname.startsWith("/") || pathname.includes("\\")
    || pathname.split("/").some((part) => part === "." || part === "..")) return missing();
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!publicAssets.has(relative)) return missing();
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  let handle;
  try {
    const realRoot = await realpath(root);
    let file = realRoot;
    for (const part of relative.split("/")) {
      file = join(file, part);
      if ((await lstat(file)).isSymbolicLink()) return missing();
    }
    if (await realpath(file) !== file) return missing();
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile() || await realpath(file) !== file) return missing();
    const bytes = req.method === "HEAD" ? null : await handle.readFile();
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(file)], "Content-Length": info.size,
      "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"
    });
    res.end(bytes);
  } catch {
    return missing();
  } finally {
    if (handle) await handle.close();
  }
}
