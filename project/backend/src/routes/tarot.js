const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const Cuisine = require('../models/cuisine');
const Dish = require('../models/dish');
const User = require('../models/user');

const defaultCategories = [
  { id: 'chuan', name: '川菜', tarotCover: '/images/tarot/category/cat-chuan.png', tags: ['辣', '麻辣', '重口'] },
  { id: 'yue', name: '粤菜', tarotCover: '/images/tarot/category/cat-yue.png', tags: ['清淡', '鲜美', '精致'] },
  { id: 'ri', name: '日料', tarotCover: '/images/tarot/category/cat-ri.png', tags: ['清淡', '生鲜', '精致'] },
  { id: 'han', name: '韩餐', tarotCover: '/images/tarot/category/cat-han.png', tags: ['辣', '重口', '烤肉'] },
  { id: 'xi', name: '西餐', tarotCover: '/images/tarot/category/cat-xi.png', tags: ['精致', '牛排', '浪漫'] },
  { id: 'su', name: '素食', tarotCover: '/images/tarot/category/cat-su.png', tags: ['清淡', '健康', '轻食'] },
  { id: 'lu', name: '鲁菜', tarotCover: '/images/tarot/category/cat-lu.png', tags: ['咸鲜', '醇厚', '经典'] },
  { id: 'xiang', name: '湘菜', tarotCover: '/images/tarot/category/cat-xiang.png', tags: ['辣', '酸辣', '下饭'] },
  { id: 'huaiyang', name: '淮扬菜', tarotCover: '/images/tarot/category/cat-huaiyang.png', tags: ['清淡', '刀工', '精致'] },
  { id: 'dongbei', name: '东北菜', tarotCover: '/images/tarot/category/cat-dongbei.png', tags: ['量大', '炖菜', '豪放'] },
  { id: 'xibei', name: '西北菜', tarotCover: '/images/tarot/category/cat-xibei.png', tags: ['面食', '羊肉', '粗犷'] },
  { id: 'xiaochi', name: '小吃', tarotCover: '/images/tarot/category/cat-xiaochi.png', tags: ['街头', '零食', '特色'] },
];

