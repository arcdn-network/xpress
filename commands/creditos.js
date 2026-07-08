const { getUser, updateUser, searchReseller, createCreditLog } = require('../utils/api');
const { TARIFARIO } = require('../utils/constants');
const isAdmin = require('../middleware/isAdmin');
const { formatDateTime } = require('../utils/functions');
const { getUnlimitedStatus } = require('../utils/unlimited');
const { mySupplierId } = require('../utils/data');

const creditosProcessingUsers = new Set();
const pendingCustomAmount = new Map();
const pendingUnlimitedFlow = new Map();

const UNLIMITED_OPTIONS = [
  { label: '7 días', days: 7 },
  { label: '15 días', days: 15 },
  { label: '30 días', days: 30 },
  { label: '60 días', days: 60 },
  { label: '♾️ Infinito', days: 0 },
];

function getUserDisplayName(user) {
  return user.username ? `@${user.username}` : `ID ${user.telegramId}`;
}

// ─── MENSAJES ────────────────────────────────────────────────

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

function buildCreditsMenuMessage(user) {
  const displayName = getUserDisplayName(user);
  const unlimitedStatus = getUnlimitedStatus(user);

  let unlimitedLine = '';
  if (unlimitedStatus.isUnlimited) {
    unlimitedLine = unlimitedStatus.expiresAt
      ? `\n[♾️] <b>Ilimitado hasta:</b> ${formatDateTime(unlimitedStatus.expiresAt)}`
      : `\n[♾️] <b>Ilimitado:</b> Sin vencimiento`;
  }

  return `
💳 <b>Gestión de créditos</b>

[⚡] <b>Usuario:</b> ${displayName}
[🙎‍♂️] <b>Telegram ID:</b> ${user.telegramId}
[💰] <b>Créditos actuales:</b> ${user.credits}${unlimitedLine}

Selecciona una opción.
`.trim();
}

function buildCreditsKeyboard(targetId, user) {
  const unlimitedStatus = getUnlimitedStatus(user);
  const rows = [];

  if (unlimitedStatus.isUnlimited) {
    rows.push([{ text: '➕ Agregar días', callback_data: `creditos:unlimited_menu:${targetId}` }]);
    rows.push([{ text: '🚫 Anular suscripción', callback_data: `creditos:unlimited_revoke:${targetId}` }]);
    rows.push([{ text: '❌ Cancelar', callback_data: `creditos:cancel:${targetId}` }]);
  } else {
    const activeItems = TARIFARIO.filter((item) => item.active);
    for (let i = 0; i < activeItems.length; i += 2) {
      const row = activeItems.slice(i, i + 2).map((item) => ({
        text: item.label || `${item.credits} créditos •S/ ${item.price}`,
        callback_data: `creditos:add:${targetId}:${item.credits}`,
      }));
      rows.push(row);
    }

    rows.push([{ text: '♾️ Ilimitado', callback_data: `creditos:unlimited_menu:${targetId}` }]);
    rows.push([{ text: '✍️ Otro monto', callback_data: `creditos:custom:${targetId}` }]);
    rows.push([{ text: '❌ Cancelar', callback_data: `creditos:cancel:${targetId}` }]);
  }

  return { inline_keyboard: rows };
}

function buildUnlimitedDaysKeyboard(targetId) {
  const rows = [];

  for (let i = 0; i < UNLIMITED_OPTIONS.length; i += 2) {
    const row = UNLIMITED_OPTIONS.slice(i, i + 2).map((opt) => ({
      text: opt.label,
      callback_data: `creditos:unlimited_days:${targetId}:${opt.days}`,
    }));
    rows.push(row);
  }

  rows.push([{ text: '⬅️ Regresar', callback_data: `creditos:back_to_menu:${targetId}` }]);
  rows.push([{ text: '❌ Cancelar', callback_data: `creditos:cancel:${targetId}` }]);

  return { inline_keyboard: rows };
}

function buildUnlimitedConfirmKeyboard(targetId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ CONFIRMAR', callback_data: `creditos:unlimited_confirm:${targetId}` },
        { text: '❌ CANCELAR', callback_data: `creditos:cancel:${targetId}` },
      ],
    ],
  };
}

function buildCustomAmountKeyboard(targetId) {
  return {
    inline_keyboard: [
      [
        { text: '⬅️ Regresar', callback_data: `creditos:back:${targetId}` },
        { text: '❌ Cancelar', callback_data: `creditos:cancel:${targetId}` },
      ],
    ],
  };
}

