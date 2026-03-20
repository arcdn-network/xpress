const fs = require('fs');
const path = require('path');

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
  };

  return types[ext] || 'application/octet-stream';
}

function buildFileOptions(filePath) {
  return {
    filename: path.basename(filePath),
    contentType: getContentType(filePath),
  };
}

function sendPhoto(bot, chatId, filePath, options = {}) {
  return bot.sendPhoto(
    chatId,
    fs.createReadStream(filePath),
    {
      caption: options.caption || '',
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup,
    },
    buildFileOptions(filePath),
  );
}

function sendAnimation(bot, chatId, filePath, options = {}) {
  return bot.sendAnimation(
    chatId,
    fs.createReadStream(filePath),
    {
      caption: options.caption || '',
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup,
    },
    buildFileOptions(filePath),
  );
}

function sendDocument(bot, chatId, filePath, options = {}) {
  return bot.sendDocument(
    chatId,
    fs.createReadStream(filePath),
    {
      caption: options.caption || '',
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup,
    },
    buildFileOptions(filePath),
  );
}

module.exports = {
  sendPhoto,
  sendAnimation,
  sendDocument,
};
