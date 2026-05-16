const express = require('express');
const router = express.Router();
const User = require('../models/user');

const defaultPreferences = {
  cuisines: {},
  tags: {},
  totalSpins: 0,
};

function parsePref(user) {
  if (!user || !user.preference_tags) return { ...defaultPreferences };
  const raw = user.preference_tags;
  if (typeof raw === 'string') {
    try { return { ...defaultPreferences, ...JSON.parse(raw) }; } catch (e) { return { ...defaultPreferences }; }
  }
  if (Array.isArray(raw)) {
    try { return { ...defaultPreferences, ...JSON.parse(raw[0] || '{}') }; } catch (e) { return { ...defaultPreferences }; }
  }
  if (typeof raw === 'object') return { ...defaultPreferences, ...raw };
  return { ...defaultPreferences };
}

router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id || '';
    if (!userId) return res.json({ data: defaultPreferences });
    const user = await User.findOne({ openid: userId }).lean();
    res.json({ data: parsePref(user) });
  } catch (e) {
    res.json({ data: defaultPreferences });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, cuisineId, tags } = req.body;
    if (!userId) return res.status(400).json({ error: '缺少 userId' });

    let user = await User.findOne({ openid: userId });
    if (!user) {
      user = await User.create({ openid: userId, preference_tags: JSON.stringify(defaultPreferences) });
    }

    const pref = parsePref(user);

    if (cuisineId) {
      pref.cuisines[cuisineId] = (pref.cuisines[cuisineId] || 0) + 1;
    }
    if (tags) {
      (Array.isArray(tags) ? tags : []).forEach(t => {
        pref.tags[t] = (pref.tags[t] || 0) + 1;
      });
    }
    pref.totalSpins = (pref.totalSpins || 0) + 1;

    await User.updateOne(
      { openid: userId },
      { $set: { preference_tags: JSON.stringify(pref) } }
    );

    res.json({ data: pref });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const { userId, likedCuisines } = req.body;
    if (!userId) return res.status(400).json({ error: '缺少 userId' });

    let user = await User.findOne({ openid: userId });
    if (!user) {
      user = await User.create({ openid: userId, preference_tags: JSON.stringify(defaultPreferences) });
    }

    const pref = parsePref(user);
    pref.likedCuisines = likedCuisines || [];
    pref.totalSpins = pref.totalSpins || 0;

    await User.updateOne(
      { openid: userId },
      { $set: { preference_tags: JSON.stringify(pref) } }
    );

    res.json({ data: pref });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
