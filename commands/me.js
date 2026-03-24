const User = require('../models/users');
const { APP_NAME, LOCAL } = require('../utils/constants');
const { sendMessage } = require('../utils/sender');
const { formatDate } = require('../utils/functions');
const { getFiles } = require('../utils/files');

function registerMeCommand(bot) {
  bot.onText(/\/me/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const telegramId = msg.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return bot.sendMessage(chatId, 'No estás registrado. Usa /register');
      }

      const response = buildProfileTemplate(user, msg);
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
      console.error('Error en /me:', error.message);
      await bot.sendMessage(chatId, 'Error al obtener tu información');
    }
  });
}

function buildProfileTemplate(user, msg) {
  return `
<b>[#${APP_NAME}]</b> <b>PERFIL DE USUARIO</b>
•···························•····························•
➤ <b>INFORMACIÓN DE USUARIO</b>

[🙎‍♂️] ID ➤ <code>${user.telegramId}</code>
[🗒] NOMBRE ➤ ${msg.from.first_name || 'No disponible'}
[⚡] USERNAME ➤ ${user.username ? '@' + user.username : 'Sin username'}

[📅] REGISTRADO ➤ ${formatDate(user.registeredAt)}
[👾] ESTADO ➤ ${user.status === 'activo' ? 'ACTIVO' : 'NO ACTIVO'}
[💰] CREDITOS ➤ ${user.credits}
•···························•····························•
`.trim();
}

module.exports = registerMeCommand;
