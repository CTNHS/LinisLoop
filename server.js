// Zero-dependency static server for LinisLoop. Run: node server.js  (or npm start)
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "www");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain" };
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split("?")[0]); } catch { res.writeHead(400); return res.end("Bad request"); }
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(buf);
  });
});
let port = Number(process.env.PORT) || 8080;
server.on("error", e => { if (e.code === "EADDRINUSE") { port++; server.listen(port); } else throw e; });
server.on("listening", () => {
  console.log("\n  LinisLoop is running!\n");
  console.log("  On this computer:  http://localhost:" + port);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list) if (i.family === "IPv4" && !i.internal) console.log("  On your phone/Wi-Fi: http://" + i.address + ":" + port + "  (camera app upload works; live camera needs HTTPS)");
  console.log("\n  Press Ctrl+C to stop.\n");
});
server.listen(port);
