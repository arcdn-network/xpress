// service.js
const { renderDocument } = require("./render");

const IGV_RATE = 0.18;
const TUUA_POR_AEROPUERTO = { LIM: 11.53, CUZ: 4.25, AQP: 6.5, PIU: 6.5, TRU: 6.5 };
const TUUA_DEFAULT = 6.5;
const CODIGO_RESERVA_LEN = 6;

const DURACION_MIN = {
  CUZ: 80,
  AQP: 95,
  PIU: 85,
  TRU: 60,
  CIX: 80,
  TPP: 75,
  IQT: 105,
  JAU: 40,
  TCQ: 90,
  PCL: 65,
};
const DURACION_DEFAULT = 90;

const HORA_MIN_OPERACION = 5;
const HORA_MAX_OPERACION = 22;
const MINUTOS_VALIDOS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// Variación de precio para el tramo de vuelta (evita que sea idéntico al de ida)
const VARIACION_PRECIO_MIN = 0.05; // 5%
const VARIACION_PRECIO_MAX = 0.15; // 15%

function randomAlfaNum(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function generarNumeroTicket() {
  const random10 = String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
  return `900${random10}`;
}

function fechaHoy() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function sumarDias(fechaStr, dias) {
  const [dd, mm, yyyy] = fechaStr.split("-").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  d.setDate(d.getDate() + dias);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function tuuaPorAeropuerto(codigo) {
  return TUUA_POR_AEROPUERTO[codigo] ?? TUUA_DEFAULT;
}

function usd(n) {
  return n.toFixed(2);
}

function calcularTramo(origen, importe) {
  return { tuua: tuuaPorAeropuerto(origen), igv: importe * IGV_RATE, importe };
}

function generarNumeroVuelo() {
  const aerolineas = ["LA", "H2", "JA"];
  const aerolinea = aerolineas[Math.floor(Math.random() * aerolineas.length)];
  const numero = 1000 + Math.floor(Math.random() * 9000);
  return `${aerolinea}${numero}`;
}

function calcularHoraLlegada(origen, destino, hora) {
  const codigo = origen === "LIM" ? destino : origen;
  const minutos = DURACION_MIN[codigo] ?? DURACION_DEFAULT;
  const [h, m] = String(hora).trim().split(":").map(Number);
  const total = (h * 60 + m + minutos) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function calcularHoraSalida(horaExcluir) {
  let hora;
  do {
    const h = HORA_MIN_OPERACION + Math.floor(Math.random() * (HORA_MAX_OPERACION - HORA_MIN_OPERACION + 1));
    const m = MINUTOS_VALIDOS[Math.floor(Math.random() * MINUTOS_VALIDOS.length)];
    hora = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } while (hora === horaExcluir);
  return hora;
}

// Aplica +/- 5%-15% al importe, redondeado a 2 decimales
function variarImporte(importe) {
  const porcentaje = VARIACION_PRECIO_MIN + Math.random() * (VARIACION_PRECIO_MAX - VARIACION_PRECIO_MIN);
  const signo = Math.random() < 0.5 ? -1 : 1;
  const variado = importe * (1 + signo * porcentaje);
  return Math.round(variado * 100) / 100;
}

async function generarVoucherVuelo({ dni, titular, origen, destino, fecha, hora, importe, dias }, aerolinea) {
  const ida = {
    dni: String(dni).trim(),
    titular: String(titular).trim(),
    vuelo: generarNumeroVuelo(),
    origen: String(origen).trim().toUpperCase(),
    destino: String(destino).trim().toUpperCase(),
    fecha: String(fecha).trim(),
    horaSalida: String(hora).trim(),
    horaLlegada: calcularHoraLlegada(origen, destino, hora),
    importe: Number(importe),
  };

  const tramoIda = calcularTramo(ida.origen, ida.importe);

  const diasNum = Number(dias) || 0;
  const hayVuelta = diasNum > 0;

  let vueltaCampos = {
    F_3: "",
    H_3: "",
    F_4: "",
    H_4: "",
    DO_1: "",
    DO_2: "",
    DO_3: "",
    VUELO_VUELTA: "",
  };

  let tramoVuelta = { tuua: 0, igv: 0, importe: 0 };

  if (hayVuelta) {
    const horaSalidaVuelta = calcularHoraSalida(ida.horaSalida);
    const horaLlegadaVuelta = calcularHoraLlegada(ida.destino, ida.origen, horaSalidaVuelta);
    const fechaVuelta = sumarDias(ida.fecha, diasNum);

    const importeVuelta = variarImporte(ida.importe);
    tramoVuelta = calcularTramo(ida.destino, importeVuelta);

    vueltaCampos = {
      F_3: fechaVuelta,
      H_3: horaSalidaVuelta,
      F_4: fechaVuelta,
      H_4: horaLlegadaVuelta,
      DO_1: usd(tramoVuelta.tuua),
      DO_2: usd(tramoVuelta.igv),
      DO_3: usd(tramoVuelta.importe),
      VUELO_VUELTA: ida.vuelo,
    };
  }

  const tarifaTotal = tramoIda.importe + tramoVuelta.importe;
  const impuestoTotal = tramoIda.tuua + tramoVuelta.tuua;
  const igvTotal = tramoIda.igv + tramoVuelta.igv;
  const total = tarifaTotal + impuestoTotal + igvTotal;

  const boleto = generarNumeroTicket();

  const data = {
    TITULAR: ida.titular,
    DNI: ida.dni,
    BOLETO: boleto,
    TICKET: boleto,
    CODIGO: randomAlfaNum(CODIGO_RESERVA_LEN),
    FECHA_EMISION: fechaHoy(),

    VUELO_IDA: ida.vuelo,
    ORIGEN: ida.origen,
    DESTINO: ida.destino,
    F_1: ida.fecha,
    H_1: ida.horaSalida,
    F_2: ida.fecha,
    H_2: ida.horaLlegada,
    OD_1: usd(tramoIda.tuua),
    OD_2: usd(tramoIda.igv),
    OD_3: usd(tramoIda.importe),

    hayVuelta,
    ...vueltaCampos,

    TARIFA: usd(tarifaTotal),
    IMPUESTO: usd(impuestoTotal),
    IGV: usd(igvTotal),
    TOTAL: usd(total),
  };

  return renderDocument(data, aerolinea);
}

module.exports = { generarVoucherVuelo };
