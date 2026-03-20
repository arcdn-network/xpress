const User = require('../models/users');

async function isAdmin(telegramId) {
  const user = await User.findOne({ telegramId });

  if (!user) return false;

  return user.role === 'admin' || user.role === 'reseller';
}

module.exports = isAdmin;
