const { renderPhotoView } = require("../utils/photo-view");
const { CONFIG, VOUCHER_KEYS } = require("../vouchers");
const { LOCAL, APP_USERNAME, buildButtonsVoucherPlan } = require("../utils/constants");

const { isOwner } = require("../middleware/isAdmin");

const { getActiveProducts, PRODUCTS_BY_KEY, VOUCHER_PRODUCT, buildProductButton } = require("../utils/products");
const { FREE_DAILY_LIMIT } = require("../utils/constants");

const { sendGalleryMessage } = require("../vouchers/access/telegram/gallery");
const { escapeHtml } = require("../utils/functions");

const VOUCHERS_PER_PAGE = 2;

function buildVoucherCommandsBlock(commands, offset) {
  return commands
    .map((comando, index) => {
      const formats = CONFIG[comando].examples.map((example) => "- Formato: <code>" + escapeHtml(example) + "</code>").join("\n");
      return `${offset + index + 1}. <b>${escapeHtml(CONFIG[comando].name || comando.toUpperCase())} ✅</b>\n${formats}`;
    })
    .join("\n\n");
}

function buildView(section, admin, userId, requestedPage = 0) {
  const callback = (value) => `cmds:${userId}:${value}`;
  if (section === "menu") {
    const buttons = getActiveProducts().map((product) => [{ text: product.name, callback_data: callback(product.key) }]);
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
      text: `<b>${escapeHtml(VOUCHER_PRODUCT.title || VOUCHER_PRODUCT.name)}</b>\n📂 Página ${page + 1}/${totalPages} · ${VOUCHER_KEYS.length} comandos\n\n${buildVoucherCommandsBlock(commands, offset)}\n\n🎁 Tienes ${FREE_DAILY_LIMIT} vouchers diarios gratis`,
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

  const product = PRODUCTS_BY_KEY[section];
  if (product) {
    const commands = (product.commands || []).map((item) => `${escapeHtml(item.description)}\n<code>${escapeHtml(item.command)}</code>`).join("\n\n");
    return {
      text: `<b>${escapeHtml(product.title || product.name)}</b>\n\n<blockquote>${escapeHtml(product.description)}</blockquote>\n\n${commands}`,
      reply_markup: { inline_keyboard: [[buildProductButton(product, APP_USERNAME)], [{ text: "🏠 Regresar Menú", callback_data: callback("menu") }]] },
    };
  }

  const adminCommands = [
    { command: "/creditos telegramId", description: "Gestiona créditos de activaciones." },
    { command: "/dias telegramId", description: "Gestiona el plan de vouchers." },
    { command: "/create_token nombre|30|true", description: 'Crea un TOKEN API. Usa "true" para plan ilimitado.' },
    { command: "/extender_token TOKEN|DIAS", description: "Extiende la duración de un TOKEN API existente." },
    { command: "/delete_gallery", description: "Borra únicamente la caché de la galería." },
    { command: "/delete_shop", description: "Borra únicamente la caché de las imágenes del catálogo." },
    { command: "/delete_base", description: "Borra la caché base y conserva la galería y las imágenes del catálogo." },
  ];

  const sections = {
    admin: `🛠️ <b>ADMIN</b>\n\n${adminCommands.map((item) => `${escapeHtml(item.description)}\n<code>${escapeHtml(item.command)}</code>`).join("\n\n")}`,
  };

  const buttons = [[{ text: "🏠 Regresar Menú", callback_data: callback("menu") }]];
  return { text: sections[section], reply_markup: { inline_keyboard: buttons } };
}

function registerCmdsCommand(bot) {
  const pending = new Set();
  bot.onText(/^\/cmds(?:@\w+)?\s*$/, async (msg) => {
    const view = buildView("menu", isOwner(msg.from.id), msg.from.id);
    await renderPhotoView(bot, {
      chatId: msg.chat.id,
      cacheKey: "TARGET_IMAGE",
      image: LOCAL.TARGET_IMAGE,
      text: view.text,
      replyMarkup: view.reply_markup,
    });
  });

  bot.on("callback_query", async (query) => {
    if (!query.data?.startsWith("cmds:")) return;
    const lockKey = query.message && `${query.message.chat.id}:${query.message.message_id}`;
    if (pending.has(lockKey)) {
      await bot.answerCallbackQuery(query.id).catch(() => {});
      return;
    }
    pending.add(lockKey);
    try {
      const match = /^cmds:(\d+):([a-z]+)(?::(\d{1,6}))?$/.exec(query.data);
      if (match?.[2] === "activaciones") match[2] = "credits";
      const selectedProduct = match && Object.hasOwn(PRODUCTS_BY_KEY, match[2]) ? PRODUCTS_BY_KEY[match[2]] : null;
      if (!match || !query.message || (!selectedProduct && !["menu", "admin", "noop", "gallery"].includes(match[2])) || (selectedProduct && selectedProduct.status !== true)) {
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
        await sendGalleryMessage(bot, query.message.chat.id, 0);
        return;
      }
      const view = buildView(match[2], admin, query.from.id, Number(match[3] || 0));
      const product = selectedProduct;
      const imageKey = product ? product.cacheKey : "TARGET_IMAGE";
      const imagePath = product ? product.image : LOCAL.TARGET_IMAGE;
      await renderPhotoView(bot, {
        chatId: query.message.chat.id,
        message: query.message,
        cacheKey: imageKey,
        image: imagePath,
        text: view.text,
        replyMarkup: view.reply_markup,
      });
    } catch (error) {
      if (!/message is not modified/i.test(error.message || "")) {
        console.error("Error en menú /cmds:", error.message);
      }
    } finally {
      pending.delete(lockKey);
    }
  });
}

module.exports = registerCmdsCommand;
