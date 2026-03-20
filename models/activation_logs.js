const mongoose = require('mongoose');

const ActivationLogSchema = new mongoose.Schema(
  {
    resellerTelegramId: { type: Number, required: true, index: true },
    clientId: { type: String, default: null, index: true },
    clientEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    activatedLicenses: { type: [String], default: [] },
    creditsCost: { type: Number, required: true },
    commandRaw: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'activation_logs',
  },
);

module.exports = mongoose.model('ActivationLog', ActivationLogSchema);
