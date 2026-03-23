function registerTutorialCommand(bot) {
  bot.onText(/\/tutorial/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      await bot.sendVideo(chatId, 'BAACAgEAAxkBAAIFUmnBdHs2rygyMslAuBXibfzEmsOEAAIVBwACnjgIRvpUmE7xED2OOgQ', {
        caption: '🎥 Tutorial de de activación',
        parse_mode: 'HTML',
        supports_streaming: true,
      });
    } catch (error) {
      console.error('Error en /tutorial:', error.message);
      await bot.sendMessage(chatId, 'No se pudo enviar el tutorial');
    }
  });
}

module.exports = registerTutorialCommand;
