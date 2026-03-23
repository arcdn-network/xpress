const User = require('../models/users');
const CreditsLog = require('../models/credit_logs');
const isAdmin = require('../middleware/isAdmin');
const { TARIFARIO } = require('../utils/constants');

const creditosProcessingUsers = new Set();
const pendingCustomAmount = new Map();

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
  const isAdd = amount > 0;

  return `
${isAdd ? '🎉 <b>¡Créditos actualizados!</b>' : '⚠️ <b>Ajuste de créditos</b>'}

Se ${isAdd ? 'agregaron' : 'descontaron'} <b>${Math.abs(amount)}</b> créditos al usuario ${displayName}.
•···························•····························•
💳 <b>Resumen de saldo</b>

Antes: <b>${previousCredits}</b> créditos
Movimiento: <b>${isAdd ? '+' : '-'}${Math.abs(amount)}</b> créditos
Ahora: <b>${user.credits}</b> créditos
•···························•····························•
`.trim();
}

function buildCreditsKeyboard(targetId) {
  const activeItems = TARIFARIO.filter((item) => item.active);
  const rows = [];

  for (let i = 0; i < activeItems.length; i += 2) {
    const row = activeItems.slice(i, i + 2).map((item) => ({
      text: item.label || `${item.credits} créditos - S/ ${item.price}`,
      callback_data: `creditos:add:${targetId}:${item.credits}`,
    }));

    rows.push(row);
  }

  rows.push([
    {
      text: '✍️ Otro monto',
      callback_data: `creditos:custom:${targetId}`,
    },
  ]);

  rows.push([
    {
      text: '❌ Cancelar',
      callback_data: `creditos:cancel:${targetId}`,
    },
  ]);

  return {
    inline_keyboard: rows,
  };
}

function buildCustomAmountKeyboard(targetId) {
  return {
    inline_keyboard: [
      [
        {
          text: '⬅️ Regresar',
          callback_data: `creditos:back:${targetId}`,
        },
        {
          text: '❌ Cancelar',
          callback_data: `creditos:cancel:${targetId}`,
        },
      ],
    ],
  };
}

function buildCreditsMenuMessage(user) {
  const displayName = getUserDisplayName(user);

  return `
💳 <b>Gestión de créditos</b>

[⚡] <b>Usuario:</b> ${displayName}
[🙎‍♂️] <b>Telegram ID:</b> ${user.telegramId}
[💰] <b>Créditos actuales:</b> ${user.credits}

Selecciona una opción o usa <b>Otro monto</b> para otro valor.
`.trim();
}

function buildCustomAmountMessage(targetId) {
  return `
✍️ <b>Otro monto</b>

Escribe el monto para el usuario <b>${targetId}</b>.

Ejemplos: <b>-50</b>
`.trim();
}

async function safeDeleteMessage(bot, chatId, messageId) {
  if (!chatId || !messageId) {
    return;
  }

  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {}
}

