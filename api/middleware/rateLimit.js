const rateLimit = require('express-rate-limit');

const hourLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  message: {
    status: false,
    message: 'RATE_LIMIT_HOUR',
  },
});

const dayLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  message: {
    status: false,
    message: 'RATE_LIMIT_DAY',
  },
});

module.exports = { hourLimiter, dayLimiter };
