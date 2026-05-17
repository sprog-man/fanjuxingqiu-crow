const mongoose = require('mongoose');

const buddySchema = new mongoose.Schema({
  openid: { type: String, required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  remark: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Buddy', buddySchema);
