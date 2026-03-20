const { sendMessage } = require('../utils/sender');

function buildApkTemplate() {
  return `
📲 <b>DESCARGA DE APK - ANDROID</b>

Aquí puedes descargar la aplicación.

⚠️ Recuerda habilitar "orígenes desconocidos" en tu dispositivo antes de instalar.
  `.trim();
}

function buildWebTemplate() {
  return `
🌐 <b>ACCESO WEB OFICIAL</b>

🔗 <code>https://ypfk-oficial.vercel.app/</code>

•···························•····························•
📱 <b>INSTALAR COMO APP</b>

🤖 <b>ANDROID</b>
1. Abre el link en <b>Chrome</b>
2. Presiona los tres puntos <b>(⋮)</b>
3. Toca <b>Agregar a pantalla de inicio</b>
4. Confirma la instalación

🍏 <b>IPHONE</b>
1. Abre el link en <b>Safari</b>
2. Presiona <b>Compartir (📤)</b>
3. Toca <b>Agregar a inicio</b>
4. Confirma la instalación

•···························•····························•
⚠️ <b>IMPORTANTE</b>

No abras el enlace desde Telegram.
Cópialo y pégalo en tu navegador para una mejor experiencia.
  `.trim();
}

function registerAppCommands(bot) {
  bot.onText(/\/apk/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const filePath = 'files/Yape_Fake.apk';

      await sendMessage(bot, chatId, {
        filePath,
        text: buildApkTemplate(),
      });
    } catch (error) {
      console.error('Error en /apk:', error.message);
      await sendMessage(bot, chatId, {
        text: 'Error al enviar el APK',
      });
    }
  });

  bot.onText(/\/web/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      await bot.sendMessage(chatId, buildWebTemplate(), {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error en /web:', error.message);
      await bot.sendMessage(chatId, 'Error al mostrar el enlace');
    }
  });
}

module.exports = registerAppCommands;
