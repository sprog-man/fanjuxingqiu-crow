const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  fromOpenid: { type: String, required: true },
  fromNickname: { type: String, default: '' },
  toOpenid: { type: String, required: true, index: true },
  roomCode: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
