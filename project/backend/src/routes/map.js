const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const Gathering = require('../models/gathering');
const oss = require('../utils/oss');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

function generateOssPath(originalname) {
  const ext = path.extname(originalname).toLowerCase() || '.jpg';
  const filename = crypto.randomUUID() + ext;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `map/checkins/${year}/${month}/${filename}`;
}

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

router.get('/city-records', async (req, res) => {
  try {
    const userId = req.query.user_id || '我';
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'city required' });
    const gatherings = await Gathering.find({
      $or: [{ participants: userId }, { creatorId: userId }],
      'location.city': city,
    }).sort({ dateTime: -1 }).lean();
    res.json({ data: gatherings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/checkin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant, food, lat, lng, city, province, photos, note, dateTime } = req.body;
    
    const gathering = await Gathering.findById(id);
    if (!gathering) {
      return res.status(404).json({ error: '打卡记录不存在' });
    }

    gathering.title = restaurant || (city ? `${city}打卡` : '美食打卡');
    if (dateTime) gathering.dateTime = dateTime;
    if (lat !== undefined) gathering.location.lat = lat;
    if (lng !== undefined) gathering.location.lng = lng;
    if (city) gathering.location.city = city;
    if (restaurant) gathering.location.name = restaurant;
    if (photos !== undefined) gathering.photos = photos;
    if (note !== undefined) gathering.note = note;
    if (food !== undefined) gathering.foodTags = [food];

    await gathering.save();
    
    res.json({ data: { ...gathering.toObject(), _id: gathering._id, id: gathering._id } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/checkin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const gathering = await Gathering.findByIdAndDelete(id);
    if (!gathering) {
      return res.status(404).json({ error: '打卡记录不存在' });
    }

    res.json({ data: { success: true } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload', upload.array('photos', 9), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请选择照片' });
    }
    const files = [];
    for (const f of req.files) {
      const ossPath = generateOssPath(f.originalname);
      const url = await oss.uploadBuffer(f.buffer, ossPath);
      files.push({ url, originalName: f.originalname, size: f.size });
    }
    res.json({ data: files });
  } catch (e) {
    if (e.code === 'OSS_MISCONFIG') {
      return res.status(500).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

const TENCENT_MAP_KEY = '7JTBZ-P2N6W-QNURK-3QKJY-VYAXE-WOFBJ'

router.get('/geocode', (req, res) => {
  const { lat, lng } = req.query
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' })

  const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${TENCENT_MAP_KEY}&get_poi=0&output=json`

  https.get(url, (proxyRes) => {
    let body = ''
    proxyRes.on('data', (chunk) => { body += chunk })
    proxyRes.on('end', () => {
      try {
        const data = JSON.parse(body)
        if (data.status === 0) {
          const addr = data.result.address_component
          res.json({
            data: {
              city: addr.city || addr.district || '',
              province: addr.province || '',
              district: addr.district || '',
              lat: parseFloat(lat),
              lng: parseFloat(lng),
            }
          })
        } else {
          res.status(502).json({ error: `腾讯地图 API 错误: ${data.message}`, code: data.status })
        }
      } catch (e) {
        res.status(502).json({ error: '解析腾讯地图响应失败' })
      }
    })
    proxyRes.on('error', () => {
      res.status(502).json({ error: '腾讯地图代理请求失败' })
    })
  }).on('error', (e) => {
    res.status(502).json({ error: '腾讯地图代理请求失败: ' + e.message })
  })
})

module.exports = router;
