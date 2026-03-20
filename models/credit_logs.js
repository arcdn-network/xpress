const mongoose = require('mongoose');

const CreditsLogSchema = new mongoose.Schema(
  {
    targetTelegramId: { type: Number, required: true, index: true },
    adminTelegramId:  { type: Number, default: null, index: true },
    previousCredits:  { type: Number, required: true },
    currentCredits:   { type: Number, required: true },
    movementType:     { type: String, required: true, enum: ['add', 'discount', 'consume'] },
    reason:           { type: String, default: '', trim: true },
    commandRaw:       { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'credits_logs',
  },
);

module.exports = mongoose.model('CreditsLog', CreditsLogSchema);
