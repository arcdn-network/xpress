const { getUser, updateUser } = require('../utils/api');
const { formatDateTime } = require('../utils/functions');
const { isAdmin } = require('../middleware/isAdmin');

const DAY_MS = 24 * 60 * 60 * 1000;

const diasProcessingUsers = new Set();
const pendingCustomDias = new Map();
const pendingDiasAction = new Map();

const DIAS_OPTIONS = [7, 15, 30];

// ─── HELPERS ─────────────────────────────
function getUserDisplayName(user) {
  return user.username ? `@${user.username}` : `ID ${user.telegramId}`;
}

function buildLineaDias(dias) {
  return `${dias > 0 ? '➕' : '➖'} Días ${dias > 0 ? 'agregados' : 'quitados'} ➣ ${Math.abs(dias)}`;
}

async function safeDeleteMessage(bot, chatId, messageId) {
  if (!chatId || !messageId) return;
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {}
}

function calcNewExpiresAt(targetUser, dias) {
  const now = new Date();
  const currentExpiresAt = targetUser.voucher?.expiresAt ? new Date(targetUser.voucher.expiresAt) : null;
  const baseDate = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
  return new Date(baseDate.getTime() + dias * DAY_MS);
}

function getDaysRemaining(expiresAt) {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / DAY_MS));
}

function getCurrentDaysRemaining(targetUser) {
  const voucher = targetUser.voucher || {};

  if (voucher.active && voucher.expiresAt === null) {
    return Infinity;
  }

  if (!voucher.active || !voucher.expiresAt) {
    return 0;
  }

  return getDaysRemaining(voucher.expiresAt);
}

// ─── MENSAJES ────────────────────────────

function buildDiasMenuMessage(user) {
  const displayName = getUserDisplayName(user);
  const voucher = user.voucher || {};

  let statusLine;
  if (voucher.active && voucher.expiresAt === null) {
    statusLine = '♾️ Ilimitado (sin vencimiento)';
  } else if (voucher.active && voucher.expiresAt) {
    statusLine = `✅ Activo hasta ${formatDateTime(voucher.expiresAt)}`;
  } else {
    statusLine = '❌ Inactivo';
  }

  return `
📅 <b>Gestión de plan de vouchers</b>

[🙎‍♂️] <b>Usuario:</b> ${displayName}
[💳] <b>Telegram ID:</b> ${user.telegramId}
[📌] <b>Estado actual:</b> ${statusLine}

Selecciona una opción.
`.trim();
}

function buildDiasKeyboard(targetId) {
  const rows = [];

  rows.push([
    { text: `+${DIAS_OPTIONS[0]} días`, callback_data: `dias:pick_add:${targetId}:${DIAS_OPTIONS[0]}` },
    { text: `+${DIAS_OPTIONS[1]} días`, callback_data: `dias:pick_add:${targetId}:${DIAS_OPTIONS[1]}` },
  ]);

  rows.push([
    { text: `+${DIAS_OPTIONS[2]} días`, callback_data: `dias:pick_add:${targetId}:${DIAS_OPTIONS[2]}` },
    { text: '♾️ Ilimitado', callback_data: `dias:pick_ilimitado:${targetId}` },
  ]);

  rows.push([{ text: '✍️ Otro monto', callback_data: `dias:custom:${targetId}` }]);
  rows.push([{ text: '🚫 Desactivar', callback_data: `dias:pick_off:${targetId}` }]);
  rows.push([{ text: '❌ Cancelar', callback_data: `dias:cancel:${targetId}` }]);

  return { inline_keyboard: rows };
}

function buildDiasCustomMessage(targetId) {
  return `
✍️ <b>Otro monto de días</b>

Escribe la cantidad de días para el usuario <b>${targetId}</b>.

Ejemplos: <code>45</code> para agregar, <code>-10</code> para quitar.
Escribe <code>cancelar</code> para abortar.
`.trim();
}

function buildConfirmKeyboard(targetId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ CONFIRMAR', callback_data: `dias:confirm:${targetId}` },
        { text: '❌ CANCELAR', callback_data: `dias:cancel:${targetId}` },
      ],
      [{ text: '⬅️ REGRESAR', callback_data: `dias:back:${targetId}` }],
    ],
  };
}

