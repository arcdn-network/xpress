const PRODUCTS = [
  {
    key: "app",
    asset: 1,
    name: "🚀 Yape App",
    title: "🚀 YAPE APP - ANDROID/IPHONE",
    commands: [
      { command: "/apk", description: "Descargar la aplicación para Android." },
      { command: "/iphone", description: "Descargar la aplicación para iPhone." },
    ],
    status: true,
    description: "Aplicación para Android y iPhone. Realiza Yapeos, transferencias, recargas y mucho más. Es de pago único y acceso permanente.\n",
    rules: "➤ Descarga Android → /apk\n➤ Descarga IPhone → /iphone",
    button: "🚀 Comprar Aplicación",
    message: "Hola, información de la aplicación Yape Fake",
  },
  {
    key: "vouchers",
    asset: 2,
    name: "⭐ Plan Vouchers",
    title: "⭐ PLAN VOUCHERS",
    commands: [],
    status: true,
    description: "Genera todos los vouchers que necesites, cuando quieras. Más de 15 formatos disponibles.\n",
    rules: "➤ Uso ilimitado.\n➤ Operativo 24/7.\n➤ Formatos disponibles → /ejemplos",
    button: "⭐ Adquirir plan vouchers",
    message: "Hola, quiero adquirir el plan de vouchers de YapeXpress",
  },
  {
    key: "credits",
    asset: 3,
    name: "💰 Compra de Créditos",
    title: "💰 ACTIVACIONES YAPE APP - ANDROID/IPHONE",
    commands: [
      { command: "/activate correo@gmail.com", description: "Activa una cuenta de un cliente registrado." },
      { command: "/info correo@gmail.com", description: "Ver información del cliente." },
      { command: "/token", description: "Genera token de autocompletado." },
      { command: "/historial", description: "Ver el historial de activaciones y tokens." },
    ],
    status: true,
    description: "Bot exclusivo para clientes que tienen su cuenta de Yape Fake en aplicativo. Te permite activar a mitad de precio para que puedas ganar el 50% 💸.\n",
    rules: "➤ Costo por activación 25 créditos.\n➤ Recarga minima 50 créditos.\n➤ Tutorial de uso → /tutorial",
    button: "💰 Comprar créditos",
    message: "Hola, quiero comprar créditos de YapeXpress",
  },
].map((product) => ({ ...product, image: `buy/buy${product.asset}.png`, cacheKey: `BUY_${product.asset}_IMAGE` }));

const PRODUCTS_BY_KEY = Object.fromEntries(PRODUCTS.map((product) => [product.key, product]));

function getActiveProducts() {
  return PRODUCTS.filter((product) => product.status === true);
}

function buildProductButton(product, username) {
  return { text: product.button, url: "https://t.me/" + username + "?text=" + encodeURIComponent(product.message) };
}

module.exports = {
  PRODUCTS,
  PRODUCTS_BY_KEY,
  APP_PRODUCT: PRODUCTS_BY_KEY.app,
  VOUCHER_PRODUCT: PRODUCTS_BY_KEY.vouchers,
  CREDITS_PRODUCT: PRODUCTS_BY_KEY.credits,
  buildProductButton,
  getActiveProducts,
};
