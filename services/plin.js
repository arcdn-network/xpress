const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/plin.html'), 'utf-8');
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pool = createBrowserPool();

const BACKGROUND_BASE64 = (() => {
  const buffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/template_plin.png'));
  return `data:image/png;base64,${buffer.toString('base64')}`;
})();

const FONT_BASE64 = fs.readFileSync(path.resolve(__dirname, '../resources/fonts/Geometria.ttf')).toString('base64');

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

function buildPlinHtml({ monto, nombre, digitos, destino = 'Plin' }) {
  const { fecha, hora } = formatFecha();
  const digitosLimpios = String(digitos || '').trim();

  let celularHtml = '';
  if (/^\d{3}$/.test(digitosLimpios)) {
    celularHtml = `*** *** ${digitosLimpios} - `;
  } else if (/^\d{9}$/.test(digitosLimpios)) {
    celularHtml = `${digitosLimpios} - `;
  }

  return TEMPLATE_HTML.replace('{{FONT}}', `data:font/ttf;base64,${FONT_BASE64}`)
    .replace('{{BACKGROUND}}', BACKGROUND_BASE64)
    .replace('{{MONTO}}', parseFloat(monto).toFixed(2))
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
