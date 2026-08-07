const { generateVoucher: generateYape } = require('../../services/yape');
const { generateVoucher: generatePlin } = require('../../services/plin');
const { generateVoucher: generateBim } = require('../../services/bim');
const { generateVoucher: generateSip } = require('../../services/sip');
const { generateVoucher: generateAgora } = require('../../services/agora');
const { generateVoucher: generateLemon } = require('../../services/lemon');
const { generateVoucher: generatePrexpe } = require('../../services/prexpe');
const { generateVoucher: generateBcp } = require('../../services/bcp');
const { generateVoucher: generateIbk } = require('../../services/ibk');
const { generateVoucher: generateBbva } = require('../../services/bbva');
const { generateVoucher: generateRipley } = require('../../services/ripley');
const { generateVoucher: generateFalabella } = require('../../services/falabella');
const { generateVoucher: generateScotiabank } = require('../../services/scotiabank');
const { generateVoucher: generateCaja } = require('../../services/caja');

function buildErrorMsg(comando, cantidad) {
  const digitosLabel = cantidad.map((n) => `${n} dígitos`).join(' o ');

  const ejemplos = [
    // Sin dígitos
    `/${comando} 150|Pedro Castillo`,
    // Con dígitos
    ...cantidad.map((n) => `/${comando} 150|Pedro Castillo|${'9'.repeat(n)}`),
    // Con mensaje
    `/${comando} 150|Pedro Castillo|${'9'.repeat(cantidad[0])}|Pago realizado`,
    // Con destino
    `/${comando} 150|Pedro Castillo|${'9'.repeat(cantidad[0])}|Pago realizado|Plin`,
  ].join('\n');

  return (
    `⚠️ Formato incorrecto.\n` +
    `Uso: \`/${comando} monto|titular|${digitosLabel}|mensaje|destino\`\n\n` +
    `✅ Ejemplo de uso:\n\`\`\`\n${ejemplos}\n\`\`\``
  );
}

const CONFIG = {
  yape: {
    service: generateYape,
    destinoDefault: 'Yape',
    cantidad: [3],
  },
  plin: {
    service: generatePlin,
    destinoDefault: 'Plin',
    cantidad: [3, 9],
  },
  bim: {
    service: generateBim,
    destinoDefault: 'YAPE',
    cantidad: [3],
  },
  sip: {
    service: generateSip,
    destinoDefault: 'Sip',
    cantidad: [3],
  },
  agora: {
    service: generateAgora,
    destinoDefault: 'AGORA/OH!',
    cantidad: [3, 9],
  },
  lemon: {
    service: generateLemon,
    destinoDefault: 'YAPE',
    cantidad: [3],
  },
  prexpe: {
    service: generatePrexpe,
    destinoDefault: 'Prexpe',
    cantidad: [0],
  },
  bcp: {
    service: generateBcp,
    destinoDefault: 'BCP',
    cantidad: [3],
  },
  ibk: {
    service: generateIbk,
    destinoDefault: 'Plin',
    cantidad: [3, 9],
  },
  bbva: {
    service: generateBbva,
    destinoDefault: 'Plin',
    cantidad: [3],
  },
  scotiabank: {
    service: generateScotiabank,
    destinoDefault: 'Yape',
    cantidad: [3, 9],
  },
  falabella: {
    service: generateFalabella,
    destinoDefault: 'Yape',
    cantidad: [3],
  },
  ripley: {
    service: generateRipley,
    destinoDefault: 'Ripley',
    cantidad: [3, 9],
  },
  caja: {
    service: generateCaja,
    destinoDefault: 'PLIN',
    cantidad: [9, 3],
  },
};

Object.keys(CONFIG).forEach((comando) => {
  CONFIG[comando].errorMsg = buildErrorMsg(comando, CONFIG[comando].cantidad);
});

module.exports = { CONFIG, buildErrorMsg };