function buildConfirmAddMessage(targetUser, dias) {
  const displayName = getUserDisplayName(targetUser);
  const newExpiresAt = calcNewExpiresAt(targetUser, dias);
  const diasRestantes = getDaysRemaining(newExpiresAt);
  const emojiDias = dias > 0 ? '➕' : '➖';
  const labelDias = dias > 0 ? 'Días agregados' : 'Días quitados';

  return `
📅 <b>CONFIRMAR CAMBIO DE DÍAS</b>

- ···························•····························•
[🙎‍♂️] <b>Usuario:</b> ${displayName}
[${emojiDias}] <b>${labelDias}:</b> ${Math.abs(dias)}
[⏳] <b>Días totales:</b> ${diasRestantes}
[📆] <b>Vence el:</b> ${formatDateTime(newExpiresAt)}
- ···························•····························•

¿Confirmas?
`.trim();
}

function buildConfirmIlimitadoMessage(targetUser) {
  const displayName = getUserDisplayName(targetUser);

  return `
♾️ <b>CONFIRMAR ILIMITADO</b>

- ···························•····························•
[🙎‍♂️] <b>Usuario:</b> ${displayName}
[📆] <b>Vencimiento:</b> Sin vencimiento
- ···························•····························•

¿Confirmas?
`.trim();
}

function buildConfirmOffMessage(targetUser) {
  const displayName = getUserDisplayName(targetUser);

  return `
🚫 <b>CONFIRMAR DESACTIVACIÓN</b>

- ···························•····························•
[🙎‍♂️] <b>Usuario:</b> ${displayName}
[📌] <b>Acción:</b> Desactivar plan de vouchers
- ···························•····························•

¿Confirmas?
`.trim();
}

// ─── LÓGICA DE ACTUALIZACIÓN ─────────────

async function applyDiasChange(bot, chatId, oldMessageId, targetId, dias) {
  const targetUser = await getUser(targetId);

  if (!targetUser) {
    await safeDeleteMessage(bot, chatId, oldMessageId);
    await bot.sendMessage(chatId, '❌ Ese usuario no está registrado.');
    return;
  }

  const displayName = getUserDisplayName(targetUser);

  if (targetUser.voucher?.active && targetUser.voucher?.expiresAt === null) {
    await safeDeleteMessage(bot, chatId, oldMessageId);
    await bot.sendMessage(
      chatId,
      `⚠️ Este usuario ya tiene plan de voucher <b>ilimitado sin vencimiento</b>.\n` +
        `Si quieres ponerle una fecha de vencimiento, primero usa /dias ${targetId} y elige "🚫 Desactivar".`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (dias < 0 && getCurrentDaysRemaining(targetUser) <= 0) {
    await safeDeleteMessage(bot, chatId, oldMessageId);
    await bot.sendMessage(chatId, '❌ Este usuario ya no tiene días activos para quitar.');
    return;
  }

  const newExpiresAt = calcNewExpiresAt(targetUser, dias);
  const diasRestantes = getDaysRemaining(newExpiresAt);

  await updateUser(targetId, {
    voucher: {
      ...(targetUser.voucher || {}),
      active: newExpiresAt > new Date(),
      expiresAt: newExpiresAt,
    },
  });

  const emojiDias = dias > 0 ? '➕' : '➖';

  await bot.editMessageText(
    `✅ <b>Días de vouchers actualizados</b>\n\n` +
      `👤 Usuario ➣ ${displayName}\n` +
      `${emojiDias} Días ${dias > 0 ? 'agregados' : 'quitados'} ➣ ${Math.abs(dias)}\n` +
      `⏳ Días totales ➣ ${diasRestantes}\n` +
      `📅 Vence el ➣ ${formatDateTime(newExpiresAt)}`,
    {
      chat_id: chatId,
      message_id: oldMessageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] },
    },
  );

  try {
    await bot.sendMessage(
      targetId,
      `🎉 <b>Se actualizó tu plan de vouchers</b>\n\n` +
        `${emojiDias} Días ${dias > 0 ? 'agregados' : 'quitados'} ➣ ${Math.abs(dias)}\n` +
        `⏳ Días totales ➣ ${diasRestantes}\n` +
        `📅 Ahora vence el ➣ ${formatDateTime(newExpiresAt)}`,
      { parse_mode: 'HTML' },
    );
  } catch (notifyError) {
    console.error(`No se pudo notificar al usuario ${targetId}:`, notifyError.message);
    await bot.sendMessage(chatId, '⚠️ No se pudo notificar al cliente (posiblemente bloqueó el bot).');
  }
}

