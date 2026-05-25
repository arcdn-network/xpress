const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/lemon.html'), 'utf-8');
const checkBuffer = fs.readFileSync(path.resolve(__dirname, '../resources/images/check_lemon.png'));
const CHECK_IMG = `data:image/png;base64,${checkBuffer.toString('base64')}`;

const pool = createBrowserPool();

function randomOperacion() {
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return `2026...${suffix}`;
}

function formatFecha() {
  const now = new Date();
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = [
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
  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return { fecha: `${dia} ${mes} ${anio}`, hora: `${hh}:${mm} PM` };
}

function buildLemonHtml({ monto, nombre, digitos, destino = 'YAPE' }) {
  const { fecha, hora } = formatFecha();

  const digitosLimpios = String(digitos || '').trim();
  const celularDisplay = /^\d{4}$/.test(digitosLimpios) ? `*${digitosLimpios}` : '';

  const celularHtml = celularDisplay
    ? `<div class="operation-row">
        <span class="operation-label">N° de celular</span>
        <span class="operation-value">${celularDisplay}</span>
       </div>`
    : '';

  return TEMPLATE_HTML.replace('{{CHECK_IMG}}', CHECK_IMG)
    .replace('{{MONTO}}', parseFloat(monto).toFixed(2))
    .replace('{{NOMBRE}}', nombre)
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{CELULAR}}', celularHtml)
    .replace('{{DESTINO}}', destino.toUpperCase())
    .replace('{{OPERACION}}', randomOperacion());
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildLemonHtml(data), { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    return buffer.toString('base64');
  });
}

module.exports = { generateVoucher };
