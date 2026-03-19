require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on('message', (msg) => {
  console.log('Mensaje recibido:', msg.text);
});

console.log('\x1b[32mBot activo...\x1b[0m');
