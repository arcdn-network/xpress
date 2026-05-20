const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/agora.html'), 'utf-8');
const checkBuffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/check_agora.png'));
const CHECK_IMG = `data:image/png;base64,${checkBuffer.toString('base64')}`;

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

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildAgoraHtml({ monto, nombre, digitos, mensaje, destino = 'PLIN' }) {
  const { fecha, hora } = formatFecha();

  const celularHtml = digitos
    ? `<div class="row flex justify-content-between">
        <span>Celular</span>
        <span class="flex align-items-center gap-1">
          <div class="text-xs">•••</div>
          <div class="text-xs">•••</div>
          <div>${digitos}</div>
        </span>
       </div>`
    : '';

  const motivoHtml = mensaje
    ? `<div class="row flex justify-content-between">
        <span>Motivo</span>
        <span>${mensaje}</span>
       </div>`
    : '';

  return TEMPLATE_HTML.replace('{{MONTO}}', parseFloat(monto).toFixed(2))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{CELULAR}}', celularHtml)
    .replace('{{MOTIVO}}', motivoHtml)
    .replace('{{DESTINO}}', destino.toUpperCase())
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{OPERACION}}', randomOperacion())
    .replace('{{CDN_CHECK}}', CHECK_IMG);
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 460, height: 940, deviceScaleFactor: 2 });
    await page.setContent(buildAgoraHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    return { buffer, base64: buffer.toString('base64') };
  });
}

module.exports = { generateVoucher };
