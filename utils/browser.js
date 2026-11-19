const puppeteer = require("puppeteer");
const { buildPool } = require("./browser-pool");

// All services in this Node process share one browser and one concurrency limit.
let sharedPool;
let sharedConfiguration;
function createBrowserPool(launchOptions = {}, poolOptions = {}) {
  const configuration = JSON.stringify([launchOptions, poolOptions]);
  if (sharedPool && configuration !== sharedConfiguration) {
    throw new Error("Todos los servicios de Xpress deben compartir la configuración del navegador");
  }
  if (!sharedPool) {
    sharedPool = buildPool(puppeteer, launchOptions, poolOptions);
    sharedConfiguration = configuration;
  }
  return sharedPool;
}

const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": null,
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const readResource = (specifier) => {
  const filePath = require.resolve(specifier);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext];

  if (mimeType === undefined) {
    throw new Error(`Extensión no soportada: ${ext}`);
  }
  if (mimeType === null) {
    return fs.readFileSync(filePath, "utf-8");
  }

  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${base64}`;
};

module.exports = { createBrowserPool, readResource };