const defaultDishes = {
  chuan: [
    { name: '麻婆豆腐', tags: ['麻辣', '下饭'], description: '经典川菜，麻辣鲜香' },
    { name: '水煮鱼', tags: ['麻辣', '鲜香'], description: '鱼片嫩滑，红油飘香' },
    { name: '宫保鸡丁', tags: ['甜辣', '花生'], description: '鸡丁配花生，甜辣适中' },
    { name: '回锅肉', tags: ['咸香', '家常'], description: '蒜苗回锅肉，家常美味' },
    { name: '夫妻肺片', tags: ['麻辣', '凉拌'], description: '牛肉牛杂凉拌，麻辣开胃' },
    { name: '辣子鸡', tags: ['麻辣', '干香'], description: '干辣椒炒鸡，外酥里嫩' },
  ],
  yue: [
    { name: '白切鸡', tags: ['清淡', '原味'], description: '广东名菜，皮爽肉滑' },
    { name: '烧鹅', tags: ['香脆', '蜜汁'], description: '皮脆肉嫩，蜜汁飘香' },
    { name: '虾饺', tags: ['鲜美', '点心'], description: '透明外皮，鲜虾饱满' },
    { name: '肠粉', tags: ['嫩滑', '早餐'], description: '米浆蒸制，嫩滑爽口' },
    { name: '叉烧', tags: ['蜜汁', '香甜'], description: '蜜汁叉烧，肥瘦相间' },
    { name: '煲仔饭', tags: ['锅巴', '香浓'], description: '腊味煲仔饭，锅巴焦香' },
  ],
  ri: [
    { name: '三文鱼刺身', tags: ['生鲜', '清淡'], description: '新鲜三文鱼，入口即化' },
    { name: '拉面', tags: ['浓郁', '面食'], description: '豚骨汤底，面条劲道' },
    { name: '天妇罗', tags: ['酥脆', '油炸'], description: '蔬菜海鲜裹面糊炸制' },
    { name: '寿司拼盘', tags: ['精致', '生鲜'], description: '多种寿司组合' },
    { name: '烤鳗鱼', tags: ['甜咸', '炭烤'], description: '蒲烧鳗鱼，甜咸适口' },
    { name: '章鱼小丸子', tags: ['街头', '小吃'], description: '外酥内软，配木鱼花' },
  ],
  han: [
    { name: '韩式烤肉', tags: ['烤肉', '辣酱'], description: '五花肉配辣酱生菜' },
    { name: '石锅拌饭', tags: ['拌饭', '辣酱'], description: '热石锅拌饭，锅巴香脆' },
    { name: '泡菜汤', tags: ['酸辣', '暖胃'], description: '泡菜豆腐汤，酸辣开胃' },
    { name: '炸鸡', tags: ['酥脆', '甜辣'], description: '韩式甜辣炸鸡' },
    { name: '冷面', tags: ['清凉', '酸甜'], description: '冰镇冷面，夏日必备' },
    { name: '部队锅', tags: ['丰富', '辣味'], description: '午餐肉年糕火锅' },
  ],
  xi: [
    { name: '牛排', tags: ['牛排', '精致'], description: '澳洲牛排，五分熟最佳' },
    { name: '意面', tags: ['番茄', '面食'], description: '经典番茄肉酱意面' },
    { name: '凯撒沙拉', tags: ['清爽', '健康'], description: '罗马生菜配凯撒酱' },
    { name: '奶油蘑菇汤', tags: ['浓郁', '暖胃'], description: '奶油蘑菇浓汤' },
    { name: '披萨', tags: ['芝士', '分享'], description: '玛格丽特披萨' },
    { name: '焗蜗牛', tags: ['法式', '蒜香'], description: '黄油蒜香焗蜗牛' },
  ],
  su: [
    { name: '罗汉斋', tags: ['清淡', '养生'], description: '多种素菜烩制' },
    { name: '素炒时蔬', tags: ['清淡', '健康'], description: '当季蔬菜清炒' },
    { name: '豆腐煲', tags: ['鲜美', '暖胃'], description: '砂锅豆腐煲' },
    { name: '素饺子', tags: ['家常', '面食'], description: '三鲜素馅饺子' },
    { name: '凉拌木耳', tags: ['爽脆', '开胃'], description: '木耳凉拌，酸辣爽口' },
    { name: '素汉堡', tags: ['轻食', '新潮'], description: '植物肉汉堡' },
  ],
  lu: [
    { name: '糖醋鲤鱼', tags: ['酸甜', '经典'], description: '外酥里嫩，糖醋汁浓' },
    { name: '九转大肠', tags: ['醇厚', '经典'], description: '鲁菜名菜，肥而不腻' },
    { name: '葱烧海参', tags: ['高档', '鲜美'], description: '大葱烧海参，鲜香浓郁' },
    { name: '锅塌豆腐', tags: ['家常', '嫩滑'], description: '豆腐煎塌，外焦里嫩' },
    { name: '爆炒腰花', tags: ['快炒', '鲜嫩'], description: '腰花快炒，鲜嫩爽口' },
    { name: '德州扒鸡', tags: ['酥烂', '香浓'], description: '德州名菜，骨肉分离' },
  ],
  xiang: [
    { name: '剁椒鱼头', tags: ['辣', '鲜香'], description: '大鱼头配剁椒，鲜辣过瘾' },
    { name: '小炒黄牛肉', tags: ['辣', '下饭'], description: '牛肉小炒，香辣入味' },
    { name: '农家小炒肉', tags: ['辣', '家常'], description: '五花肉配辣椒，下饭神器' },
    { name: '毛氏红烧肉', tags: ['甜咸', '软糯'], description: '毛氏红烧肉，肥而不腻' },
    { name: '腊味合蒸', tags: ['咸香', '腊味'], description: '多种腊味蒸制' },
    { name: '口味虾', tags: ['辣', '夜宵'], description: '麻辣小龙虾，夜宵首选' },
  ],
  huaiyang: [
    { name: '狮子头', tags: ['醇厚', '经典'], description: '大肉丸炖制，入口即化' },
    { name: '大煮干丝', tags: ['清淡', '刀工'], description: '豆腐干切丝，高汤煮制' },
    { name: '松鼠鳜鱼', tags: ['酸甜', '造型'], description: '鳜鱼炸制，形似松鼠' },
    { name: '扬州炒饭', tags: ['经典', '家常'], description: '虾仁蛋炒饭，粒粒分明' },
    { name: '水晶肴肉', tags: ['冷盘', '精致'], description: '镇江名菜，晶莹剔透' },
    { name: '文思豆腐', tags: ['刀工', '清淡'], description: '豆腐切丝如发，高汤清炖' },
  ],
  dongbei: [
    { name: '锅包肉', tags: ['酸甜', '酥脆'], description: '里脊肉裹粉炸，酸甜汁浇' },
    { name: '地三鲜', tags: ['家常', '下饭'], description: '土豆茄子青椒炒制' },
    { name: '铁锅炖', tags: ['炖菜', '豪放'], description: '铁锅炖大鹅，东北特色' },
    { name: '酸菜白肉', tags: ['酸菜', '暖胃'], description: '酸菜炖白肉，冬日必备' },
    { name: '烤冷面', tags: ['街头', '小吃'], description: '东北烤冷面，配鸡蛋香肠' },
    { name: '酱骨架', tags: ['酱香', '大骨'], description: '大骨酱炖，啃骨过瘾' },
  ],
  xibei: [
    { name: '羊肉泡馍', tags: ['面食', '羊肉'], description: '西安名吃，汤浓馍软' },
    { name: '肉夹馍', tags: ['面食', '肉香'], description: '腊汁肉夹馍，外酥里嫩' },
    { name: '兰州拉面', tags: ['面食', '牛肉'], description: '一清二白三红四绿' },
    { name: '手抓羊肉', tags: ['羊肉', '原味'], description: '手抓羊肉，原汁原味' },
    { name: '凉皮', tags: ['清凉', '酸辣'], description: '米皮配辣椒醋汁' },
    { name: '大盘鸡', tags: ['辣', '大盘'], description: '新疆大盘鸡，配皮带面' },
  ],
  xiaochi: [
    { name: '臭豆腐', tags: ['街头', '特色'], description: '外酥内嫩，闻着臭吃着香' },
    { name: '煎饼果子', tags: ['早餐', '面食'], description: '天津煎饼果子，配薄脆' },
    { name: '麻辣烫', tags: ['辣', '自选'], description: '自选食材麻辣汤底' },
    { name: '烤串', tags: ['烧烤', '夜宵'], description: '羊肉串牛肉串，炭烤飘香' },
    { name: '糖葫芦', tags: ['甜食', '传统'], description: '山楂糖葫芦，酸甜可口' },
    { name: '生煎包', tags: ['面食', '鲜美'], description: '底部焦脆，汤汁丰富' },
  ],
};

