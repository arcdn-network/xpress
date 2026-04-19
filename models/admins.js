const { Schema, model } = require('mongoose');
const { timestamps } = require('../utils/data');

const AdminSchema = Schema(
  {
    username:      { type: String, required: true },
    password:      { type: String, required: true },
    status:        { type: Boolean, required: false, default: true},
    autocompleted: { type: Boolean, required: false, default: false },
    superadmin:    { type: Boolean, required: false, default: false },
    config:        { type: Boolean, required: false, default: false },
    trusted:       { type: Boolean, required: false, default: false },
    loginAttempts: { type: Number, default: 0 },
    loginHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        userAgent: String,
        ip: String,
      }
    ]
  },
  timestamps,
);

module.exports = model('Admin', AdminSchema);
