const mongoose = require('mongoose');

const gatheringSchema = new mongoose.Schema({
  title: { type: String, required: true },
  dateTime: { type: Date, required: true },
  location: {
    name: { type: String, default: '' },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    city: { type: String, default: '' },
  },
  participants: [{ type: String }],
  payer: { type: String, default: null },
  totalCost: { type: Number, required: true },
  photos: [{ type: String }],
  moodScore: { type: Number, min: 1, max: 5, default: null },
  moodTags: [{ type: String }],
  note: { type: String, default: '' },
  foodTags: [{ type: String }],
  creatorId: { type: String, default: '' },
  isCheckin: { type: Boolean, default: false },
  cover: { type: String, default: '' },
}, { timestamps: true });

gatheringSchema.index({ creatorId: 1, dateTime: -1 });
gatheringSchema.index({ 'location.city': 1 });

module.exports = mongoose.model('Gathering', gatheringSchema);
