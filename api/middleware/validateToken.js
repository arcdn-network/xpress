const fs = require('fs');
const path = require('path');
const { formatShortDateTime } = require('../../utils/functions');
const { APP_USERNAME } = require('../../utils/constants');

const DATA_FILE = path.resolve(__dirname, '../../data.json');
const DETAILS = `Contáctame en Telegram @${APP_USERNAME}.`;

let db = [];
let globalTokenDisabled = false;

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

fs.watchFile(DATA_FILE, () => {
  loadData();
});

function buildExpiracion(client) {
  return client.unlimited ? 'Ilimitado' : formatShortDateTime(client.expireIn);
}

const validateToken = (req, res, next) => {
  try {
    if (req.method !== 'POST') {
      return next();
    }

    const token = req.headers['x-token'];

    if (globalTokenDisabled) {
      return res.status(503).json({ status: false, message: 'Servicio en mantenimiento.' });
    }

    if (!token) {
      return res.status(401).json({ status: false, message: 'Debes ingresar tu x-token', details: DETAILS });
    }

    const client = db.find((x) => x.token === token);

    if (!client) {
      return res.status(403).json({ status: false, message: 'Token inválido' });
    }

    if (!client.status) {
      return res.status(403).json({ status: false, message: 'Token desactivado' });
    }

    if (!client.unlimited && Date.now() > client.expireIn) {
      return res.status(403).json({
        status: false,
        expires: formatShortDateTime(client.expireIn),
        message: 'Token expirado',
        details: DETAILS,
      });
    }

    req.client = client;
    req.expire = buildExpiracion(client);

    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: 'SERVER_ERROR' });
  }
};

module.exports = {
  validateToken,
};
