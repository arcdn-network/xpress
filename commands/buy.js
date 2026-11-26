const path = require("path");
const { APP_USERNAME } = require("../utils/constants");
const { getFiles, saveFileTelegram } = require("../utils/files");

const { PRODUCTS, buildProductButton } = require("../utils/products");

function buildPage(page) {
  const products = PRODUCTS.filter((product) => product.status === true);
  if (!products.length) return null;
  const index = ((page % products.length) + products.length) % products.length;
  const product = products[index];
  return {
    key: product.cacheKey,
    file: path.resolve(__dirname, "../resources", product.image),
    caption: `<b>${product.name}</b> · ${index + 1}/${products.length}\n\n${product.description}\n${product.rules}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⬅️ Atrás", callback_data: `buy:page:${(index + products.length - 1) % products.length}` },
          { text: "Siguiente ➡️", callback_data: `buy:page:${(index + 1) % products.length}` },
        ],
        [buildProductButton(product, APP_USERNAME)],
      ],
    },
  };
}

module.exports = function registerBuyCommand(bot) {
  const pending = new Set();
  async function show(chatId, page, messageId) {
    const view = buildPage(page);
    if (!view) {
      const text = "No hay productos disponibles en el catálogo por el momento.";
      return messageId
        ? bot.editMessageCaption(text, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
        : bot.sendMessage(chatId, text);
    }
    const cached = getFiles()[view.key];
    const options = { caption: view.caption, parse_mode: "HTML", reply_markup: view.reply_markup };
    const response = messageId
      ? await bot.editMessageMedia(
          { type: "photo", media: cached || `attach://${view.file}`, caption: view.caption, parse_mode: "HTML" },
          { chat_id: chatId, message_id: messageId, reply_markup: view.reply_markup },
        )
      : await bot.sendPhoto(chatId, cached || view.file, options);
    if (!cached) {
      try {
        saveFileTelegram(response, view.key);
      } catch (error) {
        console.error("Error guardando caché del catálogo:", error.message);
      }
    }
  }
  bot.onText(/^\/buy(?:@\w+)?\s*$/i, async (msg) => {
    const key = `chat:${msg.chat.id}`;
    if (pending.has(key)) return;
    pending.add(key);
    try {
      await show(msg.chat.id, 0);
    } catch (error) {
      console.error("Error en /buy:", error.message);
      await bot.sendMessage(msg.chat.id, "❌ No se pudo abrir el catálogo. Inténtalo nuevamente.");
    } finally {
      pending.delete(key);
    }
  });
  bot.on("callback_query", async (query) => {
    const open = query.data === "buy:open";
    const match = /^buy:page:(\d{1,6})$/.exec(query.data || "");
    if ((!open && !match) || !query.message) return;
    const { chat, message_id } = query.message;
    const key = open ? `chat:${chat.id}` : `${chat.id}:${message_id}`;
    if (pending.has(key)) {
      await bot.answerCallbackQuery(query.id).catch(() => {});
      return;
    }
    pending.add(key);
    try {
      await bot.answerCallbackQuery(query.id);
      await show(chat.id, open ? 0 : Number(match[1]), open ? undefined : message_id);
    } catch (error) {
      if (!/message is not modified/i.test(error.message || "")) {
        console.error("Error navegando catálogo:", error.message);
      }
    } finally {
      pending.delete(key);
    }
  });
};
