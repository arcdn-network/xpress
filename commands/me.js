const User = require('../models/users');
const path = require('path');
const { sendPhoto } = require('../utils/sender');
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
      const imagePath = path.join(process.cwd(), 'resources', 'target.png');

      await sendPhoto(bot, chatId, imagePath, { caption: response });
    } catch (error) {
      console.error('Error en /me:', error.message);
      await bot.sendMessage(chatId, 'Error al obtener tu información');
    }
  });
}

function buildProfileTemplate(user, msg) {
  const roles = {
    admin: 'ADMIN',
    user: 'USUARIO',
  };

  const activationStats = user.activationStats || {
    total: 0,
    yape: 0,
    bcp: 0,
    ibk: 0,
    bbva: 0,
  };

  return `
<b>[#YapeXpress]</b> <b>PERFIL DE USUARIO</b>
•···························•····························•
➤ <b>INFORMACIÓN DE USUARIO</b>

[🙎‍♂️] ID ➤ <code>${user.telegramId}</code>
[🗒] NOMBRE ➤ ${msg.from.first_name || 'No disponible'}
[⚡] USERNAME ➤ ${user.username ? '@' + user.username : 'Sin username'}

[〽️] ROL ➤ ${roles[user.role] || 'USUARIO'}
[💰] CREDITOS ➤ ${user.credits}
[👾] ESTADO ➤ ${user.status === 'activo' ? 'ACTIVO' : 'NO ACTIVO'}
[📅] REGISTRADO ➤ ${formatDate(user.registeredAt)}

•···························•····························•
➤ <b>RESUMEN DE ACTIVACIONES</b>

[🔎] ACTIVACIONES ➤ ${activationStats.total}
[📦] DETALLE ➤ YAPE: ${activationStats.yape} | BCP: ${activationStats.bcp} | IBK: ${activationStats.ibk} | BBVA: ${activationStats.bbva}
•···························•····························•
`.trim();
}

module.exports = registerMeCommand;
