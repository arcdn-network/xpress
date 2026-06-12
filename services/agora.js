const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/agora.html'), 'utf-8');
const checkBuffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/check_agora.png'));
const ticketBuffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/ticket_agora.png'));
const CHECK_IMG = `data:image/png;base64,${checkBuffer.toString('base64')}`;
const TICKET_IMG = `data:image/png;base64,${ticketBuffer.toString('base64')}`;

const pool = createBrowserPool();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomOperacion() {
  return `1${Math.floor(Math.random() * 1000000000000000)
    .toString()
    .padStart(15, '0')}`.slice(0, 16);
}

function formatFecha() {
  const now = new Date();
  return {
    fecha: `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`,
    hora: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
  };
}

function formatMonto(monto) {
  return Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildAgoraHtml({ monto, nombre, digitos, mensaje, destino = 'AGORA/OH!' }) {
  const { fecha, hora } = formatFecha();

  const esCompraIzi = nombre.toLowerCase().startsWith('izi*') || nombre.toLowerCase().startsWith('*izi');

  const tituloHtml = esCompraIzi
    ? `<div class="text-xs font-light mb-2">Compraste en</div>${nombre.toUpperCase()}`
    : 'Pago realizado';

  const iconHtml = esCompraIzi
    ? `<img src="${TICKET_IMG}" class="w-6rem h-6rem">`
    : `<img src="${CHECK_IMG}" class="w-5rem h-5rem">`;

  const titularHtml = esCompraIzi
    ? ''
    : `<div class="row flex justify-content-between">
        <span>Pagaste a</span>
        <span>${nombre.toUpperCase()}</span>
       </div>`;

  const digitosLimpios = String(digitos || '').trim();
  const celularDisplay = /^\d{3}$/.test(digitosLimpios) || /^\d{9}$/.test(digitosLimpios) ? digitosLimpios : '';

  const celularHtml =
    celularDisplay && !esCompraIzi
      ? `<div class="row flex justify-content-between">
        <span>Celular</span>
        <span class="flex align-items-center gap-1">
          ${/^\d{3}$/.test(digitosLimpios) ? '<div class="text-xs">•••</div><div class="text-xs">•••</div>' : ''}
          <div>${celularDisplay}</div>
        </span>
       </div>`
      : '';

  const destinoHtml = esCompraIzi
    ? `<div class="row flex justify-content-between">
        <span>Tipo de operación</span>
        <span>Pago a comercios</span>
       </div>`
    : `<div class="row flex justify-content-between">
        <span>Destino</span>
        <span>${destino.toUpperCase()}</span>
       </div>`;

  const mensajeHtml = mensaje
    ? `<div class="row flex justify-content-between">
        <span>Motivo</span>
        <span>${mensaje}</span>
       </div>`
    : '';

  return TEMPLATE_HTML.replace('{{MONTO}}', formatMonto(monto))
    .replace('{{TITULO}}', tituloHtml)
    .replace('{{TITULAR}}', titularHtml)
    .replace('{{CELULAR}}', celularHtml)
    .replace('{{MENSAJE}}', mensajeHtml)
    .replace('{{DESTINO}}', destinoHtml)
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{OPERACION}}', randomOperacion())
    .replace('{{ICON}}', iconHtml);
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 460, height: 1024, deviceScaleFactor: 3 });
    await page.setContent(buildAgoraHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
