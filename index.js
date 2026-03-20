process.env.NTBA_FIX_350 = true;
require('dotenv').config({ quiet: true });
const { APP_NAME } = require('./utils/constants');

const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/database');

const registerMeCommand = require('./commands/me');
const registerStartCommand = require('./commands/start');
const registerCreditosCommand = require('./commands/creditos');
const registerActivateCommand = require('./commands/activate');
const registerBuyCommand = require('./commands/buy');
const registerCmdsCommand = require('./commands/cmds');
const registerAppCommands = require('./commands/apk');
const registerInfoCommand = require('./commands/info');

async function startApp() {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    throw new Error('Falta BOT_TOKEN en el archivo .env');
  }

  await connectDB();

  const bot = new TelegramBot(token, { polling: true });

  registerMeCommand(bot);
  registerStartCommand(bot);
  registerCreditosCommand(bot);
  registerActivateCommand(bot);
  registerBuyCommand(bot);
  registerCmdsCommand(bot);
  registerAppCommands(bot);
  registerInfoCommand(bot);

  bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
  });

  console.log(`Bot ${APP_NAME} iniciado`);
}

startApp().catch((error) => {
  console.error('Error al iniciar la app:', error.message);
});
