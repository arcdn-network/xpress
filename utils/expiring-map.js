// For idle UI state only. Never use for in-flight operation locks.
class ExpiringMap extends Map {
  constructor({ ttlMs = 15 * 60 * 1000, maxEntries = 10000, now = Date.now } = {}) {
    super();
    if (!Number.isInteger(ttlMs) || ttlMs < 1 || !Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("Invalid expiring map limits");
    }
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.expirations = new Map();
    this.timer = setInterval(() => this.sweep(), Math.min(ttlMs, 60000));
    this.timer.unref();
  }

  set(key, value) {
    this.delete(key);
    while (this.size >= this.maxEntries) this.delete(this.keys().next().value);
    this.expirations.set(key, this.now() + this.ttlMs);
    return super.set(key, value);
  }

  has(key) {
    if (this.expirations.get(key) <= this.now()) this.delete(key);
    return super.has(key);
  }

  get(key) {
    return this.has(key) ? super.get(key) : undefined;
  }

  delete(key) {
    this.expirations.delete(key);
    return super.delete(key);
  }

  clear() {
    this.expirations.clear();
    super.clear();
  }

  sweep() {
    for (const key of this.expirations.keys()) this.has(key);
  }

  dispose() {
    clearInterval(this.timer);
    this.clear();
  }
}

module.exports = { ExpiringMap };
