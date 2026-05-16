const mongoose = require('mongoose');

const relationSchema = new mongoose.Schema({
  userA: { type: String, required: true },
  userB: { type: String, required: true },
  gatherCount: { type: Number, default: 0 },
  title: { type: String, default: '' },
  cities: [{ type: String }],
  totalSpent: { type: Number, default: 0 },
  lastGatherAt: { type: Date, default: null },
}, { timestamps: true });

relationSchema.index({ userA: 1, userB: 1 }, { unique: true });

module.exports = mongoose.model('Relation', relationSchema);
