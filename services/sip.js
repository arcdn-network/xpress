const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/sip.html'), 'utf-8');

const pool = createBrowserPool();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function randomOperacion() {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function formatFechaHora(fechaBase = new Date()) {
  const now = new Date(fechaBase);
  const dia = now.getDate().toString().padStart(2, '0');
  const mes = MESES[now.getMonth()];
  const anio = now.getFullYear();

  let horas = now.getHours();
  const minutos = now.getMinutes().toString().padStart(2, '0');
  const meridiano = horas >= 12 ? 'pm' : 'am';
  horas = horas % 12;
  horas = horas === 0 ? 12 : horas;

  return `${dia} ${mes} ${anio} - ${horas.toString().padStart(2, '0')}:${minutos} ${meridiano}`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function maskCelular(digitos) {
  const limpio = String(digitos || '').replace(/\D/g, '');
  if (!limpio) return '';

  const ultimos = limpio.slice(-3);
  return `••• ••• ${ultimos}`;
}

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildSipHtml({ monto, nombre, digitos, destino = 'Sip', fecha }) {
  return TEMPLATE_HTML.replace('{{MONTO}}', formatMonto(monto))
    .replace('{{NOMBRE}}', String(nombre || '').toUpperCase())
    .replace('{{CELULAR}}', maskCelular(digitos))
    .replace('{{DESTINO}}', destino)
    .replace('{{FECHA_HORA}}', formatFechaHora(fecha))
    .replace('{{OPERACION}}', randomOperacion());
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 460, height: 1024, deviceScaleFactor: 3 });
    await page.setContent(buildSipHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
