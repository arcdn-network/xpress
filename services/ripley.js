const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const readFile = (relativePath, encoding = null) => fs.readFileSync(path.resolve(__dirname, relativePath), encoding);

const toBase64 = (relativePath, mimeType) => {
  const buffer = readFile(relativePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const TEMPLATE_HTML = readFile('../resources/templates/ripley.html', 'utf-8');
const BACKGROUND_BASE64 = toBase64('../resources/images/ripley.png', 'image/png');

const pool = createBrowserPool();

function formatFecha() {
  const now = new Date();
  return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

function formatHora() {
  const now = new Date();
  const horas = now.getHours().toString().padStart(2, '0');
  const minutos = now.getMinutes().toString().padStart(2, '0');
  const segundos = now.getSeconds().toString().padStart(2, '0');
  return `${horas}:${minutos}:${segundos}`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildRipleyHtml({ monto, nombre, digitos, destino }) {
  const digitosLimpios = String(digitos || '').trim();

  let celularValue = '';
  if (/^\d{3}$/.test(digitosLimpios)) {
    celularValue = `*** *** ${digitosLimpios}`;
  } else if (/^\d{9}$/.test(digitosLimpios)) {
    celularValue = digitosLimpios;
  }

  const celularRow = celularValue
    ? `<div class="flex justify-content-between align-items-center mb-3 line-height-2">
               <div class="label">Teléfono destinatario</div>
               <div class="value">${celularValue}</div>
            </div>`
    : '';

  return TEMPLATE_HTML.replace('{{BACKGROUND}}', BACKGROUND_BASE64)
    .replace('{{MONTO}}', formatMonto(monto))
    .replace('{{TITULAR}}', nombre)
    .replace('{{DESTINO}}', destino)
    .replace('{{FECHA}}', formatFecha())
    .replace('{{HORA}}', formatHora())
    .replace('{{CELULAR_ROW}}', celularRow);
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildRipleyHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
