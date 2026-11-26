const { isOwner } = require("../middleware/isAdmin");
const { deleteCachedFiles } = require("../utils/files");

module.exports = function registerCacheCommands(bot) {
  bot.onText(/^\/delete_(gallery|shop|base)(?:@\w+)?\s*$/i, async (msg, match) => {
    if (!isOwner(msg.from?.id)) return;
    const scope = match[1].toLowerCase();
    let deleted;
    try {
      deleted = deleteCachedFiles(scope);
    } catch (error) {
      console.error("Error limpiando caché:", error.message);
      return bot.sendMessage(msg.chat.id, "❌ No se pudo limpiar la caché.");
    }
    const detail = {
      gallery: "Solo galería; las demás entradas se conservaron.",
      shop: "Solo imágenes del catálogo; las demás entradas se conservaron.",
      base: "La galería y las imágenes del catálogo se conservaron.",
    }[scope];
    return bot.sendMessage(msg.chat.id, `✅ Caché: ${deleted} entradas eliminadas.\n${detail}\nLos archivos originales no se borran.`);
  });
};
