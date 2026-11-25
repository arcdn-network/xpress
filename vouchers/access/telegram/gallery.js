const fs = require("fs");
const path = require("path");
const { getFiles, saveFileTelegram } = require("../host");
const { CONFIG, VOUCHER_KEYS } = require("../../catalog");
const botStates = new WeakMap();
function getState(bot) {
  if (!botStates.has(bot)) botStates.set(bot, { opening: new Map(), navigating: new Set(), active: new Map(), registered: false });
  return botStates.get(bot);
}

function sendGalleryMessage(bot, chatId, index) {
  const { opening, active, navigating } = getState(bot);
  const key = String(chatId);
  if (opening.has(key)) return opening.get(key);
  const pending = Promise.resolve().then(async () => {
    const message = active.get(key);
    if (message) {
      const lockKey = `${chatId}:${message.message_id}`;
      if (navigating.has(lockKey)) return message;
      navigating.add(lockKey);
      try {
        await editGalleryMessage(bot, chatId, message.message_id, index);
        return message;
      } catch (error) {
        if (/message is not modified/i.test(error.message || '')) return message;
        // Only confirmed deletion allows creating a replacement, never a network error.
        if (!/message to edit not found/i.test(error.message || '')) throw error;
        active.delete(key);
      } finally {
        navigating.delete(lockKey);
      }
    }
    const response = await sendGalleryMessageOnce(bot, chatId, index);
    if (response?.document && response.message_id) active.set(key, response);
    return response;
  });
  opening.set(key, pending);
  pending.then(() => opening.delete(key), () => opening.delete(key));
  return pending;
}

function getCaptureList() {
  return VOUCHER_KEYS.reduce((acc, comando) => {
    const filename = CONFIG[comando].examplePath;

    if (!filename) {
      console.warn(`⚠️ Galería: no se encontró captura para "${comando}"`);
      return acc;
    }

    acc.push({ comando, filename });
    return acc;
  }, []);
}

function nombreBonito(comando) {
  return CONFIG[comando].name;
}

function buildCaption(comando, safeIndex, total) {
  const titulo = `🚀 *Voucher ${nombreBonito(comando)}* (${safeIndex + 1}/${total})`;
  const ejemploUso = CONFIG[comando]?.ejemploUso || "";
  return `${titulo}\n\n${ejemploUso}`;
}

function buildGalleryKeyboard(index, total) {
  return {
    inline_keyboard: [
      [
        { text: "⬅️", callback_data: `gallery:prev:${index}` },
        { text: `${index + 1}/${total}`, callback_data: "gallery:noop" },
        { text: "➡️", callback_data: `gallery:next:${index}` },
      ],
      [{ text: "❌ Cerrar", callback_data: "gallery:close" }],
    ],
  };
}

async function sendGalleryMessageOnce(bot, chatId, index) {
  const captures = getCaptureList();

  if (!captures.length) {
    return bot.sendMessage(chatId, "❌ No hay capturas disponibles.");
  }

  const total = captures.length;
  if (!total) throw new Error("No hay capturas disponibles");
  const safeIndex = ((index % total) + total) % total;
  const { comando, filename } = captures[safeIndex];
  const key = `GALLERY_v2_${comando}`;
  const files = getFiles();
  const caption = buildCaption(comando, safeIndex, total);

  const source = files[key] || fs.createReadStream(filename);

  const response = await bot.sendDocument(chatId, source, {
    caption,
    parse_mode: "Markdown",
    reply_markup: buildGalleryKeyboard(safeIndex, total),
  }, { filename: `${comando}${path.extname(filename)}` });

  try { saveFileTelegram(response, key); }
  catch (error) { console.error('Error guardando caché de galería:', error.message); }
  return response;
}

async function editGalleryMessage(bot, chatId, messageId, index) {
  const captures = getCaptureList();
  const total = captures.length;
  if (!total) throw new Error("No hay capturas disponibles");
  const safeIndex = ((index % total) + total) % total;
  const { comando, filename } = captures[safeIndex];
  const files = getFiles();
  const key = `GALLERY_v2_${comando}`;
  const cachedFileId = files[key];
  const caption = buildCaption(comando, safeIndex, total);

  if (cachedFileId) {
    return bot.editMessageMedia(
      {
        type: "document",
        media: cachedFileId,
        caption,
        parse_mode: "Markdown",
      },
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: buildGalleryKeyboard(safeIndex, total),
      },
    );
  }

  // Upload into the same message: never delete/send a replacement during navigation.
  const response = await bot.editMessageMedia({
    type: "document", media: `attach://${filename}`, caption, parse_mode: "Markdown",
    fileOptions: { filename: `${comando}${path.extname(filename)}` },
  }, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: buildGalleryKeyboard(safeIndex, total),
  });

  saveFileTelegram(response, key);
}

function registerGalleryCommand(bot) {
  const state = getState(bot);
  if (state.registered) return;
  state.registered = true;
  bot.onText(/^\/(?:ejemplos?|galeria)(?:@\w+)?\s*$/i, async (msg) => {
    if (msg.chat.type !== "private") {
      return bot.sendMessage(msg.chat.id, "❌ Este comando solo está disponible en chat privado.");
    }

    try {
      await sendGalleryMessage(bot, msg.chat.id, 0);
    } catch (error) {
      console.error("Error al abrir galería:", error.message);
      await bot.sendMessage(msg.chat.id, "❌ Error al cargar la galería");
    }
  });

  bot.on("callback_query", async (query) => {
    const data = query.data || "";
    if (!/^gallery:(prev:\d+|next:\d+|noop|close)$/.test(data) || !query.message) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const [, action, indexStr] = data.split(":");
    const currentIndex = parseInt(indexStr, 10) || 0;
    const { navigating } = getState(bot);
    const lockKey = `${chatId}:${messageId}`;
    if (navigating.has(lockKey)) {
      await bot.answerCallbackQuery(query.id).catch(() => {});
      return;
    }
    navigating.add(lockKey);

    try {
      await bot.answerCallbackQuery(query.id);
      if (action === "close") {
        try { await bot.deleteMessage(chatId, messageId); }
        catch (error) {
          if (!/message to delete not found/i.test(error.message || '')) throw error;
        }
        if (state.active.get(String(chatId))?.message_id === messageId) state.active.delete(String(chatId));
        return;
      }

      if (action === "noop") {
        return;
      }

      const total = getCaptureList().length;
      if (!total) return;
      let nextIndex = currentIndex;

      if (action === "next") nextIndex = (currentIndex + 1) % total;
      if (action === "prev") nextIndex = (currentIndex - 1 + total) % total;

      await editGalleryMessage(bot, chatId, messageId, nextIndex);
    } catch (error) {
      if (/message is not modified/i.test(error.message || "")) return;
      console.error("Error en galería:", error.message);
    } finally {
      navigating.delete(lockKey);
    }
  });
}

module.exports = registerGalleryCommand;
module.exports.sendGalleryMessage = sendGalleryMessage;
