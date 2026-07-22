const { CONFIG } = require('./utils/config');
const { getUser, updateUser } = require('../utils/api');
const { buildButtonsVoucherPlan, LOCAL } = require('../utils/constants');
const { formatDateTime } = require('../utils/functions');
const { sendMessage } = require('../utils/sender');
const { getFiles, saveFileTelegram } = require('../utils/files');

const COOLDOWN_MS = 10000;
const FREE_DAILY_LIMIT = 3;
const cooldowns = new Map();
const enProceso = new Set();

function getTodayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function usosGratisHoy(user) {
  const hoy = getTodayStr();
  if (!user?.voucher || user.voucher.dailyDate !== hoy) return 0;
  return user.voucher.dailyUsed || 0;
}

function puedeUsarGratis(user) {
  return usosGratisHoy(user) < FREE_DAILY_LIMIT;
}

function tienePlanActivo(user) {
  return !!(user?.voucher?.active && user.voucher.expiresAt && new Date(user.voucher.expiresAt) > new Date());
}

async function registrarUsoGratis(userId, user) {
  const hoy = getTodayStr();
  const actual = user.voucher?.dailyDate === hoy ? user.voucher.dailyUsed || 0 : 0;
  await updateUser(userId, {
    voucher: {
      ...(user.voucher || {}),
      dailyDate: hoy,
      dailyUsed: actual + 1,
    },
  });
}

function isCooldown(userId) {
  if (!cooldowns.has(userId)) return false;
  return Date.now() - cooldowns.get(userId) < COOLDOWN_MS;
}

function setCooldown(userId) {
  cooldowns.set(userId, Date.now());
}

function escapeMd(text) {
  return String(text).replace(/[_*`\[]/g, '\\$&');
}

function formatFechaFilename() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, '0');
  const mes = (now.getMonth() + 1).toString().padStart(2, '0');
  const anio = now.getFullYear().toString().slice(-2);
  return `${dia}${mes}${anio}`;
}

function validarDigitos(digitos, cantidad) {
  if (!digitos) return true;
  const regex = new RegExp(`^(${cantidad.map((n) => `\\d{${n}}`).join('|')})$`);
  return regex.test(String(digitos));
}

function createVoucherHandler(bot, comando) {
  const { service, destinoDefault, errorMsg, cantidad } = CONFIG[comando];

  return async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1].trim();

    const replyOpts = {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
    };

    if (msg.chat.type !== 'private') {
      return bot.sendMessage(chatId, '❌ Este comando solo está disponible en chat privado.', replyOpts);
    }

    const sendError = () => bot.sendMessage(chatId, errorMsg, replyOpts);

    const user = await getUser(userId);
    const esIlimitado = tienePlanActivo(user);

    if (!esIlimitado && !puedeUsarGratis(user)) {
      const textoLimite = `⏰ Alcanzaste tu límite diario.\n🚀 Adquiere el plan para uso ilimitado.`;
      const files = getFiles();

      if (files.VOUCHERT_IMAGE) {
        return sendMessage(bot, chatId, {
          text: textoLimite,
          fileId: files.VOUCHERT_IMAGE,
          replyMarkup: buildButtonsVoucherPlan(),
        });
      }

      const telegramResponse = await sendMessage(bot, chatId, {
        text: textoLimite,
        filePath: LOCAL.VOUCHERT_IMAGE,
        replyMarkup: buildButtonsVoucherPlan(),
      });

      saveFileTelegram(telegramResponse, 'VOUCHERT_IMAGE');
      return;
    }

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
    if (!validarDigitos(digitos, cantidad)) return sendError();

    enProceso.add(userId);
    const loading = await bot.sendMessage(chatId, '⏳ Generando voucher...', {
      reply_to_message_id: msg.message_id,
    });

    try {
      const base64 = await service({ monto, nombre, digitos, mensaje, destino });
      const buffer = Buffer.from(base64, 'base64');

      setCooldown(userId);

      if (!esIlimitado) {
        await registrarUsoGratis(userId, user).catch((e) => console.error('Error registrando uso gratis:', e.message));
      }

      const restantes = FREE_DAILY_LIMIT - (usosGratisHoy(user) + 1);

      const lineaEstado = esIlimitado
        ? `♾️ *Plan:* Ilimitado hasta ${formatDateTime(new Date(user.voucher.expiresAt))}`
        : `🎟️ *Usos gratis restantes hoy:* ${Math.max(restantes, 0)}/${FREE_DAILY_LIMIT}`;

      await bot.deleteMessage(chatId, loading.message_id);
      await bot.sendDocument(
        chatId,
        buffer,
        {
          reply_to_message_id: msg.message_id,
          caption: [
            `✅ *Voucher ${comando.charAt(0).toUpperCase() + comando.slice(1)} generado*`,
            ``,
            `💰 *Monto:* S/ ${escapeMd(monto)}`,
            `👤 *Titular:* ${escapeMd(nombre)}`,
            ...(digitos ? [`🔢 *Dígitos:* ${escapeMd(digitos)}`] : []),
            ...(mensaje ? [`💬 *Mensaje:* ${escapeMd(mensaje)}`] : []),
            ``,
            lineaEstado,
          ].join('\n'),
          parse_mode: 'Markdown',
        },
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

function registerVoucherCommands(bot) {
  bot.onText(/\/yape(.*)/, createVoucherHandler(bot, 'yape'));
  bot.onText(/\/plin(.*)/, createVoucherHandler(bot, 'plin'));
  bot.onText(/\/bim(.*)/, createVoucherHandler(bot, 'bim'));
  bot.onText(/\/agora(.*)/, createVoucherHandler(bot, 'agora'));
  bot.onText(/\/lemon(.*)/, createVoucherHandler(bot, 'lemon'));
  bot.onText(/\/bcp(.*)/, createVoucherHandler(bot, 'bcp'));
  bot.onText(/\/ibk(.*)/, createVoucherHandler(bot, 'ibk'));
  bot.onText(/\/bbva(.*)/, createVoucherHandler(bot, 'bbva'));
  bot.onText(/\/scotiabank(.*)/, createVoucherHandler(bot, 'scotiabank'));
  bot.onText(/\/caja(.*)/, createVoucherHandler(bot, 'caja'));
}

module.exports = registerVoucherCommands;
