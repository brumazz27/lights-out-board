// Serves lights-out.html as a full HTML document, the way claude.ai wraps it when publishing.
// No dependencies, so it runs anywhere Node does (locally, in CI, in a Testkube workflow).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const page = fileURLToPath(new URL("../lights-out.html", import.meta.url));
const port = Number(process.env.PORT || 4173);
const head =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  "</head><body>";

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/healthz") return res.writeHead(200, { "content-type": "text/plain" }).end("ok");
  if (path !== "/" && path !== "/index.html") return res.writeHead(404).end("Not found");
  try {
    const body = await readFile(page, "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(head + body + "</body></html>");
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" }).end(String(err));
  }
}).listen(port, "0.0.0.0", () => console.log(`Lights Out Board on http://localhost:${port}`));
