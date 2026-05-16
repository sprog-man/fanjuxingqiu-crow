const mongoose = require('mongoose');

const cuisineSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  icon: { type: String, default: '' },
  color: { type: String, default: '#D85A30' },
  tags: [{ type: String }],
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Cuisine', cuisineSchema);
