const { generateVoucher } = require('../services/plin');

const COOLDOWN_MS = 10000;
const cooldowns = new Map();
const enProceso = new Set();

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

function getPlinErrorMsg() {
  return `⚠️ *Formato incorrecto.*
Debes proporcionar: El monto, titular y los últimos 3 dígitos.
El destino es opcional.

✅ *Ejemplo de uso:*
\`\`\`
/plin 150|Pedro Cas*|987
\`\`\`
\`\`\`
/plin 150|Pedro Cas*|987|Yape
\`\`\``;
}

function registerPlinCommand(bot) {
  bot.onText(/\/plin(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1].trim();

    const replyOpts = {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
    };

    const sendError = () => bot.sendMessage(chatId, getPlinErrorMsg(), replyOpts);

    if (!input) {
      return sendError();
    }

    if (enProceso.has(userId)) {
      return bot.sendMessage(chatId, '⏳ Ya tienes un voucher generándose, espere un momento.', replyOpts);
    }

    if (isCooldown(userId)) {
      const restante = Math.ceil((COOLDOWN_MS - (Date.now() - cooldowns.get(userId))) / 1000);
      return bot.sendMessage(chatId, `⏳ Espera *${restante} segundos* antes de generar otro voucher.`, replyOpts);
    }

    const args = input.split('|');

    if (args.length < 2 || args.length > 4) {
      return sendError();
    }

    const [monto, nombre, digitos, destino = 'Plin'] = args.map((a) => a.trim());

    if (!monto || !/^\d+(\.\d{1,2})?$/.test(monto)) {
      return sendError();
    }

    if (!nombre) {
      return sendError();
    }

    if (digitos && !/^\d{3}$/.test(digitos)) {
      return sendError();
    }

    if (!isDentroDeHorario()) {
      return bot.sendMessage(
        chatId,
        '🕙 *El servicio de vouchers está disponible de 8:00 a.m. a 10:00 p.m.*',
        replyOpts,
      );
    }

    enProceso.add(userId);
    const loading = await bot.sendMessage(chatId, '⏳ Generando voucher...');

    try {
      const { buffer } = await generateVoucher({ monto, nombre, digitos, destino });

      setCooldown(userId);
      await bot.deleteMessage(chatId, loading.message_id);

      await bot.sendDocument(
        chatId,
        buffer,
        { reply_to_message_id: msg.message_id },
        { filename: `Screenshot_${formatFechaFilename()}.png`, contentType: 'image/png' },
      );
    } catch (error) {
      console.error('Error en /plin:', error.message);
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      await bot.sendMessage(chatId, '❌ Error al generar el voucher', replyOpts);
    } finally {
      enProceso.delete(userId);
    }
  });
}

module.exports = registerPlinCommand;
