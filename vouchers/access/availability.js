const { FREE_DAILY_LIMIT, USE_DAILY_LIMIT, FREE_BONUS_VOUCHER } = require("../../utils/constants");
const { formatDateLima } = require("../../utils/functions");

function restantesGratis(user) {
  if (USE_DAILY_LIMIT) {
    const hoy = formatDateLima();
    const usadosHoy = user?.voucher?.dailyDate === hoy ? user.voucher.dailyUsed || 0 : 0;
    return Math.max(FREE_DAILY_LIMIT - usadosHoy, 0);
  }

  return user?.voucher?.freeQty ?? FREE_BONUS_VOUCHER;
}

function puedeUsarGratis(user) {
  return restantesGratis(user) > 0;
}

function tienePlanActivo(user) {
  if (!user?.voucher?.active) return false;
  if (!user.voucher.expiresAt) return true;
  return new Date(user.voucher.expiresAt) > new Date();
}

module.exports = { restantesGratis, puedeUsarGratis, tienePlanActivo };
