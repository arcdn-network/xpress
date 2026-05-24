const { generateVoucher: generateYape } = require('../services/yape');
const { generateVoucher: generatePlin } = require('../services/plin');
const { generateVoucher: generateAgora } = require('../services/agora');
const { generateVoucher: generateBim } = require('../services/bim');
const { generateVoucher: generateBcp } = require('../services/bcp');
const { generateVoucher: generateIbk } = require('../services/ibk');

const COOLDOWN_MS = 10000;
const cooldowns = new Map();
const enProceso = new Set();

function buildErrorMsg(comando, ejemplos) {
  const ejs = ejemplos.map((e) => `\`\`\`\n/${comando} ${e}\n\`\`\``).join('\n');
  return `⚠️ *Formato incorrecto.*
Debes proporcionar: El monto, titular y los últimos 3 dígitos.
Puedes ingresar texto (opcional) y destino (opcional).
✅ *Ejemplo de uso:*
${ejs}`;
}

const CONFIG = {
  yape: {
    service: generateYape,
    destinoDefault: 'Yape',
    digitosRegex: /^\d{3}$/,
    errorMsg: buildErrorMsg('yape', ['150|Pedro Cas*|987', '150|Pedro Cas*|987|Texto de la operación|Plin']),
  },
  plin: {
    service: generatePlin,
    destinoDefault: 'Plin',
    digitosRegex: /^\d{3}$/,
    errorMsg: buildErrorMsg('plin', ['150|Pedro Cas*|987', '150|Pedro Cas*|987|Yape']),
  },
  agora: {
    service: generateAgora,
    destinoDefault: 'AGORA/OH!',
    digitosRegex: /^\d{9}$/,
    errorMsg: buildErrorMsg('agora', ['150|PEDRO CASTILLO|987654321', '150|IZI* COMERCIO']),
  },
  bim: {
    service: generateBim,
    destinoDefault: 'YAPE',
    digitosRegex: /^\d{3}$/,
    errorMsg: buildErrorMsg('bim', ['150|Pedro Cas*|987', '150|Pedro Cas*|987|Texto del comentario|Yape']),
  },
  bcp: {
    service: generateBcp,
    destinoDefault: 'BCP',
    digitosRegex: /^\d{3}$/,
    errorMsg: buildErrorMsg('bcp', ['150|Carlos Diaz*|653', '150|Carlos Diaz*|653|Yape']),
  },
  ibk: {
    service: generateIbk,
    destinoDefault: 'Plin',
    digitosRegex: /^\d{9}$/,
    errorMsg: buildErrorMsg('ibk', ['150|Pedro Castillo|987654321', '150|Pedro Castillo|987654321|Yape']),
  },
};

const MSG_HORARIO = '🕙 *El servicio de vouchers está disponible de 8:00 a.m. a 10:00 p.m.*';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isDentroDeHorario() {
  const hora = new Date().getHours();
  return hora >= 8 && hora < 22;
}

function isCooldown(userId) {
  if (!cooldowns.has(userId)) return false;
  return Date.now() - cooldowns.get(userId) < COOLDOWN_MS;
}

function setCooldown(userId) {
  cooldowns.set(userId, Date.now());
}

function formatFechaFilename() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, '0');
  const mes = (now.getMonth() + 1).toString().padStart(2, '0');
  const anio = now.getFullYear().toString().slice(-2);
  return `${dia}${mes}${anio}`;
}

// ─── Handler genérico ─────────────────────────────────────────────────────────
function createVoucherHandler(bot, comando) {
  const { service, destinoDefault, errorMsg, digitosRegex } = CONFIG[comando];

  return async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1].trim();

    const replyOpts = {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
    };

    const sendError = () => bot.sendMessage(chatId, errorMsg, replyOpts);

    if (!input) return sendError();

    if (enProceso.has(userId)) {
      return bot.sendMessage(chatId, '⏳ Ya tienes un voucher generándose, espere un momento.', replyOpts);
    }

    if (isCooldown(userId)) {
      const restante = Math.ceil((COOLDOWN_MS - (Date.now() - cooldowns.get(userId))) / 1000);
      return bot.sendMessage(chatId, `⏳ Espera *${restante} segundos* antes de generar otro voucher.`, replyOpts);
    }

    const args = input.split('|').map((a) => a.trim());

    if (args.length < 2 || args.length > 5) return sendError();

    const [monto, nombre, digitos, mensaje = '', destino = destinoDefault] = args;

    if (!monto || !/^\d+(\.\d{1,2})?$/.test(monto)) return sendError();
    if (!nombre) return sendError();
    if (digitos && !digitosRegex.test(digitos)) return sendError();

    if (!isDentroDeHorario()) {
      return bot.sendMessage(chatId, MSG_HORARIO, replyOpts);
    }

    enProceso.add(userId);
    const loading = await bot.sendMessage(chatId, '⏳ Generando voucher...');

    try {
      const { buffer } = await service({ monto, nombre, digitos, mensaje, destino });

      setCooldown(userId);
      await bot.deleteMessage(chatId, loading.message_id);
      await bot.sendDocument(
        chatId,
        buffer,
        { reply_to_message_id: msg.message_id },
        { filename: `Screenshot_${formatFechaFilename()}.png`, contentType: 'image/png' },
      );
    } catch (error) {
      console.error(`Error en /${comando}:`, error.message);
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      await bot.sendMessage(chatId, '❌ Error al generar el voucher', replyOpts);
    } finally {
      enProceso.delete(userId);
    }
  };
}

// ─── Registro de comandos ─────────────────────────────────────────────────────

function registerVoucherCommands(bot) {
  bot.onText(/\/yape(.*)/, createVoucherHandler(bot, 'yape'));
  bot.onText(/\/plin(.*)/, createVoucherHandler(bot, 'plin'));
  bot.onText(/\/agora(.*)/, createVoucherHandler(bot, 'agora'));
  bot.onText(/\/bim(.*)/, createVoucherHandler(bot, 'bim'));
  bot.onText(/\/bcp(.*)/, createVoucherHandler(bot, 'bcp'));
  bot.onText(/\/ibk(.*)/, createVoucherHandler(bot, 'ibk'));
}

module.exports = registerVoucherCommands;
