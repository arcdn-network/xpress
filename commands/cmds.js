const { isOwner } = require("../middleware/isAdmin");
const { CONFIG, VOUCHER_KEYS } = require("../vouchers");
const { LOCAL, buildButtonsCredits, buildButtonsVoucherPlan } = require("../utils/constants");
const { sendMessage } = require("../utils/sender");
const { getFiles, saveFileTelegram } = require("../utils/files");

function buildVoucherCommandsBlock() {
  return VOUCHER_KEYS.map((comando) => {
    const { cantidad } = CONFIG[comando];
    const digitosLabel = cantidad.includes(0) ? "" : `|${cantidad[0]}digitos`;
    return `<code>/${comando} monto|nombre${digitosLabel}</code>`;
  }).join("\n");
}

function buildView(section, admin, userId) {
  const callback = (value) => `cmds:${userId}:${value}`;
  if (section === "menu") {
    const buttons = [
      [{ text: "🚀 ACTIVACIONES YAPE", callback_data: callback("activaciones") }],
      [{ text: "⭐ PLAN VOUCHERS", callback_data: callback("vouchers") }],
    ];
    if (admin) buttons.push([{ text: "🛠️ ADMIN", callback_data: callback("admin") }]);
    return {
      text: "📋 <b>COMANDOS DISPONIBLES</b>\n\nSelecciona una sección:",
      reply_markup: { inline_keyboard: buttons },
    };
  }

  const sections = {
    activaciones: `🚀 <b>ACTIVACIONES YAPE</b>

<code>/activate correo@gmail.com</code>
Activa una cuenta de un cliente registrado.

<code>/token</code>
Genera token de autocompletado.

<code>/info correo@gmail.com</code>
Ver información del cliente.

<code>/historial</code>
Ver el historial de tus activaciones.`,
    vouchers: `🧾 <b>PLAN VOUCHERS</b>

<code>/ejemplos</code>
Ver galería de ejemplos.

${buildVoucherCommandsBlock()}
Genera vouchers de pago.`,
    admin: `🛠️ <b>ADMIN</b>

<code>/creditos telegramId</code>
Gestiona créditos de activaciones.

<code>/dias telegramId</code>
Gestiona el plan de vouchers.

<code>/create_token nombre|dias|unlimited</code>
Crea un TOKEN API. Usa "true" en unlimited para plan ilimitado.

<code>/extender_token TOKEN|DIAS</code>
Extiende la duración de un TOKEN API existente.`,
  };
  const buttons = [];
  if (section === "activaciones") buttons.push(...buildButtonsCredits().inline_keyboard);
  if (section === "vouchers") buttons.push(...buildButtonsVoucherPlan().inline_keyboard);
  buttons.push([{ text: "⬅️ Volver", callback_data: callback("menu") }]);
  return { text: sections[section], reply_markup: { inline_keyboard: buttons } };
}

function registerCmdsCommand(bot) {
  bot.onText(/^\/cmds(?:@\w+)?\s*$/, async (msg) => {
    const view = buildView("menu", isOwner(msg.from.id), msg.from.id);
    const fileId = getFiles().TARGET_IMAGE;
    const response = await sendMessage(bot, msg.chat.id, {
      text: view.text,
      fileId,
      filePath: LOCAL.TARGET_IMAGE,
      replyMarkup: view.reply_markup,
    });
    if (!fileId) saveFileTelegram(response, "TARGET_IMAGE");
  });

  bot.on("callback_query", async (query) => {
    if (!query.data?.startsWith("cmds:")) return;
    try {
      const match = /^cmds:(\d+):(menu|activaciones|vouchers|admin)$/.exec(query.data);
      if (!match || !query.message) {
        await bot.answerCallbackQuery(query.id, { text: "Menú inválido. Usa /cmds nuevamente." });
        return;
      }
      if (match[1] !== String(query.from.id)) {
        await bot.answerCallbackQuery(query.id, { text: "Abre tu propio menú con /cmds." });
        return;
      }
      const admin = isOwner(query.from.id);
      if (match[2] === "admin" && !admin) {
        await bot.answerCallbackQuery(query.id, { text: "No tienes acceso a esta sección.", show_alert: true });
        return;
      }
      await bot.answerCallbackQuery(query.id);
      const view = buildView(match[2], admin, query.from.id);
      // Keep older text-only menus working after deployment.
      const edit = query.message.photo ? bot.editMessageCaption.bind(bot) : bot.editMessageText.bind(bot);
      await edit(view.text, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: "HTML",
        reply_markup: view.reply_markup,
      });
    } catch (error) {
      if (!/message is not modified/i.test(error.message || "")) {
        console.error("Error en menú /cmds:", error.message);
      }
    }
  });
}

module.exports = registerCmdsCommand;