router.get('/categories', async (req, res) => {
  try {
    let categories = await Cuisine.find({ enabled: true }).lean();
    const dbIds = new Set(categories.map(c => c.id));
    const missing = defaultCategories.filter(c => !dbIds.has(c.id));
    const allCategories = [...categories, ...missing];
    const result = allCategories.map(c => ({
      id: c.id,
      name: c.name,
      tarotCover: c.tarotCover || `/images/tarot/category/cat-${c.id}.png`,
      tags: c.tags || [],
    }));
    res.json({ data: result });
  } catch (e) {
    res.json({ data: defaultCategories });
  }
});

router.post('/draw', async (req, res) => {
  const { cuisineId, mood, tags, userId } = req.body;
  if (!cuisineId) {
    return res.status(400).json({ error: '请选择分类' });
  }

  // 自动修补旧数据缺失的 type 字段
  await Dish.updateMany({ type: { $exists: false } }, { $set: { type: 'system' } }).catch(() => {});

  let dishes;
  if (userId) {
    dishes = await Dish.find({ cuisineId, enabled: true, $or: [{ openid: '' }, { openid: userId }] }).lean();
  } else {
    dishes = await Dish.find({ cuisineId, enabled: true }).lean();
  }
  if (dishes.length === 0) {
    dishes = (defaultDishes[cuisineId] || []).map(d => ({
      name: d.name,
      tags: d.tags,
      description: d.description,
      image: '',
    }));
  }

  if (tags && tags.length) {
    const filtered = dishes.filter(d => d.tags && d.tags.some(t => tags.includes(t)));
    if (filtered.length > 0) dishes = filtered;
  }

  const picked = dishes[Math.floor(Math.random() * dishes.length)];

  if (userId) {
    try {
      const user = await User.findOne({ openid: userId });
      if (user) {
        let pref = {};
        try { pref = typeof user.preference_tags === 'string' ? JSON.parse(user.preference_tags) : user.preference_tags; } catch (_) {}
        pref.cuisines = pref.cuisines || {};
        pref.cuisines[cuisineId] = (pref.cuisines[cuisineId] || 0) + 1;
        pref.totalSpins = (pref.totalSpins || 0) + 1;
        user.preference_tags = JSON.stringify(pref);
        await user.save();
      }
    } catch (_) {}
  }

  res.json({
    data: {
      name: picked.name,
      cuisineId,
      tags: picked.tags || [],
      description: picked.description || '',
      image: picked.image || '',
    }
  });
});

router.get('/dishes', async (req, res) => {
  const { cuisineId, openid } = req.query;
  console.log('GET /dishes cuisineId:', cuisineId, 'openid:', openid);
  try {
    // 自动修补旧数据缺失的 type 字段
    await Dish.updateMany({ type: { $exists: false } }, { $set: { type: 'system' } });

    let dishes;
    const filter = { enabled: true };
    if (cuisineId) filter.cuisineId = cuisineId;
    if (openid) {
      filter.$or = [{ openid: '' }, { openid }];
    }
    dishes = await Dish.find(filter).lean();
    console.log('Dishes found:', dishes.length);
    res.json({ data: dishes });
  } catch (e) {
    console.error('Dishes query error:', e);
    res.json({ data: [] });
  }
});

