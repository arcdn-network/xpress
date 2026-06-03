const { generateVoucher } = require('../services/minsa');

const MAX_DIAS = 20;
const RENIEC_URL = 'https://api.azuraperu.app/servicios/reniec_free';
const RENIEC_TOKEN = '0CeQ9Cm0KXqIKiavpy9BpGX6joSJucFjPNqUit2q';

// ─── RENIEC ───────────────────────────────────────────────────────────────────
async function consultarNombrePorDNI(dni) {
  const res = await fetch(RENIEC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': RENIEC_TOKEN,
    },
    body: JSON.stringify({ documento: dni }),
  });

  if (!res.ok) return null;

  const data = await res.json();

  if (data?.status !== 'success' || !data?.listaAni) return null;

  const { apellido_paterno, apellido_materno, nombres } = data.listaAni;

  return [apellido_paterno, apellido_materno, nombres].filter(Boolean).join(' ').toUpperCase();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidFecha(str) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(str)) return false;
  const [dd, mm, yyyy] = str.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

// ─── Ruta ─────────────────────────────────────────────────────────────────────
async function minsaRoute(req, res) {
  const { dni, contingencia, dias, fecha, hospital } = req.body;

  // ── Validaciones ──────────────────────────────────────────────────────────
  if (!dni || !/^\d{8}$/.test(String(dni))) {
    return res.status(400).json({ status: false, message: 'El DNI debe tener exactamente 8 dígitos.' });
  }

  if (!contingencia || typeof contingencia !== 'string' || contingencia.trim().length < 2) {
    return res.status(400).json({ status: false, message: 'La contingencia ingresada no es válida.' });
  }

  const diasNum = parseInt(dias, 10);
  if (!diasNum || isNaN(diasNum) || diasNum < 1 || diasNum > MAX_DIAS) {
    return res.status(400).json({ status: false, message: `El número de días debe estar entre 1 y ${MAX_DIAS}.` });
  }

  if (fecha && !isValidFecha(fecha)) {
    return res.status(400).json({ status: false, message: 'La fecha no es válida. Usa el formato DD-MM-YYYY.' });
  }

  // ── Consulta RENIEC ───────────────────────────────────────────────────────
  let nombre;
  try {
    nombre = await consultarNombrePorDNI(String(dni));
  } catch (err) {
    console.error('[RENIEC]', err.message);
    return res
      .status(502)
      .json({ status: false, message: 'No se pudo conectar con RENIEC. Intenta de nuevo más tarde.' });
  }

  if (!nombre) {
    return res.status(404).json({ status: false, message: 'No se encontró ningún titular para el DNI ingresado.' });
  }

  // ── Generación ────────────────────────────────────────────────────────────
  try {
    const base64 = await generateVoucher({
      nombre,
      dni: String(dni),
      contingencia: contingencia.trim().toUpperCase(),
      dias: diasNum,
      fecha: fecha ?? undefined,
      hospital: hospital?.trim() ?? undefined,
    });

    return res.status(200).json({ status: true, nombre, image: base64 });
  } catch (error) {
    console.error('[/api/minsa]', error.message);
    return res
      .status(500)
      .json({ status: false, message: 'Ocurrió un error al generar el voucher. Por favor, intenta nuevamente.' });
  }
}

module.exports = { minsaRoute };
