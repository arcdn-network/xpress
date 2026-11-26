function bounded(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function buildPool(puppeteer, launchOptions = {}, options = {}) {
  const settings = { maxConcurrent: 3, maxQueue: 30, queueTimeoutMs: 20000, timeoutMs: 15000, closeTimeoutMs: 5000, restartAfter: 200, ...options };

  for (const [key, value] of Object.entries(settings)) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid pool option: ${key}`);
  }

  // Never attach to an existing browser or use an external persistent profile.
  if (
    launchOptions.userDataDir ||
    launchOptions.browserWSEndpoint ||
    launchOptions.browserURL ||
    launchOptions.args?.some((arg) => /--user-data-dir|--profile-directory|--remote-debugging/i.test(arg))
  ) {
    throw new Error("Xpress requiere un navegador con perfil temporal propio");
  }
  let browser, launching, maintenance, recoveryTimer;
  let running = 0,
    useCount = 0,
    dirty = false,
    stopped = false;
  const queue = [];

  function rejectQueue(error) {
    for (const job of queue.splice(0)) {
      clearTimeout(job.timer);
      job.reject(error);
    }
  }

  async function acquire() {
    if (browser) return browser;
    if (!launching) {
      launching = puppeteer
        .launch({
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
          ...launchOptions,
          timeout: settings.timeoutMs,
          protocolTimeout: settings.timeoutMs,
        })
        .then((value) => {
          browser = value;
          return value;
        })
        .finally(() => {
          launching = null;
        });
    }
    return launching;
  }

  async function retire() {
    // Only this instance, returned by our own launch(), can be closed.
    if (launching) await launching.catch(() => {});
    if (browser) {
      await bounded(browser.close(), settings.closeTimeoutMs, "No se pudo cerrar el navegador propio de Xpress");
      browser = null;
    }
    dirty = false;
    useCount = 0;
  }

  function pump() {
    if (maintenance || recoveryTimer) return;
    if (browser && !browser.connected) dirty = true;
    if (dirty || useCount >= settings.restartAfter || stopped) {
      if (running) return;
      maintenance = retire()
        .catch((error) => {
          // Retain ownership and retry closure; never launch a second browser
          // while the first one's closure is unconfirmed.
          dirty = true;
          rejectQueue(error);
          console.error("[Xpress browser]", error.message);
          if (!stopped) {
            recoveryTimer = setTimeout(() => {
              recoveryTimer = null;
              pump();
            }, settings.closeTimeoutMs);
            recoveryTimer.unref();
          }
        })
        .finally(() => {
          maintenance = null;
          if (!stopped) pump();
        });
      return;
    }
    while (running < settings.maxConcurrent && queue.length && useCount < settings.restartAfter) {
      const job = queue.shift();
      clearTimeout(job.timer);
      running++;
      useCount++;
      void run(job);
    }
  }

  async function run(job) {
    let page,
      expired = false,
      result,
      failure;
    const work = (async () => {
      const owned = await acquire();
      if (expired) return;
      const created = await owned.newPage();
      if (expired) {
        await bounded(created.close(), settings.closeTimeoutMs, "Timeout cerrando página tardía").catch(() => {
          dirty = true;
        });
        return;
      }
      page = created;
      return job.fn(page);
    })();
    try {
      result = await bounded(work, settings.timeoutMs, "Timeout al generar voucher");
    } catch (error) {
      failure = error;
      dirty = true;
    } finally {
      expired = true;
      if (page) {
        try {
          await bounded(page.close(), settings.closeTimeoutMs, "Timeout cerrando página");
        } catch (error) {
          dirty = true;
          failure ||= error;
        }
      }
      running--;
      if (failure) job.reject(failure);
      else job.resolve(result);
      pump();
    }
  }

  return {
    withPage(fn) {
      if (stopped) return Promise.reject(new Error("Pool de Xpress detenido"));
      if (queue.length >= settings.maxQueue) return Promise.reject(new Error("Servidor ocupado. Inténtalo en unos momentos."));
      return new Promise((resolve, reject) => {
        const job = { fn, resolve, reject };
        job.timer = setTimeout(() => {
          const index = queue.indexOf(job);
          if (index !== -1) queue.splice(index, 1);
          reject(new Error("Tiempo de espera agotado en la cola de Xpress"));
        }, settings.queueTimeoutMs);
        queue.push(job);
        pump();
      });
    },
    stats: () => ({ running, queued: queue.length, useCount, stopped, recycling: !!maintenance }),
    async close() {
      stopped = true;
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
      rejectQueue(new Error("Pool de Xpress detenido"));
      // Active jobs retain their browser until their own bounded cleanup finishes.
      while (running) await new Promise((resolve) => setTimeout(resolve, 10));
      if (maintenance) await maintenance;
      else await retire();
    },
  };
}

module.exports = { buildPool };
