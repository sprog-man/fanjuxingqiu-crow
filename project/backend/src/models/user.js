const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  openid: { type: String, unique: true, required: true },
  nickname: { type: String, default: '' },
  avatar_url: { type: String, default: '' },
  phone: { type: String, default: '' },
  preference_tags: { type: String, default: '{}' },
  friend_ids: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
