const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    telegramId:   { type: Number, required: true, unique: true, index: true },
    username:     { type: String, default: '' },
    registeredAt: { type: Date, default: Date.now },
    credits:      { type: Number, default: 0 },
    status:       { type: String, default: 'activo' },
    role:         { type: String, default: 'user' },
    activationStats: {
      yape:  { type: Number, default: 0 },
      bcp:   { type: Number, default: 0 },
      ibk:   { type: Number, default: 0 },
      bbva:  { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    unlimited: {
      active:     { type: Boolean, default: false },
      expiresAt:  { type: Date, default: null },
      resellerId: { type: String, default: null },
    },
  },
  { versionKey: false, collection: 'users' },
);

module.exports = mongoose.model('User', UserSchema);
