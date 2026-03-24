const User = require('../models/users');
const { sendMessage } = require('../utils/sender');
const { formatDate } = require('../utils/functions');
const { buildButtonsCreditsWithApk, buildButtonsCredits, APP_NAME, LOCAL } = require('../utils/constants');
const { getFiles, saveFileTelegram } = require('../utils/files');

function buildStartMessage(firstName) {
  return `
Hola, que tal <b>${firstName}</b>? Bienvenido a <b>${APP_NAME}</b>!

Para utilizar este bot primero debes registrarte utilizando:
<b>/register</b>

[👤] Para visualizar tu perfil <b>/me</b>
[🧾] Para visualizar comandos <b>/cmds</b>
[💰] Para visualizar los precios <b>/buy</b>
[❓] Si tienes alguna consulta respecto a <b>${APP_NAME}</b> puedes contactar con <b>(@dev_lguss)</b>
`.trim();
}

function buildRegisterSuccessMessage(firstName, user) {
  return `
<b>${firstName}</b> te registraste correctamente ✅

[〽️] ROL ➤ USUARIO
[📅] REGISTRADO ➤ ${formatDate(user.registeredAt)}

Actualmente cuentas con <b>${user.credits} créditos</b>.
Para comprar créditos haz click en el enlace de abajo.
`.trim();
}

function buildAlreadyRegisteredMessage(firstName) {
  return `[⚠] Estimado <b>${firstName}</b> ya te encuentras registrado en <b>${APP_NAME}</b> 🧑‍🦯`.trim();
}

async function sendWelcomeMessage(bot, chatId, text, replyMarkup) {
  const files = getFiles();

  if (files.WELCOME_IMAGE) {
    return sendMessage(bot, chatId, {
      text,
      fileId: files.WELCOME_IMAGE,
      replyMarkup,
    });
  }

  const telegramResponse = await sendMessage(bot, chatId, {
    text,
    filePath: LOCAL.WELCOME_IMAGE,
    replyMarkup,
  });

  saveFileTelegram(telegramResponse, 'WELCOME_IMAGE');

  return telegramResponse;
}

function registerStartCommand(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || 'usuario';

    try {
      const response = buildStartMessage(firstName);
      await sendWelcomeMessage(bot, chatId, response, buildButtonsCreditsWithApk());
    } catch (error) {
      console.error('Error en /start:', error.message);
      await bot.sendMessage(chatId, 'Error al mostrar el mensaje de bienvenida');
    }
  });

  bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || 'usuario';

    try {
      const telegramId = msg.from.id;
      const username = msg.from.username || '';

      let user = await User.findOne({ telegramId });

      if (user) {
        if (user.username !== username) {
          user.username = username;
          await user.save();
        }

        const response = buildAlreadyRegisteredMessage(firstName);

        await bot.sendMessage(chatId, response, {
          parse_mode: 'HTML',
        });

        return;
      }

      user = await User.create({
        telegramId,
        username,
        registeredAt: new Date(),
        credits: 0,
        status: 'activo',
        role: 'user',
      });

      const response = buildRegisterSuccessMessage(firstName, user);
      await sendWelcomeMessage(bot, chatId, response, buildButtonsCredits());
    } catch (error) {
      console.error('Error en /register:', error.message);
      await bot.sendMessage(chatId, 'Error al procesar tu registro');
    }
  });
}

module.exports = registerStartCommand;
