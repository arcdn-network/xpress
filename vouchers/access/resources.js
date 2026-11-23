const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function readResource(directory, filename) {
  const file = path.resolve(directory, filename);
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") return fs.readFileSync(file, "utf8");
  const mime = MIME_TYPES[ext];
  if (!mime) throw new Error(`Extensión no soportada: ${ext}`);
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

module.exports = { readResource };
