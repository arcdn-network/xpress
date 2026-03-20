const User = require('../models/users');
const CreditsLog = require('../models/credit_logs');
const isAdmin = require('../middleware/isAdmin');

function getUserDisplayName(user) {
  return user.username ? `@${user.username}` : `ID ${user.telegramId}`;
}

function buildUserCreditsAddedMessage(user, amount, previousCredits) {
  const displayName = getUserDisplayName(user);

  return `
🎉 <b>¡Créditos añadidos!</b>

Hola ${displayName},
Hemos agregado <b>${Math.abs(amount)}</b> créditos a tu cuenta.

•···························•····························•
💳 <b>Tu saldo</b>

Antes: <b>${previousCredits}</b> créditos
Ahora: <b>${user.credits}</b> créditos
•···························•····························•

🚀 Ya puedes seguir utilizando nuestros servicios.
`.trim();
}

function buildUserCreditsDiscountedMessage(user, amount, previousCredits) {
  const displayName = getUserDisplayName(user);

  return `
⚠️ <b>Ajuste de créditos</b>

Hola ${displayName},
Se han descontado <b>${Math.abs(amount)}</b> créditos de tu cuenta.

•···························•····························•
💳 <b>Tu saldo</b>

Antes: <b>${previousCredits}</b> créditos
Ahora: <b>${user.credits}</b> créditos
•···························•····························•

Si tienes alguna consulta, puedes contactarnos.
`.trim();
}

function buildAdminCreditsMessage(user, amount, previousCredits) {
  const displayName = getUserDisplayName(user);
  const tipo = amount > 0 ? '➕ Recarga realizada' : '➖ Descuento realizado';

  return `
${tipo}

👤 <b>Usuario:</b> ${displayName}
🆔 <b>Telegram ID:</b> ${user.telegramId}

💳 <b>Saldo anterior:</b> ${previousCredits}
🔄 <b>Movimiento:</b> ${amount > 0 ? '+' : ''}${amount}
💳 <b>Saldo final:</b> ${user.credits}
`.trim();
}

function registerCreditosCommand(bot) {
  bot.onText(/\/creditos (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    try {
      const admin = await isAdmin(senderId);

      if (!admin) {
        return bot.sendMessage(chatId, 'No autorizado');
      }

      const args = match[1].trim().split(/\s+/);

      if (args.length < 2) {
        return bot.sendMessage(chatId, 'Formato: /creditos <userId> <cantidad>');
      }

      const targetId = Number(args[0]);
      const amount = Number(args[1]);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        return bot.sendMessage(chatId, 'El userId no es válido');
      }

      if (!Number.isInteger(amount) || amount === 0) {
        return bot.sendMessage(chatId, 'La cantidad debe ser un número entero distinto de 0');
      }

      const user = await User.findOne({ telegramId: targetId });

      if (!user) {
        return bot.sendMessage(chatId, 'Usuario no encontrado');
      }

      if (amount < 0 && user.credits + amount < 0) {
        return bot.sendMessage(chatId, 'No puedes dejar al usuario con créditos negativos');
      }

      const previousCredits = user.credits;

      user.credits += amount;
      await user.save();

      await CreditsLog.create({
        targetTelegramId: user.telegramId,
        adminTelegramId: senderId,
        amount,
        previousCredits,
        currentCredits: user.credits,
        movementType: amount > 0 ? 'add' : 'discount',
        reason: 'Ajuste manual de créditos',
        commandRaw: match[0],
      });

      try {
        const userMessage =
          amount > 0
            ? buildUserCreditsAddedMessage(user, amount, previousCredits)
            : buildUserCreditsDiscountedMessage(user, amount, previousCredits);

        await bot.sendMessage(targetId, userMessage, { parse_mode: 'HTML' });
      } catch (notifyError) {
        console.error('No se pudo notificar al usuario:', notifyError.message);
      }

      const adminMessage = buildAdminCreditsMessage(user, amount, previousCredits);

      await bot.sendMessage(chatId, adminMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error en /creditos:', error.message);
      await bot.sendMessage(chatId, 'Error al actualizar créditos');
    }
  });
}

module.exports = registerCreditosCommand;
