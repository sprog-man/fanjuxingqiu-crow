const express = require('express');
const router = express.Router();
const Gathering = require('../models/gathering');

router.post('/checkin', async (req, res) => {
  try {
    const { userId, restaurant, food, lat, lng, city, province, photos, note, dateTime } = req.body;
    const record = {
      title: restaurant || (city ? `${city}打卡` : '美食打卡'),
      dateTime: dateTime || new Date().toISOString(),
      location: {
        name: restaurant || '未知地点',
        lat: lat || 0,
        lng: lng || 0,
        city: city || province || '未知',
      },
      participants: [userId || '我'],
      totalCost: 0,
      photos: photos || [],
      note: note || '',
      foodTags: food ? [food] : [],
      moodTags: ['打卡'],
      creatorId: userId || '我',
      isCheckin: true,
    };
    const gathering = await Gathering.create(record);
    res.json({ data: { ...record, _id: gathering._id, id: gathering._id } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/footprints', async (req, res) => {
  try {
    const userId = req.query.user_id || '我';
    const gatherings = await Gathering.find().lean();

    const cityData = {};
    gatherings.forEach(g => {
      if (!g.participants || !g.participants.includes(userId)) return;
      const city = (g.location && g.location.city) || '未知';
      if (!cityData[city]) cityData[city] = { city, foods: new Set(), count: 0, lastVisit: null };
      cityData[city].count++;
      if (g.foodTags) g.foodTags.forEach(f => cityData[city].foods.add(f));
      const visitDate = g.dateTime || g.createdAt;
      if (visitDate && (!cityData[city].lastVisit || new Date(visitDate) > new Date(cityData[city].lastVisit))) {
        cityData[city].lastVisit = visitDate;
      }
    });

    const cities = Object.values(cityData).map(c => ({
      city: c.city,
      foods: [...c.foods],
      count: c.count,
      lastVisit: c.lastVisit,
      markerSize: c.count >= 5 ? 'large' : c.count >= 3 ? 'medium' : 'small',
    })).sort((a, b) => b.count - a.count);

    const totalCities = cities.length;
    const totalFoods = cities.reduce((s, c) => s + c.foods.length, 0);
    const totalGatherings = cities.reduce((s, c) => s + c.count, 0);

    res.json({ data: { cities, totalCities, totalFoods, totalGatherings } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const achievementDefs = [
  { id: 'city-1', name: '初出茅庐', desc: '打卡 1 个城市', icon: '📍', tier: 'bronze', check: (s) => s.totalCities >= 1 },
  { id: 'city-3', name: '足迹达人', desc: '打卡 3 个城市', icon: '📍', tier: 'silver', check: (s) => s.totalCities >= 3 },
  { id: 'city-5', name: '旅行家', desc: '打卡 5 个城市', icon: '🌍', tier: 'gold', check: (s) => s.totalCities >= 5 },
  { id: 'food-10', name: '美食猎人 I', desc: '探索 10 种美食', icon: '🍜', tier: 'bronze', check: (s) => s.totalFoods >= 10 },
  { id: 'food-20', name: '美食猎人 II', desc: '探索 20 种美食', icon: '🍜', tier: 'silver', check: (s) => s.totalFoods >= 20 },
  { id: 'food-50', name: '美食猎人 III', desc: '探索 50 种美食', icon: '🏆', tier: 'gold', check: (s) => s.totalFoods >= 50 },
  { id: 'gather-1', name: '聚餐新手', desc: '完成 1 次聚餐', icon: '🍽️', tier: 'bronze', check: (s) => s.totalGatherings >= 1 },
  { id: 'gather-10', name: '聚餐常客', desc: '完成 10 次聚餐', icon: '🍽️', tier: 'silver', check: (s) => s.totalGatherings >= 10 },
  { id: 'gather-30', name: '聚餐达人', desc: '完成 30 次聚餐', icon: '👑', tier: 'gold', check: (s) => s.totalGatherings >= 30 },
  { id: 'gather-50', name: '聚餐狂人', desc: '完成 50 次聚餐', icon: '🏆', tier: 'platinum', check: (s) => s.totalGatherings >= 50 },
  { id: 'city-star', name: '城市之星', desc: '同城打卡 ≥ 5 次', icon: '⭐', tier: 'silver', check: (s) => s.maxCityCount >= 5 },
];

router.get('/achievements', async (req, res) => {
  try {
    const userId = req.query.user_id || '我';
    const gatherings = await Gathering.find({
      $or: [{ participants: userId }, { creatorId: userId }]
    }).lean();

    const cityData = {};
    const allFoods = new Set();
    gatherings.forEach(g => {
      const city = (g.location && g.location.city) || '未知';
      cityData[city] = (cityData[city] || 0) + 1;
      if (g.foodTags) g.foodTags.forEach(f => allFoods.add(f));
    });

    const stats = {
      totalCities: Object.keys(cityData).length,
      totalFoods: allFoods.size,
      totalGatherings: gatherings.length,
      maxCityCount: Math.max(...Object.values(cityData), 0),
    };

    const achievements = achievementDefs.map(def => ({
      ...def,
      unlocked: def.check(stats),
    }));

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const totalCount = achievements.length;

    res.json({ data: { achievements, stats, unlockedCount, totalCount } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/checkins', async (req, res) => {
  try {
    const userId = req.query.user_id || '我';
    const gatherings = await Gathering.find({
      $or: [{ participants: userId }, { creatorId: userId }],
      isCheckin: true,
    }).sort({ dateTime: -1 }).lean();
    res.json({ data: gatherings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
