const { createBrowserPool } = require("../access/browser");
const { readResource } = require("../access/resources");

const TEMPLATE_HTML = readResource(__dirname, "template.html");
const FONT_BASE64 = readResource(__dirname, "fonts/Manrope.woff2");
const CHECK_IMG = readResource(__dirname, "resources/check_lemon.png");

const pool = createBrowserPool();

function randomOperacion() {
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `2026...${suffix}`;
}

function formatFecha() {
  const now = new Date();

  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const anio = now.getFullYear();

  let horas = now.getHours();
  const minutos = now.getMinutes().toString().padStart(2, "0");

  const periodo = horas >= 12 ? "PM" : "AM";

  horas = horas % 12;
  horas = horas === 0 ? 12 : horas;

  return {
    fecha: `${dia} ${mes} ${anio}`,
    hora: `${horas}:${minutos} ${periodo}`,
  };
}

function formatMonto(monto) {
  return Number(monto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml({ monto, nombre, digitos, destino = "YAPE" }) {
  const { fecha, hora } = formatFecha();

  const digitosLimpios = String(digitos || "").trim();
  const celularDisplay = /^\d{3}$/.test(digitosLimpios) ? `*${digitosLimpios}` : "";

  const celularHtml = celularDisplay
    ? `<div class="operation-row">
        <span class="operation-label">N° de celular</span>
        <span class="operation-value">${celularDisplay}</span>
       </div>`
    : "";

  return TEMPLATE_HTML.replace("{{FONT_BASE64}}", FONT_BASE64)
    .replace("{{CHECK_IMG}}", CHECK_IMG)
    .replace("{{MONTO}}", formatMonto(monto))
    .replace("{{NOMBRE}}", nombre)
    .replace("{{FECHA}}", fecha)
    .replace("{{HORA}}", hora)
    .replace("{{CELULAR}}", celularHtml)
    .replace("{{DESTINO}}", destino.toUpperCase())
    .replace("{{OPERACION}}", randomOperacion());
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildHtml(data), { waitUntil: "networkidle2" });
    const buffer = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
    return buffer.toString("base64");
  });
}

module.exports = { generateVoucher };
