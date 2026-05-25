const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const readFileBase64 = (relativePath, mimeType) => {
  const filePath = path.resolve(__dirname, relativePath);
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mimeType};base64,${base64}`;
};

const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/scotiabank.html'), 'utf-8');
const LOGO_PLIN = readFileBase64('../resources/images/plin.webp', 'image/webp');
const LOGO_SCOTIA = readFileBase64('../resources/images/scotiabank.png', 'image/png');
const FONT_SCOTIA = readFileBase64('../resources/fonts/Scotia-Regular.woff', 'font/woff');

const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

const pool = createBrowserPool();

function randomOperacion() {
  const parte = () => Math.floor(100 + Math.random() * 900).toString();
  const larga = Math.floor(1000 + Math.random() * 9000).toString();
  return `${parte()}.${parte()}.${parte()}.${larga}`;
}

function randomCuentaOrigen() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function formatFecha() {
  const now = new Date();
  const dia = now.getDate();
  const mes = MESES[now.getMonth()];
  const horas = now.getHours();
  const minutos = now.getMinutes().toString().padStart(2, '0');
  const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
  const hora12 = (horas % 12 || 12).toString().padStart(2, '0');
  return {
    fecha: `${dia} ${mes}, ${hora12}:${minutos} ${ampm}`,
  };
}

function buildScotiabankHtml({ monto, nombre, digitos, mensaje = '', destino = 'Plin' }) {
  const { fecha } = formatFecha();
  const operacion = randomOperacion();

  const digitosHtml = digitos ? `*** *** ${digitos}<br />${destino}` : destino;

  const mensajeRow = mensaje
    ? `<div class="row-item flex px-3 py-2 gap-3 text-sm">
            <span>Descripción</span>
            <span>${mensaje}</span>
         </div>`
    : '';

  return TEMPLATE_HTML.replace('{{MONTO}}', parseFloat(monto).toFixed(2))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{DIGITOS}}', digitosHtml)
    .replace('{{DESTINO}}', destino)
    .replace('{{FECHA}}', fecha)
    .replace('{{OPERACION}}', operacion)
    .replace('{{MENSAJE}}', mensajeRow)
    .replace('{{FONT}}', FONT_SCOTIA)
    .replace('{{LOGO_PLIN}}', LOGO_PLIN)
    .replace('{{LOGO_SCOTIA}}', LOGO_SCOTIA);
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildScotiabankHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