function buildUnlimitedDaysMessage(targetUser) {
  const displayName = getUserDisplayName(targetUser);
  const unlimitedStatus = getUnlimitedStatus(targetUser);

  const currentLine = unlimitedStatus.isUnlimited
    ? unlimitedStatus.expiresAt
      ? `[♾️] <b>Vence actualmente:</b> ${formatDateTime(unlimitedStatus.expiresAt)}\n`
      : `[♾️] <b>Vence actualmente:</b> Sin vencimiento\n`
    : '';

  return `
♾️ <b>Activar / Extender Ilimitado</b>

[🙎‍♂️] <b>Usuario:</b> ${displayName}
[💳] <b>Telegram ID:</b> ${targetUser.telegramId}
${currentLine}
Selecciona el período a agregar:
`.trim();
}

function buildAwaitingResellerMessage(targetUser, days) {
  const displayName = getUserDisplayName(targetUser);
  return `
♾️ <b>Activar Ilimitado</b>

[🙎‍♂️] <b>Usuario:</b> ${displayName}
[📅] <b>Período:</b> ${days === 0 ? '∞ Infinito' : `${days} días`}

Escribe el <b>ID</b> del <b>RESELLER</b> a asignar:
`.trim();
}

function buildUnlimitedConfirmMessage(targetUser, reseller, days, isExtension) {
  const userDisplay = getUserDisplayName(targetUser);
  const unlimitedStatus = getUnlimitedStatus(targetUser);
  const isInfinite = days === 0;

  let expiresAt = null;
  if (!isInfinite) {
    if (isExtension && unlimitedStatus.isUnlimited && unlimitedStatus.expiresAt) {
      expiresAt = new Date(unlimitedStatus.expiresAt);
      expiresAt.setDate(expiresAt.getDate() + days);
    } else {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }
  }

  const accion = isExtension ? 'EXTENDER' : 'ACTIVAR';
  const vencimientoLine = isInfinite ? 'Sin vencimiento' : formatDateTime(expiresAt);

  return `
♾️ <b>CONFIRMAR ${accion} ILIMITADO</b>

•···························•····························•
[🙎‍♂️] <b>Usuario:</b> ${userDisplay}
[📅] <b>Días a agregar:</b> ${isInfinite ? '∞ Infinito' : days}
[📆] <b>Nueva fecha vencimiento:</b> ${vencimientoLine}
[🏷] <b>Reseller:</b> ${reseller.username}
[🆔] <b>Reseller ID:</b> <code>${reseller._id}</code>
•···························•····························•

¿Confirmas?
`.trim();
}

function buildUnlimitedSuccessMessage(targetUser, reseller, days, isExtension) {
  const userDisplay = getUserDisplayName(targetUser);
  const unlimitedStatus = getUnlimitedStatus(targetUser);
  const isInfinite = days === 0;

  let expiresAt = null;
  if (!isInfinite) {
    if (isExtension && unlimitedStatus.isUnlimited && unlimitedStatus.expiresAt) {
      expiresAt = new Date(unlimitedStatus.expiresAt);
      expiresAt.setDate(expiresAt.getDate() + days);
    } else {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }
  }

  const vencimientoLine = isInfinite ? 'Sin vencimiento' : formatDateTime(expiresAt);

  return `
✅ <b>ILIMITADO ${isExtension ? 'EXTENDIDO' : 'ACTIVADO'}</b>

•···························•····························•
[🙎‍♂️] <b>Usuario:</b> ${userDisplay}
[📅] <b>Días agregados:</b> ${isInfinite ? '∞ Infinito' : days}
[📆] <b>Vence:</b> ${vencimientoLine}
[🏷] <b>Reseller:</b> @${reseller.username}
•···························•····························•
`.trim();
}

function buildCustomAmountMessage(targetId) {
  return `
✍️ <b>Otro monto</b>

Escribe el monto para el usuario <b>${targetId}</b>.

Ejemplos: <code>50</code> para agregar, <code>-50</code> para descontar.
`.trim();
}

// ─── HELPERS ─────────────────────────────────────────────────

async function safeDeleteMessage(bot, chatId, messageId) {
  if (!chatId || !messageId) return;
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {}
}

