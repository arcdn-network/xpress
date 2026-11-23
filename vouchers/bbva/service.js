const { createBrowserPool } = require("../access/browser");
const { readResource } = require("../access/resources");

const TEMPLATE_HTML = readResource(__dirname, "template.html");
const FONT_BASE64 = readResource(__dirname, "fonts/BentonSans.woff");

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const pool = createBrowserPool();

function randomOperacion() {
  const chars = "0123456789ABCDEF";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function randomCuentaOrigen() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function formatFecha() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, "0");
  const mes = MESES[now.getMonth()];
  const anio = now.getFullYear();
  const horas = now.getHours().toString().padStart(2, "0");
  const minutos = now.getMinutes().toString().padStart(2, "0");
  return {
    fecha: `${dia} ${mes} ${anio}`,
    hora: `${horas}:${minutos}`,
  };
}

function formatMonto(monto) {
  return Number(monto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml({ monto, nombre, digitos, destino = "BBVA Perú" }) {
  const { fecha, hora } = formatFecha();
  const operacion = randomOperacion();
  const cuentaOrigen = randomCuentaOrigen();

  const digitosHtml = digitos ? `<div class="text-right font-bold text-black font-italic">•${digitos}</div>` : "";

  return TEMPLATE_HTML.replace("{{FONT_BASE64}}", FONT_BASE64)
    .replace("{{MONTO}}", formatMonto(monto))
    .replace("{{NOMBRE}}", nombre)
    .replace("{{DIGITOS}}", digitosHtml)
    .replace("{{DESTINO}}", destino)
    .replace("{{FECHA}}", fecha)
    .replace("{{HORA}}", hora)
    .replace("{{OPERACION}}", operacion)
    .replace("{{CUENTA_ORIGEN}}", cuentaOrigen);
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
