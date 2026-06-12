const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const readFile = (relativePath, encoding = null) => fs.readFileSync(path.resolve(__dirname, relativePath), encoding);

const toBase64 = (relativePath, mimeType) => {
  const buffer = readFile(relativePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const TEMPLATE_HTML = readFile('../resources/templates/plin.html', 'utf-8');
const BACKGROUND_BASE64 = toBase64('../resources/images/template_plin.png', 'image/png');
const FONT_BASE64 = toBase64('../resources/fonts/Geometria.ttf', 'font/ttf');

const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pool = createBrowserPool();

function randomOperacion() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function formatFecha() {
  const now = new Date();
  const horas = now.getHours();
  const ampm = horas >= 12 ? 'PM' : 'AM';
  return {
    fecha: `${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}`,
    hora: `${(horas % 12 || 12).toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`,
  };
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildPlinHtml({ monto, nombre, digitos, destino = 'Plin' }) {
  const { fecha, hora } = formatFecha();
  const digitosLimpios = String(digitos || '').trim();

  let celularHtml = '';
  if (/^\d{3}$/.test(digitosLimpios)) {
    celularHtml = `*** *** ${digitosLimpios} - `;
  } else if (/^\d{9}$/.test(digitosLimpios)) {
    celularHtml = `${digitosLimpios} - `;
  }

  return TEMPLATE_HTML.replace('{{FONT}}', FONT_BASE64)
    .replace('{{BACKGROUND}}', BACKGROUND_BASE64)
    .replace('{{MONTO}}', formatMonto(monto))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{CELULAR}}', celularHtml)
    .replace('{{DESTINO}}', destino)
    .replace('{{FECHA}}', `${fecha} ${hora}`)
    .replace('{{OPERACION}}', randomOperacion());
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildPlinHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