async function applyDiasIlimitado(bot, chatId, oldMessageId, targetId) {
  const targetUser = await getUser(targetId);

  if (!targetUser) {
    await safeDeleteMessage(bot, chatId, oldMessageId);
    await bot.sendMessage(chatId, '❌ Ese usuario no está registrado.');
    return;
  }

  const displayName = getUserDisplayName(targetUser);

  await updateUser(targetId, {
    voucher: {
      ...(targetUser.voucher || {}),
      active: true,
      expiresAt: null,
    },
  });

  await bot.editMessageText(
    `✅ <b>Plan de Voucher ilimitado activado</b>\n\n` +
      `👤 Usuario ➣ ${displayName}\n` +
      `♾️ Vencimiento ➣ Sin vencimiento`,
    {
      chat_id: chatId,
      message_id: oldMessageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] },
    },
  );

  try {
    await bot.sendMessage(
      targetId,
      `🎉 <b>Se activó tu Plan de Voucher ilimitado</b>\n\n♾️ Vencimiento ➣ Sin vencimiento`,
      { parse_mode: 'HTML' },
    );
  } catch (notifyError) {
    console.error(`No se pudo notificar al usuario ${targetId}:`, notifyError.message);
    await bot.sendMessage(chatId, '⚠️ No se pudo notificar al cliente (posiblemente bloqueó el bot).');
  }
}

async function applyDiasOff(bot, chatId, oldMessageId, targetId) {
  const targetUser = await getUser(targetId);

  if (!targetUser) {
    await safeDeleteMessage(bot, chatId, oldMessageId);
    await bot.sendMessage(chatId, '❌ Ese usuario no está registrado.');
    return;
  }

  const displayName = getUserDisplayName(targetUser);

  await updateUser(targetId, {
    voucher: {
      ...(targetUser.voucher || {}),
      active: false,
      expiresAt: null,
    },
  });

  await bot.editMessageText(`✅ <b>Plan de Voucher desactivado</b>\n\n👤 Usuario ➣ ${displayName}`, {
    chat_id: chatId,
    message_id: oldMessageId,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [] },
  });

  try {
    await bot.sendMessage(targetId, '⚠️ <b>Tu Plan de Voucher fue desactivado</b>', { parse_mode: 'HTML' });
  } catch (notifyError) {
    console.error(`No se pudo notificar al usuario ${targetId}:`, notifyError.message);
    await bot.sendMessage(chatId, '⚠️ No se pudo notificar al cliente (posiblemente bloqueó el bot).');
  }
}

// ─── COMANDO PRINCIPAL ───────────────────

