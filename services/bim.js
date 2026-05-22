const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/bim.html'), 'utf-8');
const bimLogoBuffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/logo-bim.png'));
const BIM_LOGO = `data:image/png;base64,${bimLogoBuffer.toString('base64')}`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pool = createBrowserPool();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomOperacion() {
  const now = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const fecha = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const hora = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const random = Math.floor(100000 + Math.random() * 900000).toString();
  return `${fecha}${hora}${random}`;
}

function formatFecha() {
  const now = new Date();
  const horas = now.getHours();
  const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
  return `${now.getDate()} ${MESES[now.getMonth()]}. ${now.getFullYear()} ${(horas % 12 || 12).toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`;
}

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildBimHtml({ monto, nombre, digitos, mensaje = '', destino = 'Bim' }) {
  const fecha = formatFecha();
  const operacion = randomOperacion();

  const celularHtml =
    digitos && /^\d{3}$/.test(String(digitos))
      ? `<div class="mb-2"><span>Número de celular:</span><span>*** *** ${digitos}</span></div>`
      : '';

  const comentarioHtml = mensaje ? `<div class="mb-2"><span>Comentario:</span><span>${mensaje}</span></div>` : '';

  return TEMPLATE_HTML.replace('{{MONTO}}', parseFloat(monto).toFixed(2))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{DESTINO}}', destino.toUpperCase())
    .replace('{{CELULAR}}', celularHtml)
    .replace('{{COMENTARIO}}', comentarioHtml)
    .replace('{{FECHA}}', fecha)
    .replace('{{OPERACION}}', operacion)
    .replace(/\{\{CDN_LOGO\}\}/g, BIM_LOGO);
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 460, height: 1024, deviceScaleFactor: 3 });
    await page.setContent(buildBimHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
