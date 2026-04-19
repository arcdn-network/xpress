function getUnlimitedStatus(user) {
  if (!user.unlimited?.active) return { isUnlimited: false };

  const now = new Date();
  const expired = user.unlimited.expiresAt && now > user.unlimited.expiresAt;

  if (expired) return { isUnlimited: false, expired: true };

  return {
    isUnlimited: true,
    resellerId: user.unlimited.resellerId,
    expiresAt: user.unlimited.expiresAt,
  };
}

async function expireUnlimitedIfNeeded(user) {
  const status = getUnlimitedStatus(user);

  if (status.expired) {
    user.unlimited.active = false;
    user.unlimited.expiresAt = null;
    user.unlimited.resellerId = null;
    await user.save();
  }

  return status.expired ?? false;
}

module.exports = { getUnlimitedStatus, expireUnlimitedIfNeeded };
