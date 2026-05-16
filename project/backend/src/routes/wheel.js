const express = require('express');
const router = express.Router();
const Cuisine = require('../models/cuisine');
const User = require('../models/user');

const defaultCuisines = [
  { id: 'chuan', name: '川菜', icon: '🌶️', color: '#D85A30', tags: ['辣', '麻辣', '重口'] },
  { id: 'yue', name: '粤菜', icon: '🥟', color: '#1D9E75', tags: ['清淡', '鲜美', '精致'] },
  { id: 'ri', name: '日料', icon: '🍣', color: '#534AB7', tags: ['清淡', '生鲜', '精致'] },
  { id: 'han', name: '韩餐', icon: '🥘', color: '#185FA5', tags: ['辣', '重口', '烤肉'] },
  { id: 'xi', name: '西餐', icon: '🥩', color: '#BA7517', tags: ['精致', '牛排', '浪漫'] },
  { id: 'su', name: '素食', icon: '🥗', color: '#1D9E75', tags: ['清淡', '健康', '轻食'] },
];

const moodTags = [
  { id: 'celebrate', name: '庆祝', icon: '🎉' },
  { id: 'daily', name: '日常', icon: '☕' },
  { id: 'explore', name: '探店', icon: '🔍' },
  { id: 'relax', name: '解压', icon: '🫂' },
];

function weightedPick(cuisines, tags) {
  const filtered = tags && tags.length
    ? cuisines.filter(c => c.tags && c.tags.some(t => tags.includes(t)))
    : cuisines;
  if (!filtered.length) return cuisines[Math.floor(Math.random() * cuisines.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

router.get('/cuisines', async (req, res) => {
  try {
    const cuisines = await Cuisine.find({ enabled: true }).lean();
    if (cuisines.length === 0) return res.json({ data: defaultCuisines });
    res.json({ data: cuisines });
  } catch (e) {
    res.json({ data: defaultCuisines });
  }
});

router.get('/moods', (req, res) => {
  res.json({ data: moodTags });
});

router.post('/spin', async (req, res) => {
  const { tags, userId } = req.body;
  let cuisines;
  try {
    cuisines = await Cuisine.find({ enabled: true }).lean();
    if (cuisines.length === 0) cuisines = defaultCuisines;
  } catch (e) {
    cuisines = defaultCuisines;
  }

  let pref = {};
  if (userId) {
    try {
      const user = await User.findOne({ openid: userId }).lean();
      if (user && user.preference_tags) {
        pref = typeof user.preference_tags === 'string'
          ? JSON.parse(user.preference_tags) : user.preference_tags;
      }
    } catch (_) {}
  }

  const prefCuisines = pref.cuisines || {};
  const likedCuisines = pref.likedCuisines || [];
  const totalSpins = pref.totalSpins || 0;

  const weighted = cuisines.map(c => {
    let weight = 1.0;
    const historyCount = prefCuisines[c.id] || 0;
    if (historyCount > 0) {
      weight += Math.min(0.5, historyCount / Math.max(totalSpins, 1) * 2);
    }
    if (likedCuisines.includes(c.id)) {
      weight += 0.3;
    }
    return { ...c, _weight: weight };
  });

  const filtered = tags && tags.length
    ? weighted.filter(c => c.tags && c.tags.some(t => tags.includes(t)))
    : weighted;
  const pool = filtered.length > 0 ? filtered : weighted;

  const totalWeight = pool.reduce((s, c) => s + c._weight, 0);
  let rand = Math.random() * totalWeight;
  let result = pool[pool.length - 1];
  for (const c of pool) {
    rand -= c._weight;
    if (rand <= 0) { result = c; break; }
  }

  res.json({ data: { id: result.id, name: result.name, icon: result.icon, color: result.color, tags: result.tags } });
});

router.post('/vote', async (req, res) => {
  const { votes } = req.body;
  if (!votes || !votes.length) {
    return res.status(400).json({ error: '请提交投票' });
  }
  const tagCounts = {};
  votes.forEach(v => {
    (v.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  });
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const topTags = sorted.slice(0, 2).map(([tag]) => tag);
  let cuisines;
  try {
    cuisines = await Cuisine.find({ enabled: true }).lean();
    if (cuisines.length === 0) cuisines = defaultCuisines;
  } catch (e) {
    cuisines = defaultCuisines;
  }
  const recommended = weightedPick(cuisines, topTags);
  res.json({ data: { topTags, recommended, voteSummary: tagCounts } });
});

// 初始化默认菜系（首次启动时填充数据库）
router.post('/seed', async (req, res) => {
  const count = await Cuisine.countDocuments();
  if (count === 0) {
    await Cuisine.insertMany(defaultCuisines);
    res.json({ data: { seeded: defaultCuisines.length } });
  } else {
    res.json({ data: { seeded: 0, message: 'already seeded' } });
  }
});

module.exports = router;
