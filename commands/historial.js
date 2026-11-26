const { formatDateTime, escapeHtml } = require("../utils/functions");
const { sendMessage } = require("../utils/sender");
const { getHistory } = require("../utils/api");

const PAGE_SIZE = 10;

function buildHistorialMessage(logs, page, totalPages, totalItems, pageSize) {
  if (!logs.length) {
    return "📭 No tienes activaciones ni tokens registrados.";
  }

  let message = "📊 <b>HISTORIAL DE ACTIVACIONES</b>\n\n";
  message += `📄 <b>Página:</b> ${page} de ${totalPages}\n`;
  message += `📦 <b>Total registros:</b> ${totalItems}\n\n`;

  logs.forEach((log, index) => {
    const licenses = Array.isArray(log.activatedLicenses) && log.activatedLicenses.length ? log.activatedLicenses.join(", ") : "N/A";
    message += `🔹 <b>Registro ${(page - 1) * pageSize + index + 1}</b>\n`;
    message += `📧 <b>Email:</b> ${escapeHtml(log.clientEmail || "No aplica")}\n`;
    message += `📦 <b>Licencias:</b> ${escapeHtml(licenses)}\n`;
    message += `💰 <b>Créditos:</b> ${escapeHtml(log.creditsCost)}\n`;
    message += `📅 <b>Fecha:</b> ${escapeHtml(formatDateTime(log.createdAt))}\n`;
    message += "•···························•····························•\n";
  });

  return message;
}

function buildHistorialKeyboard(page, totalPages) {
  const buttons = [];

  if (page > 1) {
    buttons.push({
      text: "⬅️ Anterior",
      callback_data: `historial:${page - 1}`,
    });
  }

  if (page < totalPages) {
    buttons.push({
      text: "➡️ Siguiente",
      callback_data: `historial:${page + 1}`,
    });
  }



  return {
    inline_keyboard: [
      ...(buttons.length ? [buttons] : []),
    ],
  };
}

async function renderHistorial(bot, chatId, telegramId, page, messageId) {
  const { logs, totalPages, totalItems, page: actualPage, pageSize = PAGE_SIZE } = await getHistory(telegramId, page);
  const safePage = actualPage || Math.min(Math.max(page, 1), totalPages);

  const text = buildHistorialMessage(logs, safePage, totalPages, totalItems, pageSize);
  const replyMarkup = buildHistorialKeyboard(safePage, totalPages);

  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
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
      console.error("Error en /historial:", error.message);

      await sendMessage(bot, chatId, {
        text: "❌ Error al obtener el historial.",
      });
    }
  });

  bot.on("callback_query", async (query) => {
    try {
      if (!query.data || !query.data.startsWith("historial:")) {
        return;
      }

      const telegramId = query.from.id;
      const chatId = query.message?.chat?.id;
      const messageId = query.message?.message_id;
      const match = /^historial:(?:(activations|consume):)?(\d{1,6})$/.exec(query.data);
      const page = Number(match?.[2]);

      if (!chatId || !messageId || !Number.isSafeInteger(page) || page < 1) {
        await bot.answerCallbackQuery(query.id, {
          text: "❌ Página inválida",
        });
        return;
      }

      await renderHistorial(bot, chatId, telegramId, page, messageId);

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      if (/message is not modified/i.test(error.message || "")) {
        await bot.answerCallbackQuery(query.id).catch(() => {});
        return;
      }
      console.error("Error paginando /historial:", error.message);

      try {
        await bot.answerCallbackQuery(query.id, {
          text: "❌ Error al cambiar de página",
        });
      } catch (callbackError) {
        console.error("Error respondiendo callback:", callbackError.message);
      }
    }
  });
}

module.exports = registerHistorialCommand;
