const { createBrowserPool, readResource } = require("../../utils/browser");

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = readResource("#resources/templates/bim.html");
const FONT_BASE64 = readResource("#resources/fonts/Roboto.woff2");
const BIM_LOGO = readResource("#resources/images/logo-bim.png");

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pool = createBrowserPool();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomOperacion() {
  const now = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const fecha = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const hora = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const random = Math.floor(100000 + Math.random() * 900000).toString();
  return `${fecha}${hora}${random}`;
}

function formatFecha() {
  const now = new Date();
  const horas = now.getHours();
  const ampm = horas >= 12 ? "p. m." : "a. m.";
  return `${now.getDate()} ${MESES[now.getMonth()]}. ${now.getFullYear()} ${(horas % 12 || 12).toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} ${ampm}`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildHtml({ monto, nombre, digitos, mensaje = "", destino = "Bim" }) {
  const fecha = formatFecha();
  const operacion = randomOperacion();

  const celularHtml =
    digitos && /^\d{3}$/.test(String(digitos)) ? `<div class="mb-2"><span>Número de celular:</span><span>*** *** ${digitos}</span></div>` : "";

  const comentarioHtml = mensaje ? `<div class="mb-2"><span>Comentario:</span><span>${mensaje}</span></div>` : "";

  return TEMPLATE_HTML.replace("{{FONT_BASE64}}", FONT_BASE64)
    .replace("{{MONTO}}", formatMonto(monto))
    .replace("{{NOMBRE}}", nombre)
    .replace("{{DESTINO}}", destino.toUpperCase())
    .replace("{{CELULAR}}", celularHtml)
    .replace("{{COMENTARIO}}", comentarioHtml)
    .replace("{{FECHA}}", fecha)
    .replace("{{OPERACION}}", operacion)
    .replace(/\{\{CDN_LOGO\}\}/g, BIM_LOGO);
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildHtml(data), { waitUntil: "networkidle2" });
    const buffer = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
    return buffer.toString("base64");
  });
}

module.exports = { generateVoucher };
