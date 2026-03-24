const fs = require('fs');
const path = require('path');

const resourcesPath = path.join(process.cwd(), 'resources');

function resolveFilePath(filePath) {
  if (!filePath) {
    return '';
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.join(resourcesPath, filePath);
}

function buildTelegramOptions(options = {}) {
  return {
    parse_mode: options.parseMode || 'HTML',
    reply_markup: options.replyMarkup || null,
  };
}

async function sendMessage(bot, chatId, options = {}) {
  const text = options.text || '';
  const telegramOptions = buildTelegramOptions(options);

  // 👉 solo texto
  if (!options.filePath && !options.fileId) {
    return bot.sendMessage(chatId, text, telegramOptions);
  }

  const mediaOptions = {
    ...telegramOptions,
    caption: text,
  };

  // ✅ prioridad: file_id (ultra rápido)
  if (options.fileId) {
    return bot.sendPhoto(chatId, options.fileId, mediaOptions);
  }

  // ✅ fallback: archivo local
  const resolvedFilePath = resolveFilePath(options.filePath);

  if (!fs.existsSync(resolvedFilePath)) {
    throw new Error(`Archivo no encontrado: ${resolvedFilePath}`);
  }

  return bot.sendPhoto(chatId, resolvedFilePath, mediaOptions);
}

module.exports = {
  sendMessage,
};
