const { createBrowserPool, readResource } = require("../../utils/browser");

const TEMPLATE_HTML = readResource("#resources/templates/plin.html");
const MEDIA = {
  FONT_REGULAR: readResource("#resources/fonts/Poppins-Regular.ttf"),
  FONT_MEDIUM: readResource("#resources/fonts/Poppins-Medium.ttf"),
  FONT_SEMIBOLD: readResource("#resources/fonts/Poppins-SemiBold.ttf"),
  PLIN_LOGO: readResource("#resources/images/plin-voucher-logo.webp"),
  COPY_ICON: readResource("#resources/images/copy-operation.svg"),
};

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const pool = createBrowserPool();

function randomOperacion() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function formatFecha() {
  const now = new Date();
  const horas = now.getHours();
  const ampm = horas >= 12 ? "PM" : "AM";
  return {
    fecha: `${now.getDate().toString().padStart(2, "0")} ${MESES[now.getMonth()]} ${now.getFullYear()}`,
    hora: `${(horas % 12 || 12).toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")} ${ampm}`,
  };
}

function formatMonto(monto) {
  return Number(monto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml({ monto, nombre, digitos, destino = "Plin", mensaje = "" }) {
  const { fecha, hora } = formatFecha();
  const digitosLimpios = String(digitos || "").trim();

  let celularHtml = "";
  if (/^\d{3}$/.test(digitosLimpios)) {
    celularHtml = `••• ••• ${digitosLimpios} - `;
  } else if (/^\d{9}$/.test(digitosLimpios)) {
    const formateado = digitosLimpios.match(/.{1,3}/g).join(" ");
    celularHtml = `${formateado} - `;
  }

  const values = {
    ...MEDIA,
    MONTO: formatMonto(monto),
    NOMBRE: escapeHtml(nombre),
    CELULAR: celularHtml,
    DESTINO: escapeHtml(destino),
    FECHA: `${fecha} · ${hora}`,
    OPERACION: randomOperacion(),
    MENSAJE: escapeHtml(mensaje),
    MESSAGE_HIDDEN: String(mensaje ?? "").trim() ? "" : "hidden",
  };
  return TEMPLATE_HTML.replace(/{{([A-Z_]+)}}/g, (placeholder, key) => values[key] ?? placeholder);
}

async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
    await page.setContent(buildHtml(data), { waitUntil: "networkidle2" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const buffer = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
    return buffer.toString("base64");
  });
}

module.exports = { generateVoucher };
