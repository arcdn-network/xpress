const { getUser, updateUser, createToken } = require('../utils/api');
const { APP_NAME } = require('../utils/constants');
const { getUnlimitedStatus } = require('../utils/unlimited');

const pendingTokens = new Map();
const pendingTokenConfirms = new Map();

const TOKEN_PRICES = {
  7: 3,
  10: 5,
  15: 7,
  30: 10,
};

function getTokenCost(days) {
  return TOKEN_PRICES[days] ?? null;
}

function buildTokenMessage(user, selectedDays = 7) {
  const cost = getTokenCost(selectedDays);
  const unlimitedStatus = getUnlimitedStatus(user);

  const costoLine = unlimitedStatus.isUnlimited ? '' : `\n<b>[💰] COSTO</b>\n- Créditos ➣ ${cost} créditos`;

  return `<b>[#${APP_NAME}]</b> ➣ GENERAR TOKEN

<b>[🙎‍♂️] TU ESTADO</b>
- Usuario ➣ ${user.username ? '@' + user.username : user.telegramId}
- Saldo ➣ ${unlimitedStatus.isUnlimited ? '♾️ ILIMITADO' : `${user.credits} créditos`}

<b>[⚙️] CONFIGURACIÓN</b>
- Duración ➣ ${selectedDays} días${costoLine}

<b>[📌] INFORMACIÓN</b>
- Selecciona la duración del token.
- Luego presiona generar.`;
}

function buildConfirmTokenMessage(user, selectedDays) {
  const cost = getTokenCost(selectedDays);

  return `<b>[#${APP_NAME}]</b> ➣ CONFIRMAR GENERACIÓN

<b>[🙎‍♂️] TU ESTADO</b>
- Usuario ➣ ${user.username ? '@' + user.username : user.telegramId}
- Saldo ➣ ${user.credits} créditos

<b>[⚙️] CONFIGURACIÓN</b>
- Duración ➣ ${selectedDays} días

<b>[💰] COSTO</b>
- Créditos ➣ ${cost} créditos`;
}

function buildInsufficientCreditsMessage(user, cost) {
  return `<b>[#${APP_NAME}]</b> ➣ CRÉDITOS INSUFICIENTES

<b>[⚠️] REQUISITO</b>
- Créditos necesarios ➣ ${cost}

<b>[🙎‍♂️] TU ESTADO</b>
- Créditos actuales ➣ ${user.credits}

<b>[📌] INFORMACIÓN</b>
- No cuentas con créditos suficientes.
- Para recargar créditos usa /buy`;
}

function buildGeneratedTokenMessage(token, days) {
  return `<b>[✨] YAPE AUTOCOMPLETADO</b>

Token de autocompletado por <b>${days} días</b> generado:
<blockquote>
<code>${token}</code>
</blockquote>

<b>[📲] ¿CÓMO ACTIVARLO?</b>
1. Presiona el ícono de la personita 👤
2. Ingresa a <b>Configuración</b>
3. Busca el apartado <b>"Autocompletado"</b>
4. Pega el token y confirma la activación

<b>[⚡] IMPORTANTE</b>
- El token no tiene fecha de vencimiento.
- El token es válido para una única activación.
- Duración del servicio: <b>${days} días</b>.`;
}

function buildCanceledMessage() {
  return `<b>[#${APP_NAME}]</b> ➣ GENERACIÓN CANCELADA

<b>[📌] INFORMACIÓN</b>
- El proceso fue cancelado correctamente.`;
}

function buildTokenKeyboard(telegramId, selectedDays = 7) {
  const entries = Object.entries(TOKEN_PRICES);
  const keyboard = [];

  for (let i = 0; i < entries.length; i += 2) {
    keyboard.push(
      entries.slice(i, i + 2).map(([days]) => ({
        text: `${selectedDays === Number(days) ? '✅' : '⬜'} ${days} días`,
        callback_data: `token_days:${telegramId}:${days}`,
      })),
    );
  }

  keyboard.push([{ text: '🎟 GENERAR TOKEN', callback_data: `token_generate:${telegramId}` }]);
  keyboard.push([{ text: '❌ CANCELAR', callback_data: `token_cancel:${telegramId}` }]);

  return { inline_keyboard: keyboard };
}

function buildTokenConfirmKeyboard(confirmId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ CONFIRMAR', callback_data: `token_confirm_${confirmId}` },
        { text: '❌ CANCELAR', callback_data: `token_reject_${confirmId}` },
      ],
      [{ text: '⬅️ REGRESAR', callback_data: `token_back_${confirmId}` }],
    ],
  };
}

function clearConfirm(confirmId) {
  pendingTokenConfirms.delete(confirmId);
}

