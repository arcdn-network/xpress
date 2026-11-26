const puppeteer = require("puppeteer");
const { buildPool } = require("./browser-pool");
const { protectScreenshots } = require("./watermark");

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
    const withPage = sharedPool.withPage.bind(sharedPool);
    sharedPool.withPage = (fn) => withPage((page) => fn(protectScreenshots(page)));
    sharedConfiguration = configuration;
  }
  return sharedPool;
}

module.exports = { createBrowserPool };