async function processCreditsUpdate(bot, chatId, senderId, targetId, amount, reason, commandRaw) {
  const user = await User.findOne({ telegramId: targetId });

  if (!user) {
    await bot.sendMessage(chatId, 'Usuario no encontrado');
    return;
  }

  if (!Number.isInteger(amount) || amount === 0) {
    await bot.sendMessage(chatId, 'La cantidad debe ser un número entero distinto de 0');
    return;
  }

  if (amount < 0 && user.credits + amount < 0) {
    await bot.sendMessage(chatId, 'No puedes dejar al usuario con créditos negativos');
    return;
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
    reason,
    commandRaw,
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
}

function registerCreditosCommand(bot) {
  bot.onText(/\/creditos(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (creditosProcessingUsers.has(senderId)) {
      return bot.sendMessage(chatId, 'Ya tienes una solicitud de créditos en proceso. Espera un momento.');
    }

    try {
      const admin = await isAdmin(senderId);

      if (!admin) {
        return bot.sendMessage(chatId, 'No autorizado');
      }

      const rawArgs = (match[1] || '').trim();

      if (!rawArgs) {
        return bot.sendMessage(chatId, 'Formato: /creditos <userId> o /creditos <userId> <cantidad>');
      }

      const args = rawArgs.split(/\s+/);

      if (args.length === 1) {
        const targetId = Number(args[0]);

        if (!Number.isInteger(targetId) || targetId <= 0) {
          return bot.sendMessage(chatId, 'El userId no es válido');
        }

        const user = await User.findOne({ telegramId: targetId });

        if (!user) {
          return bot.sendMessage(chatId, 'Usuario no encontrado');
        }

        pendingCustomAmount.delete(senderId);

        return bot.sendMessage(chatId, buildCreditsMenuMessage(user), {
          parse_mode: 'HTML',
          reply_markup: buildCreditsKeyboard(targetId),
        });
      }

      if (args.length >= 2) {
        const targetId = Number(args[0]);
        const amount = Number(args[1]);

        if (!Number.isInteger(targetId) || targetId <= 0) {
          return bot.sendMessage(chatId, 'El userId no es válido');
        }

        creditosProcessingUsers.add(senderId);
        pendingCustomAmount.delete(senderId);

        await processCreditsUpdate(bot, chatId, senderId, targetId, amount, 'Ajuste manual de créditos', match[0]);

        creditosProcessingUsers.delete(senderId);
        return;
      }

      return bot.sendMessage(chatId, 'Formato: /creditos <userId> o /creditos <userId> <cantidad>');
    } catch (error) {
      creditosProcessingUsers.delete(senderId);
      pendingCustomAmount.delete(senderId);
      console.error('Error en /creditos:', error.message);
      await bot.sendMessage(chatId, 'Error al actualizar créditos');
    }
  });

  bot.on('callback_query', async (query) => {
    const senderId = query.from.id;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const data = query.data || '';

    if (!data.startsWith('creditos:')) {
      return;
    }

    if (!chatId || !messageId) {
      return bot.answerCallbackQuery(query.id, {
        text: 'No se pudo procesar la solicitud',
        show_alert: false,
      });
    }

    if (creditosProcessingUsers.has(senderId)) {
      return bot.answerCallbackQuery(query.id, {
        text: 'Ya tienes una solicitud en proceso',
        show_alert: false,
      });
    }

    try {
      const admin = await isAdmin(senderId);

      if (!admin) {
        return bot.answerCallbackQuery(query.id, {
          text: 'No autorizado',
          show_alert: false,
        });
      }

      creditosProcessingUsers.add(senderId);

      const [, action, targetIdRaw, amountRaw] = data.split(':');
      const targetId = Number(targetIdRaw);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        creditosProcessingUsers.delete(senderId);
        return bot.answerCallbackQuery(query.id, {
          text: 'Usuario inválido',
          show_alert: false,
        });
      }

      if (action === 'add') {
        const amount = Number(amountRaw);

        await bot.answerCallbackQuery(query.id, {
          text: 'Procesando...',
          show_alert: false,
        });

        await safeDeleteMessage(bot, chatId, messageId);

        pendingCustomAmount.delete(senderId);

        await processCreditsUpdate(
          bot,
          chatId,
          senderId,
          targetId,
          amount,
          'Recarga por tarifario',
          `callback:${data}`,
        );

        creditosProcessingUsers.delete(senderId);
        return;
      }

      if (action === 'custom') {
        await bot.answerCallbackQuery(query.id, {
          text: 'Ingresa el monto manual',
          show_alert: false,
        });

        await safeDeleteMessage(bot, chatId, messageId);

        const sentMessage = await bot.sendMessage(chatId, buildCustomAmountMessage(targetId), {
          parse_mode: 'HTML',
          reply_markup: buildCustomAmountKeyboard(targetId),
        });

        pendingCustomAmount.set(senderId, {
          targetId,
          chatId,
          messageId: sentMessage.message_id,
        });

        creditosProcessingUsers.delete(senderId);
        return;
      }

      if (action === 'back') {
        const user = await User.findOne({ telegramId: targetId });

        pendingCustomAmount.delete(senderId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Regresando...',
          show_alert: false,
        });

        await safeDeleteMessage(bot, chatId, messageId);

        if (user) {
          await bot.sendMessage(chatId, buildCreditsMenuMessage(user), {
            parse_mode: 'HTML',
            reply_markup: buildCreditsKeyboard(targetId),
          });
        } else {
          await bot.sendMessage(chatId, 'Usuario no encontrado');
        }

        creditosProcessingUsers.delete(senderId);
        return;
      }

      if (action === 'cancel') {
        pendingCustomAmount.delete(senderId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Cancelado',
          show_alert: false,
        });

        await safeDeleteMessage(bot, chatId, messageId);

        creditosProcessingUsers.delete(senderId);
        return;
      }

      creditosProcessingUsers.delete(senderId);

      return bot.answerCallbackQuery(query.id, {
        text: 'Acción no válida',
        show_alert: false,
      });
    } catch (error) {
      creditosProcessingUsers.delete(senderId);
      pendingCustomAmount.delete(senderId);
      console.error('Error en callback de /creditos:', error.message);
      await bot.answerCallbackQuery(query.id, {
        text: 'Error al procesar',
        show_alert: false,
      });
    }
  });

  bot.on('message', async (msg) => {
    const senderId = msg.from?.id;
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!senderId || !chatId || !text) {
      return;
    }

    if (text.startsWith('/')) {
      return;
    }

    const pending = pendingCustomAmount.get(senderId);

    if (!pending) {
      return;
    }

    if (pending.chatId !== chatId) {
      return;
    }

    if (creditosProcessingUsers.has(senderId)) {
      return bot.sendMessage(chatId, 'Ya tienes una solicitud de créditos en proceso. Espera un momento.');
    }

    try {
      const admin = await isAdmin(senderId);

      if (!admin) {
        pendingCustomAmount.delete(senderId);
        return bot.sendMessage(chatId, 'No autorizado');
      }

      if (/^cancelar$/i.test(text)) {
        pendingCustomAmount.delete(senderId);
        await safeDeleteMessage(bot, chatId, pending.messageId);
        return;
      }

      const amount = Number(text);

      if (!Number.isInteger(amount) || amount === 0) {
        pendingCustomAmount.delete(senderId);
        await safeDeleteMessage(bot, chatId, pending.messageId);
        await bot.sendMessage(chatId, 'Debes ingresar un número entero, por lo tanto la operación fue cancelada.');
        return;
      }

      creditosProcessingUsers.add(senderId);
      pendingCustomAmount.delete(senderId);

      await safeDeleteMessage(bot, chatId, pending.messageId);

      await processCreditsUpdate(
        bot,
        chatId,
        senderId,
        pending.targetId,
        amount,
        'Ajuste manual ingresado por botón',
        `/creditos ${pending.targetId} ${amount}`,
      );

      creditosProcessingUsers.delete(senderId);
    } catch (error) {
      creditosProcessingUsers.delete(senderId);
      pendingCustomAmount.delete(senderId);
      console.error('Error procesando monto manual en /creditos:', error.message);
      await bot.sendMessage(chatId, 'Error al actualizar créditos');
    }
  });
}

module.exports = registerCreditosCommand;