router.post('/dishes', async (req, res) => {
  const { name, cuisineId, openid, image, tags, description } = req.body;
  console.log('POST /dishes received:', req.body);
  if (!name || !cuisineId) {
    return res.status(400).json({ error: '名称和分类必填' });
  }
  try {
    const dish = await Dish.create({ name, cuisineId, openid: openid || '', image: image || '', tags: tags || [], description: description || '' });
    console.log('Dish created:', dish);
    res.json({ data: dish });
  } catch (e) {
    console.error('Dish create error:', e);
    res.status(500).json({ error: '创建失败: ' + e.message });
  }
});

router.delete('/dishes/clear', async (req, res) => {
  try {
    const { cuisineId, openid } = req.query;
    if (!cuisineId || !openid) return res.status(400).json({ error: '参数不全' });
    const r = await Dish.deleteMany({ cuisineId, openid, type: 'user' });
    res.json({ data: { deleted: r.deletedCount } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/dishes/:id', async (req, res) => {
  try {
    const { openid } = req.query;
    const dish = await Dish.findById(req.params.id);
    if (!dish) return res.status(404).json({ error: '菜品不存在' });
    if (dish.openid && dish.openid !== openid) {
      return res.status(403).json({ error: '无权删除此菜品' });
    }
    await Dish.findByIdAndDelete(req.params.id);
    res.json({ data: { ok: true } });
  } catch (e) {
    res.status(500).json({ error: '删除失败' });
  }
});

router.put('/dishes/:id', async (req, res) => {
  const { name, cuisineId, openid, image, tags, description } = req.body;
  if (!name || !cuisineId) {
    return res.status(400).json({ error: '名称和分类必填' });
  }
  try {
    const existing = await Dish.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: '菜品不存在' });
    if (existing.openid && existing.openid !== openid) {
      return res.status(403).json({ error: '无权修改此菜品' });
    }
    const dish = await Dish.findByIdAndUpdate(
      req.params.id,
      { name, cuisineId, openid: openid || '', image: image || '', tags: tags || [], description: description || '' },
      { new: true }
    );
    res.json({ data: dish });
  } catch (e) {
    res.status(500).json({ error: '修改失败' });
  }
});

router.post('/seed', async (req, res) => {
  try {
    const cuisineCount = await Cuisine.countDocuments();
    if (cuisineCount === 0) {
      await Cuisine.insertMany(defaultCategories.map(c => ({
        ...c,
        icon: '',
        color: '#D85A30',
      })));
    }

    const dishCount = await Dish.countDocuments();
    if (dishCount === 0) {
      const allDishes = [];
      for (const [cuisineId, dishes] of Object.entries(defaultDishes)) {
        for (const d of dishes) {
          allDishes.push({
            name: d.name,
            cuisineId,
            openid: '',
            tags: d.tags,
            description: d.description,
          });
        }
      }
      await Dish.insertMany(allDishes);
    }

    res.json({
      data: {
        cuisines: await Cuisine.countDocuments(),
        dishes: await Dish.countDocuments(),
      }
    });
  } catch (e) {
    res.status(500).json({ error: '初始化失败' });
  }
});

const uploadDir = path.join(__dirname, '../../../uploads/dishes/');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

router.post('/upload', async (req, res) => {
  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      cb(null, uuid + ext);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      cb(null, allowed.includes(file.mimetype));
    },
  }).single('file');

  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: '上传失败' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请选择图片' });
    }

    let imageUrl = '/uploads/dishes/' + req.file.filename;

    if (config.oss.accessKeyId && config.oss.bucket) {
      try {
        const OSS = require('ali-oss');
        const client = new OSS({
          region: config.oss.region,
          accessKeyId: config.oss.accessKeyId,
          accessKeySecret: config.oss.accessKeySecret,
          bucket: config.oss.bucket,
        });
        const ossKey = 'dishes/' + req.file.filename;
        await client.put(ossKey, req.file.path, { headers: { 'x-oss-object-acl': 'public-read' } });
        imageUrl = (config.oss.baseUrl || `https://${config.oss.bucket}.${config.oss.region}.aliyuncs.com`) + '/' + ossKey;
        fs.unlinkSync(req.file.path);
      } catch (ossErr) {
        console.error('OSS upload failed, keep local file:', ossErr.message);
      }
    }

    res.json({ data: { url: imageUrl } });
  });
});

module.exports = router;
