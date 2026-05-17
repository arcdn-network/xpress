const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/arcdn-network/resource@main';
const CDN_LOGO_BANK = `${CDN_BASE}/logos/interbank.png`;
const CDN_LOGO_PLIN = `${CDN_BASE}/logos/plin.webp`;

const pool = createBrowserPool();

function randomOperacion() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function formatFecha() {
  const now = new Date();

  const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();

  let horas = now.getHours();
  const mins = now.getMinutes().toString().padStart(2, '0');
  const ampm = horas >= 12 ? 'PM' : 'AM';
  horas = (horas % 12 || 12).toString().padStart(2, '0');

  return {
    fecha: `${dia} ${mes} ${anio}`,
    hora: `${horas}:${mins} ${ampm}`,
  };
}

function buildPlinHtml({ monto, nombre, digitos, destino = 'Yape' }) {
  const { fecha, hora } = formatFecha();
  const operacion = randomOperacion();

  const montoFormateado = parseFloat(monto).toFixed(2);
  const digitosLimpios = String(digitos || '').trim();
  const mostrarDigitos = /^\d{3}$/.test(digitosLimpios);
  const celularTexto = mostrarDigitos ? `<span class="voucher-phone-dots">••• •••</span> ${digitosLimpios}` : '';

  const templatePath = path.resolve(__dirname, '../resources/templates/plin.html');
  const html = fs.readFileSync(templatePath, 'utf-8');

  return html
    .replace('{{MONTO}}', montoFormateado)
    .replace('{{NOMBRE}}', nombre)
    .replace('{{CELULAR}}', celularTexto)
    .replace('{{SEPARADOR}}', mostrarDigitos ? ' - ' : '')
    .replace('{{DESTINO}}', destino)
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{OPERACION}}', operacion)
    .replace('{{CDN_LOGO_BANK}}', CDN_LOGO_BANK)
    .replace('{{CDN_LOGO_PLIN}}', CDN_LOGO_PLIN);
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 681, height: 856, deviceScaleFactor: 2 });
    const html = buildPlinHtml(data);
    await page.setContent(html, { waitUntil: 'networkidle2' });
    const element = await page.$('.ticket-card');
    const buffer = await element.screenshot({ type: 'png' });
    return { buffer, base64: buffer.toString('base64') };
  });
}

module.exports = {
  generateVoucher,
};
