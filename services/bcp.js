const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/bcp.html'), 'utf-8');
const FONT_BASE64 = fs.readFileSync(path.resolve(__dirname, '../resources/fonts/Flexo.woff')).toString('base64');

const BANNERS = ['banner_bcp_1.jpeg', 'banner_bcp_2.jpeg'].map((file) => {
  const buffer = fs.readFileSync(path.resolve(__dirname, `../resources/images/${file}`));
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
});

function getRandomBanner() {
  return BANNERS[Math.floor(Math.random() * BANNERS.length)];
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const pool = createBrowserPool();

function randomOperacion() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function formatFecha() {
  const now = new Date();
  const horas = now.getHours();
  const ampm = horas >= 12 ? 'pm' : 'am';
  const hora12 = (horas % 12 || 12).toString().padStart(2, '0');
  const minutos = now.getMinutes().toString().padStart(2, '0');
  return {
    fecha: `${DIAS[now.getDay()]}, ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}`,
    hora: `${hora12}:${minutos} ${ampm}`,
  };
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildBcpHtml({ monto, nombre, digitos, destino = 'BCP' }) {
  const { fecha, hora } = formatFecha();
  const operacion = randomOperacion();

  const celularHtml = digitos ? `<div class="bcp-gray text-sm">*** *** ${digitos}</div>` : '';

  return TEMPLATE_HTML.replace('{{MONTO}}', formatMonto(monto))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{DIGITOS}}', celularHtml)
    .replace('{{DESTINO}}', destino)
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{OPERACION}}', operacion)
    .replace('{{BANNER}}', getRandomBanner())
    .replace('{{FONT}}', `data:font/woff;base64,${FONT_BASE64}`);
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 460, height: 1024, deviceScaleFactor: 3 });
    await page.setContent(buildBcpHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
