const { buildButtonsCredits } = require('../utils/constants');

function buildCommandsMessage() {
  return `
📋 <b>COMANDOS DISPONIBLES</b>

•···························•····························•

🪪 <b>CUENTA</b>
<code>/me</code>
Consulta tu perfil y créditos disponibles.

<code>/buy</code>
Recarga créditos para tus activaciones.

•···························•····························•

🚀 <b>ACTIVACIONES</b>
<code>/activate correo@gmail.com</code>
Selecciona los productos que quieres activar.
Puedes confirmar o cancelar esta operación.

•···························•····························•

👤 <b>CONSULTAS</b>
<code>/info correo@gmail.com</code>
Obtén información detallada del cliente.

<code>/historial</code>
Revisa todas tus activaciones realizadas.

•···························•····························•
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
