const isAdmin = require('../middleware/isAdmin');
const { getUser, updateUser } = require('../utils/api');
const { formatDateTime } = require('../utils/functions');

const DAY_MS = 24 * 60 * 60 * 1000;

function buildLineaDias(dias) {
  return `${dias > 0 ? '➕' : '➖'} Días ${dias > 0 ? 'agregados' : 'quitados'} ➣ ${Math.abs(dias)}`;
}

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
        return bot.sendMessage(
          chatId,
          '❌ Formato inválido, debes usar:\n' +
            '/dias telegramId|30\n' +
            '/dias telegramId|ilimitado\n' +
            '/dias telegramId|off',
        );
      }

      const [targetIdRaw, valueRaw] = parts;
      const targetId = Number(targetIdRaw);
      const value = valueRaw.toLowerCase();

      if (!Number.isInteger(targetId) || targetId <= 0) {
        return bot.sendMessage(chatId, '❌ El telegramId ingresado no es válido.');
      }

      const targetUser = await getUser(targetId);

      if (!targetUser) {
        return bot.sendMessage(chatId, '❌ Ese usuario no está registrado.');
      }

      const displayName = targetUser.username ? `@${targetUser.username}` : `ID ${targetId}`;

      // --- Caso OFF: desactivar voucher ---
      if (value === 'off') {
        await updateUser(targetId, {
          voucher: {
            ...(targetUser.voucher || {}),
            active: false,
            expiresAt: null,
          },
        });

        await bot.sendMessage(chatId, `✅ <b>Plan de Voucher desactivado</b>\n\n👤 Usuario ➣ ${displayName}`, {
          parse_mode: 'HTML',
        });

        try {
          await bot.sendMessage(targetId, `⚠️ <b>Tu Plan de Voucher fue desactivado</b>`, { parse_mode: 'HTML' });
        } catch (notifyError) {
          console.error(`No se pudo notificar al usuario ${targetId}:`, notifyError.message);
          await bot.sendMessage(chatId, `⚠️ No se pudo notificar al cliente (posiblemente bloqueó el bot).`);
        }

        return;
      }

      // --- Caso ILIMITADO: sin vencimiento ---
      if (value === 'ilimitado') {
        await updateUser(targetId, {
          voucher: {
            ...(targetUser.voucher || {}),
            active: true,
            expiresAt: null,
          },
        });

        await bot.sendMessage(
          chatId,
          `✅ <b>Plan de Voucher ilimitado activado</b>\n\n` +
            `👤 Usuario ➣ ${displayName}\n` +
            `♾️ Vencimiento ➣ Sin vencimiento`,
          { parse_mode: 'HTML' },
        );

        try {
          await bot.sendMessage(
            targetId,
            `🎉 <b>Se activó tu Plan de Voucher ilimitado</b>\n\n♾️ Vencimiento ➣ Sin vencimiento`,
            { parse_mode: 'HTML' },
          );
        } catch (notifyError) {
          console.error(`No se pudo notificar al usuario ${targetId}:`, notifyError.message);
          await bot.sendMessage(chatId, `⚠️ No se pudo notificar al cliente (posiblemente bloqueó el bot).`);
        }

        return;
      }

      // --- Caso NÚMERO: agregar/quitar días (comportamiento original) ---
      const dias = Number(value);

      if (!Number.isInteger(dias) || dias === 0) {
        return bot.sendMessage(
          chatId,
          '❌ Valor inválido. Usa:\n' +
            '/dias telegramId|30         → agrega/quita días\n' +
            '/dias telegramId|ilimitado  → voucher sin vencimiento\n' +
            '/dias telegramId|off        → desactivar voucher',
        );
      }

      const now = new Date();
      const currentExpiresAt = targetUser.voucher?.expiresAt ? new Date(targetUser.voucher.expiresAt) : null;

      if (targetUser.voucher?.active && targetUser.voucher?.expiresAt === null) {
        return bot.sendMessage(
          chatId,
          `⚠️ Este usuario ya tiene plan de voucher <b>ilimitado sin vencimiento</b>.\n` +
            `Si quieres ponerle una fecha de vencimiento, primero usa:\n/dias ${targetId}|off`,
          { parse_mode: 'HTML' },
        );
      }

      const baseDate = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
      const newExpiresAt = new Date(baseDate.getTime() + dias * DAY_MS);

      await updateUser(targetId, {
        voucher: {
          ...(targetUser.voucher || {}),
          active: newExpiresAt > now,
          expiresAt: newExpiresAt,
        },
      });

      const lineaDias = buildLineaDias(dias);

      await bot.sendMessage(
        chatId,
        `✅ <b>Días de vouchers actualizados</b>\n\n` +
          `👤 Usuario ➣ ${displayName}\n` +
          `${lineaDias}\n` +
          `📅 Vence el ➣ ${formatDateTime(newExpiresAt)}`,
        { parse_mode: 'HTML' },
      );

      try {
        await bot.sendMessage(
          targetId,
          `🎉 <b>Se actualizó tu plan de vouchers</b>\n\n` +
            `${lineaDias}\n` +
            `📅 Ahora vence el ➣ ${formatDateTime(newExpiresAt)}`,
          { parse_mode: 'HTML' },
        );
      } catch (notifyError) {
        console.error(`No se pudo notificar al usuario ${targetId}:`, notifyError.message);
        await bot.sendMessage(chatId, `⚠️ No se pudo notificar al cliente (posiblemente bloqueó el bot).`);
      }
    } catch (error) {
      console.error('Error en /dias:', error.message);
      await bot.sendMessage(chatId, '❌ Ocurrió un error al procesar el comando.');
    }
  });
}

module.exports = registerDiasCommand;