async function processCreditsUpdate(bot, chatId, senderId, targetId, amount, reason, commandRaw) {
  const user = await getUser(targetId);

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
  const newCredits = previousCredits + amount;

  const updatedUser = await updateUser(targetId, { credits: newCredits });

  await createCreditLog({
    targetTelegramId: user.telegramId,
    adminTelegramId: senderId,
    amount,
    previousCredits,
    currentCredits: newCredits,
    movementType: amount > 0 ? 'add' : 'discount',
    reason,
    commandRaw,
  });

  try {
    const userMessage =
      amount > 0
        ? buildUserCreditsAddedMessage(updatedUser, amount, previousCredits)
        : buildUserCreditsDiscountedMessage(updatedUser, amount, previousCredits);
    await bot.sendMessage(targetId, userMessage, { parse_mode: 'HTML' });
  } catch (notifyError) {
    console.error('No se pudo notificar al usuario:', notifyError.message);
  }

  const adminMessage = buildAdminCreditsMessage(updatedUser, amount, previousCredits);
  await bot.sendMessage(chatId, adminMessage, { parse_mode: 'HTML' });
}

// ─── COMANDO PRINCIPAL ────────────────────────────────────────

function registerCreditosCommand(bot) {
  bot.onText(/\/creditos(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (creditosProcessingUsers.has(senderId)) {
      return bot.sendMessage(chatId, 'Ya tienes una solicitud de créditos en proceso. Espera un momento.');
    }

    try {
      const admin = await isAdmin(senderId);
      if (!admin) return bot.sendMessage(chatId, 'No autorizado');

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

        const user = await getUser(targetId);
        if (!user) return bot.sendMessage(chatId, 'Usuario no encontrado');

        pendingCustomAmount.delete(senderId);
        pendingUnlimitedFlow.delete(senderId);

        return bot.sendMessage(chatId, buildCreditsMenuMessage(user), {
          parse_mode: 'HTML',
          reply_markup: buildCreditsKeyboard(targetId, user),
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
        pendingUnlimitedFlow.delete(senderId);

        await processCreditsUpdate(bot, chatId, senderId, targetId, amount, 'Ajuste manual de créditos', match[0]);
        creditosProcessingUsers.delete(senderId);
        return;
      }

      return bot.sendMessage(chatId, 'Formato: /creditos <userId> o /creditos <userId> <cantidad>');
    } catch (error) {
      creditosProcessingUsers.delete(senderId);
      pendingCustomAmount.delete(senderId);
      pendingUnlimitedFlow.delete(senderId);
      console.error('Error en /creditos:', error.message);
      await bot.sendMessage(chatId, 'Error al actualizar créditos');
    }
  });

  // ─── CALLBACKS ───────────────────────────────────────────────

  bot.on('callback_query', async (query) => {
    const senderId = query.from.id;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const data = query.data || '';

    if (!data.startsWith('creditos:')) return;
    if (!chatId || !messageId) {
      return bot.answerCallbackQuery(query.id, { text: 'No se pudo procesar la solicitud' });
    }

    if (creditosProcessingUsers.has(senderId)) {
      return bot.answerCallbackQuery(query.id, { text: 'Ya tienes una solicitud en proceso' });
    }

    try {
      const admin = await isAdmin(senderId);
      if (!admin) {
        return bot.answerCallbackQuery(query.id, { text: 'No autorizado' });
      }

      creditosProcessingUsers.add(senderId);

      const parts = data.split(':');
      const action = parts[1];
      const targetIdRaw = parts[2];
      const extra = parts[3];
      const targetId = Number(targetIdRaw);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        creditosProcessingUsers.delete(senderId);
        return bot.answerCallbackQuery(query.id, { text: 'Usuario inválido' });
      }

      // ── Menú de días ilimitado ────────────────────────────
      if (action === 'unlimited_menu') {
        const targetUser = await getUser(targetId);

        if (!targetUser) {
          creditosProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado' });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Selecciona el período' });
        await bot.editMessageText(buildUnlimitedDaysMessage(targetUser), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: buildUnlimitedDaysKeyboard(targetId),
        });

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Seleccionó días → pide reseller ID via reply ──────
      // ── Seleccionó días → pide reseller ID via reply ──────
      if (action === 'unlimited_days') {
        const days = Number(extra);

        if (days === null || days === undefined || days < 0) {
          creditosProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Período inválido' });
          return;
        }

        const targetUser = await getUser(targetId);

        if (!targetUser) {
          creditosProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado' });
          return;
        }

        const isExtension = getUnlimitedStatus(targetUser).isUnlimited;

        // ── Si ya tiene ilimitado, usa el reseller existente ──
        if (isExtension) {
          await bot.answerCallbackQuery(query.id, { text: 'Confirmando extensión...' });
          await safeDeleteMessage(bot, chatId, messageId);

          const resellerId = targetUser.unlimited?.resellerId;
          const reseller = await searchReseller(resellerId);

          if (!reseller) {
            await bot.sendMessage(chatId, '❌ No se encontró el reseller asignado.');
            creditosProcessingUsers.delete(senderId);
            return;
          }

          const supplierId = reseller.supplier || mySupplierId;

          const sentMessage = await bot.sendMessage(
            chatId,
            buildUnlimitedConfirmMessage(targetUser, reseller, days, true, supplierId),
            {
              parse_mode: 'HTML',
              reply_markup: buildUnlimitedConfirmKeyboard(targetId),
            },
          );

          pendingUnlimitedFlow.set(senderId, {
            step: 'awaiting_confirm',
            targetId,
            days,
            isExtension: true,
            chatId,
            messageId: sentMessage.message_id,
            resellerId: String(reseller._id),
            supplierId,
          });

          creditosProcessingUsers.delete(senderId);
          return;
        }

        // ── Si NO tiene ilimitado, pide reseller ID ───────────
        await bot.answerCallbackQuery(query.id, { text: 'Ingresa el reseller ID' });
        await safeDeleteMessage(bot, chatId, messageId);

        const sentMessage = await bot.sendMessage(chatId, buildAwaitingResellerMessage(targetUser, days), {
          parse_mode: 'HTML',
          reply_markup: { force_reply: true, selective: true },
        });

        pendingUnlimitedFlow.set(senderId, {
          step: 'awaiting_reseller_id',
          targetId,
          days,
          isExtension: false,
          chatId,
          messageId: sentMessage.message_id,
        });

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Anular suscripción: confirmación ──────────────────
      if (action === 'unlimited_revoke') {
        const targetUser = await getUser(targetId);

        if (!targetUser) {
          creditosProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado' });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Confirma la anulación' });

        await bot.editMessageText(
          `🚫 <b>ANULAR SUSCRIPCIÓN ILIMITADA</b>\n\n[🙎‍♂️] <b>Usuario:</b> ${getUserDisplayName(targetUser)}\n[💳] <b>Telegram ID:</b> ${targetUser.telegramId}\n\n¿Confirmas que deseas anular el período ilimitado?`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Sí, anular', callback_data: `creditos:unlimited_revoke_confirm:${targetId}` },
                  { text: '❌ Cancelar', callback_data: `creditos:cancel:${targetId}` },
                ],
              ],
            },
          },
        );

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Anular suscripción: ejecutar ──────────────────────
      if (action === 'unlimited_revoke_confirm') {
        const targetUser = await getUser(targetId);

        if (!targetUser) {
          creditosProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado' });
          return;
        }

        await updateUser(targetId, {
          unlimited: { active: false, expiresAt: null, resellerId: null, supplierId: null },
        });

        await bot.answerCallbackQuery(query.id, { text: 'Suscripción anulada' });

        await bot.editMessageText(
          `✅ <b>SUSCRIPCIÓN ANULADA</b>\n\n[🙎‍♂️] <b>Usuario:</b> ${getUserDisplayName(targetUser)}\n[💳] <b>Telegram ID:</b> ${targetUser.telegramId}\n\nEl período ilimitado fue eliminado correctamente.`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] },
          },
        );

        try {
          await bot.sendMessage(
            targetUser.telegramId,
            `⚠️ <b>Tu suscripción ilimitada ha sido cancelada.</b>\n\nA partir de ahora tus activaciones consumirán créditos.\nSi esto fue un error, comunicate inmediatamente con @dev_lguss`,
            { parse_mode: 'HTML' },
          );
        } catch (e) {}

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Confirmar ilimitado ───────────────────────────────
      if (action === 'unlimited_confirm') {
        const flow = pendingUnlimitedFlow.get(senderId);

        if (!flow || flow.step !== 'awaiting_confirm') {
          creditosProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Sesión expirada, vuelve a intentarlo' });
          return;
        }

        const targetUser = await getUser(flow.targetId);
        const reseller = await searchReseller(flow.resellerId);

        if (!targetUser || !reseller) {
          creditosProcessingUsers.delete(senderId);
          pendingUnlimitedFlow.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Error al obtener datos' });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Activando...' });

        const unlimitedStatus = getUnlimitedStatus(targetUser);
        const isInfinite = flow.days === 0;
        let expiresAt = null;

        if (!isInfinite) {
          if (flow.isExtension && unlimitedStatus.isUnlimited && unlimitedStatus.expiresAt) {
            expiresAt = new Date(unlimitedStatus.expiresAt);
            expiresAt.setDate(expiresAt.getDate() + flow.days);
          } else {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + flow.days);
          }
        }

        const supplierId = flow.supplierId || reseller.supplier || mySupplierId;

        await updateUser(flow.targetId, {
          unlimited: { active: true, expiresAt, resellerId: String(reseller._id), supplierId },
        });

        pendingUnlimitedFlow.delete(senderId);

        await bot.editMessageText(
          buildUnlimitedSuccessMessage(targetUser, reseller, flow.days, flow.isExtension, supplierId),
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] },
          },
        );

        try {
          const vencimientoText = isInfinite ? 'Sin fecha de vencimiento ♾️' : `📆 Vence: ${formatDateTime(expiresAt)}`;
          await bot.sendMessage(
            targetUser.telegramId,
            `♾️ <b>¡Tu cuenta tiene acceso ilimitado!</b>\n\n${
              isInfinite
                ? 'Puedes activar sin límite de créditos.'
                : `Puedes activar sin límite de créditos durante <b>${flow.days} días</b> adicionales.`
            }\n${vencimientoText}`,
            { parse_mode: 'HTML' },
          );
        } catch (e) {}

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Regresar al menú principal ────────────────────────
      if (action === 'back_to_menu') {
        const targetUser = await getUser(targetId);

        pendingUnlimitedFlow.delete(senderId);
        pendingCustomAmount.delete(senderId);

        await bot.answerCallbackQuery(query.id, { text: 'Regresando...' });

        if (targetUser) {
          await bot.editMessageText(buildCreditsMenuMessage(targetUser), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: buildCreditsKeyboard(targetId, targetUser),
          });
        } else {
          await safeDeleteMessage(bot, chatId, messageId);
          await bot.sendMessage(chatId, 'Usuario no encontrado');
        }

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Agregar créditos por tarifario ────────────────────
      if (action === 'add') {
        const amount = Number(extra);

        await bot.answerCallbackQuery(query.id, { text: 'Procesando...' });
        await safeDeleteMessage(bot, chatId, messageId);

        pendingCustomAmount.delete(senderId);
        pendingUnlimitedFlow.delete(senderId);

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

      // ── Monto custom ──────────────────────────────────────
      if (action === 'custom') {
        await bot.answerCallbackQuery(query.id, { text: 'Ingresa el monto manual' });
        await safeDeleteMessage(bot, chatId, messageId);

        const sentMessage = await bot.sendMessage(chatId, buildCustomAmountMessage(targetId), {
          parse_mode: 'HTML',
          reply_markup: {
            force_reply: true,
            selective: true,
          },
        });

        pendingCustomAmount.set(senderId, {
          targetId,
          chatId,
          messageId: sentMessage.message_id,
        });

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Regresar al menú desde custom ─────────────────────
      if (action === 'back') {
        const user = await getUser(targetId);

        pendingCustomAmount.delete(senderId);

        await bot.answerCallbackQuery(query.id, { text: 'Regresando...' });
        await safeDeleteMessage(bot, chatId, messageId);

        if (user) {
          await bot.sendMessage(chatId, buildCreditsMenuMessage(user), {
            parse_mode: 'HTML',
            reply_markup: buildCreditsKeyboard(targetId, user),
          });
        } else {
          await bot.sendMessage(chatId, 'Usuario no encontrado');
        }

        creditosProcessingUsers.delete(senderId);
        return;
      }

      // ── Cancelar ──────────────────────────────────────────
      if (action === 'cancel') {
        pendingCustomAmount.delete(senderId);
        pendingUnlimitedFlow.delete(senderId);

        await bot.answerCallbackQuery(query.id, { text: 'Cancelado' });
        await safeDeleteMessage(bot, chatId, messageId);

        creditosProcessingUsers.delete(senderId);
        return;
      }

      creditosProcessingUsers.delete(senderId);
      return bot.answerCallbackQuery(query.id, { text: 'Acción no válida' });
    } catch (error) {
      creditosProcessingUsers.delete(senderId);
      pendingCustomAmount.delete(senderId);
      pendingUnlimitedFlow.delete(senderId);
      console.error('Error en callback de /creditos:', error.message);
      await bot.answerCallbackQuery(query.id, { text: 'Error al procesar' });
    }
  });

  // ─── LISTENER DE MENSAJES (reply + custom amount) ────────────

  bot.on('message', async (msg) => {
    const senderId = msg.from?.id;
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!senderId || !chatId || !text || text.startsWith('/')) return;

    // ── Flujo ilimitado: esperando reseller ID via reply ──
    const flow = pendingUnlimitedFlow.get(senderId);

    if (flow && flow.step === 'awaiting_reseller_id' && flow.chatId === chatId) {
      if (creditosProcessingUsers.has(senderId)) return;

      try {
        const admin = await isAdmin(senderId);
        if (!admin) {
          pendingUnlimitedFlow.delete(senderId);
          return bot.sendMessage(chatId, 'No autorizado');
        }

        await safeDeleteMessage(bot, chatId, flow.messageId);

        const loadingMsg = await bot.sendMessage(chatId, '⏳ Validando reseller...', {
          reply_to_message_id: msg.message_id,
        });

        let reseller;
        try {
          reseller = await searchReseller(text.trim());
        } catch (e) {
          reseller = null;
        }

        if (!reseller) {
          await safeDeleteMessage(bot, chatId, loadingMsg.message_id);

          const newPrompt = await bot.sendMessage(
            chatId,
            `❌ No se encontró ningún reseller con el ID <code>${text}</code>.\n\nEscribe el ID correcto:`,
            {
              parse_mode: 'HTML',
              reply_markup: { force_reply: true, selective: true },
            },
          );

          pendingUnlimitedFlow.set(senderId, {
            ...flow,
            messageId: loadingMsg.message_id,
          });

          return;
        }

        const targetUser = await getUser(flow.targetId);

        if (!targetUser) {
          pendingUnlimitedFlow.delete(senderId);
          await bot.editMessageText('❌ Usuario no encontrado', {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'HTML',
          });
          return;
        }

        const supplierId = reseller.supplier || mySupplierId;

        pendingUnlimitedFlow.set(senderId, {
          ...flow,
          step: 'awaiting_confirm',
          resellerId: String(reseller._id),
          supplierId,
          messageId: loadingMsg.message_id,
        });

        await bot.editMessageText(
          buildUnlimitedConfirmMessage(targetUser, reseller, flow.days, flow.isExtension, supplierId),
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: 'HTML',
            reply_markup: JSON.stringify(buildUnlimitedConfirmKeyboard(flow.targetId)),
          },
        );
      } catch (error) {
        console.log(error);

        pendingUnlimitedFlow.delete(senderId);
        console.error('Error validando reseller:', error.message);
        await bot.sendMessage(chatId, 'Error al validar el reseller');
      }

      return;
    }

    // ── Flujo normal: monto custom via reply ──────────────
    const pending = pendingCustomAmount.get(senderId);

    if (!pending || pending.chatId !== chatId) return;

    if (creditosProcessingUsers.has(senderId)) {
      return bot.sendMessage(chatId, 'Ya tienes una solicitud de créditos en proceso. Espera un momento.');
    }

    try {
      const admin = await isAdmin(senderId);
      if (!admin) {
        pendingCustomAmount.delete(senderId);
        return bot.sendMessage(chatId, 'No autorizado');
      }

      await safeDeleteMessage(bot, chatId, msg.message_id);
      await safeDeleteMessage(bot, chatId, pending.messageId);

      if (/^cancelar$/i.test(text)) {
        pendingCustomAmount.delete(senderId);
        return;
      }

      const amount = Number(text);

      if (!Number.isInteger(amount) || amount === 0) {
        pendingCustomAmount.delete(senderId);
        await bot.sendMessage(chatId, 'Debes ingresar un número entero, la operación fue cancelada.');
        return;
      }

      creditosProcessingUsers.add(senderId);
      pendingCustomAmount.delete(senderId);

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
