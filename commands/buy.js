const { sendMessage } = require('../utils/sender');
const { buildButtonsCredits, LOCAL } = require('../utils/constants');
const { getFiles, saveFileTelegram } = require('../utils/files');

function buildBuyMessage() {
  return `
💳 <b>TARIFARIO DE CRÉDITOS</b>

🎯 <b>Consumo de créditos</b>
- Yape Fake ➤ 20 créditos
- Banca Fake ➤ 5 créditos

📈 Ganancia reseller: hasta 60%. Precios libres.

🛒 Compra tus créditos aquí 👇
`.trim();
}

function registerBuyCommand(bot) {
  bot.onText(/\/buy/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const response = buildBuyMessage();

      await sendBuyMessage(bot, chatId, response);
    } catch (error) {
      console.error('Error en /buy:', error.message);
      await bot.sendMessage(chatId, 'Error al mostrar la información de compra');
    }
  });
}

async function sendBuyMessage(bot, chatId, text) {
  const files = getFiles();

  if (files.CREDITS_IMAGE) {
    return sendMessage(bot, chatId, {
      text,
      fileId: files.CREDITS_IMAGE,
      replyMarkup: buildButtonsCredits(),
    });
  }

  const telegramResponse = await sendMessage(bot, chatId, {
    text,
    filePath: LOCAL.CREDITS_IMAGE,
    replyMarkup: buildButtonsCredits(),
  });

  saveFileTelegram(telegramResponse, 'CREDITS_IMAGE');

  return telegramResponse;
}

module.exports = registerBuyCommand;
