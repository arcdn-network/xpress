// handle.js
const { consultarNombrePorDNI } = require("../../../utils/api");
const { generarVoucherVuelo } = require("./service");

const CAMPOS_REQUERIDOS = ["dni", "origen", "destino", "fecha", "hora", "importe", "dias"];

function validarVuelo(body) {
  for (const campo of CAMPOS_REQUERIDOS) {
    if (body[campo] === undefined || body[campo] === null || body[campo] === "") {
      return `El campo "${campo}" es obligatorio.`;
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(String(body.importe))) {
    return "El importe debe ser un número válido (ej: 43 o 43.50).";
  }
  if (!/^\d+$/.test(String(body.dias))) {
    return 'El campo "dias" debe ser un número entero (0 si es solo ida).';
  }
  return null;
}

function handleVuelo(aerolinea) {
  return async (req, res) => {
    try {
      const error = validarVuelo(req.body);
      if (error) {
        return res.status(400).json({ status: false, message: error });
      }

      const { dni, origen, destino, fecha, hora, importe, dias } = req.body;

      /* const titular = await consultarNombrePorDNI(dni); */
      const titular = "Jose Luis Cabrera Ttica";
      if (!titular) {
        return res.status(404).json({ status: false, message: `No se encontró información para el DNI ${dni}.` });
      }

      const base64 = await generarVoucherVuelo({ dni, titular, origen, destino, fecha, hora, importe, dias }, aerolinea);

      return res.json({ status: true, expires: req.expire, base64 });
    } catch (error) {
      console.error("Error en API /sky:", error.message);
      return res.status(500).json({ status: false, message: "Error al generar voucher." });
    }
  };
}

module.exports = { handleVuelo };
