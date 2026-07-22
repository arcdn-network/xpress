const isAdmin = require('../middleware/isAdmin');
const { getUser, updateUser } = require('../utils/api');
const { formatDateTime } = require('../utils/functions');

const DAY_MS = 24 * 60 * 60 * 1000;

function registerDiasCommand(bot) {
  bot.onText(/\/dias (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const requesterId = msg.from.id;
    const input = match[1].trim();

    try {
      const permitido = await isAdmin(requesterId);

      if (!permitido) {
        return bot.sendMessage(chatId, '❌ No tienes permisos para usar este comando.');
      }

      const parts = input.split('|').map((p) => p.trim());

      if (parts.length !== 2) {
        return bot.sendMessage(chatId, '❌ Formato inválido. Usa:\n/dias telegramId|dias\n\nEj: /dias 123456789|30');
      }

      const [targetIdRaw, diasRaw] = parts;
      const targetId = Number(targetIdRaw);
      const dias = Number(diasRaw);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        return bot.sendMessage(chatId, '❌ El telegramId ingresado no es válido.');
      }

      if (!Number.isInteger(dias) || dias === 0) {
        return bot.sendMessage(chatId, '❌ La cantidad de días debe ser un número entero distinto de 0.');
      }

      const targetUser = await getUser(targetId);

      if (!targetUser) {
        return bot.sendMessage(chatId, '❌ Ese usuario no está registrado.');
      }

      const now = new Date();
      const currentExpiresAt = targetUser.voucher?.expiresAt ? new Date(targetUser.voucher.expiresAt) : null;
      const baseDate = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
      const newExpiresAt = new Date(baseDate.getTime() + dias * DAY_MS);

      await updateUser(targetId, {
        voucher: {
          ...(targetUser.voucher || {}),
          active: newExpiresAt > now,
          expiresAt: newExpiresAt,
        },
      });

      const displayName = targetUser.username ? `@${targetUser.username}` : `ID ${targetId}`;

      await bot.sendMessage(
        chatId,
        `✅ *Días de vouchers actualizados*\n\n` +
          `👤 Usuario ➣ ${displayName}\n` +
          `${dias > 0 ? '➕' : '➖'} Días ${dias > 0 ? 'agregados' : 'quitados'} ➣ ${Math.abs(dias)}\n` +
          `📅 Vence el ➣ ${formatDateTime(newExpiresAt)}`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      console.error('Error en /dias:', error.message);
      await bot.sendMessage(chatId, '❌ Ocurrió un error al procesar el comando.');
    }
  });
}

module.exports = registerDiasCommand;
