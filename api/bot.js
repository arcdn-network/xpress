const { LOCAL, FREE_BONUS_VOUCHER, FREE_DAILY_LIMIT, USE_DAILY_LIMIT } = require('../utils/constants');
const { CONFIG } = require('./utils/config');
const { getUser, updateUser } = require('../utils/api');
const { buildButtonsVoucherPlan } = require('../utils/constants');
const { getFiles, saveFileTelegram } = require('../utils/files');
const { formatDateTime, formatDateLima } = require('../utils/functions');
const { sendMessage } = require('../utils/sender');

const COOLDOWN_MS = 10000;
const COOLDOWN_MS_PLAN = COOLDOWN_MS / 2;
const cooldowns = new Map();
const enProceso = new Set();

function restantesGratis(user) {
  if (USE_DAILY_LIMIT) {
    const hoy = formatDateLima();
    const usadosHoy = user?.voucher?.dailyDate === hoy ? user.voucher.dailyUsed || 0 : 0;
    return Math.max(FREE_DAILY_LIMIT - usadosHoy, 0);
  }

  return user?.voucher?.freeQty ?? FREE_BONUS_VOUCHER;
}

function puedeUsarGratis(user) {
  return restantesGratis(user) > 0;
}

function tienePlanActivo(user) {
  if (!user?.voucher?.active) return false;
  if (!user.voucher.expiresAt) return true;
  return new Date(user.voucher.expiresAt) > new Date();
}

async function descontarUsoGratis(userId, user) {
  if (USE_DAILY_LIMIT) {
    const hoy = formatDateLima();
    const actual = user.voucher?.dailyDate === hoy ? user.voucher.dailyUsed || 0 : 0;

    await updateUser(userId, {
      voucher: {
        ...(user.voucher || {}),
        dailyDate: hoy,
        dailyUsed: actual + 1,
      },
    });

    return Math.max(FREE_DAILY_LIMIT - (actual + 1), 0);
  }

  const actual = restantesGratis(user);
  const nuevo = Math.max(actual - 1, 0);

  await updateUser(userId, {
    voucher: {
      ...(user.voucher || {}),
      freeQty: nuevo,
    },
  });

  return nuevo;
}

function textoLimiteAlcanzado() {
  return USE_DAILY_LIMIT
    ? `⏰ Alcanzaste tu límite diario.\n🚀 Adquiere el plan para uso ilimitado.`
    : `⏰ Ya agotaste tu bono gratis.\n🚀 Adquiere el plan para uso ilimitado.`;
}

function lineaEstadoGratis(restantes) {
  return USE_DAILY_LIMIT
    ? `🎟️ *Usos gratis restantes hoy:* ${restantes}/${FREE_DAILY_LIMIT}`
    : `🎟️ *Bono gratis restante:* ${restantes}`;
}

function isCooldown(userId, cooldownMs) {
  if (!cooldowns.has(userId)) return false;
  return Date.now() - cooldowns.get(userId) < cooldownMs;
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
  if (!digitos || cantidad.includes(0)) return true;
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
    const cooldownActual = esIlimitado ? COOLDOWN_MS_PLAN : COOLDOWN_MS;

    if (!esIlimitado && !puedeUsarGratis(user)) {
      const files = getFiles();

      if (files.VOUCHER_IMAGE) {
        return sendMessage(bot, chatId, {
          text: textoLimiteAlcanzado(),
          fileId: files.VOUCHER_IMAGE,
          replyMarkup: buildButtonsVoucherPlan(),
        });
      }

      const telegramResponse = await sendMessage(bot, chatId, {
        text: textoLimiteAlcanzado(),
        filePath: LOCAL.VOUCHER_IMAGE,
        replyMarkup: buildButtonsVoucherPlan(),
      });

      saveFileTelegram(telegramResponse, 'VOUCHER_IMAGE');
      return;
    }

    if (!input) return sendError();

    if (enProceso.has(userId)) {
      return bot.sendMessage(chatId, '⏳ Ya tienes un voucher generándose, espere un momento.', replyOpts);
    }

    if (isCooldown(userId, cooldownActual)) {
      const restante = Math.ceil((cooldownActual - (Date.now() - cooldowns.get(userId))) / 1000);
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

      let restantes = restantesGratis(user);
      if (!esIlimitado) {
        restantes = await descontarUsoGratis(userId, user).catch((e) => {
          console.error('Error descontando uso gratis:', e.message);
          return restantes;
        });
      }

      const lineaEstado = esIlimitado
        ? user.voucher.expiresAt
          ? `♾️ *Plan:* Ilimitado hasta ${formatDateTime(new Date(user.voucher.expiresAt))}`
          : `♾️ *Plan:* Ilimitado sin vencimiento`
        : lineaEstadoGratis(restantes);

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
  bot.onText(/\/sip(.*)/, createVoucherHandler(bot, 'sip'));
  bot.onText(/\/agora(.*)/, createVoucherHandler(bot, 'agora'));
  bot.onText(/\/prexpe(.*)/, createVoucherHandler(bot, 'prexpe'));
  bot.onText(/\/lemon(.*)/, createVoucherHandler(bot, 'lemon'));
  bot.onText(/\/bcp(.*)/, createVoucherHandler(bot, 'bcp'));
  bot.onText(/\/ibk(.*)/, createVoucherHandler(bot, 'ibk'));
  bot.onText(/\/bbva(.*)/, createVoucherHandler(bot, 'bbva'));
  bot.onText(/\/caja(.*)/, createVoucherHandler(bot, 'caja'));
  bot.onText(/\/ripley(.*)/, createVoucherHandler(bot, 'ripley'));
  bot.onText(/\/scotiabank(.*)/, createVoucherHandler(bot, 'scotiabank'));
}

module.exports = registerVoucherCommands;
