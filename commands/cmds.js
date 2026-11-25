const { isOwner } = require("../middleware/isAdmin");
const path = require("path");
const { CONFIG, VOUCHER_KEYS } = require("../vouchers");
const { LOCAL, buildButtonsCredits, buildButtonsVoucherPlan } = require("../utils/constants");
const { sendMessage } = require("../utils/sender");
const { getFiles, saveFileTelegram } = require("../utils/files");

const VOUCHERS_PER_PAGE = 2;
const { getUser } = require("../utils/api");
const { FREE_DAILY_LIMIT, USE_DAILY_LIMIT, FREE_BONUS_VOUCHER } = require("../utils/constants");
const { restantesGratis, tienePlanActivo } = require("../vouchers/access/availability");
const { sendGalleryMessage } = require("../vouchers/access/telegram/gallery");
const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildVoucherCommandsBlock(commands, offset) {
  return commands
    .map((comando, index) => {
      const formats = CONFIG[comando].examples.map((example) => "- Formato: <code>" + escapeHtml(example) + "</code>").join("\n");
      return `${offset + index + 1}. <b>${CONFIG[comando].name || comando.toUpperCase()} ✅</b>\n${formats}`;
    })
    .join("\n\n");
}

function buildView(section, admin, userId, requestedPage = 0, availability = "") {
  const callback = (value) => `cmds:${userId}:${value}`;
  if (section === "menu") {
    const buttons = [[{ text: "⭐ PLAN VOUCHERS", callback_data: callback("vouchers") }], [{ text: "🚀 ACTIVACIONES YAPE APP", callback_data: callback("activaciones") }]];
    if (admin) buttons.push([{ text: "🛠️ ADMIN", callback_data: callback("admin") }]);
    return {
      text: "📋 <b>COMANDOS DISPONIBLES</b>\n\nSelecciona una sección:",
      reply_markup: { inline_keyboard: buttons },
    };
  }

  if (section === "vouchers") {
    const totalPages = Math.max(1, Math.ceil(VOUCHER_KEYS.length / VOUCHERS_PER_PAGE));
    const page = Math.min(Math.max(requestedPage, 0), totalPages - 1);
    const offset = page * VOUCHERS_PER_PAGE;
    const commands = VOUCHER_KEYS.slice(offset, offset + VOUCHERS_PER_PAGE);
    return {
      text: `⭐ <b>PLAN VOUCHERS</b>\n📂 Página ${page + 1}/${totalPages} · ${VOUCHER_KEYS.length} comandos\n\n${buildVoucherCommandsBlock(commands, offset)}\n\n🎁 ${availability}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⬅️ Atrás", callback_data: callback(totalPages > 1 ? `vouchers:${(page - 1 + totalPages) % totalPages}` : "noop") },
            { text: "🏠 Menú", callback_data: callback("menu") },
            { text: "Siguiente ➡️", callback_data: callback(totalPages > 1 ? `vouchers:${(page + 1) % totalPages}` : "noop") },
          ],
          ...buildButtonsVoucherPlan().inline_keyboard,
        ],
      },
    };
  }

  const sections = {
    activaciones: `🚀 <b>ACTIVACIONES YAPE FAKE - ANDROID/IPHONE</b>

<blockquote>Este bot es exclusivo para clientes que tienen su cuenta de Yape Fake en aplicativo. Te permite activar a mitad de precio para que puedas ganar el 50% 💸.</blockquote>

<code>/activate correo@gmail.com</code>
Activa una cuenta de un cliente registrado.

<code>/info correo@gmail.com</code>
Ver información del cliente.

<code>/token</code>
Genera token de autocompletado.

<code>/historial</code>
Ver el historial de tus activaciones.`,
    admin: `🛠️ <b>ADMIN</b>

<code>/creditos telegramId</code>
Gestiona créditos de activaciones.

<code>/dias telegramId</code>
Gestiona el plan de vouchers.

<code>/create_token nombre|dias|unlimited</code>
Crea un TOKEN API. Usa "true" en unlimited para plan ilimitado.

<code>/extender_token TOKEN|DIAS</code>
Extiende la duración de un TOKEN API existente.

<code>/delete_gallery</code>
Borra únicamente la caché de la galería.

<code>/delete_all</code>
Borra las demás entradas de caché y conserva la galería.`,
  };
  const buttons = [];
  if (section === "activaciones") buttons.push(...buildButtonsCredits().inline_keyboard);
  buttons.push([{ text: "🏠 Regresar Menú", callback_data: callback("menu") }]);
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
      const match = /^cmds:(\d+):(menu|activaciones|vouchers|admin|noop|gallery)(?::(\d{1,6}))?$/.exec(query.data);
      if (!match || !query.message) {
        await bot.answerCallbackQuery(query.id, { text: "Menú inválido. Usa /cmds nuevamente." });
        return;
      }
      if (match[1] !== String(query.from.id)) {
        await bot.answerCallbackQuery(query.id, { text: "Abre tu propio menú con /cmds." });
        return;
      }
      if (match[2] === "noop") {
        await bot.answerCallbackQuery(query.id, { text: "No hay más páginas en esta dirección." });
        return;
      }
      const admin = isOwner(query.from.id);
      if (match[2] === "admin" && !admin) {
        await bot.answerCallbackQuery(query.id, { text: "No tienes acceso a esta sección.", show_alert: true });
        return;
      }
      await bot.answerCallbackQuery(query.id);
      if (match[2] === "gallery") {
        if (query.message.chat.type !== "private") {
          await bot.sendMessage(query.message.chat.id, "La galería está disponible en chat privado.");
          return;
        }
        await sendGalleryMessage(bot, query.message.chat.id, 0);
        return;
      }
      let availability = "";
      if (match[2] === "vouchers") {
        try {
          const user = await getUser(query.from.id);
          availability = !user
            ? "Disponibilidad: regístrate con /register"
            : tienePlanActivo(user)
              ? "Disponibilidad: ilimitada · Plan activo ✅"
              : `Disponibilidad: ${restantesGratis(user)}/${USE_DAILY_LIMIT ? FREE_DAILY_LIMIT : FREE_BONUS_VOUCHER} vouchers gratis`;
        } catch {
          availability = "Disponibilidad: no se pudo consultar. Inténtalo nuevamente.";
        }
      }
      const view = buildView(match[2], admin, query.from.id, Number(match[3] || 0), availability);
      const imageKey = match[2] === "vouchers" ? "BOT_IMAGE" : "TARGET_IMAGE";
      const cachedImage = getFiles()[imageKey];
      const options = {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: view.reply_markup,
      };
      if (cachedImage && query.message.photo?.some((photo) => photo.file_id === cachedImage)) {
        await bot.editMessageCaption(view.text, { ...options, parse_mode: "HTML" });
      } else {
        const response = await bot.editMessageMedia(
          {
            type: "photo",
            media: cachedImage || `attach://${path.resolve(__dirname, "../resources", LOCAL[imageKey])}`,
            caption: view.text,
            parse_mode: "HTML",
          },
          options,
        );
        if (!cachedImage) saveFileTelegram(response, imageKey);
      }
    } catch (error) {
      if (!/message is not modified/i.test(error.message || "")) {
        console.error("Error en menú /cmds:", error.message);
      }
    }
  });
}

module.exports = registerCmdsCommand;
