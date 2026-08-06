const { isOwner } = require('../middleware/isAdmin');
const { buildButtonsCredits } = require('../utils/constants');

function buildCommandsMessage(admin = false) {
  let msg = `
📋 <b>COMANDOS DISPONIBLES</b>

•···························•····························•

🪪 <b>GENERAL</b>
<code>/me</code>
Ver mi información.

<code>/buy</code>
Tarifario de créditos.

•···························•····························•

🚀 <b>ACTIVACIONES YAPE</b>
<code>/activate correo@gmail.com</code>
Activa una cuenta de un cliente registrado.

<code>/token</code>
Genera token de autocompletado.

<code>/info correo@gmail.com</code>
Ver información del cliente.

<code>/historial</code>
Ver el historial de tus activaciones.

•···························•····························•

🧾 <b>PLAN VOUCHERS</b>
<code>/yape monto|nombre|3digitos</code>
<code>/plin monto|nombre|3digitos</code>
<code>/bim monto|nombre|3digitos</code>
<code>/sip monto|nombre|3digitos</code>
<code>/agora monto|nombre|3digitos</code>
<code>/lemon monto|nombre|3digitos</code>
<code>/prexpe monto|nombre|3digitos</code>
<code>/bcp monto|nombre|3digitos</code>
<code>/bbva monto|nombre|3digitos</code>
<code>/ibk monto|nombre|3digitos</code>
<code>/caja monto|nombre|3digitos</code>
<code>/ripley monto|nombre|3digitos</code>
<code>/scotiabank monto|nombre|3digitos</code>
Genera vouchers de pago.
`;

  if (admin) {
    msg += `
•···························•····························•

🛠️ <b>ADMIN</b>

<code>/creditos telegramId</code>
Gestiona créditos de activaciones.

<code>/dias telegramId</code>
Gestiona el plan de vouchers.

<code>/create_token nombre|dias|unlimited</code>
Crea un TOKEN API. Usa "true" en unlimited para plan ilimitado.

<code>/extender_token TOKEN|DIAS</code>
Extiende la duración de un TOKEN API existente.

`;
  }

  msg += `
•···························•····························•
`;

  return msg.trim();
}

function registerCmdsCommand(bot) {
  bot.onText(/\/cmds$/, async (msg) => {
    const admin = isOwner(msg.from.id);

    await bot.sendMessage(msg.chat.id, buildCommandsMessage(admin), {
      parse_mode: 'HTML',
      reply_markup: buildButtonsCredits(),
    });
  });
}

module.exports = registerCmdsCommand;
