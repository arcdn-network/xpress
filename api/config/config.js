const { generateVoucher: generateYape } = require("../services/yape");
const { generateVoucher: generatePlin } = require("../services/plin");
const { generateVoucher: generateBim } = require("../services/bim");
const { generateVoucher: generateSip } = require("../services/sip");
const { generateVoucher: generateAgora } = require("../services/agora");
const { generateVoucher: generateLemon } = require("../services/lemon");
const { generateVoucher: generatePrexpe } = require("../services/prexpe");
const { generateVoucher: generateBcp } = require("../services/bcp");
const { generateVoucher: generateIbk } = require("../services/ibk");
const { generateVoucher: generateBbva } = require("../services/bbva");
const { generateVoucher: generateRipley } = require("../services/ripley");
const { generateVoucher: generateFalabella } = require("../services/falabella");
const { generateVoucher: generateScotiabank } = require("../services/scotiabank");
const { generateVoucher: generateCaja } = require("../services/caja");

// Lista de ejemplos compartida entre el mensaje de error y el de ayuda/galería.
function buildEjemplos(comando, cantidad) {
  return [
    // Sin dígitos
    `/${comando} 150|Pedro Castillo`,
    // Con dígitos
    ...cantidad.map((n) => `/${comando} 150|Pedro Castillo|${"9".repeat(n)}`),
    // Con mensaje
    `/${comando} 150|Pedro Castillo|${"9".repeat(cantidad[0])}|Pago realizado`,
    // Con destino
    `/${comando} 150|Pedro Castillo|${"9".repeat(cantidad[0])}|Pago realizado|Plin`,
  ];
}

function buildErrorMsg(comando, cantidad) {
  const digitosLabel = cantidad.map((n) => `${n} dígitos`).join(" o ");
  const ejemplos = buildEjemplos(comando, cantidad).join("\n");

  return (
    `⚠️ Formato incorrecto.\n` +
    `Uso: \`/${comando} monto|titular|${digitosLabel}|mensaje|destino\`\n\n` +
    `✅ Ejemplo de uso:\n\`\`\`\n${ejemplos}\n\`\`\``
  );
}

function buildEjemploUso(comando, cantidad) {
  const digitosLabel = cantidad.map((n) => `${n} dígitos`).join(" o ");
  const ejemplos = buildEjemplos(comando, cantidad).join("\n");

  return `🕹️ Comando: \n\`/${comando} monto|titular|${digitosLabel}|mensaje|destino\`\n\n` + `✅ Ejemplo de uso:\n\`\`\`\n${ejemplos}\n\`\`\``;
}

const CONFIG = {
  yape: {
    service: generateYape,
    destinoDefault: "Yape",
    cantidad: [3],
  },
  plin: {
    service: generatePlin,
    destinoDefault: "Plin",
    cantidad: [3, 9],
  },
  bim: {
    service: generateBim,
    destinoDefault: "Yape",
    cantidad: [3],
  },
  sip: {
    service: generateSip,
    destinoDefault: "Sip",
    cantidad: [3],
  },
  agora: {
    service: generateAgora,
    destinoDefault: "AGORA/OH!",
    cantidad: [3, 9],
  },
  lemon: {
    service: generateLemon,
    destinoDefault: "Yape",
    cantidad: [3],
  },
  prexpe: {
    service: generatePrexpe,
    destinoDefault: "Prexpe",
    cantidad: [0],
  },
  bcp: {
    service: generateBcp,
    destinoDefault: "Yape",
    cantidad: [3],
  },
  ibk: {
    service: generateIbk,
    destinoDefault: "Plin",
    cantidad: [3, 9],
  },
  bbva: {
    service: generateBbva,
    destinoDefault: "Plin",
    cantidad: [3],
  },
  scotiabank: {
    service: generateScotiabank,
    destinoDefault: "Yape",
    cantidad: [3, 9],
  },
  falabella: {
    service: generateFalabella,
    destinoDefault: "Yape",
    cantidad: [3],
  },
  ripley: {
    service: generateRipley,
    destinoDefault: "Yape",
    cantidad: [3, 9],
  },
  caja: {
    service: generateCaja,
    destinoDefault: "Plin",
    cantidad: [3, 9],
  },
};

Object.keys(CONFIG).forEach((comando) => {
  CONFIG[comando].errorMsg = buildErrorMsg(comando, CONFIG[comando].cantidad);
  CONFIG[comando].ejemploUso = buildEjemploUso(comando, CONFIG[comando].cantidad);
});

const VOUCHER_KEYS = Object.keys(CONFIG);

module.exports = { CONFIG, VOUCHER_KEYS };
