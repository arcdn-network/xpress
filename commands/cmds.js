const { buildButtonsCredits } = require('../utils/constants');

function buildCommandsMessage() {
  return `
📋 <b>LISTA DE COMANDOS</b>

Estos son los comandos disponibles para gestionar tus licencias y créditos:

━━━━━━━━━━━━━━━
🚀 <b>Activaciones</b>

<b>🔹 YAPE</b>
💰 <b>20 créditos</b>
<code>/activate correo@gmail.com</code>

<b>🔹 YAPE + 1 BANCA</b>
💰 <b>25 créditos</b>
<code>/activate correo@gmail.com|bcp</code>
<code>/activate correo@gmail.com|ibk</code>
<code>/activate correo@gmail.com|bbva</code>

<b>🔹 YAPE + 2 BANCAS</b>
💰 <b>30 créditos</b>
<code>/activate correo@gmail.com|bcp,ibk</code>
<code>/activate correo@gmail.com|bcp,bbva</code>
<code>/activate correo@gmail.com|ibk,bbva</code>

<b>🔹 YAPE + 3 BANCAS</b>
💰 <b>35 créditos</b>
<code>/activate correo@gmail.com|bcp,ibk,bbva</code>

━━━━━━━━━━━━━━━
ℹ️ <b>Importante</b>

• El orden de las bancas <b>no importa</b>
• Las bancas deben ir separadas por <b>comas</b>
• Los productos activados <b>no se vuelven a cobrar</b>
• Si ya tienes <b>YAPE</b>, solo se cobra la banca adicional
• Solo se puede activar cuentas <b>registradas</b>
`.trim();
}

function registerCmdsCommand(bot) {
  bot.onText(/\/cmds$/, async (msg) => {
    await bot.sendMessage(msg.chat.id, buildCommandsMessage(), {
      parse_mode: 'HTML',
      reply_markup: buildButtonsCredits(),
    });
  });
}

module.exports = registerCmdsCommand;
