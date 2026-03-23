const User = require('../models/users');
const ActivationLog = require('../models/activation_logs');
const { findClientByEmail, updateClientById } = require('../sevices/clients');
const { sendMessage } = require('../utils/sender');
const { buildButtonsCredits, APP_NAME } = require('../utils/constants');

const BASE_ACTIVATION_COST = 20;
const EXTRA_BANK_COST = 5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVATION_TTL_MS = 2 * 60 * 1000;
const ACTIVATION_IMAGE = 'target.png';
const RECHARGE_IMAGE = 'recharge.png';

const pendingActivations = new Map();
const processingActivations = new Set();
const pendingActivationByUser = new Map();

const pendingActivationFlows = new Map();
const processingActivationFlows = new Set();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUserDisplayName(user) {
  return user?.username ? `@${user.username}` : `ID ${user?.telegramId || ''}`.trim();
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

function buildClientUpdateData(pendingLicenses, currentClient) {
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

  if (!currentClient?.reseller) {
    updateData.reseller = '698bcab283fedfc8230cbc65';
  }

  updateData.currentToken = null;

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

function getClientStatus(client) {
  return {
    YAPE: client.payment === true,
    BCP: client.bcp === true,
    IBK: client.ibk === true,
    BBVA: client.bbva === true,
  };
}

function getAvailableBanks(client) {
  const banks = [];

  if (client.bcp !== true) {
    banks.push('BCP');
  }

  if (client.ibk !== true) {
    banks.push('IBK');
  }

  if (client.bbva !== true) {
    banks.push('BBVA');
  }

  return banks;
}

function getRequestedLicensesFromSelection(selectedBanks = []) {
  const requestedLicenses = ['YAPE'];
  const uniqueBanks = [];
  const seen = new Set();

  for (const bank of selectedBanks) {
    if (['BCP', 'IBK', 'BBVA'].includes(bank) && !seen.has(bank)) {
      seen.add(bank);
      uniqueBanks.push(bank);
    }
  }

  requestedLicenses.push(...uniqueBanks);

  return requestedLicenses;
}

function licensesToRawValue(email, requestedLicenses) {
  const extras = [];

  if (requestedLicenses.includes('BCP')) {
    extras.push('bcp');
  }

  if (requestedLicenses.includes('IBK')) {
    extras.push('ibk');
  }

  if (requestedLicenses.includes('BBVA')) {
    extras.push('bbva');
  }

  return extras.length ? `${email}|${extras.join(',')}` : email;
}

function getMinimumActivationCost(client) {
  if (client.payment !== true) {
    return BASE_ACTIVATION_COST;
  }

  if (client.bcp !== true || client.ibk !== true || client.bbva !== true) {
    return EXTRA_BANK_COST;
  }

  return 0;
}

function buildActivationSuccessMessage(client, user, activatedLicenses, cost, resellerName) {
  return `<b>[#${APP_NAME}]</b> ➣ ACTIVACIÓN COMPLETADA

<b>[📧] CLIENTE</b>
• Correo ➣ <code>${client.email}</code>
• Solicitado por ➣ ${resellerName}

<b>[🔐] LICENCIAS ACTIVADAS</b>
• Licencias ➣ ${activatedLicenses.join(', ')}

<b>[💳] DETALLE</b>
• Costo ➣ ${cost} créditos
• Créditos restantes ➣ ${user.credits}

<b>[✅] RESULTADO</b>
• La activación se completó correctamente.`;
}

function buildAlreadyActivatedMessage(client, resellerName, requestedLicenses) {
  return `<b>[#${APP_NAME}]</b> ➣ SIN CAMBIOS

<b>[📧] CLIENTE</b>
• Correo ➣ <code>${client.email}</code>
• Solicitado por ➣ ${resellerName}

<b>[🔐] LICENCIAS SOLICITADAS</b>
• Licencias ➣ ${requestedLicenses.join(', ')}

<b>[📌] INFORMACIÓN</b>
• Todas las licencias solicitadas ya se encontraban activas.
• No se descontaron créditos.`;
}

function buildFullyActivatedMessage(client, resellerName) {
  return `<b>[#${APP_NAME}]</b> ➣ CUENTA YA ACTIVADA

<b>[📧] CLIENTE</b>
• Correo ➣ <code>${client.email}</code>
• Solicitado por ➣ ${resellerName}

<b>[🔐] LICENCIAS DISPONIBLES</b>
• Estado ➣ YAPE, BCP, IBK y BBVA ya están activas

<b>[📌] INFORMACIÓN</b>
• Esta cuenta ya tiene activadas todas las licencias disponibles.
• No hay productos pendientes por activar.`;
}

function buildInsufficientCreditsMessage(user, cost) {
  return `<b>[#${APP_NAME}]</b> ➣ CRÉDITOS INSUFICIENTES

<b>[⚠️] REQUISITO</b>
• Créditos necesarios ➣ ${cost}

<b>[🙎‍♂️] TU ESTADO</b>
• Créditos actuales ➣ ${user.credits}

<b>[📌] INFORMACIÓN</b>
• No cuentas con créditos suficientes.
• Para recargar créditos usa /buy`;
}

function buildConfirmActivationMessage(client, pendingLicenses, cost) {
  return `<b>[#${APP_NAME}]</b> ➣ CONFIRMAR ACTIVACIÓN

<b>[📧] CLIENTE</b>
• Correo ➣ <code>${client.email}</code>

<b>[🔐] LICENCIAS</b>
• Productos ➣ ${pendingLicenses.join(' + ')}

<b>[💰] COSTO</b>
• Créditos ➣ ${cost}`;
}

function buildCanceledActivationMessage() {
  return `<b>[#${APP_NAME}]</b> ➣ ACTIVACIÓN CANCELADA

<b>[📌] INFORMACIÓN</b>
• La activación fue cancelada correctamente.`;
}

function buildActivationSelectorMessage(client, user, selectedBanks = []) {
  const status = getClientStatus(client);
  const requestedLicenses = getRequestedLicensesFromSelection(selectedBanks);
  const pendingLicenses = getPendingLicenses(client, requestedLicenses);
  const cost = getActivationCost(pendingLicenses);
  const insufficientCredits = cost > user.credits;

  return `<b>[#${APP_NAME}]</b> ➣ ACTIVAR LICENCIAS

<b>[📧] CLIENTE</b>
• Correo ➣ <code>${client.email}</code>

<b>[🙎‍♂️] TU ESTADO</b>
• Saldo ➣ ${user.credits} créditos

<b>[🔐] LICENCIAS DISPONIBLES</b>
${status.YAPE ? '🔒 <b>YAPE</b> ya activo' : '✅ <b>YAPE</b>'}
${status.BCP ? '🔒 <b>BCP</b> ya activo' : `${selectedBanks.includes('BCP') ? '✅' : '⬜'} <b>BCP</b>`}
${status.IBK ? '🔒 <b>INTERBANK</b> ya activo' : `${selectedBanks.includes('IBK') ? '✅' : '⬜'} <b>INTERBANK</b>`}
${status.BBVA ? '🔒 <b>BBVA</b> ya activo' : `${selectedBanks.includes('BBVA') ? '✅' : '⬜'} <b>BBVA</b>`}

<b>[${insufficientCredits ? '⚠️' : '💰'}] COSTO</b>
• Total ➣ ${insufficientCredits ? 'No tienes créditos suficientes.' : `${cost} créditos`}`;
}

function buildActivationSelectorKeyboard(telegramId, client, user, selectedBanks = []) {
  const banksRow = [];

  if (client.bcp !== true) {
    banksRow.push({
      text: `${selectedBanks.includes('BCP') ? '✅' : '⬜'} BCP`,
      callback_data: `activate_flow:${telegramId}:toggle:BCP`,
    });
  }

  if (client.ibk !== true) {
    banksRow.push({
      text: `${selectedBanks.includes('IBK') ? '✅' : '⬜'} IBK`,
      callback_data: `activate_flow:${telegramId}:toggle:IBK`,
    });
  }

  if (client.bbva !== true) {
    banksRow.push({
      text: `${selectedBanks.includes('BBVA') ? '✅' : '⬜'} BBVA`,
      callback_data: `activate_flow:${telegramId}:toggle:BBVA`,
    });
  }

  const keyboard = [];

  if (banksRow.length > 0) {
    keyboard.push(banksRow);
  }

  keyboard.push([{ text: '➡️ CONTINUAR', callback_data: `activate_flow:${telegramId}:continue` }]);
  keyboard.push([{ text: '❌ CANCELAR', callback_data: `activate_flow:${telegramId}:cancel` }]);

  return {
    inline_keyboard: keyboard,
  };
}

function buildActivationConfirmKeyboard(confirmId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ CONFIRMAR', callback_data: `activate_confirm_${confirmId}` },
        { text: '❌ CANCELAR', callback_data: `activate_cancel_${confirmId}` },
      ],
      [{ text: '⬅️ REGRESAR', callback_data: `activate_back_${confirmId}` }],
    ],
  };
}

