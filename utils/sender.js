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

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.apk': 'application/vnd.android.package-archive',
  };

  return types[ext] || 'application/octet-stream';
}

function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (['.png', '.jpg', '.jpeg'].includes(ext)) {
    return 'photo';
  }

  if (['.gif', '.mp4'].includes(ext)) {
    return 'animation';
  }

  return 'document';
}

function buildFileOptions(filePath) {
  return {
    filename: path.basename(filePath),
    contentType: getContentType(filePath),
  };
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

  if (!options.filePath) {
    return bot.sendMessage(chatId, text, telegramOptions);
  }

  const resolvedFilePath = resolveFilePath(options.filePath);
  const fileType = getFileType(resolvedFilePath);
  const fileStream = fs.createReadStream(resolvedFilePath);
  const fileOptions = buildFileOptions(resolvedFilePath);

  const mediaOptions = {
    ...telegramOptions,
    caption: text,
  };

  if (fileType === 'photo') {
    return bot.sendPhoto(chatId, fileStream, mediaOptions, fileOptions);
  }

  if (fileType === 'animation') {
    return bot.sendAnimation(chatId, fileStream, mediaOptions, fileOptions);
  }

  return bot.sendDocument(chatId, fileStream, mediaOptions, fileOptions);
}

module.exports = {
  sendMessage,
};
