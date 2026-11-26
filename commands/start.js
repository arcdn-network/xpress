const { sendMessage } = require("../utils/sender");
const { formatDate, escapeHtml } = require("../utils/functions");
const { APP_NAME, LOCAL, FREE_DAILY_LIMIT } = require("../utils/constants");
const { getFiles, saveFileTelegram } = require("../utils/files");
const { getUser, createUser, updateUser } = require("../utils/api");
const { restantesGratis } = require("../vouchers/access/availability");

function buildCatalogButton() {
  return { inline_keyboard: [[{ text: "🏪 Ver Catálogo", callback_data: "buy:open" }]] };
}

function buildStartMessage(firstName) {
  firstName = escapeHtml(firstName);
  return `
Hola, que tal <b>${firstName}</b>? Bienvenido a <b>${APP_NAME}</b>!

Para utilizar este bot primero debes registrarte utilizando:
<b>/register</b>

[👤] Para visualizar tu perfil <b>/me</b>
[🧾] Para visualizar comandos <b>/cmds</b>
[💰] Para visualizar los precios <b>/buy</b>
[❓] Si tienes alguna consulta respecto a <b>${APP_NAME}</b> puedes contactar con <b>(@dev_lguss)</b>
`.trim();
}

function buildRegisterSuccessMessage(firstName, user, alreadyRegistered = false) {
  firstName = escapeHtml(firstName);
  const heading = alreadyRegistered ? `[⚠] Estimado <b>${firstName}</b> ya te encuentras registrado en <b>${APP_NAME}</b> 🧑‍🦯` : `<b>${firstName}</b> te registraste correctamente ✅`;
  return `
${heading}

[〽️] ROL ➤ USUARIO
[📅] REGISTRADO ➤ ${formatDate(user.registeredAt)}
[🎁] ${restantesGratis(user)}/${FREE_DAILY_LIMIT} vouchers diarios
`.trim();
}

async function sendWelcomeMessage(bot, chatId, text, replyMarkup) {
  const files = getFiles();

  if (files.WELCOME_IMAGE) {
    return sendMessage(bot, chatId, {
      text,
      fileId: files.WELCOME_IMAGE,
      replyMarkup,
    });
  }

  const telegramResponse = await sendMessage(bot, chatId, {
    text,
    filePath: LOCAL.WELCOME_IMAGE,
    replyMarkup,
  });

  saveFileTelegram(telegramResponse, "WELCOME_IMAGE");

  return telegramResponse;
}

function registerStartCommand(bot) {
  const pendingRegistrations = new Set();
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || "usuario";

    try {
      const response = buildStartMessage(firstName);
      await sendWelcomeMessage(bot, chatId, response, buildCatalogButton());
    } catch (error) {
      console.error("Error en /start:", error.message);
      await bot.sendMessage(chatId, "Error al mostrar el mensaje de bienvenida");
    }
  });

  bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || "usuario";
    const telegramId = msg.from.id;
    if (pendingRegistrations.has(telegramId)) return;
    pendingRegistrations.add(telegramId);

    try {
      const username = msg.from.username || "";

      let user = await getUser(telegramId);

      if (user) {
        if (user.username !== username) {
          await updateUser(telegramId, { username });
        }

        const response = buildRegisterSuccessMessage(firstName, user, true);
        await sendWelcomeMessage(bot, chatId, response, buildCatalogButton());

        return;
      }

      const body = {
        telegramId,
        username,
        registeredAt: new Date(),
        credits: 0,
        status: "activo",
        role: "user",
      };

      user = await createUser(body);

      const response = buildRegisterSuccessMessage(firstName, user);
      await sendWelcomeMessage(bot, chatId, response, buildCatalogButton());
    } catch (error) {
      console.error("Error en /register:", error.message);
      await bot.sendMessage(chatId, error.code === "BACKEND_UNAVAILABLE" ? error.message : "Error al procesar tu registro");
    } finally {
      pendingRegistrations.delete(telegramId);
    }
  });
}

module.exports = registerStartCommand;
