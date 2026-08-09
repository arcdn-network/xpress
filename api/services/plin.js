const { createBrowserPool, readResource } = require("../../utils/browser");

const TEMPLATE_HTML = readResource("#resources/templates/plin.html");
const BACKGROUND = readResource("#resources/images/template_plin.png");
const FONT_BASE64 = readResource("#resources/fonts/Geometria.ttf");

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

function buildHtml({ monto, nombre, digitos, destino = "Plin" }) {
  const { fecha, hora } = formatFecha();
  const digitosLimpios = String(digitos || "").trim();

  let celularHtml = "";
  if (/^\d{3}$/.test(digitosLimpios)) {
    celularHtml = `*** *** ${digitosLimpios} - `;
  } else if (/^\d{9}$/.test(digitosLimpios)) {
    celularHtml = `${digitosLimpios} - `;
  }

  return TEMPLATE_HTML.replace("{{FONT_BASE64}}", FONT_BASE64)
    .replace("{{BACKGROUND}}", BACKGROUND)
    .replace("{{MONTO}}", formatMonto(monto))
    .replace("{{NOMBRE}}", nombre)
    .replace("{{CELULAR}}", celularHtml)
    .replace("{{DESTINO}}", destino)
    .replace("{{FECHA}}", `${fecha} ${hora}`)
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
