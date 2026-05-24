const express = require('express');
const { generateVoucher: generateYape } = require('../services/yape');
const { generateVoucher: generatePlin } = require('../services/plin');
const { generateVoucher: generateAgora } = require('../services/agora');
const { generateVoucher: generateBim } = require('../services/bim');
const { generateVoucher: generateBcp } = require('../services/bcp');
const { generateVoucher: generateIbk } = require('../services/ibk');

const router = express.Router();

// ─── Configuración ───────────────────────────────────────────────
const CONFIG = {
  yape: { service: generateYape, destinoDefault: 'Yape', cantidad: 3 },
  plin: { service: generatePlin, destinoDefault: 'Plin', cantidad: 9 },
  agora: { service: generateAgora, destinoDefault: 'AGORA/OH!', cantidad: 9 },
  bim: { service: generateBim, destinoDefault: 'Bim', cantidad: 3 },
  bcp: { service: generateBcp, destinoDefault: 'BCP', cantidad: 3 },
  ibk: { service: generateIbk, destinoDefault: 'Plin', cantidad: 9 },
};

// ─── Validaciones ────────────────────────────────────────────────────
function validarParametros(monto, nombre, digitos, cantidad) {
  if (!monto || !/^\d+(\.\d{1,2})?$/.test(String(monto))) {
    return 'El monto es obligatorio y debe ser válido.';
  }
  if (!nombre) {
    return 'El nombre es obligatorio.';
  }
  if (digitos && !new RegExp(`^\\d{${cantidad}}$`).test(String(digitos))) {
    return `Los dígitos deben tener exactamente ${cantidad} números.`;
  }
  return null;
}

// ─── Handler genérico ────────────────────────────────────────────────────────────
function createVoucherRoute(servicio) {
  const { service, destinoDefault, cantidad } = CONFIG[servicio];

  return async (req, res) => {
    try {
      const { monto, nombre, digitos, mensaje = '', destino = destinoDefault } = req.body;

      const error = validarParametros(monto, nombre, digitos, cantidad);

      if (error) {
        return res.status(400).json({ status: false, message: error });
      }

      const base64 = await service({
        monto: String(monto).trim(),
        nombre: String(nombre).trim(),
        digitos: digitos ? String(digitos).trim() : '',
        mensaje: String(mensaje).trim(),
        destino: String(destino).trim(),
      });

      return res.json({ status: true, base64 });
    } catch (error) {
      console.error(`Error en API /${servicio}:`, error.message);
      return res.status(500).json({ status: false, message: 'Error al generar voucher.' });
    }
  };
}

// ─── Registro de rutas ────────────────────────────────────────────────────────
router.post('/yape', createVoucherRoute('yape'));
router.post('/plin', createVoucherRoute('plin'));
router.post('/agora', createVoucherRoute('agora'));
router.post('/bim', createVoucherRoute('bim'));
router.post('/bcp', createVoucherRoute('bcp'));
router.post('/ibk', createVoucherRoute('ibk'));

module.exports = router;
