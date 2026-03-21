const User = require('../models/users');
const ActivationLog = require('../models/activation_logs');
const { findClientByEmail, updateClientById } = require('../sevices/clients');
const { sendMessage } = require('../utils/sender');
const { buildButtonsCredits, APP_NAME } = require('../utils/constants');

const BASE_ACTIVATION_COST = 20;
const EXTRA_BANK_COST = 5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVATION_TTL_MS = 2 * 60 * 1000;

const pendingActivations = new Map();
const processingActivations = new Set();
const pendingActivationByUser = new Map();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUserDisplayName(user) {
  return user?.username ? `@${user.username}` : `ID ${user?.telegramId || ''}`.trim();
}

function normalizeProduct(value) {
  const product = value.trim().toLowerCase();

  if (product === 'bcp') return 'BCP';
  if (product === 'bbva') return 'BBVA';
  if (product === 'ibk' || product === 'interbank') return 'IBK';

  return null;
}

function parseActivateInput(value) {
  const separatorCount = (value.match(/\|/g) || []).length;

  if (separatorCount > 1) {
    return {
      email: '',
      requestedLicenses: [],
      invalidProducts: ['Formato inválido'],
    };
  }

  const [emailPart, productsPart] = value.split('|');
  const email = (emailPart || '').trim().toLowerCase();
  const extras = [];
  const invalidProducts = [];
  const seen = new Set();

  if (productsPart) {
    const products = productsPart
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const item of products) {
      const normalized = normalizeProduct(item);

      if (!normalized) {
        invalidProducts.push(item);
        continue;
      }

      if (!seen.has(normalized)) {
        seen.add(normalized);
        extras.push(normalized);
      }
    }
  }

  return {
    email,
    requestedLicenses: ['YAPE', ...extras],
    invalidProducts,
  };
}

function getPendingLicenses(client, requestedLicenses) {
  const pendingLicenses = [];

  if (requestedLicenses.includes('YAPE') && client.payment !== true) {
    pendingLicenses.push('YAPE');
  }

  if (requestedLicenses.includes('BCP') && client.bcp !== true) {
    pendingLicenses.push('BCP');
  }

  if (requestedLicenses.includes('BBVA') && client.bbva !== true) {
    pendingLicenses.push('BBVA');
  }

  if (requestedLicenses.includes('IBK') && client.ibk !== true) {
    pendingLicenses.push('IBK');
  }

  return pendingLicenses;
}

function getActivationCost(licenses) {
  if (!licenses.length) {
    return 0;
  }

  let cost = 0;

  if (licenses.includes('YAPE')) {
    cost += BASE_ACTIVATION_COST;
  }

  const banksCount = licenses.filter((item) => item !== 'YAPE').length;
  cost += banksCount * EXTRA_BANK_COST;

  return cost;
}

function buildClientUpdateData(pendingLicenses) {
  const updateData = {};

  if (pendingLicenses.includes('YAPE')) {
    updateData.payment = true;
  }

  if (pendingLicenses.includes('BCP')) {
    updateData.bcp = true;
  }

  if (pendingLicenses.includes('BBVA')) {
    updateData.bbva = true;
  }

  if (pendingLicenses.includes('IBK')) {
    updateData.ibk = true;
  }

  return updateData;
}

function updateUserActivationStats(user, activatedLicenses) {
  if (!user.activationStats) {
    user.activationStats = {
      yape: 0,
      bcp: 0,
      ibk: 0,
      bbva: 0,
      total: 0,
    };
  }

  if (activatedLicenses.includes('YAPE')) {
    user.activationStats.yape += 1;
  }

  if (activatedLicenses.includes('BCP')) {
    user.activationStats.bcp += 1;
  }

  if (activatedLicenses.includes('IBK')) {
    user.activationStats.ibk += 1;
  }

  if (activatedLicenses.includes('BBVA')) {
    user.activationStats.bbva += 1;
  }

  user.activationStats.total += activatedLicenses.length;
}

function buildActivationSuccessMessage(client, user, activatedLicenses, cost, resellerName) {
  return `
✅ <b>Cuenta activada</b>

📧 <b>Correo:</b> <code>${client.email}</code>
🔐 <b>Licencias:</b> ${activatedLicenses.join(', ')}
👤 <b>Activado por:</b> ${resellerName}

•···························•····························•
💳 <b>Detalle</b>

• Costo: <b>${cost}</b> créditos
• Créditos restantes: <b>${user.credits}</b>

•···························•····························•

🚀 Activación completada correctamente.
`.trim();
}

function buildAlreadyActivatedMessage(client, resellerName, requestedLicenses) {
  return `
ℹ️ <b>Sin cambios</b>

📧 <b>Correo:</b> <code>${client.email}</code>
🔐 <b>Licencias solicitadas:</b> ${requestedLicenses.join(', ')}
👤 <b>Solicitado por:</b> ${resellerName}

•···························•····························•

Todas las licencias solicitadas ya se encontraban activas.
No se descontaron créditos.
`.trim();
}

