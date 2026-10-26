const TEMPORARY_MESSAGE = "El servicio está temporalmente ocupado. Inténtalo nuevamente en unos momentos.";

function isTransient(error) {
  const status = error.response?.status;
  if ([502, 503, 504].includes(status)) return true;
  if (status === 500) {
    return /buffering timed out|server selection timed out/i.test(String(error.response?.data?.msg || ""));
  }
  return !error.response && ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ECONNREFUSED", "ERR_NETWORK"].includes(error.code);
}

function unavailable(cause) {
  const error = new Error(TEMPORARY_MESSAGE, { cause });
  error.code = "BACKEND_UNAVAILABLE";
  return error;
}

// Only explicitly selected, read-only endpoints use this policy. Writes never retry.
function createBackendReader(client, { now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), logger = console } = {}) {
  let failures = 0;
  let openUntil = 0;
  let probing = false;
  return async function read(url, config = {}) {
    if (openUntil && (now() < openUntil || probing)) throw unavailable();
    const probe = openUntil !== 0;
    if (probe) probing = true;
    const deadline = now() + 25000;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const remaining = deadline - now();
          if (remaining <= 0) throw unavailable();
          const response = await client.get(url, {
            ...config,
            timeout: Math.min(12000, remaining),
            signal: AbortSignal.timeout(remaining),
          });
          if (!openUntil || probe) {
            if (probe) logger.info("[Backend] Consultas recuperadas");
            failures = 0;
            openUntil = 0;
          }
          return response;
        } catch (error) {
          if (!isTransient(error) && error.code !== "ERR_CANCELED" && error.code !== "BACKEND_UNAVAILABLE") {
            // A valid HTTP response (including 404) ends an outage probe.
            if (probe || !openUntil) {
              failures = 0;
              openUntil = 0;
            }
            throw error;
          }
          if (attempt === 0 && !probe && !openUntil && deadline - now() > 1000) {
            await sleep(1000);
            if (!openUntil) continue;
          }
          failures += 1;
          if (probe || failures >= 3) {
            if (!openUntil || probe) logger.warn("[Backend] Consultas pausadas durante 20s por fallos repetidos");
            openUntil = now() + 20000;
          }
          throw unavailable(error);
        }
      }
    } finally {
      if (probe) probing = false;
    }
  };
}

module.exports = { createBackendReader, isTransient, TEMPORARY_MESSAGE };
