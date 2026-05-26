const { CONFIG } = require('../utils/config');

function validarParametros(monto, nombre, digitos, cantidad) {
  if (!monto || !/^\d+(\.\d{1,2})?$/.test(String(monto))) {
    return 'El monto es obligatorio y debe ser válido.';
  }

  if (!nombre) {
    return 'El nombre es obligatorio.';
  }

  if (digitos) {
    const regex = new RegExp(`^(${cantidad.map((n) => `\\d{${n}}`).join('|')})$`);

    if (!regex.test(String(digitos))) {
      return `Los dígitos deben tener ${cantidad.join(' o ')} números.`;
    }
  }

  return null;
}

function createVoucherRoute(servicio) {
  const { service, destinoDefault, cantidad } = CONFIG[servicio];

  return async (req, res) => {
    try {
      const { monto, nombre, digitos, mensaje = '', destino = destinoDefault } = req.body;

      const error = validarParametros(monto, nombre, digitos, cantidad);

      if (error) {
        return res.status(400).json({
          status: false,
          message: error,
        });
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

module.exports = {
  createVoucherRoute,
};
