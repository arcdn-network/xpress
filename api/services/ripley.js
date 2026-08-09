const { createBrowserPool, readResource } = require("../../utils/browser");

const TEMPLATE_HTML = readResource("#resources/templates/ripley.html");
const FONT_BASE64 = readResource("#resources/fonts/Nunito.woff2");
const BACKGROUND = readResource("#resources/images/ripley.png");

const pool = createBrowserPool();

function formatFecha() {
  const now = new Date();
  return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

function formatHora() {
  const now = new Date();
  const horas = now.getHours().toString().padStart(2, "0");
  const minutos = now.getMinutes().toString().padStart(2, "0");
  const segundos = now.getSeconds().toString().padStart(2, "0");
  return `${horas}:${minutos}:${segundos}`;
}

function formatMonto(monto) {
  return Number(monto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml({ monto, nombre, digitos, destino }) {
  const digitosLimpios = String(digitos || "").trim();

  let celularValue = "";
  if (/^\d{3}$/.test(digitosLimpios)) {
    celularValue = `*** *** ${digitosLimpios}`;
  } else if (/^\d{9}$/.test(digitosLimpios)) {
    celularValue = digitosLimpios;
  }

  const celularRow = celularValue
    ? `<div class="flex justify-content-between align-items-center mb-3 line-height-2">
               <div class="label">Teléfono destinatario</div>
               <div class="value">${celularValue}</div>
            </div>`
    : "";

  return TEMPLATE_HTML.replace("{{FONT_BASE64}}", FONT_BASE64)
    .replace("{{BACKGROUND}}", BACKGROUND)
    .replace("{{MONTO}}", formatMonto(monto))
    .replace("{{TITULAR}}", nombre)
    .replace("{{DESTINO}}", destino)
    .replace("{{FECHA}}", formatFecha())
    .replace("{{HORA}}", formatHora())
    .replace("{{CELULAR_ROW}}", celularRow);
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
