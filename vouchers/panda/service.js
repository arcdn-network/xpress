const crypto = require("crypto");
const { createBrowserPool } = require("../access/browser");
const { readResource } = require("../access/resources");

const TEMPLATE_HTML = readResource(__dirname, "template.html");
const FONT_BASE64 = readResource(__dirname, "fonts/Quicksand.woff2");
const BACKGROUND = readResource(__dirname, "resources/panda.png");

const pool = createBrowserPool();

function formatFecha() {
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const now = new Date();

  return `${now.getDate()} de ${meses[now.getMonth()]} ${now.getFullYear()}`;
}

function formatHora() {
  const now = new Date();

  const horas = now.getHours().toString().padStart(2, "0");
  const minutos = now.getMinutes().toString().padStart(2, "0");

  return `${horas}:${minutos}`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generarCCI() {
  // CCI peruano de 20 dígitos
  let cci = "";

  for (let i = 0; i < 20; i++) {
    cci += Math.floor(Math.random() * 10);
  }

  return cci;
}

function generarCodigo() {
  return crypto.randomUUID();
}

function buildHtml({ monto, nombre, destino, mensaje }) {
  const cci = generarCCI();
  const codigo = generarCodigo();

  const mensajeLimpio = String(mensaje ?? "").trim();

  const mensajeRow = mensajeLimpio
    ? `
      <div class="row border">
         <span class="label">
            Mensajes
         </span>

         <span class="value">
            ${escapeHtml(mensajeLimpio)}
         </span>
      </div>
    `
    : "";

  return TEMPLATE_HTML.replace("{{FONT_BASE64}}", FONT_BASE64)
    .replace("{{BACKGROUND}}", BACKGROUND)

    .replace("{{MONTO}}", formatMonto(monto))
    .replace("{{DESTINATARIO}}", escapeHtml(nombre))
    .replace("{{ENTIDAD}}", escapeHtml(destino))

    .replace("{{CCI}}", cci)
    .replace("{{CODIGO}}", codigo)

    .replace("{{FECHA}}", formatFecha())
    .replace("{{HORA}}", formatHora())

    .replace("{{MENSAJES_ROW}}", mensajeRow);
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildHtml(data), { waitUntil: "networkidle2" });
    const buffer = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
    return buffer.toString("base64");
  });
}

module.exports = {
  generateVoucher,
};
