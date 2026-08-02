const { APP_NAME, LOCAL, FREE_BONUS_VOUCHER, FREE_DAILY_LIMIT, USE_DAILY_LIMIT } = require('../utils/constants');
const { formatDate, formatDateTime, formatDateLima } = require('../utils/functions');
const { getFiles, saveFileTelegram } = require('../utils/files');
const { getUnlimitedStatus } = require('../utils/unlimited');
const { sendMessage } = require('../utils/sender');
const { getUser } = require('../utils/api');

function registerMeCommand(bot) {
  bot.onText(/\/me/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const telegramId = msg.from.id;
      const user = await getUser(telegramId);

      if (!user) {
        return bot.sendMessage(chatId, 'No estás registrado. Usa /register');
      }

      const response = buildProfileTemplate(user, msg);
      const files = getFiles();

      if (files.TARGET_IMAGE) {
        return sendMessage(bot, chatId, {
          text: response,
          fileId: files.TARGET_IMAGE,
        });
      }

      const telegramResponse = await sendMessage(bot, chatId, {
        text: response,
        filePath: LOCAL.TARGET_IMAGE,
      });

      saveFileTelegram(telegramResponse, 'TARGET_IMAGE');
    } catch (error) {
      console.log(error);

      console.error('Error en /me:', error.message);
      await bot.sendMessage(chatId, 'Error al obtener tu información');
    }
  });
}

function getVoucherLine(user) {
  const activo = user?.voucher?.active;
  const expiresAt = user?.voucher?.expiresAt;

  if (activo && !expiresAt) {
    return `[🎫] VOUCHERS ➤ Sin vencimiento`;
  }

  if (activo && expiresAt && new Date(expiresAt) > new Date()) {
    return `[🎫] VOUCHERS ➤ Vence ${formatDateTime(expiresAt)}`;
  }

  if (USE_DAILY_LIMIT) {
    const hoy = formatDateLima();
    const usadosHoy = user?.voucher?.dailyDate === hoy ? user.voucher.dailyUsed || 0 : 0;
    const restantes = Math.max(FREE_DAILY_LIMIT - usadosHoy, 0);
    return `[🎫] VOUCHERS ➤ Gratis ${restantes}/${FREE_DAILY_LIMIT}`;
  }

  const restantes = user?.voucher?.freeQty ?? FREE_BONUS_VOUCHER;
  return `[🎫] VOUCHERS ➤ Gratis ${restantes}`;
}

function buildProfileTemplate(user, msg) {
  const unlimitedStatus = getUnlimitedStatus(user);

  const creditosLine = unlimitedStatus.isUnlimited
    ? unlimitedStatus.expiresAt
      ? `[♾️] ILIMITADO ➤ ${formatDateTime(unlimitedStatus.expiresAt)}`
      : `[♾️] ILIMITADO ➤ Sin vencimiento`
    : `[💰] CREDITOS ➤ ${user.credits}`;

  const voucherLine = getVoucherLine(user);
  const estadoLine = `[👾] ESTADO ➤ ${user.status === 'activo' ? 'ACTIVO' : 'NO ACTIVO'}`;
  const registradoLine = `[📅] REGISTRADO ➤ ${formatDate(user.registeredAt)}`;

  const bottomLines = unlimitedStatus.isUnlimited
    ? `${estadoLine}\n${registradoLine}\n${creditosLine}\n${voucherLine}`
    : `${registradoLine}\n${estadoLine}\n${creditosLine}\n${voucherLine}`;

  return `
<b>[#${APP_NAME}]</b> <b>PERFIL DE USUARIO</b>
- ···························•····························•
➤ <b>INFORMACIÓN DE USUARIO</b>

[🙎‍♂️] ID ➤ <code>${user.telegramId}</code>
[🗒] NOMBRE ➤ ${msg.from.first_name || 'No disponible'}
[⚡] USERNAME ➤ ${user.username ? '@' + user.username : 'Sin username'}

${bottomLines}
- ···························•····························•
`.trim();
}

module.exports = registerMeCommand;
