const path = require('path');
const fs = require('fs');
const { getBroadcastUsers } = require('../utils/api');
const { getFiles, saveFileTelegram } = require('../utils/files');
const { LOCAL } = require('../utils/constants');

const ADMIN_IDS = [123456789]; // tu telegramId
const RESOURCES_DIR = path.join(__dirname, '../resources'); // 👈 ajusta si tu carpeta resources está en otro nivel

function registerBroadcastCommand(bot) {
  bot.onText(/\/broadcast(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!ADMIN_IDS.includes(msg.from.id)) return;

    const caption = match[1]?.trim();
    if (!caption) {
      return bot.sendMessage(chatId, 'Uso: /broadcast <texto del aviso>');
    }

    try {
      const data = await getBroadcastUsers();
      const users = data.items;

      await bot.sendMessage(chatId, `📤 Enviando aviso a ${users.length} usuarios...`);

      const files = getFiles();
      let fileToSend = files.BROADCAST_IMAGE; // file_id ya subido antes, si existe

      // Si aún no hay file_id, resolvemos el path absoluto del banner local
      const bannerPath = path.join(RESOURCES_DIR, LOCAL.BROADCAST_IMAGE);

      let enviados = 0;
      let fallidos = 0;

      for (const user of users) {
        try {
          const sent = await bot.sendPhoto(
            user.telegramId,
            fileToSend || fs.createReadStream(bannerPath), // 👈 stream si es la primera vez
            { caption, parse_mode: 'HTML' },
          );

          if (!fileToSend) {
            fileToSend = sent.photo[sent.photo.length - 1].file_id;
            saveFileTelegram(sent, 'BROADCAST_IMAGE');
          }

          enviados++;
        } catch (err) {
          fallidos++;
          console.error(`Fallo a ${user.telegramId}:`, err.message);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await bot.sendMessage(chatId, `✅ Enviados: ${enviados} | ❌ Fallidos: ${fallidos}`);
    } catch (error) {
      console.error('Error en /broadcast:', error.message);
      await bot.sendMessage(chatId, 'Error al ejecutar el broadcast');
    }
  });
}

module.exports = registerBroadcastCommand;
