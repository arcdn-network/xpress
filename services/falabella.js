const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const readFile = (relativePath, encoding = null) => fs.readFileSync(path.resolve(__dirname, relativePath), encoding);

const toBase64 = (relativePath, mimeType) => {
  const buffer = readFile(relativePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const TEMPLATE_HTML = readFile('../resources/templates/falabella.html', 'utf-8');
const BACKGROUND_BASE64 = toBase64('../resources/images/falabella.jpg', 'image/jpeg');
const FONT_NUNITO_BASE64 = toBase64('../resources/fonts/Nunito.woff2', 'font/woff2');

const pool = createBrowserPool();

function formatFecha() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, '0');
  const mes = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${dia}/${mes}/${now.getFullYear()}`;
}

function formatHora() {
  const now = new Date();
  const horas = now.getHours().toString().padStart(2, '0');
  const minutos = now.getMinutes().toString().padStart(2, '0');
  return `${horas}:${minutos}`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function randomDigits(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function generarCCI() {
  return randomDigits(20);
}

function generarNroOperacion() {
  return `0${randomDigits(11)}`;
}

function buildFalabellaHtml({ monto, nombre, digitos, destino }) {
  const digitosLimpios = String(digitos || '').trim();

  let celularRow = '';
  if (/^\d+$/.test(digitosLimpios) && digitosLimpios.length >= 3) {
    const ultimos3 = digitosLimpios.slice(-3);
    celularRow = `<div class="flex justify-content-between line-height-2 mb-2">
               <span class="label">Nro. celular</span>
               <span class="value">••••${ultimos3}</span>
            </div>`;
  }

  return TEMPLATE_HTML.replace('{{BACKGROUND}}', BACKGROUND_BASE64)
    .replace('{{FONT_NUNITO}}', FONT_NUNITO_BASE64)
    .replace('{{MONTO}}', formatMonto(monto))
    .replace(/{{DESTINATARIO}}/g, nombre)
    .replace('{{CELULAR_ROW}}', celularRow)
    .replace('{{DESTINO}}', destino)
    .replace('{{CCI_DESTINO}}', generarCCI())
    .replace('{{FECHA}}', formatFecha())
    .replace('{{HORA}}', formatHora())
    .replace('{{NRO_OPERACION}}', generarNroOperacion());
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildFalabellaHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
