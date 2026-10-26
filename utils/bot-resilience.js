function errorSummary(error) {
  return String(error?.message || error).replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[REDACTED]");
}

function installBotResilience(bot, logger = console) {
  const guard = (handler, context) =>
    function (...args) {
      try {
        return Promise.resolve(handler.apply(this, args)).catch((error) => {
          logger.error(`[Telegram ${context}] ${errorSummary(error)}`);
        });
      } catch (error) {
        logger.error(`[Telegram ${context}] ${errorSummary(error)}`);
        return Promise.resolve();
      }
    };

  const onText = bot.onText.bind(bot);
  bot.onText = (regexp, handler) => onText(regexp, guard(handler, String(regexp)));
  const on = bot.on.bind(bot);
  bot.on = (event, handler) => on(event, ["message", "callback_query"].includes(event) ? guard(handler, event) : handler);

  let failures = 0;
  const getUpdates = bot.getUpdates.bind(bot);
  bot.getUpdates = async (...args) => {
    const updates = await getUpdates(...args);
    if (failures) logger.info("[Telegram] Conexión recuperada");
    failures = 0;
    bot.options.polling.interval = 1000;
    return updates;
  };

  bot.on("polling_error", (error) => {
    failures += 1;
    const retryAfter = Number(error.response?.body?.parameters?.retry_after) || 0;
    const delay = Math.max(retryAfter * 1000 + 1000, Math.min(60000, 1000 * 2 ** Math.min(failures, 6)));
    bot.options.polling.interval = delay;
    logger.error(`[Telegram polling] ${errorSummary(error)}; reintento en ${delay / 1000}s`);
  });
}

module.exports = { installBotResilience, errorSummary };
