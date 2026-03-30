process.env.NTBA_FIX_350 = true;
require('dotenv').config({ quiet: true });
const { APP_NAME } = require('./utils/constants');

const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/database');

const registerMeCommand = require('./commands/me');
const registerStartCommand = require('./commands/start');
const registerCreditosCommand = require('./commands/creditos');
const registerActivateCommand = require('./commands/activate');
const registerHistorialCommand = require('./commands/historial');
const registerTutorialCommand = require('./commands/tutorial');

const registerBuyCommand = require('./commands/buy');
const registerCmdsCommand = require('./commands/cmds');
const registerAppCommands = require('./commands/apk');
const registerInfoCommand = require('./commands/info');
const registerYapeCommand = require('./commands/yape');

async function startApp() {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    throw new Error('Falta BOT_TOKEN en el archivo .env');
  }

  await connectDB();

  const bot = new TelegramBot(token, { polling: true });

  await bot.setMyCommands([
    { command: 'start', description: 'Iniciar el bot' },
    { command: 'register', description: 'Registrarte en el sistema' },
    { command: 'cmds', description: 'Ver comandos disponibles' },
    { command: 'me', description: 'Ver tu perfil' },
    { command: 'buy', description: 'Ver precios y compras' },
    { command: 'historial', description: 'Ver historial de activaciones' },
    { command: 'tutorial', description: 'Ver tutorial de activaciones' },
    { command: 'yape', description: 'Generar Voucher' },
    { command: 'apk', description: 'Obtener APK' },
    { command: 'web', description: 'Obtener Link' },
  ]);

  registerMeCommand(bot);
  registerStartCommand(bot);
  registerCreditosCommand(bot);
  registerActivateCommand(bot);
  registerHistorialCommand(bot);
  registerTutorialCommand(bot);

  registerBuyCommand(bot);
  registerCmdsCommand(bot);
  registerAppCommands(bot);
  registerInfoCommand(bot);
  registerYapeCommand(bot);

  bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
  });

  console.log(`Bot ${APP_NAME} iniciado`);
}

startApp().catch((error) => {
  console.error('Error al iniciar la app:', error.message);
});
