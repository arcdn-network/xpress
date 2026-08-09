const puppeteer = require("puppeteer");

const DEFAULT_OPTIONS = {
  maxConcurrent: 5,
  timeoutMs: 15000,
  restartAfter: 200,
};

function createBrowserPool(launchOptions = {}, poolOptions = {}) {
  const { maxConcurrent, timeoutMs, restartAfter } = {
    ...DEFAULT_OPTIONS,
    ...poolOptions,
  };

  let browser = null;
  let useCount = 0;
  let running = 0;
  const queue = [];

  async function getBrowser() {
    const needsRestart = !browser || !browser.connected || useCount >= restartAfter;

    if (needsRestart) {
      if (browser) {
        try {
          await browser.close();
        } catch (_) {}
      }

      browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        ...launchOptions,
      });

      useCount = 0;
    }

    useCount++;
    return browser;
  }

  function withPage(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      processQueue();
    });
  }

  function processQueue() {
    if (running >= maxConcurrent || queue.length === 0) return;

    running++;
    const { fn, resolve, reject } = queue.shift();

    (async () => {
      let page = null;
      try {
        const br = await getBrowser();
        page = await br.newPage();

        const result = await Promise.race([
          fn(page),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout al generar voucher")), timeoutMs)),
        ]);

        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        if (page)
          try {
            await page.close();
          } catch (_) {}
        running--;
        processQueue();
      }
    })();
  }

  function stats() {
    return { running, queued: queue.length, useCount };
  }

  return { withPage, stats };
}

const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": null,
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
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