function registerTokenCallback(bot) {
  if (bot._tokenCallbackRegistered) {
    return;
  }

  bot._tokenCallbackRegistered = true;

  bot.on('callback_query', async (query) => {
    const data = query.data || '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const telegramId = query.from.id;

    const isTokenData =
      data.startsWith('token_days:') ||
      data.startsWith('token_generate:') ||
      data.startsWith('token_cancel:') ||
      data.startsWith('token_confirm_') ||
      data.startsWith('token_reject_') ||
      data.startsWith('token_back_');

    if (!isTokenData) return;

    try {
      // ── CANCELAR desde selector ──────────────────────────────────────
      if (data.startsWith('token_cancel:')) {
        const ownerId = Number(data.split(':')[1]);

        if (ownerId !== telegramId) {
          return bot.answerCallbackQuery(query.id, { text: 'No puedes usar este menú' });
        }

        const current = pendingTokens.get(telegramId);

        if (!current || current.messageId !== messageId) {
          return bot.answerCallbackQuery(query.id, { text: 'Este menú ya no está activo', show_alert: true });
        }

        pendingTokens.delete(telegramId);

        await bot.answerCallbackQuery(query.id, { text: 'Cancelado' });
        await bot.editMessageText(buildCanceledMessage(), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        });

        return;
      }

      // ── SELECCIONAR DÍAS ─────────────────────────────────────────────
      if (data.startsWith('token_days:')) {
        const [, ownerIdRaw, daysRaw] = data.split(':');
        const ownerId = Number(ownerIdRaw);
        const days = Number(daysRaw);

        if (ownerId !== telegramId) {
          return bot.answerCallbackQuery(query.id, { text: 'No puedes usar este menú' });
        }

        if (getTokenCost(days) === null) {
          return bot.answerCallbackQuery(query.id, { text: 'Duración no válida', show_alert: true });
        }

        const current = pendingTokens.get(telegramId);

        if (!current || current.messageId !== messageId) {
          return bot.answerCallbackQuery(query.id, { text: 'Este menú ya no está activo', show_alert: true });
        }

        if (current.days === days) {
          return bot.answerCallbackQuery(query.id, { text: `${days} días ya seleccionado` });
        }

        pendingTokens.set(telegramId, { days, messageId });

        const user = await getUser(telegramId);

        await bot.answerCallbackQuery(query.id, { text: `${days} días seleccionado` });
        await bot.editMessageText(buildTokenMessage(user, days), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: buildTokenKeyboard(telegramId, days),
        });

        return;
      }

      // ── GENERAR ──────────────────────────────────────────────────────
      if (data.startsWith('token_generate:')) {
        const ownerId = Number(data.split(':')[1]);

        if (ownerId !== telegramId) {
          return bot.answerCallbackQuery(query.id, { text: 'No puedes usar este menú' });
        }

        const config = pendingTokens.get(telegramId);

        if (!config || config.messageId !== messageId) {
          return bot.answerCallbackQuery(query.id, { text: 'Este menú ya no está activo', show_alert: true });
        }

        const cost = getTokenCost(config.days);

        if (cost === null) {
          return bot.answerCallbackQuery(query.id, { text: 'Duración no válida', show_alert: true });
        }

        const user = await getUser(telegramId);

        if (!user) {
          return bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado', show_alert: true });
        }

        const unlimitedStatus = getUnlimitedStatus(user);

        // Sin confirmación para ilimitados: generar directo
        if (unlimitedStatus.isUnlimited) {
          await bot.answerCallbackQuery(query.id, { text: 'Generando token...' });

          const resp = await createToken({ days: config.days, telegramId });

          if (!resp.status) {
            return bot.sendMessage(chatId, resp.msg || 'No se pudo generar el token');
          }

          pendingTokens.delete(telegramId);

          await bot.editMessageText(buildGeneratedTokenMessage(resp.token, config.days), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
          });

          return;
        }

        // Verificar créditos antes de mostrar confirmación
        if (user.credits < cost) {
          await bot.answerCallbackQuery(query.id);
          await bot.editMessageText(buildInsufficientCreditsMessage(user, cost), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
          });

          return;
        }

        // Limpiar confirmación anterior si existía
        for (const [oldConfirmId, payload] of pendingTokenConfirms.entries()) {
          if (payload.telegramId === telegramId) {
            pendingTokenConfirms.delete(oldConfirmId);
          }
        }

        // Mostrar pantalla de confirmación
        const confirmId = `${telegramId}_${Date.now()}`;

        pendingTokenConfirms.set(confirmId, {
          telegramId,
          chatId,
          messageId,
          days: config.days,
          cost,
        });

        await bot.answerCallbackQuery(query.id, { text: 'Confirma la generación' });
        await bot.editMessageText(buildConfirmTokenMessage(user, config.days), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: buildTokenConfirmKeyboard(confirmId),
        });

        return;
      }

      // ── CONFIRMAR ────────────────────────────────────────────────────
      if (data.startsWith('token_confirm_')) {
        const confirmId = data.replace('token_confirm_', '');
        const payload = pendingTokenConfirms.get(confirmId);

        if (!payload) {
          return bot.answerCallbackQuery(query.id, {
            text: 'La confirmación expiró o ya fue procesada',
            show_alert: true,
          });
        }

        if (payload.telegramId !== telegramId) {
          return bot.answerCallbackQuery(query.id, { text: 'No puedes confirmar esta acción' });
        }

        const user = await getUser(telegramId);

        if (!user) {
          clearConfirm(confirmId);
          return bot.answerCallbackQuery(query.id, { text: 'Usuario no encontrado', show_alert: true });
        }

        const unlimitedStatus = getUnlimitedStatus(user);

        if (!unlimitedStatus.isUnlimited && user.credits < payload.cost) {
          clearConfirm(confirmId);
          await bot.answerCallbackQuery(query.id);
          await bot.editMessageText(buildInsufficientCreditsMessage(user, payload.cost), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
          });

          return;
        }

        await bot.answerCallbackQuery(query.id, { text: 'Generando token...' });

        const resp = await createToken({ days: payload.days, telegramId: payload.telegramId });

        if (!resp.status) {
          clearConfirm(confirmId);
          return bot.sendMessage(chatId, resp.msg || 'No se pudo generar el token');
        }

        const newCredits = user.credits - payload.cost;

        await updateUser(telegramId, { credits: newCredits });

        pendingTokens.delete(telegramId);
        clearConfirm(confirmId);

        await bot.editMessageText(buildGeneratedTokenMessage(resp.token, payload.days), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        });

        return;
      }

      // ── RECHAZAR desde confirmación ──────────────────────────────────
      if (data.startsWith('token_reject_')) {
        const confirmId = data.replace('token_reject_', '');
        const payload = pendingTokenConfirms.get(confirmId);

        if (!payload) {
          return bot.answerCallbackQuery(query.id, {
            text: 'La confirmación expiró o ya fue procesada',
            show_alert: true,
          });
        }

        if (payload.telegramId !== telegramId) {
          return bot.answerCallbackQuery(query.id, { text: 'No puedes cancelar esta acción' });
        }

        clearConfirm(confirmId);
        pendingTokens.delete(telegramId);

        await bot.answerCallbackQuery(query.id, { text: 'Cancelado' });
        await bot.editMessageText(buildCanceledMessage(), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        });

        return;
      }

      // ── REGRESAR desde confirmación ──────────────────────────────────
      if (data.startsWith('token_back_')) {
        const confirmId = data.replace('token_back_', '');
        const payload = pendingTokenConfirms.get(confirmId);

        if (!payload) {
          return bot.answerCallbackQuery(query.id, {
            text: 'La confirmación expiró o ya fue procesada',
            show_alert: true,
          });
        }

        if (payload.telegramId !== telegramId) {
          return bot.answerCallbackQuery(query.id, { text: 'No puedes usar este menú' });
        }

        clearConfirm(confirmId);

        const user = await getUser(telegramId);

        // Restaurar messageId en pendingTokens al regresar
        pendingTokens.set(telegramId, { days: payload.days, messageId: payload.messageId });

        await bot.answerCallbackQuery(query.id, { text: 'Regresando...' });
        await bot.editMessageText(buildTokenMessage(user, payload.days), {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: buildTokenKeyboard(telegramId, payload.days),
        });

        return;
      }
    } catch (error) {
      console.error('Error token:', error.message);
      await bot.sendMessage(chatId, '❌ Ocurrió un error al generar el token').catch(() => {});
    }
  });
}

function registerTokenCommand(bot) {
  registerTokenCallback(bot);

  bot.onText(/\/token/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await getUser(telegramId);

      if (!user) {
        return bot.sendMessage(chatId, 'No estás registrado. Usa /register');
      }

      // Limpiar estado anterior
      pendingTokens.delete(telegramId);

      for (const [confirmId, payload] of pendingTokenConfirms.entries()) {
        if (payload.telegramId === telegramId) {
          pendingTokenConfirms.delete(confirmId);
        }
      }

      const selectedDays = 7;

      const sentMessage = await bot.sendMessage(chatId, buildTokenMessage(user, selectedDays), {
        parse_mode: 'HTML',
        reply_markup: buildTokenKeyboard(telegramId, selectedDays),
      });

      pendingTokens.set(telegramId, { days: selectedDays, messageId: sentMessage.message_id });
    } catch (error) {
      console.error('Error /token:', error.message);
      await bot.sendMessage(chatId, '❌ Ocurrió un error al abrir el generador');
    }
  });
}

module.exports = registerTokenCommand;
