const express = require('express');
const { generateVoucher } = require('../services/yape');
const router = express.Router();

router.post('/yape', async (req, res) => {
  try {
    const { monto, nombre, digitos, mensaje = '', destino = 'Yape' } = req.body;

    if (!monto || !/^\d+(\.\d{1,2})?$/.test(String(monto))) {
      return res.status(400).json({ status: false, message: 'El monto es obligatorio y debe ser válido.' });
    }

    if (!nombre) {
      return res.status(400).json({ status: false, message: 'El nombre es obligatorio.' });
    }

    if (digitos && !/^\d{3}$/.test(String(digitos))) {
      return res.status(400).json({ status: false, message: 'Los dígitos deben tener exactamente 3 números.' });
    }

    const { base64 } = await generateVoucher({
      monto: String(monto).trim(),
      nombre: String(nombre).trim(),
      digitos: String(digitos).trim(),
      mensaje: String(mensaje || '').trim(),
      destino: String(destino || 'Yape').trim(),
    });

    return res.json({ status: true, author: '@dev_lguss', base64 });
  } catch (error) {
    console.error('Error en API generar-yape:', error.message);
    return res.status(500).json({ status: false, message: 'Error al generar voucher.' });
  }
});

module.exports = router;
