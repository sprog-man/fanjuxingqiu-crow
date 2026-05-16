const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const Gathering = require('../models/gathering');

const upload = multer({
  dest: path.join(__dirname, '../../../uploads/gatherings/'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/create', async (req, res) => {
  try {
    const { title, dateTime, location, participants, totalCost, payer, photos, moodScore, moodTags, note, foodTags, creatorId } = req.body;
    if (!title || !dateTime || !location || !participants || !totalCost) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const record = await Gathering.create({
      title, dateTime: new Date(dateTime), location, participants,
      totalCost: Number(totalCost), payer: payer || null,
      photos: photos || [], moodScore: moodScore || null,
      moodTags: moodTags || [], note: note || '', foodTags: foodTags || [], creatorId: creatorId || '',
    });
    res.json({ data: record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Gathering.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Gathering.countDocuments(),
    ]);
    res.json({ data: { items, total, page: Number(page) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/detail/:id', async (req, res) => {
  try {
    const record = await Gathering.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ error: '记录不存在' });
    res.json({ data: record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const gatherings = await Gathering.find().lean();
    const total = gatherings.length;
    const totalCost = gatherings.reduce((s, g) => s + (g.totalCost || 0), 0);
    const avgCost = total > 0 ? Math.round(totalCost / total) : 0;
    const allPeople = new Set(gatherings.flatMap(g => g.participants));
    const perPerson = allPeople.size > 0 ? Math.round(totalCost / allPeople.size) : 0;

    const friendCount = {};
    gatherings.forEach(g => (g.participants || []).forEach(p => {
      friendCount[p] = (friendCount[p] || 0) + 1;
    }));
    const topFriends = Object.entries(friendCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const moodDist = {};
    gatherings.forEach(g => (g.moodTags || []).forEach(t => {
      moodDist[t] = (moodDist[t] || 0) + 1;
    }));

    const now = new Date();
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      const count = gatherings.filter(g => {
        const d = new Date(g.dateTime);
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      }).length;
      monthly.push({ month: key, count });
    }

    const cityCount = {};
    gatherings.forEach(g => {
      const city = (g.location && g.location.city) || '未知';
      cityCount[city] = (cityCount[city] || 0) + 1;
    });
    const cities = Object.entries(cityCount).sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    res.json({ data: { total, totalCost, avgCost, perPerson, topFriends, moodDist, monthly, cities } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/update-photos', async (req, res) => {
  try {
    const { gatheringId, photos } = req.body;
    await Gathering.updateOne(
      { _id: gatheringId },
      { $push: { photos: { $each: photos } } }
    );
    res.json({ data: { updated: true } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload', upload.array('photos', 9), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请选择照片' });
    }
    const files = req.files.map(f => ({
      url: '/uploads/gatherings/' + f.filename,
      originalName: f.originalname,
      size: f.size,
    }));
    res.json({ data: files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
