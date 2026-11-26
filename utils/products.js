const PRODUCTS = [
  {
    name: "🚀 Yape App",
    description: "Aplicación de demostración para simular la experiencia de uso. No realiza pagos reales.",
    button: "🚀 Comprar App",
    message: "Hola, quiero comprar la aplicación Yape de demostración, sin validez de pago.",
  },
  {
    name: "⭐ Plan Vouchers",
    description: "Formatos de ejemplo con marca SIMULACIÓN — SIN VALIDEZ DE PAGO. No acreditan transferencias.",
    button: "⭐ Adquirir plan vouchers",
    message: "Hola, quiero adquirir el plan de vouchers de demostración de YapeXpress, sin validez de pago.",
  },
  {
    name: "💰 Activaciones Apps",
    description: "Créditos para activar aplicaciones de demostración. No representan saldo bancario ni permiten realizar pagos.",
    button: "💰 Comprar créditos",
    message: "Hola, quiero comprar créditos de YapeXpress para aplicaciones de demostración, sin validez de pago.",
  },
].map((product, index) => ({ ...product, image: `buy/buy${index + 1}.png`, cacheKey: `BUY_${index + 1}_IMAGE` }));

function buildProductButton(product, username) {
  return { text: product.button, url: "https://t.me/" + username + "?text=" + encodeURIComponent(product.message) };
}

module.exports = { PRODUCTS, APP_PRODUCT: PRODUCTS[0], VOUCHER_PRODUCT: PRODUCTS[1], CREDITS_PRODUCT: PRODUCTS[2], buildProductButton };
