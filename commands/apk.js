const { LOCAL } = require("../utils/constants");
const path = require("path");

function buildApkTemplate() {
  return `
<b>OPCIÓN 1</b>
📲 <b>DESCARGA DE APK - ANDROID</b>

Aquí puedes descargar la aplicación.
⚠️ Recuerda habilitar "orígenes desconocidos" en tu dispositivo antes de instalar.

•···························•····························•
<b>OPCIÓN 2</b>
Si no puedes instalar mediante la APK

🌐 <b>ACCESO LINK OFICIAL</b>
🔗 <code>https://ypfk-xpress.vercel.app/</code>

📱 <b>INSTALAR COMO APP</b>

🤖 <b>ANDROID</b>
1. Abre el link en <b>Chrome/Brave</b>
2. Presiona los tres puntos <b>(⋮)</b>
3. Toca <b>Agregar a pantalla de inicio</b>
4. Confirma la instalación
  `.trim();
}

function buildIPhoneTemplate() {
  return `
🌐 <b>ACCESO LINK OFICIAL</b>

🔗 <code>https://ypfk-xpress.vercel.app/</code>

•···························•····························•
🍏 <b>INSTALACIÓN IPHONE</b>
1. Abre el link en <b>Safari</b>
2. Busca el icono <b>Compartir (📤)</b>
3. Luego selecciona <b>Agregar a inicio</b>
4. Confirma la instalación
•···························•····························•
⚠️ <b>IMPORTANTE</b>

No abras el enlace desde Telegram porque no podrás instalar.
Cópialo y pégalo en tu navegador Safari.
  `.trim();
}

function registerAppCommands(bot) {
  bot.onText(/\/apk/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const filePath = path.resolve(LOCAL.APK_FILE);
      await bot.sendDocument(chatId, filePath, {
        caption: buildApkTemplate(),
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error("Error en /apk:", error);
      try {
        await bot.sendMessage(chatId, "Error al enviar el APK");
      } catch {}
    }
  });

  bot.onText(/\/iphone/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      await bot.sendMessage(chatId, buildIPhoneTemplate(), {
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error("Error en /iphone:", error.message);
      await bot.sendMessage(chatId, "Error al mostrar el enlace");
    }
  });
}

module.exports = registerAppCommands;
