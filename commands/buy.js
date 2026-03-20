const path = require('path');
const { sendPhoto } = require('../utils/sender');
const { buildButtonsCredits, buildPaquetesMessage } = require('../utils/constants');

function buildBuyMessage() {
  const paquetes = buildPaquetesMessage();

  return `
💳 <b>COMPRA DE CRÉDITOS</b>

Actualmente trabajamos con:
• <b>YAPE | BCP | BBVA | INTERBANK</b>

📦 <b>Paquetes disponibles</b>
${paquetes}

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
Obtienes entre <b>50% a 60% de ganancia</b> en cada venta.
Eres libre de poner tus propios precios.

🛒 <b>Compra tus créditos aquí</b> 👇
`.trim();
}

function registerBuyCommand(bot) {
  bot.onText(/\/buy/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const response = buildBuyMessage();
      const imagePath = path.join(process.cwd(), 'resources', 'target.png');

      await sendPhoto(bot, chatId, imagePath, {
        caption: response,
        reply_markup: buildButtonsCredits(),
      });
    } catch (error) {
      console.error('Error en /buy:', error.message);
      await bot.sendMessage(chatId, 'Error al mostrar la información de compra');
    }
  });
}

module.exports = registerBuyCommand;