function registerDiasCommand(bot) {
  bot.onText(/\/dias (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;
    const input = match[1].trim();

    try {
      const permitido = await isAdmin(senderId);

      if (!permitido) {
        return bot.sendMessage(chatId, '❌ No tienes permisos para usar este comando.');
      }

      const targetId = Number(input);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        return bot.sendMessage(chatId, '❌ Debes ingresar un telegramId válido.\n\nUso: /dias telegramId');
      }

      const targetUser = await getUser(targetId);

      if (!targetUser) {
        return bot.sendMessage(chatId, '❌ Ese usuario no está registrado.');
      }

      pendingCustomDias.delete(senderId);
      pendingDiasAction.delete(senderId);

      return bot.sendMessage(chatId, buildDiasMenuMessage(targetUser), {
        parse_mode: 'HTML',
        reply_markup: buildDiasKeyboard(targetId),
      });
    } catch (error) {
      console.error('Error en /dias:', error.message);
      await bot.sendMessage(chatId, '❌ Ocurrió un error al procesar el comando.');
    }
  });

  // ─── CALLBACKS ─────────────────────────

  bot.on('callback_query', async (query) => {
    const data = query.data || '';

    if (!data.startsWith('dias:')) return;

    const senderId = query.from.id;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;

    if (!chatId || !messageId) {
      return bot.answerCallbackQuery(query.id, { text: 'No se pudo procesar la solicitud' });
    }

    if (diasProcessingUsers.has(senderId)) {
      return bot.answerCallbackQuery(query.id, { text: 'Ya tienes una solicitud en proceso' });
    }

    try {
      const admin = await isAdmin(senderId);

      if (!admin) {
        return bot.answerCallbackQuery(query.id, { text: 'No autorizado' });
      }

      diasProcessingUsers.add(senderId);

      const parts = data.split(':');
      const action = parts[1];
      const targetIdRaw = parts[2];
      const extra = parts[3];
      const targetId = Number(targetIdRaw);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        diasProcessingUsers.delete(senderId);
        return bot.answerCallbackQuery(query.id, { text: 'Usuario inválido' });
      }

      // ── Eligió +días → muestra confirmación ────────────
      if (action === 'pick_add') {
        const dias = Number(extra);
        const targetUser = await getUser(targetId);

        if (!targetUser) {
          diasProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado' });
          return;
        }

        if (dias < 0 && getCurrentDaysRemaining(targetUser) <= 0) {
          diasProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, {
            text: 'Este usuario no tiene días activos para quitar',
            show_alert: true,
          });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Confirma el cambio' });
        await bot.editMessageText(buildConfirmAddMessage(targetUser, dias), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: buildConfirmKeyboard(targetId),
        });

        pendingDiasAction.set(senderId, { type: 'add', targetId, dias, chatId, messageId });

        diasProcessingUsers.delete(senderId);
        return;
      }

      // ── Eligió ilimitado → muestra confirmación ─────────
      if (action === 'pick_ilimitado') {
        const targetUser = await getUser(targetId);

        if (!targetUser) {
          diasProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado' });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Confirma el cambio' });
        await bot.editMessageText(buildConfirmIlimitadoMessage(targetUser), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: buildConfirmKeyboard(targetId),
        });

        pendingDiasAction.set(senderId, { type: 'ilimitado', targetId, chatId, messageId });

        diasProcessingUsers.delete(senderId);
        return;
      }

      // ── Eligió desactivar → muestra confirmación ────────
      if (action === 'pick_off') {
        const targetUser = await getUser(targetId);

        if (!targetUser) {
          diasProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado' });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Confirma el cambio' });
        await bot.editMessageText(buildConfirmOffMessage(targetUser), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: buildConfirmKeyboard(targetId),
        });

        pendingDiasAction.set(senderId, { type: 'off', targetId, chatId, messageId });

        diasProcessingUsers.delete(senderId);
        return;
      }

      // ── Confirmar acción pendiente ──────────────────────
      if (action === 'confirm') {
        const pendingAction = pendingDiasAction.get(senderId);

        if (!pendingAction || pendingAction.targetId !== targetId) {
          diasProcessingUsers.delete(senderId);
          await bot.answerCallbackQuery(query.id, { text: 'Sesión expirada, vuelve a intentarlo' });
          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Procesando...' });
        pendingDiasAction.delete(senderId);
        pendingCustomDias.delete(senderId);

        if (pendingAction.type === 'add') {
          await applyDiasChange(bot, chatId, messageId, targetId, pendingAction.dias);
        } else if (pendingAction.type === 'ilimitado') {
          await applyDiasIlimitado(bot, chatId, messageId, targetId);
        } else if (pendingAction.type === 'off') {
          await applyDiasOff(bot, chatId, messageId, targetId);
        }

        diasProcessingUsers.delete(senderId);
        return;
      }

      // ── Otro monto → pide input vía reply ───────────────
      if (action === 'custom') {
        await bot.answerCallbackQuery(query.id, { text: 'Ingresa la cantidad de días' });
        await safeDeleteMessage(bot, chatId, messageId);

        const sentMessage = await bot.sendMessage(chatId, buildDiasCustomMessage(targetId), {
          parse_mode: 'HTML',
          reply_markup: { force_reply: true, selective: true },
        });

        pendingCustomDias.set(senderId, {
          targetId,
          chatId,
          messageId: sentMessage.message_id,
        });

        diasProcessingUsers.delete(senderId);
        return;
      }

      // ── Regresar al menú principal ──────────────────────
      if (action === 'back') {
        const targetUser = await getUser(targetId);

        pendingDiasAction.delete(senderId);
        pendingCustomDias.delete(senderId);

        await bot.answerCallbackQuery(query.id, { text: 'Regresando...' });

        if (targetUser) {
          await bot.editMessageText(buildDiasMenuMessage(targetUser), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: buildDiasKeyboard(targetId),
          });
        } else {
          await safeDeleteMessage(bot, chatId, messageId);
          await bot.sendMessage(chatId, 'Usuario no encontrado');
        }

        diasProcessingUsers.delete(senderId);
        return;
      }

      // ── Cancelar ─────────────────────────────────────────
      if (action === 'cancel') {
        pendingCustomDias.delete(senderId);
        pendingDiasAction.delete(senderId);

        await bot.answerCallbackQuery(query.id, { text: 'Cancelado' });
        await safeDeleteMessage(bot, chatId, messageId);

        diasProcessingUsers.delete(senderId);
        return;
      }

      diasProcessingUsers.delete(senderId);
      return bot.answerCallbackQuery(query.id, { text: 'Acción no válida' });
    } catch (error) {
      diasProcessingUsers.delete(senderId);
      console.error('Error en callback de /dias:', error.message);
      await bot.answerCallbackQuery(query.id, { text: 'Error al procesar' });
    }
  });

  // ─── LISTENER DE MENSAJES (monto custom via reply) ────

  bot.on('message', async (msg) => {
    const senderId = msg.from?.id;
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!senderId || !chatId || !text || text.startsWith('/')) return;

    const pending = pendingCustomDias.get(senderId);

    if (!pending || pending.chatId !== chatId) return;

    if (diasProcessingUsers.has(senderId)) {
      return bot.sendMessage(chatId, 'Ya tienes una solicitud en proceso. Espera un momento.');
    }

    try {
      const admin = await isAdmin(senderId);

      if (!admin) {
        pendingCustomDias.delete(senderId);
        return bot.sendMessage(chatId, 'No autorizado');
      }

      await safeDeleteMessage(bot, chatId, msg.message_id);
      await safeDeleteMessage(bot, chatId, pending.messageId);

      if (/^cancelar$/i.test(text)) {
        pendingCustomDias.delete(senderId);
        return;
      }

      const dias = Number(text);

      if (!Number.isInteger(dias) || dias === 0) {
        pendingCustomDias.delete(senderId);
        await bot.sendMessage(chatId, 'Debes ingresar un número entero de días, la operación fue cancelada.');
        return;
      }

      const targetUser = await getUser(pending.targetId);

      if (!targetUser) {
        pendingCustomDias.delete(senderId);
        await bot.sendMessage(chatId, '❌ Ese usuario no está registrado.');
        return;
      }

      if (dias < 0 && getCurrentDaysRemaining(targetUser) <= 0) {
        pendingCustomDias.delete(senderId);
        await bot.sendMessage(chatId, '❌ Este usuario no tiene días activos para quitar, la operación fue cancelada.');
        return;
      }

      const sentMessage = await bot.sendMessage(chatId, buildConfirmAddMessage(targetUser, dias), {
        parse_mode: 'HTML',
        reply_markup: buildConfirmKeyboard(pending.targetId),
      });

      pendingDiasAction.set(senderId, {
        type: 'add',
        targetId: pending.targetId,
        dias,
        chatId,
        messageId: sentMessage.message_id,
      });

      pendingCustomDias.delete(senderId);
    } catch (error) {
      pendingCustomDias.delete(senderId);
      console.error('Error procesando días manual en /dias:', error.message);
      await bot.sendMessage(chatId, 'Error al actualizar días');
    }
  });
}

module.exports = registerDiasCommand;
