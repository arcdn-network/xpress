const express = require('express');
const { generateVoucher } = require('../services/plin');
const router = express.Router();

router.post('/plin', async (req, res) => {
  try {
    const { monto, nombre, digitos, destino = 'Plin' } = req.body;

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
      digitos: digitos ? String(digitos).trim() : '',
      destino: String(destino || 'Plin').trim(),
    });

    return res.json({ status: true, author: '@dev_lguss', base64 });
  } catch (error) {
    console.error('Error en API generar-plin:', error.message);
    return res.status(500).json({ status: false, message: 'Error al generar voucher.' });
  }
});

module.exports = router;