function buildInsufficientCreditsMessage(user, cost) {
  return `<b>[#${APP_NAME}]</b> ➣ CRÉDITOS INSUFICIENTES

<b>[⚠️] REQUISITO</b>
• Créditos necesarios ➣ ${cost}

<b>[🙎‍♂️] TU ESTADO</b>
• Créditos actuales ➣ ${user.credits}

<b>[📌] INFORMACIÓN</b>
• No cuentas con créditos suficientes.
• Para recargar créditos usa: /buy`;
}

function buildConfirmActivationMessage(client, pendingLicenses, cost, user) {
  return `
⚠️ <b>Confirmar activación</b>

📧 <b>Correo:</b> <code>${client.email}</code>
🔐 <b>Licencias:</b> ${pendingLicenses.join(' + ')}
💰 <b>Costo:</b> ${cost} créditos
💳 <b>Créditos actuales:</b> ${user.credits}
💸 <b>Créditos restantes:</b> ${user.credits - cost}
`.trim();
}

function buildCanceledActivationMessage() {
  return '❌ Activación cancelada';
}

async function deletePendingMessage(bot, payload) {
  if (!payload?.chatId || !payload?.messageId) {
    return;
  }

  await bot.deleteMessage(payload.chatId, payload.messageId).catch(() => {});
}

function clearActivationState(confirmId) {
  const payload = pendingActivations.get(confirmId);

  if (payload?.timeoutId) {
    clearTimeout(payload.timeoutId);
  }

  if (payload?.telegramId) {
    pendingActivationByUser.delete(payload.telegramId);
  }

  pendingActivations.delete(confirmId);
  processingActivations.delete(confirmId);
}

function setActivationTimeout(bot, confirmId) {
  return setTimeout(async () => {
    const payload = pendingActivations.get(confirmId);

    if (!payload) {
      processingActivations.delete(confirmId);
      return;
    }

    await deletePendingMessage(bot, payload);
    clearActivationState(confirmId);
  }, ACTIVATION_TTL_MS);
}

async function replacePendingActivation(bot, telegramId) {
  const previousConfirmId = pendingActivationByUser.get(telegramId);

  if (!previousConfirmId) {
    return;
  }

  const previousPayload = pendingActivations.get(previousConfirmId);

  if (previousPayload) {
    await deletePendingMessage(bot, previousPayload);
  }

  clearActivationState(previousConfirmId);
}

function registerActivateCallback(bot) {
  if (bot._activateCallbackRegistered) {
    return;
  }

  bot._activateCallbackRegistered = true;

  bot.on('callback_query', async (query) => {
    const data = query.data || '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;

    if (!data.startsWith('activate_confirm_') && !data.startsWith('activate_cancel_')) {
      return;
    }

    let confirmId = '';

    try {
      if (data.startsWith('activate_cancel_')) {
        confirmId = data.replace('activate_cancel_', '');

        const payload = pendingActivations.get(confirmId);

        if (!payload) {
          await bot.answerCallbackQuery(query.id, {
            text: 'La confirmación expiró o ya fue procesada',
          });
          return;
        }

        if (query.from.id !== payload.telegramId) {
          await bot.answerCallbackQuery(query.id, {
            text: 'No puedes cancelar esta activación',
          });
          return;
        }

        clearActivationState(confirmId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Activación cancelada',
        });

        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(chatId, buildCanceledActivationMessage());

        return;
      }

      confirmId = data.replace('activate_confirm_', '');

      const payload = pendingActivations.get(confirmId);

      if (!payload) {
        await bot.answerCallbackQuery(query.id, {
          text: 'La confirmación expiró o ya fue procesada',
        });
        return;
      }

      if (query.from.id !== payload.telegramId) {
        await bot.answerCallbackQuery(query.id, {
          text: 'No puedes confirmar esta activación',
        });
        return;
      }

      if (processingActivations.has(confirmId)) {
        await bot.answerCallbackQuery(query.id, {
          text: '⏳ Ya se está procesando...',
        });
        return;
      }

      processingActivations.add(confirmId);

      const { telegramId, clientId, clientEmail, requestedLicenses, rawValue } = payload;

      const user = await User.findOne({ telegramId });

      if (!user) {
        clearActivationState(confirmId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Usuario no encontrado',
        });

        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(chatId, '❌ No fue posible completar la activación.');

        return;
      }

      const client = await findClientByEmail(clientEmail);

      if (!client || String(client._id) !== String(clientId)) {
        clearActivationState(confirmId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Cliente no disponible',
        });

        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(chatId, '❌ El cliente ya no se encuentra disponible.');

        return;
      }

      if (client.banned) {
        clearActivationState(confirmId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Cliente baneado',
        });

        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(chatId, '❌ No es posible activar esta cuenta porque el cliente se encuentra baneado.');

        return;
      }

      const pendingLicenses = getPendingLicenses(client, requestedLicenses);
      const cost = getActivationCost(pendingLicenses);

      if (pendingLicenses.length === 0) {
        clearActivationState(confirmId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Ya estaba activado',
        });

        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(
          chatId,
          buildAlreadyActivatedMessage(client, getUserDisplayName(user), requestedLicenses),
          {
            parse_mode: 'HTML',
          },
        );

        return;
      }

      if (user.credits < cost) {
        clearActivationState(confirmId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Créditos insuficientes',
        });

        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(chatId, buildInsufficientCreditsMessage(user, cost), {
          parse_mode: 'HTML',
        });

        return;
      }

      await bot.answerCallbackQuery(query.id, {
        text: 'Procesando activación...',
      });

      await bot.deleteMessage(chatId, messageId).catch(() => {});

      const loadingMsg = await bot.sendMessage(chatId, '⏳ Procesando activación...');

      await delay(2000);

      const updateData = buildClientUpdateData(pendingLicenses);

      user.credits -= cost;
      updateUserActivationStats(user, pendingLicenses);
      await user.save();

      await updateClientById(client._id, updateData);
      Object.assign(client, updateData);

      try {
        await ActivationLog.create({
          resellerTelegramId: user.telegramId,
          clientId: client._id ? String(client._id) : null,
          clientEmail: client.email,
          activatedLicenses: pendingLicenses,
          creditsCost: cost,
          commandRaw: '/activate ' + rawValue,
        });
      } catch (logError) {
        console.error('Error guardando activation log:', logError.message);
      }

      const resellerName = getUserDisplayName(user);

      await bot.editMessageText(buildActivationSuccessMessage(client, user, pendingLicenses, cost, resellerName), {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        parse_mode: 'HTML',
      });

      clearActivationState(confirmId);
    } catch (error) {
      if (confirmId) {
        clearActivationState(confirmId);
      }

      console.error('Error en callback de activación:', error.message);

      if (chatId) {
        await bot.sendMessage(chatId, '❌ Ocurrió un error al procesar la activación.').catch(() => {});
      }
    }
  });
}

