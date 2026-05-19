const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cuisineId: { type: String, required: true, index: true },
  openid: { type: String, default: '', index: true },
  image: { type: String, default: '' },
  tags: [{ type: String }],
  description: { type: String, default: '' },
  popularity: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

dishSchema.index({ cuisineId: 1, enabled: 1 });
dishSchema.index({ cuisineId: 1, openid: 1 });
dishSchema.index({ cuisineId: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Dish', dishSchema);
