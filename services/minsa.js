const path = require('path');
const fs = require('fs');
const { createBrowserPool } = require('../utils/browser');

// ─── Constantes estáticas ─────────────────────────────────────────────────────
const TEMPLATE_HTML = fs.readFileSync(path.resolve(__dirname, '../resources/templates/minsa.html'), 'utf-8');
const IMAGES_DIR = path.resolve(__dirname, '../resources/images/minsa');

function loadBase64(filename) {
  const buffer = fs.readFileSync(path.join(IMAGES_DIR, filename));
  const ext = path.extname(filename).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${buffer.toString('base64')}`;
}

const IMG_SELLO = loadBase64('sello.png');
const IMG_FIRMA = loadBase64('firma.png');
const IMG_QR = loadBase64('qr.png');

const pool = createBrowserPool();

// ─── Datos por defecto del hospital / médico ──────────────────────────────────
const DEFAULT_HOSPITAL = 'ANTONIO LORENA CUSCO - MINSA - SIS';
const DEFAULT_SERVICIO = 'EMERGENCIA-MEDICINA GENERAL';
const DEFAULT_TIPO_ATEN = 'EMERGENCIA/URGENCIAS';
const DEFAULT_MEDICO = {
  nombre: 'MEDICO CALLE PEÑA MOISES ANDRES',
  cmp: '045187',
  rne: '022291',
  ruc: '2163486454',
};
const DEFAULT_USUARIO = 'ROJAS RAMIREZ SUSANA RAMIRA';

// Mapa de contingencias → tipo de atención
const CONTINGENCIA_MAP = {
  COVID: 'EMERGENCIA/URGENCIAS',
  ACCIDENTE: 'ACCIDENTE DE TRABAJO',
  ENFERMEDAD: 'ENFERMEDAD COMUN',
  MATERNIDAD: 'MATERNIDAD',
  EMERGENCIA: 'EMERGENCIA/URGENCIAS',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomCITT() {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const prefix = letters[Math.floor(Math.random() * letters.length)];
  const num1 = Math.floor(100 + Math.random() * 900);
  const num2 = Math.floor(10000000 + Math.random() * 90000000);
  const num3 = Math.floor(10 + Math.random() * 90);
  return `${prefix}-${num1}-${num2}-${num3}`;
}

function randomActoMedico() {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

function randomAutogenerado() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function addDias(date, dias) {
  const d = new Date(date);
  d.setDate(d.getDate() + dias);
  return d;
}

function fmtFecha(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function parseFecha(str) {
  const [dd, mm, yyyy] = str.split('-').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function getHoraActual() {
  const now = new Date();
  const h = now.getHours();
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = (h % 12 || 12).toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  return `${h12}:${min} ${ampm}`;
}

// ─── Builder HTML ─────────────────────────────────────────────────────────────
function buildMinsaHtml({ nombre, dni, contingencia, dias, fecha, hospital }) {
  const fechaInicio = fecha ? parseFecha(fecha) : new Date();
  const fechaFin = addDias(fechaInicio, dias - 1);
  const fechaOtorg = addDias(fechaFin, 3);

  const tipoAtencion = CONTINGENCIA_MAP[contingencia.toUpperCase()] ?? DEFAULT_TIPO_ATEN;
  const hospitalName = hospital ? hospital.toUpperCase() : DEFAULT_HOSPITAL;

  return TEMPLATE_HTML.replace(/\{\{HOSPITAL\}\}/g, hospitalName)
    .replace(/\{\{CITT_NUMERO\}\}/g, randomCITT())
    .replace(/\{\{ACTO_MEDICO\}\}/g, randomActoMedico())
    .replace(/\{\{SERVICIO\}\}/g, DEFAULT_SERVICIO)
    .replace(/\{\{NOMBRE\}\}/g, nombre.toUpperCase())
    .replace(/\{\{DNI\}\}/g, dni)
    .replace(/\{\{AUTOGENERADO\}\}/g, randomAutogenerado())
    .replace(/\{\{TIPO_ATENCION\}\}/g, tipoAtencion)
    .replace(/\{\{CONTINGENCIA\}\}/g, contingencia.toUpperCase())
    .replace(/\{\{FECHA_INICIO\}\}/g, fmtFecha(fechaInicio))
    .replace(/\{\{FECHA_FIN\}\}/g, fmtFecha(fechaFin))
    .replace(/\{\{TOTAL_DIAS\}\}/g, String(dias))
    .replace(/\{\{FECHA_OTORGAMIENTO\}\}/g, fmtFecha(fechaOtorg))
    .replace(/\{\{DIAS_CONSECUTIVOS\}\}/g, String(dias))
    .replace(/\{\{DIAS_NO_CONSECUTIVOS\}\}/g, '0')
    .replace(/\{\{MEDICO_NOMBRE\}\}/g, DEFAULT_MEDICO.nombre)
    .replace(/\{\{MEDICO_CMP\}\}/g, DEFAULT_MEDICO.cmp)
    .replace(/\{\{MEDICO_RNE\}\}/g, DEFAULT_MEDICO.rne)
    .replace(/\{\{MEDICO_RUC\}\}/g, DEFAULT_MEDICO.ruc)
    .replace(/\{\{USUARIO\}\}/g, DEFAULT_USUARIO)
    .replace(/\{\{HORA\}\}/g, getHoraActual())
    .replace(/\{\{IMG_SELLO\}\}/g, IMG_SELLO)
    .replace(/\{\{IMG_FIRMA\}\}/g, IMG_FIRMA)
    .replace(/\{\{IMG_QR\}\}/g, IMG_QR);
}

// ─── Generador ────────────────────────────────────────────────────────────────
async function generateVoucher(data) {
  return pool.withPage(async (page) => {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(buildMinsaHtml(data), { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 300));

    const buffer = await page.pdf({
      width: '794px',
      height: '1123px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(buffer).toString('base64');
  });
}

module.exports = { generateVoucher };
