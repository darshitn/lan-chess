// Lightweight zero-dependency static server for previewing site/
const http = require("http");
const fs = require("fs");
const path = require("path");

const {
  downloadPath,
  prepareMacDownload,
  renderPage,
  source,
} = require("./mac-download.cjs");

const PORT = process.env.PORT || 5050;
const SITE_DIR = __dirname;

let macUrl;

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split("?")[0]);
  if (reqPath === "/") reqPath = "/index.html";

  if (reqPath === "/index.html" || reqPath === "/sea-glass.html") {
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[".html"],
      "Cache-Control": "no-cache",
    });
    return res.end(req.method === "HEAD" ? undefined : renderPage(macUrl));
  }
  if (reqPath === "/" + downloadPath) {
    if (macUrl !== downloadPath) {
      res.writeHead(302, { Location: macUrl });
      return res.end();
    }
    const diskImage = source;
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition":
        'attachment; filename="' + path.basename(diskImage) + '"',
      "Content-Length": fs.statSync(diskImage).size,
    });
    if (req.method === "HEAD") return res.end();
    const stream = fs.createReadStream(diskImage);
    res.on("close", () => stream.destroy());
    return stream.pipe(res);
  }
  const filePath = path.join(SITE_DIR, reqPath);

  // Security check: ensure path is within SITE_DIR
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": "no-cache",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

prepareMacDownload()
  .then((url) => {
    macUrl = url;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(
        `LAN Chess site preview server running at http://localhost:${PORT}/`,
      );
    });
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
