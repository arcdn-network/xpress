const User = require('../models/users');
const { APP_NAME, LOCAL } = require('../utils/constants');
const { findClientByEmail } = require('../sevices/clients');
const { formatDate } = require('../utils/functions');
const { sendMessage } = require('../utils/sender');
const { getFiles, saveFileTelegram } = require('../utils/files');

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
[🚫] BANEADO ➤ ${client.banned ? 'SI' : 'NO'}
[📦] LICENCIAS ➤ ${buildProducts(client)}
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
      const files = getFiles();

      if (files.TARGET_IMAGE) {
        return sendMessage(bot, chatId, {
          text: response,
          fileId: files.TARGET_IMAGE,
        });
      }

      const telegramResponse = await sendMessage(bot, chatId, {
        text: response,
        filePath: LOCAL.TARGET_IMAGE,
      });

      saveFileTelegram(telegramResponse, 'TARGET_IMAGE');
    } catch (error) {
      console.error('Error en /info:', error.message);
      await bot.sendMessage(chatId, 'Error al consultar la información del cliente');
    }
  });
}

module.exports = registerInfoCommand;
