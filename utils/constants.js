const RESELLERS = [
  {
    text: '💰 Comprar créditos @dev_lguss',
    url: 'https://t.me/dev_lguss',
    visible: true,
  },
  {
    text: '💰 Comprar créditos @chucky_NET',
    url: 'https://t.me/chucky_NET',
    visible: false,
  },
];

function buildButtonsCredits() {
  return {
    inline_keyboard: RESELLERS.filter((item) => item.visible).map((item) => [
      {
        text: item.text,
        url: item.url,
      },
    ]),
  };
}

const TARIFARIO = [
  { credits: 50, price: 50, active: true },
  { credits: 100, price: 95, active: true },
  { credits: 200, price: 180, active: true },
  { credits: 500, price: 400, active: true, label: null },
];

function buildPaquetesMessage() {
  return TARIFARIO.filter((item) => item.active)
    .sort((a, b) => a.credits - b.credits)
    .map((item) => {
      const label = item.label ? ` ${item.label}` : '';
      return `• ${item.credits} créditos ➤ <b>S/ ${item.price}</b>${label}`;
    })
    .join('\n');
}

module.exports = {
  TARIFARIO,
  buildButtonsCredits,
  buildPaquetesMessage,
};
