const { getUser } = require('../utils/api');

async function isAdmin(telegramId) {
  const user = await getUser(telegramId);

  if (!user) return false;

  return user.role === 'admin' || user.role === 'reseller';
}

function isOwner(telegramId) {
  const ownerIds = (process.env.ADMIN_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return ownerIds.includes(String(telegramId));
}

module.exports = {
  isAdmin,
  isOwner,
};
