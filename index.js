process.env.NTBA_FIX_350 = true;
require("dotenv").config({ quiet: true });
const { APP_NAME } = require("./utils/constants");

const TelegramBot = require("node-telegram-bot-api");
const { installBotResilience, errorSummary } = require("./utils/bot-resilience");

const registerMeCommand = require("./commands/me");
const registerStartCommand = require("./commands/start");
const registerCreditosCommand = require("./commands/creditos");
const registerActivateCommand = require("./commands/activate");
const registerHistorialCommand = require("./commands/historial");
const registerTutorialCommand = require("./commands/tutorial");
const registerTokenCommand = require("./commands/token");

const registerBuyCommand = require("./commands/buy");
const registerCmdsCommand = require("./commands/cmds");
const registerAppCommands = require("./commands/apk");
const registerInfoCommand = require("./commands/info");
const registerDiasCommand = require("./commands/days");
const registerApiTokenCommand = require("./commands/api-token");
const { registerGalleryCommand } = require("./vouchers/access/telegram/gallery");
const registerCacheCommands = require("./commands/cache");
const registerVoucherCommands = require("./vouchers/access/telegram/commands");
const { MENU_COMMANDS } = require("./vouchers");

async function startBot() {
  const isDevelop = process.env.DEVELOP === "TRUE";
  const token = isDevelop ? process.env.BOT_TOKEN_2 : process.env.BOT_TOKEN;

  if (!token) {
    throw new Error("Falta BOT_TOKEN en el archivo .env");
  }

  const bot = new TelegramBot(token, {
    polling: { autoStart: false, interval: 1000, params: { timeout: 20 } },
    request: { timeout: 35000 },
  });
  installBotResilience(bot);

  const configureMenu = () =>
    bot.setMyCommands([
      { command: "me", description: "Ver tu perfil" },
      { command: "cmds", description: "Ver comandos disponibles" },
      { command: "buy", description: "Ver precios y compras" },
      { command: "activate", description: "Activar licencias" },
      { command: "historial", description: "Ver historial de activaciones" },
      { command: "tutorial", description: "Ver tutorial de activaciones" },
      { command: "token", description: "Generar token autocompletado" },
      { command: "apk", description: "Obtener APK" },
      { command: "web", description: "Obtener Link" },
      ...MENU_COMMANDS,
    ]);

  registerMeCommand(bot);
  registerStartCommand(bot);
  registerCreditosCommand(bot);
  registerActivateCommand(bot);
  registerHistorialCommand(bot);
  registerTutorialCommand(bot);
  registerTokenCommand(bot);

  registerBuyCommand(bot);
  registerCmdsCommand(bot);
  registerAppCommands(bot);
  registerInfoCommand(bot);
  registerGalleryCommand(bot);
  registerCacheCommands(bot);
  registerVoucherCommands(bot);
  registerApiTokenCommand(bot);
  registerDiasCommand(bot);

  configureMenu().catch((error) => {
    console.error("Error configurando menú:", errorSummary(error));
  });
  await bot.startPolling();

  console.log(`🚀 Iniciando ${APP_NAME} en modo ${isDevelop ? "DESARROLLO" : "PRODUCCIÓN"}`);
}

const { startApi } = require("./vouchers/api");
async function startApp() {
  await startBot();
  startApi();
}

startApp().catch((error) => {
  console.error("Error al iniciar la app:", errorSummary(error));
  process.exit(1);
});
