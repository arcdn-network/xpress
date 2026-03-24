const { sendMessage } = require('../utils/sender');
const { buildButtonsCredits, LOCAL } = require('../utils/constants');
const { getFiles, saveFileTelegram } = require('../utils/files');

function buildBuyMessage() {
  return `
💳 <b>COMPRA DE CRÉDITOS</b>

🎯 <b>Consumo de créditos</b>
• Yape Fake ➤ <b>20 créditos</b>
• Bancas Fake ➤ <b>5 créditos</b>

💰 <b>Precio sugerido de venta</b>
• Yape Fake ➤ <b>S/ 40</b>
• Bancas Fake ➤ <b>S/ 15</b>

📊 <b>Ejemplo de combos</b>
• Yape + 1 banca ➤ <b>S/ 50</b>
• Yape + 2 bancas ➤ <b>S/ 60</b>
• Yape + 3 bancas ➤ <b>S/ 70</b>

📈 <b>Ganancia para reseller</b>
Obtienes <b>hasta el 60% de ganancia</b> por venta.
Eres libre de poner tus propios precios.

🛒 <b>Compra tus créditos aquí</b> 👇
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
