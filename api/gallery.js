const fs = require("fs");
const path = require("path");
const { getFiles, saveFileTelegram } = require("../utils/files");
const { CONFIG, VOUCHER_KEYS } = require("./config/config");

const CAPTURES_DIR = path.join(process.cwd(), "resources/captures");
const VALID_EXT = [".jpg", ".jpeg", ".png"];

// Nombres bonitos para el título del caption. Si un comando no está aquí,
const NOMBRES_DISPLAY = {
  bcp: "BCP",
  bbva: "BBVA",
  bim: "BIM",
  sip: "SIP",
  ibk: "Interbank",
  scotiabank: "Scotiabank",
};

function resolveFilename(comando) {
  for (const ext of VALID_EXT) {
    const candidato = `${comando}${ext}`;
    if (fs.existsSync(path.join(CAPTURES_DIR, candidato))) {
      return candidato;
    }
  }

  return null;
}

function getCaptureList() {
  return VOUCHER_KEYS.reduce((acc, comando) => {
    const filename = resolveFilename(comando);

    if (!filename) {
      console.warn(`⚠️ Galería: no se encontró captura para "${comando}"`);
      return acc;
    }

    acc.push({ comando, filename });
    return acc;
  }, []);
}

function nombreBonito(comando) {
  if (NOMBRES_DISPLAY[comando]) return NOMBRES_DISPLAY[comando];
  return comando.charAt(0).toUpperCase() + comando.slice(1);
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

async function sendGalleryMessage(bot, chatId, index) {
  const captures = getCaptureList();

  if (!captures.length) {
    return bot.sendMessage(chatId, "❌ No hay capturas disponibles.");
  }

  const total = captures.length;
  const safeIndex = ((index % total) + total) % total;
  const { comando, filename } = captures[safeIndex];
  const key = `GALLERY_${comando}`;
  const files = getFiles();
  const caption = buildCaption(comando, safeIndex, total);

  const source = files[key] || fs.createReadStream(path.join(CAPTURES_DIR, filename));

  const response = await bot.sendDocument(chatId, source, {
    caption,
    parse_mode: "Markdown",
    reply_markup: buildGalleryKeyboard(safeIndex, total),
  });

  saveFileTelegram(response, key);
  return response;
}

async function editGalleryMessage(bot, chatId, messageId, index) {
  const captures = getCaptureList();
  const total = captures.length;
  const safeIndex = ((index % total) + total) % total;
  const { comando, filename } = captures[safeIndex];
  const files = getFiles();
  const key = `GALLERY_${comando}`;
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

  await bot.deleteMessage(chatId, messageId).catch(() => {});

  const source = fs.createReadStream(path.join(CAPTURES_DIR, filename));
  const response = await bot.sendDocument(chatId, source, {
    caption,
    parse_mode: "Markdown",
    reply_markup: buildGalleryKeyboard(safeIndex, total),
  });

  saveFileTelegram(response, key);
}

function registerGalleryCommand(bot) {
  bot.onText(/\/(?:ejemplo|ejemplos|galeria)\b/, async (msg) => {
    if (msg.chat.type !== "private") {
      return bot.sendMessage(msg.chat.id, "❌ Este comando solo está disponible en chat privado.");
    }

    try {
      await sendGalleryMessage(bot, msg.chat.id, 0);
    } catch (error) {
      console.error("Error al abrir galería:", error.message);
      bot.sendMessage(msg.chat.id, "❌ Error al cargar la galería");
    }
  });

  bot.on("callback_query", async (query) => {
    const data = query.data || "";
    if (!data.startsWith("gallery:")) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const [, action, indexStr] = data.split(":");
    const currentIndex = parseInt(indexStr, 10) || 0;

    try {
      if (action === "close") {
        await bot.deleteMessage(chatId, messageId);
        return bot.answerCallbackQuery(query.id);
      }

      if (action === "noop") {
        return bot.answerCallbackQuery(query.id);
      }

      const total = getCaptureList().length;
      let nextIndex = currentIndex;

      if (action === "next") nextIndex = (currentIndex + 1) % total;
      if (action === "prev") nextIndex = (currentIndex - 1 + total) % total;

      await editGalleryMessage(bot, chatId, messageId, nextIndex);
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Error en galería:", error.message);
      await bot.answerCallbackQuery(query.id, { text: "❌ Error al cargar la imagen" });
    }
  });
}

module.exports = registerGalleryCommand;
