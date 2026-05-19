const mongoose = require('mongoose');

const buddySchema = new mongoose.Schema({
  openid: { type: String, required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  remark: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'], 
    default: 'pending',
    index: true 
  },
  requestMessage: { type: String, default: '' },
  rejectedReason: { type: String, default: '' },
}, { timestamps: true });

buddySchema.index({ openid: 1, targetUserId: 1 }, { unique: true });

module.exports = mongoose.model('Buddy', buddySchema);
