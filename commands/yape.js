const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/arcdn-network/resource@main';
const CDN_BANNER = `${CDN_BASE}/banner.webp`;
const CDN_LOGO = `${CDN_BASE}/logos/yape.png`;
const CDN_CHAT = `${CDN_BASE}/chat.png`;

let browser = null;
let activePages = 0;
const MAX_PAGES = 5;
const queue = [];

const cooldowns = new Map();
const COOLDOWN_MS = 10000;
const enProceso = new Set();

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

function isEnCooldown(userId) {
  if (!cooldowns.has(userId)) return false;
  return Date.now() - cooldowns.get(userId) < COOLDOWN_MS;
}

function setCooldown(userId) {
  cooldowns.set(userId, Date.now());
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
  horas = (horas % 12 || 12).toString().padStart(2, '0');
  return {
    fecha: `${dia} ${mes}. ${anio}`,
    hora: `${horas}:${mins} ${ampm}`,
  };
}

function formatFechaFilename() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, '0');
  const mes = (now.getMonth() + 1).toString().padStart(2, '0');
  const anio = now.getFullYear().toString().slice(-2);
  return `${dia}${mes}${anio}`;
}

function buildYapeHtml({ monto, nombre, digitos, mensaje = '', destino = 'Yape' }) {
  const { fecha, hora } = formatFecha();
  const operacion = randomOperacion();
  const [d1, d2, d3] = operacion.slice(-3).split('');

  const mensajeHtml = mensaje
    ? `<div class="bg-yape-message py-2 px-1 border-round-lg mt-3 flex gap-2 align-items-center">
         <div class="mx-1 flex">
           <img src="${CDN_CHAT}" alt="" width="16">
         </div>
         <div class="font-semibold text-xs" style="color: #403554;">${mensaje}</div>
       </div>`
    : '';

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
    .replace('{{OPERACION}}', operacion)
    .replace('{{MENSAJE}}', mensajeHtml)
    .replace('{{DESTINO}}', destino)
    .replace('{{CDN_LOGO}}', CDN_LOGO)
    .replace('{{CDN_BANNER}}', CDN_BANNER);
}

function getYapeErrorMsg() {
  return `⚠️ *Formato incorrecto.*
Debes proporcionar: El monto, titular y los últimos 3 dígitos.
Puedes ingresar texto (opcional) y destino (opcional).

✅ *Ejemplo de uso:*
\`\`\`
/yape 150|Pedro Cas*|987
\`\`\`
\`\`\`
/yape 150|Pedro Cas*|987|Texto de la operación|Plin
\`\`\``;
}

function registerYapeCommand(bot) {
  bot.onText(/\/yape(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1].trim();

    const replyOpts = {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
    };

    const sendError = () => bot.sendMessage(chatId, getYapeErrorMsg(), replyOpts);

    if (!input) {
      return sendError();
    }

    if (enProceso.has(userId)) {
      return bot.sendMessage(chatId, '⏳ Ya tienes un voucher generándose, espere un momento.', replyOpts);
    }

    if (isEnCooldown(userId)) {
      const restante = Math.ceil((COOLDOWN_MS - (Date.now() - cooldowns.get(userId))) / 1000);
      return bot.sendMessage(chatId, `⏳ Espera *${restante} segundos* antes de generar otro voucher.`, replyOpts);
    }

    const args = input.split('|');

    if (args.length < 3 || args.length > 5) {
      return sendError();
    }

    const [monto, nombre, digitos, mensaje = '', destino = 'Yape'] = args.map((a) => a.trim());

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

    enProceso.add(userId);
    const loading = await bot.sendMessage(chatId, '⏳ Generando voucher...');

    try {
      const html = buildYapeHtml({ monto, nombre, digitos, mensaje, destino });
      const buffer = await takeScreenshot(html);

      setCooldown(userId);
      await bot.deleteMessage(chatId, loading.message_id);
      await bot.sendDocument(
        chatId,
        buffer,
        { reply_to_message_id: msg.message_id },
        { filename: `Screenshot_${formatFechaFilename()}.png`, contentType: 'image/png' },
      );
    } catch (error) {
      console.error('Error en /yape:', error.message);
      await bot.deleteMessage(chatId, loading.message_id);
      await bot.sendMessage(chatId, '❌ Error al generar el voucher', replyOpts);
    } finally {
      enProceso.delete(userId);
    }
  });
}

module.exports = registerYapeCommand;
