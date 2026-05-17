const mongoose = require('mongoose');

const buddySchema = new mongoose.Schema({
  openid: { type: String, required: true, index: true },
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  avatar: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Buddy', buddySchema);
