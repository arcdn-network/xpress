const { getUser } = require('../utils/api');

async function isAdmin(telegramId) {
  const user = await getUser(telegramId);

  if (!user) return false;

  return user.role === 'admin' || user.role === 'reseller';
}

module.exports = isAdmin;
