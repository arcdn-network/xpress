const User = require('../models/users');
const path = require('path');
const { sendPhoto } = require('../utils/sender');
const { buildButtonsCredits } = require('../utils/constants');
const { formatDate } = require('../utils/functions');

function buildStartMessage(firstName) {
  return `
Hola, que tal <b>${firstName}</b>? Bienvenido a <b>YapeXpress</b>!

Para utilizar este bot primero debes registrarte utilizando:
<b>/register</b>

[🧾] Para visualizar la lista de comandos utiliza <b>/cmds</b>
[👤] Para visualizar el perfil de tu cuenta usa <b>/me</b>
[💸] Para visualizar los precios <b>/buy</b>
[❓] Si tienes alguna duda o consulta respecto a <b>YapeXpress</b> puedes contactar con <b>(@dev_lguss)</b>
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
  return `[⚠] Estimado <b>${firstName}</b> ya te encuentras registrado en <b>YapeXpress</b> 🧑‍🦯`.trim();
}

function registerStartCommand(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || 'usuario';

    try {
      const response = buildStartMessage(firstName);
      const imagePath = path.join(process.cwd(), 'resources', 'welcome.png');

      await sendPhoto(bot, chatId, imagePath, {
        caption: response,
        replyMarkup: buildButtonsCredits(),
      });
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

      await bot.sendMessage(chatId, response, {
        parse_mode: 'HTML',
        reply_markup: buildButtonsCredits(),
      });
    } catch (error) {
      console.error('Error en /register:', error.message);
      await bot.sendMessage(chatId, 'Error al procesar tu registro');
    }
  });
}

module.exports = registerStartCommand;
