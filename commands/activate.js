const User = require('../models/users');
const ActivationLog = require('../models/activation_logs');
const { findClientByEmail, updateClientById } = require('../sevices/clients');

const BASE_ACTIVATION_COST = 20;
const EXTRA_BANK_COST = 5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

━━━━━━━━━━━━━━━
💳 <b>Detalle</b>

• Costo: <b>${cost}</b> créditos
• Créditos restantes: <b>${user.credits}</b>

━━━━━━━━━━━━━━━

🚀 Activación completada correctamente.
`.trim();
}

function buildAlreadyActivatedMessage(client, resellerName, requestedLicenses) {
  return `
ℹ️ <b>Sin cambios</b>

📧 <b>Correo:</b> <code>${client.email}</code>
🔐 <b>Licencias solicitadas:</b> ${requestedLicenses.join(', ')}
👤 <b>Solicitado por:</b> ${resellerName}

━━━━━━━━━━━━━━━

Todas las licencias solicitadas ya se encontraban activas.
No se descontaron créditos.
`.trim();
}

function registerActivateCommand(bot) {
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
        return bot.sendMessage(chatId, 'No estás registrado. Usa /start');
      }

      const client = await findClientByEmail(email);

      if (!client) {
        return bot.sendMessage(chatId, 'El correo ingresado no existe');
      }

      if (client.status !== true) {
        return bot.sendMessage(chatId, 'No es posible activar esta cuenta porque el cliente no está habilitado');
      }

      if (client.banned === true) {
        return bot.sendMessage(chatId, 'No es posible activar esta cuenta porque el cliente se encuentra bloqueado');
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
        return bot.sendMessage(
          chatId,
          `No tienes créditos suficientes.\nCosto requerido: ${cost}\nSaldo actual: ${user.credits}`,
        );
      }

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
          commandRaw: rawValue,
        });
      } catch (logError) {
        console.error('Error guardando activation log:', logError.message);
      }

      await bot.editMessageText(buildActivationSuccessMessage(client, user, pendingLicenses, cost, resellerName), {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error en /activate:', error.message);
      await bot.sendMessage(chatId, 'Ocurrió un error al activar la cuenta');
    }
  });
}

module.exports = registerActivateCommand;
