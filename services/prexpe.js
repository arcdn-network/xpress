const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const readFile = (relativePath, encoding = null) => fs.readFileSync(path.resolve(__dirname, relativePath), encoding);

const toBase64 = (relativePath, mimeType) => {
  const buffer = readFile(relativePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const TEMPLATE_HTML = readFile('../resources/templates/prexpe.html', 'utf-8');
const BACKGROUND_BASE64 = toBase64('../resources/images/prexpe.png', 'image/png');

const pool = createBrowserPool();

function randomOperacion() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

function formatFecha() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, '0');
  const mes = (now.getMonth() + 1).toString().padStart(2, '0');
  const anio = now.getFullYear();
  const horas = now.getHours().toString().padStart(2, '0');
  const minutos = now.getMinutes().toString().padStart(2, '0');
  return `${dia}/${mes}/${anio} - ${horas}:${minutos} hs.`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildPrexpeHtml({ monto, nombre, destino = 'Yape' }) {
  return TEMPLATE_HTML.replace('{{BACKGROUND}}', BACKGROUND_BASE64)
    .replace('{{MONTO}}', formatMonto(monto))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{DESTINO}}', destino)
    .replace('{{OPERACION}}', randomOperacion())
    .replace('{{FECHA}}', formatFecha());
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 360, height: 740, deviceScaleFactor: 3 });
    await page.setContent(buildPrexpeHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
