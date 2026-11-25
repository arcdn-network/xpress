const { generateVoucher: generateYape } = require("./yape/service");
const { generateVoucher: generatePlin } = require("./plin/service");
const { generateVoucher: generateBim } = require("./bim/service");
const { generateVoucher: generateSip } = require("./sip/service");
const { generateVoucher: generateAgora } = require("./agora/service");
const { generateVoucher: generateLemon } = require("./lemon/service");
const { generateVoucher: generatePrexpe } = require("./prexpe/service");
const { generateVoucher: generateBcp } = require("./bcp/service");
const { generateVoucher: generateIbk } = require("./ibk/service");
const { generateVoucher: generateBbva } = require("./bbva/service");
const { generateVoucher: generateRipley } = require("./ripley/service");
const { generateVoucher: generateFalabella } = require("./falabella/service");
const { generateVoucher: generateScotiabank } = require("./scotiabank/service");
const { generateVoucher: generatePanda } = require("./panda/service");
const { generateVoucher: generateCaja } = require("./caja/service");

// Lista de ejemplos compartida entre el mensaje de error y el de ayuda/galería.
function buildEjemplos(comando, cantidad) {
  return [
    // Sin dígitos
    `/${comando} 150|Luis`,
    // Con dígitos
    ...cantidad.filter((n) => n > 0).map((n) => `/${comando} 150|Luis|${"987654321".slice(0, n)}`),
    // Con mensaje
    `/${comando} 150|Luis|${"987654321".slice(0, cantidad[0])}|Mensaje`,
    `/${comando} 150|Luis|${"987654321".slice(0, cantidad[cantidad.length - 1])}||Yape`,
    // Con destino
    `/${comando} 150|Luis|${"987654321".slice(0, cantidad[0])}|Mensaje|Plin`,
  ];
}

function buildErrorMsg(comando, cantidad) {
  const digitosLabel = cantidad.map((n) => `${n} dígitos`).join(" o ");
  const ejemplos = buildEjemplos(comando, cantidad).join("\n");
  return `⚠️ Formato incorrecto.\n` + `Uso: \`/${comando} monto|titular|${digitosLabel}|mensaje|destino\`\n\n` + `✅ Ejemplo de uso:\n\`\`\`\n${ejemplos}\n\`\`\``;
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
  panda: {
    service: generatePanda,
    destinoDefault: "Yape",
    cantidad: [0],
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

const path = require("path");
const fs = require("fs");
const DISPLAY_NAMES = {
  yape: "Yape",
  plin: "Plin",
  bim: "Bim",
  sip: "Sip",
  agora: "Agora",
  lemon: "Lemon",
  panda: "Panda",
  prexpe: "Prexpe",
  bcp: "BCP",
  ibk: "Interbank",
  bbva: "BBVA",
  caja: "Caja Arequipa",
  ripley: "Ripley",
  falabella: "Falabella",
  scotiabank: "Scotiabank",
};

Object.keys(CONFIG).forEach((comando) => {
  CONFIG[comando].examples = buildEjemplos(comando, CONFIG[comando].cantidad);
  CONFIG[comando].name = DISPLAY_NAMES[comando];
  CONFIG[comando].description = `Generar Voucher ${DISPLAY_NAMES[comando]}`;
  CONFIG[comando].examplePath = [".jpg", ".jpeg", ".png"].map((ext) => path.join(__dirname, comando, "resources", `example${ext}`)).find((file) => fs.existsSync(file));
  CONFIG[comando].errorMsg = buildErrorMsg(comando, CONFIG[comando].cantidad);
  CONFIG[comando].ejemploUso = buildEjemploUso(comando, CONFIG[comando].cantidad);
});

const VOUCHER_KEYS = Object.keys(CONFIG);
const MENU_COMMANDS = [{ command: "ejemplos", description: "Ver galería de ejemplos" }, ...VOUCHER_KEYS.map((command) => ({ command, description: CONFIG[command].description }))];

module.exports = { CONFIG, VOUCHER_KEYS, MENU_COMMANDS };
