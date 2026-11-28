const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const fileName = "LAN-Chess-1.2.4-mac-universal.dmg";
const downloadPath = "downloads/" + fileName;
const checksum =
  "eb79c179583b29811010a8afe1a2d0a39af0aaa6a6610e41702959aec5c11891";
const source = path.resolve(__dirname, "../release", fileName);

// A packaged site carries its own installer. Source-only builds can use a
// permanent release URL or the public build page until a DMG is published.
const previewBuild =
  "https://github.com/darshitn/lan-chess/actions/runs/45443792966#artifacts";
async function prepareMacDownload(output, { hosted = false } = {}) {
  if (process.env.LAN_CHESS_MAC_DOWNLOAD_URL) {
    const url = new URL(process.env.LAN_CHESS_MAC_DOWNLOAD_URL);
    if (url.protocol !== "https:")
      throw new Error("Mac download URL must use HTTPS.");
    return url.href;
  }
  if (hosted || !fs.existsSync(source)) {
    try {
      const response = await fetch(
        "https://api.github.com/repos/darshitn/lan-chess/releases/tags/v1.2.4",
        {
          headers: { "User-Agent": "LAN-Chess-site-build" },
          signal: AbortSignal.timeout(6000),
        },
      );
      if (response.ok) {
        const release = await response.json();
        const installer = release.assets.find(
          (asset) =>
            asset.name === fileName && asset.digest === "sha256:" + checksum,
        );
        if (installer) return installer.browser_download_url;
      }
    } catch (error) {
      console.warn("Mac release lookup unavailable:", error.message);
    }
    if (hosted) {
      console.warn(
        "Mac installer is using the GitHub Actions preview. Set LAN_CHESS_MAC_DOWNLOAD_URL to a public HTTPS DMG URL for direct downloads.",
      );
    }
    return previewBuild;
  }
  const digest = crypto.createHash("sha256");
  const fd = fs.openSync(source, "r");
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let count;
    while ((count = fs.readSync(fd, buffer)) > 0)
      digest.update(buffer.subarray(0, count));
  } finally {
    fs.closeSync(fd);
  }
  if (digest.digest("hex") !== checksum)
    throw new Error("Unexpected Mac installer checksum.");
  if (!output) return downloadPath;
  const destination = path.join(output, downloadPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return downloadPath;
}

function renderPage(macUrl) {
  let page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  if (macUrl !== downloadPath) {
    page = page.replaceAll(
      /(href="downloads\/LAN-Chess-1\.2\.4-mac-universal\.dmg")\s+download\b/g,
      "$1",
    );
  }
  if (macUrl === previewBuild) {
    page = page
      .replaceAll("Download for macOS", "Get Mac preview on GitHub")
      .replace("Mac universal preview", "Mac preview · GitHub sign-in")
      .replace(
        "Universal preview · DMG · 226 MiB",
        "Build artifacts · GitHub sign-in required",
      )
      .replace(
        "Mac preview for Intel",
        "Mac preview (GitHub sign-in) for Intel",
      );
  }
  return page.replaceAll(downloadPath, () =>
    macUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;"),
  );
}

module.exports = { downloadPath, prepareMacDownload, renderPage, source };
