const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '../../data.json');

let db = [];

// ─── LOAD DB ─────────────────────────────

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    db = [];
    return;
  }

  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    db = [];
  }
}

loadData();

// AUTO RELOAD

fs.watchFile(DATA_FILE, () => {
  loadData();
});

// ─── MIDDLEWARE ─────────────────────────────

const validateToken = (req, res, next) => {
  try {
    if (req.method !== 'POST') {
      return next();
    }

    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({
        status: false,
        message: 'TOKEN_REQUIRED',
      });
    }

    const client = db.find((x) => x.token === token);

    if (!client) {
      return res.status(403).json({
        status: false,
        message: 'TOKEN_INVALID',
      });
    }

    if (!client.status) {
      return res.status(403).json({
        status: false,
        message: 'TOKEN_DISABLED',
      });
    }

    if (!client.unlimited && Date.now() > client.expireIn) {
      return res.status(403).json({
        status: false,
        message: 'TOKEN_EXPIRED',
      });
    }

    req.client = client;

    next();
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: false,
      message: 'SERVER_ERROR',
    });
  }
};

module.exports = {
  validateToken,
};
