function getUnlimitedStatus(user) {
  if (!user.unlimited?.active) return { isUnlimited: false };

  const now = new Date();
  const expired = user.unlimited.expiresAt && now > user.unlimited.expiresAt;

  if (expired) return { isUnlimited: false, expired: true };

  return {
    isUnlimited: true,
    resellerId: user.unlimited.resellerId,
    expiresAt: user.unlimited.expiresAt ?? null,
  };
}

module.exports = { getUnlimitedStatus };
