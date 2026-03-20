const { buildButtonsCreditsWithApk } = require('../utils/constants');

function buildCommandsMessage() {
  return `
📋 <b>LISTA DE COMANDOS</b>

Estos son los comandos disponibles para gestionar tus licencias y créditos:

•···························•····························•
🔎 <b>Validación previa</b>

Antes de activar una cuenta, valida el correo con:
<code>/info correo@gmail.com</code>

Con este comando podrás verificar:
• Si la cuenta está registrada
• Licencias activas actualmente
• Activaciones disponibles sugeridas

•···························•····························•
🚀 <b>Activaciones</b>

<b>🔹 YAPE</b> (⭐ <b>20 créditos</b>)
<code>/activate correo@gmail.com</code>

<b>🔹 YAPE + 1 BANCA</b> (⭐ <b>25 créditos</b>)
<code>/activate correo@gmail.com|bcp</code>
<code>/activate correo@gmail.com|ibk</code>
<code>/activate correo@gmail.com|bbva</code>

<b>🔹 YAPE + 2 BANCAS</b> (⭐ <b>30 créditos</b>)
<code>/activate correo@gmail.com|bcp,ibk</code>
<code>/activate correo@gmail.com|bcp,bbva</code>
<code>/activate correo@gmail.com|ibk,bbva</code>

<b>🔹 YAPE + 3 BANCAS</b> (⭐ <b>35 créditos</b>)
<code>/activate correo@gmail.com|bcp,ibk,bbva</code>

•···························•····························•
ℹ️ <b>Importante</b>

• Primero valida con <b>/info</b> antes de activar
• Las bancas deben ir separadas por <b>comas</b>
• Los productos activados <b>no se vuelven a cobrar</b>
• Si el <b>YAPE</b> ya está activado, solo se cobra la banca adicional
• Las cuentas deben estar <b>registradas</b> en la aplicación
`.trim();
}
function registerCmdsCommand(bot) {
  bot.onText(/\/cmds$/, async (msg) => {
    await bot.sendMessage(msg.chat.id, buildCommandsMessage(), {
      parse_mode: 'HTML',
      reply_markup: buildButtonsCreditsWithApk(),
    });
  });
}

module.exports = registerCmdsCommand;
