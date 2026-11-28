const fs = require("node:fs");
const path = require("node:path");

const { prepareMacDownload, renderPage } = require("./mac-download.cjs");
async function build() {
  const forVercel = process.argv.includes("--vercel");
  const output = path.resolve(
    __dirname,
    forVercel ? "../dist/vercel-marketing" : "../dist/marketing",
  );
  fs.mkdirSync(output, { recursive: true });
  const macUrl = await prepareMacDownload(forVercel ? undefined : output, {
    hosted: forVercel,
  });
  const page = renderPage(macUrl);
  for (const file of ["index.html", "sea-glass.html"]) {
    fs.writeFileSync(path.join(output, file), page);
  }
  for (const file of ["styles.css", "script.js"]) {
    fs.copyFileSync(path.join(__dirname, file), path.join(output, file));
  }
  const assets = [
    "display.woff2",
    "display-license.txt",
    "sans.woff2",
    "sans-license.txt",
    "icon.png",
  ];
  fs.mkdirSync(path.join(output, "assets"), { recursive: true });
  for (const file of assets) {
    fs.copyFileSync(
      path.join(__dirname, "assets", file),
      path.join(output, "assets", file),
    );
  }
  for (const directory of ["sea-glass", "moments"]) {
    fs.cpSync(
      path.join(__dirname, "assets", directory),
      path.join(output, "assets", directory),
      { recursive: true },
    );
  }
}
build().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
