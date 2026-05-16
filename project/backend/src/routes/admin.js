const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const config = require('../config');
const adminAuth = require('../middleware/adminAuth');
const Gathering = require('../models/gathering');
const User = require('../models/user');

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== config.admin.username || password !== config.admin.password) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ username, role: 'admin' }, config.jwtSecret, { expiresIn: '12h' });
  res.json({ data: { token, username } });
});

// 以下所有路由需要认证
router.use(adminAuth);

router.get('/stats', async (req, res) => {
  try {
    const total = await Gathering.countDocuments();
    const costAgg = await Gathering.aggregate([{ $group: { _id: null, total: { $sum: '$totalCost' } } }]);
    const totalCost = costAgg[0]?.total || 0;
    const recent = await Gathering.find().sort({ createdAt: -1 }).limit(5).lean();

    const totalUsers = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsers = await User.countDocuments({ createdAt: { $gte: today } });

    res.json({ total, totalCost, avgCost: total ? Math.round(totalCost / total) : 0, recent, totalUsers, todayUsers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users/growth', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 30);
    const now = new Date();
    const points = [];
    let cumulative = await User.countDocuments({ createdAt: { $lt: new Date(now.getTime() - days * 86400000) } });
    for (let i = days; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const count = await User.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } });
      cumulative += count;
      points.push({
        date: `${dayStart.getMonth()+1}/${dayStart.getDate()}`,
        newUsers: count,
        totalUsers: cumulative,
      });
    }
    res.json({ data: points, days });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/gatherings', async (req, res) => {
  try {
    const items = await Gathering.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users', async (req, res) => {
  try {
    const items = await User.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
