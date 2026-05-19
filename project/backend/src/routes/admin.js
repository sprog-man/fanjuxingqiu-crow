const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const config = require('../config');
const adminAuth = require('../middleware/adminAuth');
const Gathering = require('../models/gathering');
const User = require('../models/user');
const Dish = require('../models/dish');
const Cuisine = require('../models/cuisine');

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

    const totalUsers = await User.countDocuments({ buddy_id: { $exists: true, $ne: '' } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsers = await User.countDocuments({ createdAt: { $gte: today }, buddy_id: { $exists: true, $ne: '' } });

    res.json({ total, totalCost, avgCost: total ? Math.round(totalCost / total) : 0, recent, totalUsers, todayUsers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users/growth', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 30);
    const now = new Date();
    const points = [];
    const buddyFilter = { buddy_id: { $exists: true, $ne: '' } };
    let cumulative = await User.countDocuments({ createdAt: { $lt: new Date(now.getTime() - days * 86400000) }, ...buddyFilter });
    for (let i = days; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const count = await User.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd }, ...buddyFilter });
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

// === 公共菜品管理（仅 admin 可操作 type: 'system' 的菜品） ===

router.get('/dishes', async (req, res) => {
  try {
    const { cuisineId } = req.query;
    const filter = { type: 'system' };
    if (cuisineId) filter.cuisineId = cuisineId;
    const items = await Dish.find(filter).sort({ cuisineId: 1, name: 1 }).lean();
    const cuisines = await Cuisine.find({ enabled: true }).lean();
    res.json({ items, cuisines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/dishes', async (req, res) => {
  try {
    const { name, cuisineId, image, tags, description } = req.body;
    if (!name || !cuisineId) return res.status(400).json({ error: '名称和分类必填' });
    const dish = await Dish.create({
      name, cuisineId, type: 'system', openid: '',
      image: image || '', tags: tags || [], description: description || '',
    });
    res.json({ data: dish });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/dishes/:id', async (req, res) => {
  try {
    const dish = await Dish.findById(req.params.id);
    if (!dish) return res.status(404).json({ error: '菜品不存在' });
    if (dish.type !== 'system') return res.status(403).json({ error: '仅可管理公共菜品' });
    const { name, cuisineId, image, tags, description } = req.body;
    if (name) dish.name = name;
    if (cuisineId) dish.cuisineId = cuisineId;
    if (image !== undefined) dish.image = image;
    if (tags !== undefined) dish.tags = tags;
    if (description !== undefined) dish.description = description;
    await dish.save();
    res.json({ data: dish });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/dishes/:id', async (req, res) => {
  try {
    const dish = await Dish.findById(req.params.id);
    if (!dish) return res.status(404).json({ error: '菜品不存在' });
    if (dish.type !== 'system') return res.status(403).json({ error: '仅可删除公共菜品' });
    await Dish.findByIdAndDelete(req.params.id);
    res.json({ data: { ok: true } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === 一键初始化菜系与菜品 ===
const sampleCuisines = [
  { id: 'chuan', name: '川菜', icon: '🌶️', color: '#D85A30', tags: ['辣', '麻辣', '重口'] },
  { id: 'yue', name: '粤菜', icon: '🥟', color: '#1D9E75', tags: ['清淡', '鲜美', '精致'] },
  { id: 'ri', name: '日料', icon: '🍣', color: '#534AB7', tags: ['清淡', '生鲜', '精致'] },
  { id: 'han', name: '韩餐', icon: '🥘', color: '#185FA5', tags: ['辣', '重口', '烤肉'] },
  { id: 'xi', name: '西餐', icon: '🥩', color: '#BA7517', tags: ['精致', '牛排', '浪漫'] },
  { id: 'su', name: '素食', icon: '🥗', color: '#1D9E75', tags: ['清淡', '健康', '轻食'] },
];

const sampleDishesByCuisine = {
  chuan: ['麻婆豆腐', '水煮鱼', '宫保鸡丁', '鱼香肉丝', '夫妻肺片', '回锅肉', '辣子鸡', '酸菜鱼', '毛血旺', '干锅牛蛙', '钵钵鸡', '担担面'],
  yue: ['白切鸡', '蜜汁叉烧', '深井烧鹅', '虾饺皇', '肠粉', '煲仔饭', '干炒牛河', '老火靓汤', '清蒸鲈鱼', '啫啫煲', '白灼菜心', '杨枝甘露'],
  ri: ['三文鱼刺身', '金枪鱼寿司', '鳗鱼饭', '豚骨拉面', '天妇罗', '章鱼烧', '味噌汤', '日式咖喱饭', '乌冬面', '烧鸟串', '玉子烧', '抹茶冰淇淋'],
  han: ['石锅拌饭', '韩式烤肉', '泡菜锅', '大酱汤', '辣炒年糕', '韩式炸鸡', '拌冷面', '紫菜包饭', '部队锅', '参鸡汤', '韩式煎饼', '泡菜'],
  xi: ['煎牛排', '番茄意面', '玛格丽特披萨', '凯撒沙拉', '奶油蘑菇汤', '意式烩饭', '香煎三文鱼', '烤春鸡', '法式焗蜗牛', '牛肉汉堡', '薯条', '提拉米苏'],
  su: ['素炒时蔬', '素麻婆豆腐', '清炒西兰花', '素馅饺子', '凉拌黄瓜', '素汤', '香菇青菜', '素烧茄子', '糖醋素排骨', '素炒面', '罗汉斋', '水果沙拉'],
};

router.post('/dishes/init', async (req, res) => {
  try {
    const existingCuisines = await Cuisine.countDocuments();
    if (existingCuisines === 0) {
      await Cuisine.insertMany(sampleCuisines.map(c => ({ ...c, enabled: true, tarotCover: '' })));
    }
    const cuisines = await Cuisine.find({ enabled: true }).lean();

    const existingDishes = await Dish.countDocuments({ type: 'system' });
    if (existingDishes > 0) {
      return res.json({ data: { cuisines: cuisines.length, dishes: existingDishes, message: '菜品数据已存在，无需重复导入' } });
    }

    const dishes = [];
    for (const c of cuisines) {
      const names = sampleDishesByCuisine[c.id] || [];
      for (const name of names) {
        dishes.push({
          name,
          cuisineId: c.id,
          type: 'system',
          openid: '',
          image: '',
          tags: [],
          description: '',
          enabled: true,
        });
      }
    }
    await Dish.insertMany(dishes);
    res.json({ data: { cuisines: cuisines.length, dishes: dishes.length, message: '初始化完成' } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
