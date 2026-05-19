const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  openid: { type: String, unique: true, required: true },
  nickname: { type: String, default: '' },
  avatar_url: { type: String, default: '' },
  phone: { type: String, default: '' },
  preference_tags: { type: String, default: '{}' },
  friend_ids: [{ type: String }],
  buddy_id: { type: String, unique: true, sparse: true },
}, { timestamps: true });

userSchema.index({ nickname: 1 });

module.exports = mongoose.model('User', userSchema);
