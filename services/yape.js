const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

const BANNERS_DIR = path.resolve(__dirname, '../resources/banners');

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/arcdn-network/resource@main';
const CDN_LOGO = `${CDN_BASE}/logos/yape.png`;
const CDN_CHAT = `${CDN_BASE}/chat.png`;

const pool = createBrowserPool();

const bannerFiles = fs
  .readdirSync(BANNERS_DIR)
  .filter((file) => file.endsWith('.webp'))
  .map((file) => {
    const buffer = fs.readFileSync(path.join(BANNERS_DIR, file));
    return `data:image/webp;base64,${buffer.toString('base64')}`;
  });

if (!bannerFiles.length) {
  throw new Error('No hay banners disponibles');
}

function getRandomBanner() {
  return bannerFiles[Math.floor(Math.random() * bannerFiles.length)];
}

function randomOperacion() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function formatFecha() {
  const now = new Date();

  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();

  let horas = now.getHours();

  const mins = now.getMinutes().toString().padStart(2, '0');
  const ampm = horas >= 12 ? 'p. m.' : 'a. m.';

  horas = (horas % 12 || 12).toString().padStart(2, '0');

  return {
    fecha: `${dia} ${mes}. ${anio}`,
    hora: `${horas}:${mins} ${ampm}`,
  };
}

function buildYapeHtml({ monto, nombre, digitos, mensaje = '', destino = 'Yape' }) {
  const { fecha, hora } = formatFecha();

  const operacion = randomOperacion();
  const randomBanner = getRandomBanner();

  const [d1, d2, d3] = operacion.slice(-3).split('');

  const mostrarDigitos = !!digitos && /^\d{3}$/.test(String(digitos));
  const mostrarCodigo = destino.toLowerCase() === 'yape';

  const mensajeHtml = mensaje
    ? `
      <div class="bg-yape-message py-2 px-1 border-round-lg mt-3 flex gap-2 align-items-center">
        <div class="mx-1 flex">
          <img src="${CDN_CHAT}" alt="" width="16">
        </div>

        <div class="font-semibold text-xs" style="color: #403554;">
          ${mensaje}
        </div>
      </div>
    `
    : '';

  const celularHtml = mostrarDigitos
    ? `
    <div class="flex justify-content-between text-sm mt-2">
      <span>Nro. de celular</span>
      <span class="font-medium">*** *** ${digitos}</span>
    </div>
  `
    : '';

  const codigoHtml = mostrarCodigo
    ? `
      <div class="flex align-items-center justify-content-between mt-2">
        <div class="flex align-items-center gap-2 text-uxs font-semibold"
          style="color: var(--yape-text-label); letter-spacing: 0.5px;">
          <span>CÓDIGO DE SEGURIDAD</span>
        </div>

        <div class="my-1 flex" style="gap: 5px;">
          <div class="box-code"><span class="font-bold">${d1}</span></div>
          <div class="box-code"><span class="font-bold">${d2}</span></div>
          <div class="box-code"><span class="font-bold">${d3}</span></div>
        </div>
      </div>

      <div class="border-botton mt-2"></div>
    `
    : '';

  const templatePath = path.resolve(__dirname, '../resources/templates/yape.html');

  const html = fs.readFileSync(templatePath, 'utf-8');

  return html
    .replace('{{MONTO}}', monto)
    .replace('{{NOMBRE}}', nombre)
    .replace('{{FECHA}}', fecha)
    .replace('{{HORA}}', hora)
    .replace('{{CELULAR}}', celularHtml)
    .replace('{{OPERACION}}', operacion)
    .replace('{{MENSAJE}}', mensajeHtml)
    .replace('{{DESTINO}}', destino)
    .replace('{{CODIGO_SEGURIDAD}}', codigoHtml)
    .replace('{{CDN_LOGO}}', CDN_LOGO)
    .replace('{{CDN_BANNER}}', randomBanner);
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2 });
    const html = buildYapeHtml(data);
    await page.setContent(html, { waitUntil: 'networkidle2' });
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    return { buffer, base64: buffer.toString('base64') };
  });
}

module.exports = {
  generateVoucher,
};