async function safeDeleteMessage(bot, chatId, messageId) {
  if (!chatId || !messageId) {
    return;
  }

  await bot.deleteMessage(chatId, messageId).catch(() => {});
}

async function safeEditCaption(bot, chatId, messageId, caption, replyMarkup) {
  if (!chatId || !messageId) {
    return;
  }

  await bot
    .editMessageCaption(caption, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    })
    .catch(() => {});
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

function clearActivationFlow(telegramId) {
  pendingActivationFlows.delete(telegramId);
  processingActivationFlows.delete(telegramId);
}

function setActivationTimeout(bot, confirmId) {
  return setTimeout(async () => {
    const payload = pendingActivations.get(confirmId);

    if (!payload) {
      processingActivations.delete(confirmId);
      return;
    }

    await safeDeleteMessage(bot, payload.chatId, payload.messageId);
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
    await safeDeleteMessage(bot, previousPayload.chatId, previousPayload.messageId);
  }

  clearActivationState(previousConfirmId);
}

async function replacePendingActivationFlow(bot, telegramId) {
  const previousFlow = pendingActivationFlows.get(telegramId);

  if (!previousFlow) {
    return;
  }

  await safeDeleteMessage(bot, previousFlow.chatId, previousFlow.messageId);
  clearActivationFlow(telegramId);
}

async function openActivationSelector(bot, flow) {
  const freshUser = await User.findOne({ telegramId: flow.telegramId });

  if (!freshUser) {
    await safeDeleteMessage(bot, flow.chatId, flow.messageId);
    clearActivationFlow(flow.telegramId);
    return;
  }

  const text = buildActivationSelectorMessage(flow.client, freshUser, flow.selectedBanks);
  const replyMarkup = buildActivationSelectorKeyboard(flow.telegramId, flow.client, freshUser, flow.selectedBanks);

  await safeEditCaption(bot, flow.chatId, flow.messageId, text, replyMarkup);

  pendingActivationFlows.set(flow.telegramId, {
    ...flow,
    user: freshUser,
    step: 'select',
  });
}

async function openActivationConfirmation(
  bot,
  chatId,
  messageId,
  telegramId,
  client,
  requestedLicenses,
  rawValue,
  previousSelectedBanks = [],
) {
  const user = await User.findOne({ telegramId });

  if (!user) {
    await bot.sendMessage(chatId, 'No estás registrado. Usa /register');
    return;
  }

  const freshClient = await findClientByEmail(client.email);

  if (!freshClient) {
    await bot.sendMessage(chatId, 'El correo ingresado no existe');
    return;
  }

  if (freshClient.banned) {
    await bot.sendMessage(chatId, 'No es posible activar esta cuenta porque el cliente se encuentra baneado');
    return;
  }

  const pendingLicenses = getPendingLicenses(freshClient, requestedLicenses);
  const cost = getActivationCost(pendingLicenses);
  const resellerName = getUserDisplayName(user);

  if (pendingLicenses.length === 0) {
    await safeDeleteMessage(bot, chatId, messageId);
    await bot.sendMessage(chatId, buildAlreadyActivatedMessage(freshClient, resellerName, requestedLicenses), {
      parse_mode: 'HTML',
    });
    return;
  }

  if (user.credits < cost) {
    await safeDeleteMessage(bot, chatId, messageId);
    await sendMessage(bot, chatId, {
      text: buildInsufficientCreditsMessage(user, cost),
      filePath: RECHARGE_IMAGE,
      replyMarkup: buildButtonsCredits(),
    });
    return;
  }

  await replacePendingActivation(bot, telegramId);

  const confirmId = `${telegramId}_${Date.now()}`;
  const confirmText = buildConfirmActivationMessage(freshClient, pendingLicenses, cost);

  await safeEditCaption(bot, chatId, messageId, confirmText, buildActivationConfirmKeyboard(confirmId));

  const timeoutId = setActivationTimeout(bot, confirmId);

  pendingActivations.set(confirmId, {
    telegramId,
    chatId,
    messageId,
    clientId: freshClient._id ? String(freshClient._id) : null,
    clientEmail: freshClient.email,
    requestedLicenses,
    rawValue,
    timeoutId,
    previousSelectedBanks,
  });

  pendingActivationByUser.set(telegramId, confirmId);
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

    if (
      !data.startsWith('activate_confirm_') &&
      !data.startsWith('activate_cancel_') &&
      !data.startsWith('activate_back_') &&
      !data.startsWith('activate_flow:')
    ) {
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

        await safeDeleteMessage(bot, chatId, messageId);
        await bot.sendMessage(chatId, buildCanceledActivationMessage(), {
          parse_mode: 'HTML',
        });

        return;
      }

      if (data.startsWith('activate_back_')) {
        confirmId = data.replace('activate_back_', '');

        const payload = pendingActivations.get(confirmId);

        if (!payload) {
          await bot.answerCallbackQuery(query.id, {
            text: 'La confirmación expiró o ya fue procesada',
          });
          return;
        }

        if (query.from.id !== payload.telegramId) {
          await bot.answerCallbackQuery(query.id, {
            text: 'No puedes regresar en esta activación',
          });
          return;
        }

        const user = await User.findOne({ telegramId: payload.telegramId });
        const client = await findClientByEmail(payload.clientEmail);

        clearActivationState(confirmId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Regresando...',
        });

        if (!user || !client) {
          await safeDeleteMessage(bot, chatId, messageId);
          await bot.sendMessage(chatId, 'No fue posible regresar al menú de activación.');
          return;
        }

        const selectedBanks = payload.previousSelectedBanks || [];

        await safeEditCaption(
          bot,
          chatId,
          messageId,
          buildActivationSelectorMessage(client, user, selectedBanks),
          buildActivationSelectorKeyboard(payload.telegramId, client, user, selectedBanks),
        );

        pendingActivationFlows.set(payload.telegramId, {
          telegramId: payload.telegramId,
          chatId,
          messageId,
          client,
          user,
          step: 'select',
          selectedBanks,
        });

        return;
      }

      if (data.startsWith('activate_confirm_')) {
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

          await safeDeleteMessage(bot, chatId, messageId);
          await bot.sendMessage(chatId, '❌ No fue posible completar la activación.');

          return;
        }

        const client = await findClientByEmail(clientEmail);

        if (!client || String(client._id) !== String(clientId)) {
          clearActivationState(confirmId);

          await bot.answerCallbackQuery(query.id, {
            text: 'Cliente no disponible',
          });

          await safeDeleteMessage(bot, chatId, messageId);
          await bot.sendMessage(chatId, '❌ El cliente ya no se encuentra disponible.');

          return;
        }

        if (client.banned) {
          clearActivationState(confirmId);

          await bot.answerCallbackQuery(query.id, {
            text: 'Cliente baneado',
          });

          await safeDeleteMessage(bot, chatId, messageId);
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

          await safeDeleteMessage(bot, chatId, messageId);
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

          await safeDeleteMessage(bot, chatId, messageId);
          await sendMessage(bot, chatId, {
            text: buildInsufficientCreditsMessage(user, cost),
            filePath: RECHARGE_IMAGE,
            replyMarkup: buildButtonsCredits(),
          });

          return;
        }

        await bot.answerCallbackQuery(query.id, {
          text: 'Procesando activación...',
        });

        await safeEditCaption(bot, chatId, messageId, `<b>[#${APP_NAME}]</b> ➣ PROCESANDO ACTIVACIÓN`, {
          inline_keyboard: [],
        });

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

        await safeEditCaption(
          bot,
          chatId,
          messageId,
          buildActivationSuccessMessage(client, user, pendingLicenses, cost, resellerName),
          { inline_keyboard: [] },
        );

        clearActivationState(confirmId);
        return;
      }

      if (data.startsWith('activate_flow:')) {
        const parts = data.split(':');
        const ownerId = Number(parts[1]);
        const action = parts[2];
        const value = parts.slice(3).join(':');
        const telegramId = query.from.id;

        if (telegramId !== ownerId) {
          await bot.answerCallbackQuery(query.id, {
            text: 'No puedes usar esta activación',
          });
          return;
        }

        const flow = pendingActivationFlows.get(telegramId);

        if (!flow) {
          await bot.answerCallbackQuery(query.id, {
            text: 'La selección expiró o ya fue procesada',
          });
          return;
        }

        if (processingActivationFlows.has(telegramId)) {
          await bot.answerCallbackQuery(query.id, {
            text: '⏳ Ya se está procesando...',
          });
          return;
        }

        processingActivationFlows.add(telegramId);

        if (action === 'cancel') {
          await bot.answerCallbackQuery(query.id, {
            text: 'Cancelado',
          });

          await safeDeleteMessage(bot, chatId, messageId);
          clearActivationFlow(telegramId);
          return;
        }

        if (action === 'toggle') {
          if (!getAvailableBanks(flow.client).includes(value)) {
            processingActivationFlows.delete(telegramId);
            await bot.answerCallbackQuery(query.id, {
              text: 'Esa licencia ya está activa',
            });
            return;
          }

          const nextSelectedBanks = flow.selectedBanks.includes(value)
            ? flow.selectedBanks.filter((item) => item !== value)
            : [...flow.selectedBanks, value];

          const uniqueBanks = [];
          const seen = new Set();

          for (const bank of nextSelectedBanks) {
            if (getAvailableBanks(flow.client).includes(bank) && !seen.has(bank)) {
              seen.add(bank);
              uniqueBanks.push(bank);
            }
          }

          const nextFlow = {
            ...flow,
            selectedBanks: uniqueBanks,
          };

          await bot.answerCallbackQuery(query.id, {
            text: 'Actualizado',
          });

          await openActivationSelector(bot, nextFlow);
          processingActivationFlows.delete(telegramId);
          return;
        }

        if (action === 'continue') {
          const freshUser = await User.findOne({ telegramId });

          if (!freshUser) {
            processingActivationFlows.delete(telegramId);
            await bot.answerCallbackQuery(query.id, {
              text: 'Usuario no encontrado',
            });
            return;
          }

          const requestedLicenses = getRequestedLicensesFromSelection(flow.selectedBanks);
          const pendingLicenses = getPendingLicenses(flow.client, requestedLicenses);
          const cost = getActivationCost(pendingLicenses);

          if (pendingLicenses.length === 0) {
            processingActivationFlows.delete(telegramId);
            await bot.answerCallbackQuery(query.id, {
              text: 'No hay licencias pendientes para activar',
            });
            return;
          }

          if (cost > freshUser.credits) {
            processingActivationFlows.delete(telegramId);
            await bot.answerCallbackQuery(query.id, {
              text: 'No tienes créditos suficientes',
              show_alert: true,
            });

            await safeEditCaption(
              bot,
              flow.chatId,
              flow.messageId,
              buildActivationSelectorMessage(flow.client, freshUser, flow.selectedBanks),
              buildActivationSelectorKeyboard(telegramId, flow.client, freshUser, flow.selectedBanks),
            );

            pendingActivationFlows.set(telegramId, {
              ...flow,
              user: freshUser,
            });

            return;
          }

          const rawValue = licensesToRawValue(flow.client.email, requestedLicenses);

          await bot.answerCallbackQuery(query.id, {
            text: 'Continuando...',
          });

          clearActivationFlow(telegramId);

          await openActivationConfirmation(
            bot,
            flow.chatId,
            flow.messageId,
            telegramId,
            flow.client,
            requestedLicenses,
            rawValue,
            flow.selectedBanks,
          );

          processingActivationFlows.delete(telegramId);
          return;
        }

        processingActivationFlows.delete(telegramId);

        await bot.answerCallbackQuery(query.id, {
          text: 'Acción no válida',
        });
      }
    } catch (error) {
      if (confirmId) {
        clearActivationState(confirmId);
      }

      if (data.startsWith('activate_flow:')) {
        processingActivationFlows.delete(query.from.id);
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
      const user = await User.findOne({ telegramId });

      if (!user) {
        return bot.sendMessage(chatId, 'No estás registrado. Usa /register');
      }

      if (rawValue.includes('|')) {
        return bot.sendMessage(chatId, 'Formato no permitido. Usa únicamente:\n/activate correo@gmail.com');
      }

      const email = rawValue.toLowerCase();

      if (!EMAIL_REGEX.test(email)) {
        return bot.sendMessage(chatId, 'Debes ingresar un correo válido');
      }

      const client = await findClientByEmail(email);

      if (!client) {
        return bot.sendMessage(chatId, 'El correo ingresado no existe');
      }

      if (client.banned) {
        return bot.sendMessage(chatId, 'No es posible activar esta cuenta porque el cliente se encuentra baneado');
      }

      const allActive = client.payment === true && client.bcp === true && client.ibk === true && client.bbva === true;

      if (allActive) {
        return bot.sendMessage(chatId, buildFullyActivatedMessage(client, getUserDisplayName(user)), {
          parse_mode: 'HTML',
        });
      }

      const minimumCost = getMinimumActivationCost(client);

      if (minimumCost > 0 && user.credits < minimumCost) {
        return sendMessage(bot, chatId, {
          text: buildInsufficientCreditsMessage(user, minimumCost),
          filePath: RECHARGE_IMAGE,
          replyMarkup: buildButtonsCredits(),
        });
      }

      await replacePendingActivationFlow(bot, telegramId);

      const initialSelectedBanks = [];

      const sentMessage = await sendMessage(bot, chatId, {
        text: buildActivationSelectorMessage(client, user, initialSelectedBanks),
        filePath: ACTIVATION_IMAGE,
        replyMarkup: buildActivationSelectorKeyboard(telegramId, client, user, initialSelectedBanks),
      });

      pendingActivationFlows.set(telegramId, {
        telegramId,
        chatId,
        messageId: sentMessage.message_id,
        client,
        user,
        step: 'select',
        selectedBanks: initialSelectedBanks,
      });
    } catch (error) {
      console.error('Error en /activate:', error.message);
      await bot.sendMessage(chatId, 'Ocurrió un error al activar la cuenta');
    }
  });
}

module.exports = registerActivateCommand;
