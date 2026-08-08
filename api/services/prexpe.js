const fs = require("fs");
const { createBrowserPool } = require("../../utils/browser");

const TEMPLATE_HTML = fs.readFileSync(require.resolve("#resources/templates/prexpe.html"), "utf-8");
const FONT_BASE64 = fs.readFileSync(require.resolve("#resources/fonts/Inter.ttf")).toString("base64");
const BACKGROUND_BUFFER = fs.readFileSync(require.resolve("#resources/images/prexpe.png"));
const BACKGROUND_BASE64 = `data:image/png;base64,${BACKGROUND_BUFFER.toString("base64")}`;

const pool = createBrowserPool();

function randomOperacion() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

function formatFecha() {
  const now = new Date();
  const dia = now.getDate().toString().padStart(2, "0");
  const mes = (now.getMonth() + 1).toString().padStart(2, "0");
  const anio = now.getFullYear();
  const horas = now.getHours().toString().padStart(2, "0");
  const minutos = now.getMinutes().toString().padStart(2, "0");
  return `${dia}/${mes}/${anio} - ${horas}:${minutos} hs.`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml({ monto, nombre, destino = "Yape" }) {
  return TEMPLATE_HTML.replace("{{FONT_BASE64}}", `data:font/woff;base64,${FONT_BASE64}`)
    .replace("{{BACKGROUND}}", BACKGROUND_BASE64)
    .replace("{{MONTO}}", formatMonto(monto))
    .replace("{{NOMBRE}}", nombre)
    .replace("{{DESTINO}}", destino)
    .replace("{{OPERACION}}", randomOperacion())
    .replace("{{FECHA}}", formatFecha());
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
