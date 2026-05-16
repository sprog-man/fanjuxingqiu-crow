const mongoose = require('mongoose');

const aaRecordSchema = new mongoose.Schema({
  groupId: { type: String, required: true, index: true },
  payer: { type: String, required: true },
  participants: [{ type: String }],
  amount: { type: Number, default: 0 },
  paidStatus: { type: Map, of: Boolean, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('AARecord', aaRecordSchema);
