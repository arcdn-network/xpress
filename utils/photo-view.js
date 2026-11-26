const path = require("path");
const { getFiles, saveFileTelegram } = require("./files");

// Shared rendering for photo menus. The caller owns callback validation/locking.
async function renderPhotoView(bot, { chatId, message, cacheKey, image, text, replyMarkup }) {
  const cached = getFiles()[cacheKey];
  const options = { parse_mode: "HTML", reply_markup: replyMarkup };
  if (message && cached && message.photo?.some((photo) => photo.file_id === cached)) {
    return bot.editMessageCaption(text, { ...options, chat_id: chatId, message_id: message.message_id });
  }
  const file = path.resolve(__dirname, "../resources", image);
  const response = message
    ? await bot.editMessageMedia(
        { type: "photo", media: cached || `attach://${file}`, caption: text, parse_mode: "HTML" },
        { chat_id: chatId, message_id: message.message_id, reply_markup: replyMarkup },
      )
    : await bot.sendPhoto(chatId, cached || file, { ...options, caption: text });
  if (!cached) {
    try {
      saveFileTelegram(response, cacheKey);
    } catch (error) {
      console.error("Error guardando caché de imagen:", error.message);
    }
  }
  return response;
}

module.exports = { renderPhotoView };
