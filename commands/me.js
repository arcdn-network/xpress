const User = require('../models/users');
const { APP_NAME } = require('../utils/constants');

const { sendMessage } = require('../utils/sender');
const { formatDate } = require('../utils/functions');

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

      await sendMessage(bot, chatId, {
        text: response,
        filePath: 'target.png',
      });
    } catch (error) {
      console.error('Error en /me:', error.message);
      await bot.sendMessage(chatId, 'Error al obtener tu información');
    }
  });
}

function buildProfileTemplate(user, msg) {
  const activationStats = user.activationStats || {
    total: 0,
    yape: 0,
    bcp: 0,
    ibk: 0,
    bbva: 0,
  };

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
