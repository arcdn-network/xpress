const ActivationLog = require('../models/activation_logs');
const { formatDateTime } = require('../utils/functions');
const { sendMessage } = require('../utils/sender');

const PAGE_SIZE = 5;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHistorialMessage(logs, page, totalPages, totalItems) {
  if (!logs.length) {
    return '📭 No tienes activaciones registradas.';
  }

  let message = '📊 <b>HISTORIAL DE ACTIVACIONES</b>\n\n';
  message += `📄 <b>Página:</b> ${page} de ${totalPages}\n`;
  message += `📦 <b>Total registros:</b> ${totalItems}\n\n`;

  logs.forEach((log, index) => {
    const licenses =
      Array.isArray(log.activatedLicenses) && log.activatedLicenses.length ? log.activatedLicenses.join(', ') : 'N/A';

    message += `🔹 <b>Registro ${(page - 1) * PAGE_SIZE + index + 1}</b>\n`;
    message += `📧 <b>Email:</b> ${escapeHtml(log.clientEmail)}\n`;
    message += `📦 <b>Licencias:</b> ${escapeHtml(licenses)}\n`;
    message += `💰 <b>Créditos:</b> ${log.creditsCost}\n`;
    message += `📅 <b>Fecha:</b> ${escapeHtml(formatDateTime(log.createdAt))}\n`;
    message += '•···························•····························•\n';
  });

  return message;
}

function buildHistorialKeyboard(page, totalPages) {
  const buttons = [];

  if (page > 1) {
    buttons.push({
      text: '⬅️ Anterior',
      callback_data: `historial:${page - 1}`,
    });
  }

  if (page < totalPages) {
    buttons.push({
      text: '➡️ Siguiente',
      callback_data: `historial:${page + 1}`,
    });
  }

  if (!buttons.length) {
    return undefined;
  }

  return {
    inline_keyboard: [buttons],
  };
}

async function getHistorialPage(telegramId, page) {
  const totalItems = await ActivationLog.countDocuments({
    resellerTelegramId: telegramId,
  });

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const logs = await ActivationLog.find({
    resellerTelegramId: telegramId,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(PAGE_SIZE)
    .lean();

  return {
    logs,
    page: safePage,
    totalPages,
    totalItems,
  };
}

async function renderHistorial(bot, chatId, telegramId, page, messageId) {
  const { logs, totalPages, totalItems } = await getHistorialPage(telegramId, page);
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const text = buildHistorialMessage(logs, safePage, totalPages, totalItems);
  const replyMarkup = buildHistorialKeyboard(safePage, totalPages);

  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });

    return;
  }

  await sendMessage(bot, chatId, {
    text,
    replyMarkup,
  });
}

function registerHistorialCommand(bot) {
  bot.onText(/\/historial/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const telegramId = msg.from.id;
      await renderHistorial(bot, chatId, telegramId, 1);
    } catch (error) {
      console.error('Error en /historial:', error.message);

      await sendMessage(bot, chatId, {
        text: '❌ Error al obtener el historial.',
      });
    }
  });

  bot.on('callback_query', async (query) => {
    try {
      if (!query.data || !query.data.startsWith('historial:')) {
        return;
      }

      const telegramId = query.from.id;
      const chatId = query.message?.chat?.id;
      const messageId = query.message?.message_id;
      const page = Number(query.data.split(':')[1] || 1);

      if (!chatId || !messageId || Number.isNaN(page)) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Página inválida',
        });
        return;
      }

      await renderHistorial(bot, chatId, telegramId, page, messageId);

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error('Error paginando /historial:', error.message);

      try {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Error al cambiar de página',
        });
      } catch (callbackError) {
        console.error('Error respondiendo callback:', callbackError.message);
      }
    }
  });
}

module.exports = registerHistorialCommand;
