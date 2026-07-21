const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/caja.html'), 'utf-8');
const logoCajaBuffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/logo_caja.png'));
const logoPlinBuffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/logo_plin.png'));

const LOGO_CAJA = `data:image/png;base64,${logoCajaBuffer.toString('base64')}`;
const LOGO_PLIN = `data:image/png;base64,${logoPlinBuffer.toString('base64')}`;

const pool = createBrowserPool();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomOperacion() {
  const now = new Date();
  const anio = now.getFullYear().toString();
  const mes = (now.getMonth() + 1).toString().padStart(2, '0');
  const dia = now.getDate().toString().padStart(2, '0');
  const prefijo = `${anio}${mes}${dia}`;

  let resto = '';
  for (let i = 0; i < 14; i++) {
    resto += Math.floor(Math.random() * 10);
  }

  return `${prefijo}${resto}`;
}

function formatFechaHora() {
  const now = new Date();
  const fecha = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  const hora = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  return `${fecha} ${hora}`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTelefono(digitos) {
  const limpio = String(digitos || '').trim();

  if (/^\d{9}$/.test(limpio)) return `<span>${limpio}</span>`;

  if (/^\d{3}$/.test(limpio)) {
    const dotGroup =
      '<span class="dot-group"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
    return `${dotGroup}${dotGroup}<span>${limpio}</span>`;
  }

  return `<span>${limpio}</span>`;
}

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildCajaHtml({ monto, nombre, digitos, destino = 'plin' }) {
  return TEMPLATE_HTML.replace('{{LOGO_CAJA}}', LOGO_CAJA)
    .replace('{{LOGO_RED}}', LOGO_PLIN)
    .replace('{{MONTO}}', formatMonto(monto))
    .replace('{{DESTINATARIO}}', String(nombre).toUpperCase())
    .replace('{{TELEFONO}}', formatTelefono(digitos))
    .replace('{{OPERACION}}', randomOperacion())
    .replace('{{FECHA_HORA}}', formatFechaHora());
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 460, height: 1024, deviceScaleFactor: 3 });
    await page.setContent(buildCajaHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
