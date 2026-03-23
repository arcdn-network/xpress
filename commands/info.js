const User = require('../models/users');
const { APP_NAME } = require('../utils/constants');

const { findClientByEmail } = require('../sevices/clients');
const { formatDate } = require('../utils/functions');
const { sendMessage } = require('../utils/sender');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildProducts(client) {
  const products = [];

  if (client.payment) {
    products.push('YAPE');
  }

  if (client.bcp) {
    products.push('BCP');
  }

  if (client.ibk) {
    products.push('INTERBANK');
  }

  if (client.bbva) {
    products.push('BBVA');
  }

  return products.length ? products.join(', ') : 'NINGUNO';
}

function buildSuggestedCommands(client) {
  const email = client.email;
  const missing = [];

  if (!client.bcp) {
    missing.push('bcp');
  }

  if (!client.ibk) {
    missing.push('ibk');
  }

  if (!client.bbva) {
    missing.push('bbva');
  }

  const lines = [];

  lines.push('🚀 <b>ACTIVACIONES</b>');
  lines.push('');

  if (!client.payment) {
    lines.push('<b>🔹 YAPE</b> (⭐ <b>20 créditos</b>)');
    lines.push(`<code>/activate ${email}</code>`);
    lines.push('');
  }

  if (missing.length >= 1) {
    lines.push('<b>🔹 YAPE + 1 BANCA</b> (⭐ <b>25 créditos</b>)');

    missing.forEach((bank) => {
      lines.push(`<code>/activate ${email}|${bank}</code>`);
    });

    lines.push('');
  }

  if (missing.length >= 2) {
    lines.push('<b>🔹 YAPE + 2 BANCAS</b> (⭐ <b>30 créditos</b>)');

    for (let i = 0; i < missing.length; i++) {
      for (let j = i + 1; j < missing.length; j++) {
        lines.push(`<code>/activate ${email}|${missing[i]},${missing[j]}</code>`);
      }
    }

    lines.push('');
  }

  if (missing.length === 3) {
    lines.push('<b>🔹 YAPE + 3 BANCAS</b> (⭐ <b>35 créditos</b>)');
    lines.push(`<code>/activate ${email}|${missing.join(',')}</code>`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildNotFoundClientMessage(email) {
  return `
<b>[#${APP_NAME}]</b> <b>INFO DE USUARIO</b>
•···························•····························•
[📧] CORREO ➤ <code>${email}</code>
[🔎] REGISTRO ➤ NO ENCONTRADO
•···························•····························•

⚠️ El usuario no se encuentra registrado.
`.trim();
}

function buildBannedClientMessage(client) {
  return `
<b>[#${APP_NAME}]</b> <b>INFO DE USUARIO</b>
•···························•····························•
[📧] CORREO ➤ <code>${client.email}</code>
[🚫] BANEADO ➤ SI
•···························•····························•

⚠️ El usuario está baneado.
`.trim();
}

function buildAvailableClientMessage(client) {
  return `
<b>[#${APP_NAME}]</b> <b>INFO DE USUARIO</b>
•···························•····························•
[📧] CORREO ➤ <code>${client.email}</code>
[👤] TITULAR ➤ ${client.titular || 'NO DEFINIDO'}
[📅] REGISTRADO ➤ ${formatDate(client.createdAt)}
[👾] ESTADO ➤ ${client.status ? 'ACTIVO' : 'INACTIVO'}
[🚫] BANEADO ➤ NO

[📦] LICENCIAS ➤ ${buildProducts(client)}
•···························•····························•
${buildSuggestedCommands(client)}
•···························•····························•
`.trim();
}

function buildClientInfoMessage(client, email) {
  if (!client) {
    return buildNotFoundClientMessage(email);
  }

  if (client.banned) {
    return buildBannedClientMessage(client);
  }

  return buildAvailableClientMessage(client);
}

function registerInfoCommand(bot) {
  bot.onText(/\/info (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const user = await User.findOne({ telegramId });

      if (!user) {
        return bot.sendMessage(chatId, 'No estás registrado. Usa /register');
      }

      const email = match[1].trim().toLowerCase();

      if (!EMAIL_REGEX.test(email)) {
        return bot.sendMessage(chatId, 'Debes ingresar un correo válido');
      }

      const client = await findClientByEmail(email);
      const response = buildClientInfoMessage(client, email);

      await sendMessage(bot, chatId, {
        text: response,
        filePath: !client || (client && client.banned) ? 'target.png' : 'target.png',
      });
    } catch (error) {
      console.error('Error en /info:', error.message);
      await bot.sendMessage(chatId, 'Error al consultar la información del cliente');
    }
  });
}

module.exports = registerInfoCommand;
