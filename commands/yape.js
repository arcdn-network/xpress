const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

let browser = null;
let activePages = 0;
const MAX_PAGES = 5;
const queue = [];

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function takeScreenshot(html) {
  return new Promise((resolve, reject) => {
    const task = async () => {
      activePages++;
      try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const buffer = await page.screenshot({ type: 'png', fullPage: true });
        await page.close();
        resolve(buffer);
      } catch (err) {
        reject(err);
      } finally {
        activePages--;
        if (queue.length > 0) queue.shift()();
      }
    };

    if (activePages < MAX_PAGES) task();
    else queue.push(task);
  });
}

function isDentroDeHorario() {
  const hora = new Date().getHours();
  return hora >= 8 && hora < 22;
}

function randomOperacion() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function formatFecha() {
  const now = new Date();
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();
  let horas = now.getHours();
  const mins = now.getMinutes().toString().padStart(2, '0');
  const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
  horas = horas % 12 || 12;
  return {
    fecha: `${dia} ${mes}. ${anio}`,
    hora: `${horas}:${mins} ${ampm}`,
  };
}

function buildYapeHtml({ monto, nombre, digitos }) {
  const { fecha, hora } = formatFecha();
  const operacion = randomOperacion();
  const [d1, d2, d3] = operacion.slice(-3).split('');

  const templatePath = path.resolve(__dirname, '../resources/templates/yape.html');
  const html = fs.readFileSync(templatePath, 'utf-8');

  return html
    .replace('{{MONTO}}', monto)
    .replace('{{NOMBRE}}', nombre)
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{D1}}', d1)
    .replace('{{D2}}', d2)
    .replace('{{D3}}', d3)
    .replace('{{DIGITOS}}', digitos)
    .replace('{{OPERACION}}', operacion);
}
function registerYapeCommand(bot) {
  bot.onText(/\/yape(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim();

    const errorMsg = `⚠️ *Formato incorrecto.*
Debes proporcionar: El monto, titular y los últimos 3 dígitos.

✅ *Ejemplo de uso:*
\`/yape 150|Pedro Cas*|987\``;

    const replyOpts = {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
    };

    const sendError = () => bot.sendMessage(chatId, errorMsg, replyOpts);

    if (!input) {
      return sendError();
    }

    const args = input.split('|');

    if (args.length !== 3) {
      return sendError();
    }

    const [monto, nombre, digitos] = args.map((a) => a.trim());

    if (!monto || !/^\d+(\.\d{1,2})?$/.test(monto)) {
      return sendError();
    }

    if (!nombre) {
      return sendError();
    }

    if (!/^\d{3}$/.test(digitos)) {
      return sendError();
    }

    if (!isDentroDeHorario()) {
      return bot.sendMessage(
        chatId,
        '🕙 *El servicio de vouchers está disponible de 8:00 a.m. a 10:00 p.m.*.',
        replyOpts,
      );
    }

    const loading = await bot.sendMessage(chatId, '⏳ Generando voucher...');

    try {
      const html = buildYapeHtml({ monto, nombre, digitos });
      const buffer = await takeScreenshot(html);

      await bot.deleteMessage(chatId, loading.message_id);
      await bot.sendPhoto(chatId, buffer);
    } catch (error) {
      console.error('Error en /yape:', error.message);
      await bot.deleteMessage(chatId, loading.message_id);
      await bot.sendMessage(chatId, '❌ Error al generar el voucher', replyOpts);
    }
  });
}

module.exports = registerYapeCommand;
