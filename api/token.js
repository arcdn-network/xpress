const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.resolve(__dirname, '../data.json');
const ADMIN_IDS = parseIdList(process.env.ADMIN_ID);

// ─── DATABASE ─────────────────────────────

function parseIdList(value) {
  return (value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// CACHE RAM
const db = loadData();

// ─── HELPERS ─────────────────────────────

function soloOwner(msg) {
  const telegramId = String(msg.from.id);
  return ADMIN_IDS.includes(telegramId);
}

function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString('es-PE');
}

// ─── MAIN ─────────────────────────────

function registerVoucherTokenCommand(bot) {
  // CREATE TOKEN
  bot.onText(/^\/create_token (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (!soloOwner(msg)) return;

    const partes = match[1].split('|').map((x) => x.trim());

    if (partes.length < 2) {
      return bot.sendMessage(chatId, '❌ Uso:\n/create_token nombre | dias | unlimited');
    }

    const [name, daysStr, unlimitedStr = 'false'] = partes;

    const unlimited = unlimitedStr.toLowerCase() === 'true';

    const days = Number(daysStr);

    if (!unlimited && (isNaN(days) || days <= 0)) {
      return bot.sendMessage(chatId, '❌ Los días deben ser un número mayor a 0');
    }

    const token = generarToken();

    const expireIn = unlimited ? 0 : Date.now() + days * 24 * 60 * 60 * 1000;

    db.push({
      token,
      name,
      expireIn,
      status: true,
      unlimited,
    });

    saveData();

    return bot.sendMessage(
      chatId,
      `✅ TOKEN CREADO\n\n` +
        `👤 Nombre: ${name}\n` +
        `📅 ${unlimited ? 'Plan: Ilimitado ♾' : `Duración: ${days} días`}\n` +
        `⏰ ${unlimited ? 'Expira: Nunca' : `Expira: ${formatDate(expireIn)}`}\n\n` +
        `🔑 TOKEN:\n\n` +
        `\`${token}\``,
      {
        parse_mode: 'Markdown',
      },
    );
  });

  // EXTENDER TOKEN
  bot.onText(/^\/extender_token (.+)/, async (msg, match) => {
    if (!soloOwner(msg)) return;

    const chatId = msg.chat.id;

    const partes = match[1].split('|').map((x) => x.trim());

    if (partes.length !== 2) {
      return bot.sendMessage(chatId, '❌ Uso:\n/extender_token TOKEN | DIAS');
    }

    const [token, daysStr] = partes;

    const days = Number(daysStr);

    if (isNaN(days) || days <= 0) {
      return bot.sendMessage(chatId, '❌ Los días deben ser un número mayor a 0');
    }

    const user = db.find((x) => x.token === token);

    if (!user) {
      return bot.sendMessage(chatId, '❌ Token no encontrado');
    }

    if (user.unlimited) {
      return bot.sendMessage(chatId, '♾ Este token es unlimited');
    }

    const baseExpire = Math.max(Date.now(), user.expireIn);

    user.expireIn = baseExpire + days * 24 * 60 * 60 * 1000;

    saveData();

    return bot.sendMessage(
      chatId,
      `✅ TOKEN EXTENDIDO\n\n` +
        `👤 Nombre: ${user.name}\n` +
        `📅 Días agregados: ${days}\n` +
        `⏰ Nueva expiración: ${formatDate(user.expireIn)}`,
    );
  });
}

module.exports = registerVoucherTokenCommand;
