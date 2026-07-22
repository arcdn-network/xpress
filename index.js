process.env.NTBA_FIX_350 = true;
require('dotenv').config({ quiet: true });
const { APP_NAME } = require('./utils/constants');

const TelegramBot = require('node-telegram-bot-api');

const registerMeCommand = require('./commands/me');
const registerStartCommand = require('./commands/start');
const registerCreditosCommand = require('./commands/creditos');
const registerActivateCommand = require('./commands/activate');
const registerHistorialCommand = require('./commands/historial');
const registerTutorialCommand = require('./commands/tutorial');
const registerTokenCommand = require('./commands/token');

const registerBuyCommand = require('./commands/buy');
const registerCmdsCommand = require('./commands/cmds');
const registerAppCommands = require('./commands/apk');
const registerInfoCommand = require('./commands/info');
const registerMinsaCommand = require('./commands/minsa');
const registerVoucherCommands = require('./api/bot');
const registerVoucherTokenCommand = require('./api/token');
const registerDiasCommand = require('./commands/days');

async function startBot() {
  const isDevelop = process.env.DEVELOP === 'TRUE';
  const token = isDevelop ? process.env.BOT_TOKEN_2 : process.env.BOT_TOKEN;

  if (!token) {
    throw new Error('Falta BOT_TOKEN en el archivo .env');
  }

  const bot = new TelegramBot(token, { polling: true });

  await bot.setMyCommands([
    { command: 'me', description: 'Ver tu perfil' },
    { command: 'cmds', description: 'Ver comandos disponibles' },
    { command: 'buy', description: 'Ver precios y compras' },
    { command: 'activate', description: 'Activar licencias' },
    { command: 'historial', description: 'Ver historial de activaciones' },
    { command: 'tutorial', description: 'Ver tutorial de activaciones' },
    { command: 'token', description: 'Generar token autocompletado' },
    { command: 'yape', description: 'Generar Voucher Yape' },
    { command: 'plin', description: 'Generar Voucher Plin' },
    { command: 'bim', description: 'Generar Voucher Bim' },
    { command: 'agora', description: 'Generar Voucher Agora' },
    { command: 'lemon', description: 'Generar Voucher Lemon' },
    { command: 'bcp', description: 'Generar Voucher BCP' },
    { command: 'ibk', description: 'Generar Voucher Interbank' },
    { command: 'bbva', description: 'Generar Voucher BBVA' },
    { command: 'caja', description: 'Generar Voucher Caja Arequipa' },
    { command: 'scotiabank', description: 'Generar Voucher Scotiabank' },
    { command: 'apk', description: 'Obtener APK' },
    { command: 'web', description: 'Obtener Link' },
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
  registerVoucherCommands(bot);
  registerVoucherTokenCommand(bot);
  registerDiasCommand(bot);
  registerMinsaCommand(bot);

  bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code, error.message);
  });

  console.log(`🚀 Iniciando ${APP_NAME} en modo ${isDevelop ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
}

const { startApi } = require('./api/api');
async function startApp() {
  await startBot();
  startApi();
}

startApp().catch((error) => {
  console.error('Error al iniciar la app:', error.message);
});
