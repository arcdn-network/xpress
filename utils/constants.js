const { PRODUCTS, CREDITS_PRODUCT, VOUCHER_PRODUCT, buildProductButton } = require("./products");
const LOCAL = {
  TARGET_IMAGE: "target.png",
  WELCOME_IMAGE: "welcome.png",
  BROADCAST_IMAGE: "flayer.png",
  ...Object.fromEntries(PRODUCTS.map((product) => [product.cacheKey, product.image])),
  APK_FILE: "resources/files/Yape_Fake.apk",
};

const APP_NAME = "YapeXpress";
const APP_USERNAME = "dev_lguss";
const BASE_ACTIVATION_COST = 25;
const EXTRA_BANK_COST = 7;
const MIN_INFO_CREDITS = EXTRA_BANK_COST;

const TOKEN_COST = {
  7: 3,
  15: 7,
  30: 10,
};

// USE_DAILY_LIMIT
// true -> 3 gratis cada 24 horas
// false -> 5 gratis al registrarse
const USE_DAILY_LIMIT = true;
const FREE_DAILY_LIMIT = 2;
const FREE_BONUS_VOUCHER = 5;

const TARIFARIO = [
  { credits: 50, price: 50, active: true },
  { credits: 100, price: 95, active: true },
  { credits: 200, price: 180, active: true },
  { credits: 500, price: 400, active: true, label: null },
];

function buildButtonsCredits() {
  return { inline_keyboard: [[buildProductButton(CREDITS_PRODUCT, APP_USERNAME)]] };
}

function buildButtonsVoucherPlan() {
  return { inline_keyboard: [[buildProductButton(VOUCHER_PRODUCT, APP_USERNAME)]] };
}

function buildPaquetesMessage() {
  return TARIFARIO.filter((item) => item.active)
    .sort((a, b) => a.credits - b.credits)
    .map((item) => {
      const label = item.label ? ` ${item.label}` : "";
      return `• ${item.credits} créditos ➤ <b>S/ ${item.price}</b>${label}`;
    })
    .join("\n");
}

module.exports = {
  BASE_ACTIVATION_COST,
  EXTRA_BANK_COST,
  TOKEN_COST,
  MIN_INFO_CREDITS,
  LOCAL,
  APP_NAME,
  APP_USERNAME,
  TARIFARIO,
  USE_DAILY_LIMIT,
  FREE_DAILY_LIMIT,
  FREE_BONUS_VOUCHER,
  buildButtonsCredits,
  buildButtonsVoucherPlan,
  buildPaquetesMessage,
};