function registerActivateCommand(bot) {
  registerActivateCallback(bot);

  bot.onText(/\/activate (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const rawValue = match[1].trim();

    try {
      const { email, requestedLicenses, invalidProducts } = parseActivateInput(rawValue);

      if (!EMAIL_REGEX.test(email)) {
        return bot.sendMessage(chatId, 'Debes ingresar un correo válido');
      }

      if (invalidProducts.length > 0) {
        return bot.sendMessage(
          chatId,
          `Productos no válidos: ${invalidProducts.join(', ')}\nUsa este formato: /activate correo@gmail.com|bcp,bbva,ibk`,
        );
      }

      const user = await User.findOne({ telegramId });

      if (!user) {
        return bot.sendMessage(chatId, 'No estás registrado. Usa /register');
      }

      const client = await findClientByEmail(email);

      if (!client) {
        return bot.sendMessage(chatId, 'El correo ingresado no existe');
      }

      if (client.banned) {
        return bot.sendMessage(chatId, 'No es posible activar esta cuenta porque el cliente se encuentra baneado');
      }

      const pendingLicenses = getPendingLicenses(client, requestedLicenses);
      const cost = getActivationCost(pendingLicenses);
      const resellerName = getUserDisplayName(user);

      if (pendingLicenses.length === 0) {
        return bot.sendMessage(chatId, buildAlreadyActivatedMessage(client, resellerName, requestedLicenses), {
          parse_mode: 'HTML',
        });
      }

      if (user.credits < cost) {
        return sendMessage(bot, chatId, {
          text: buildInsufficientCreditsMessage(user, cost),
          filePath: 'yapito1.png',
          replyMarkup: buildButtonsCredits(),
        });
      }

      await replacePendingActivation(bot, telegramId);

      const confirmId = `${telegramId}_${Date.now()}`;
      const confirmText = buildConfirmActivationMessage(client, pendingLicenses, cost, user);

      const sentMessage = await sendMessage(bot, chatId, {
        text: confirmText,
        filePath: 'target.png',
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Confirmar', callback_data: `activate_confirm_${confirmId}` },
              { text: '❌ Cancelar', callback_data: `activate_cancel_${confirmId}` },
            ],
          ],
        },
      });

      const timeoutId = setActivationTimeout(bot, confirmId);

      pendingActivations.set(confirmId, {
        telegramId,
        chatId,
        messageId: sentMessage?.message_id || null,
        clientId: client._id ? String(client._id) : null,
        clientEmail: client.email,
        requestedLicenses,
        rawValue,
        timeoutId,
      });

      pendingActivationByUser.set(telegramId, confirmId);
    } catch (error) {
      console.error('Error en /activate:', error.message);
      await bot.sendMessage(chatId, 'Ocurrió un error al activar la cuenta');
    }
  });
}

module.exports = registerActivateCommand;
