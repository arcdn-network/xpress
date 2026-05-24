const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/ibk.html'), 'utf-8');
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/arcdn-network/resource@main';
const CDN_LOGO_BANK = `${CDN_BASE}/logos/interbank.png`;
const CDN_LOGO_PLIN = `${CDN_BASE}/logos/plin.webp`;
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pool = createBrowserPool();

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildPlinHtml({ monto, nombre, digitos, destino = 'Plin' }) {
  const { fecha, hora } = formatFecha();
  const digitosLimpios = String(digitos || '').trim();
  const mostrarDigitos = /^\d{3}$/.test(digitosLimpios);

  return TEMPLATE_HTML.replace('{{MONTO}}', parseFloat(monto).toFixed(2))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{CELULAR}}', mostrarDigitos ? `<span class="voucher-phone-dots">••• •••</span> ${digitosLimpios}` : '')
    .replace('{{SEPARADOR}}', mostrarDigitos ? ' - ' : '')
    .replace('{{DESTINO}}', destino)
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{OPERACION}}', randomOperacion())
    .replace('{{CDN_LOGO_BANK}}', CDN_LOGO_BANK)
    .replace('{{CDN_LOGO_PLIN}}', CDN_LOGO_PLIN);
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 681, height: 856, deviceScaleFactor: 3 });
    await page.setContent(buildPlinHtml(data), { waitUntil: 'networkidle2' });
    const element = await page.$('.ticket-card');
    const buffer = await element.screenshot({ type: 'jpeg', quality: 85 });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
