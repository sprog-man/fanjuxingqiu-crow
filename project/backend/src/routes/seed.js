const express = require('express');
const router = express.Router();
const Gathering = require('../models/gathering');
const Cuisine = require('../models/cuisine');

const sampleGatherings = [
  { title: '重庆火锅之夜', dateTime: '2026-05-15T19:00:00', location: { name: '渝味晓宇火锅', city: '重庆', lat: 29.5, lng: 106.5 }, participants: ['我', '小明', '小红'], payer: '小明', totalCost: 368, moodScore: 5, moodTags: ['开心', '美味'], foodTags: ['麻辣', '火锅', '毛肚'], creatorId: '我' },
  { title: '胡同里的烤鸭', dateTime: '2026-05-10T12:00:00', location: { name: '四季民福烤鸭', city: '北京', lat: 39.9, lng: 116.4 }, participants: ['我', '小明', '小刚'], payer: '我', totalCost: 456, moodScore: 4, moodTags: ['美味', '难忘'], foodTags: ['烤鸭', '京菜'], creatorId: '我' },
  { title: '深夜居酒屋', dateTime: '2026-05-05T20:30:00', location: { name: '鸟安居酒屋', city: '上海', lat: 31.2, lng: 121.5 }, participants: ['我', '小红', '小丽'], payer: '小红', totalCost: 520, moodScore: 5, moodTags: ['开心', '搞笑', '美味'], foodTags: ['日料', '刺身', '清酒'], creatorId: '我' },
  { title: '街角烧烤摊', dateTime: '2026-04-28T21:00:00', location: { name: '老王烧烤', city: '成都', lat: 30.6, lng: 104.1 }, participants: ['我', '小刚', '小强'], payer: '小刚', totalCost: 280, moodScore: 4, moodTags: ['开心', '日常'], foodTags: ['烧烤', '串串'], creatorId: '我' },
  { title: '广式早茶', dateTime: '2026-04-20T09:00:00', location: { name: '点都德', city: '广州', lat: 23.1, lng: 113.3 }, participants: ['我', '小明', '小丽'], payer: '我', totalCost: 198, moodScore: 4, moodTags: ['美味', '日常'], foodTags: ['粤菜', '点心', '虾饺'], creatorId: '我' },
  { title: '川菜馆辣翻', dateTime: '2026-04-15T12:30:00', location: { name: '眉州东坡', city: '北京', lat: 39.9, lng: 116.4 }, participants: ['我', '小明', '小红', '小刚'], payer: '小明', totalCost: 420, moodScore: 5, moodTags: ['开心', '搞笑', '辣到哭'], foodTags: ['川菜', '辣', '水煮鱼'], creatorId: '我' },
  { title: '日料放题', dateTime: '2026-04-08T19:30:00', location: { name: '万岛日本料理', city: '上海', lat: 31.2, lng: 121.5 }, participants: ['我', '小红', '小丽', '小明'], payer: '小红', totalCost: 680, moodScore: 5, moodTags: ['开心', '美味', '难忘'], foodTags: ['日料', '刺身', '和牛'], creatorId: '我' },
  { title: '南山烤肉', dateTime: '2026-04-01T18:00:00', location: { name: '姜虎东烤肉', city: '深圳', lat: 22.5, lng: 114.1 }, participants: ['我', '小刚'], payer: '小刚', totalCost: 320, moodScore: 3, moodTags: ['日常'], foodTags: ['韩餐', '烤肉'], creatorId: '我' },
  { title: '素食轻体验', dateTime: '2026-03-25T12:00:00', location: { name: '叶叶菩提', city: '北京', lat: 39.9, lng: 116.4 }, participants: ['我', '小明', '小丽'], payer: '小明', totalCost: 260, moodScore: 3, moodTags: ['清淡', '健康'], foodTags: ['素食', '健康', '清淡'], creatorId: '我' },
  { title: '成都街头串串', dateTime: '2026-03-18T20:00:00', location: { name: '钢管厂五区小郡肝', city: '成都', lat: 30.6, lng: 104.1 }, participants: ['我', '小红', '小强'], payer: '我', totalCost: 180, moodScore: 4, moodTags: ['开心', '日常', '辣到哭'], foodTags: ['串串', '辣'], creatorId: '我' },
  { title: '海底捞夜话', dateTime: '2026-03-10T22:00:00', location: { name: '海底捞', city: '重庆', lat: 29.5, lng: 106.5 }, participants: ['我', '小明', '小红', '小刚', '小丽', '小强'], payer: '小明', totalCost: 580, moodScore: 4, moodTags: ['开心', '搞笑', '美味'], foodTags: ['火锅', '川菜'], creatorId: '我' },
  { title: '西湖边龙井虾仁', dateTime: '2026-03-05T18:30:00', location: { name: '楼外楼', city: '杭州', lat: 30.3, lng: 120.2 }, participants: ['我', '小红'], payer: '小红', totalCost: 380, moodScore: 4, moodTags: ['美味', '难忘'], foodTags: ['杭帮菜', '清淡', '鲜'], creatorId: '我' },
];

const sampleBuddies = [
  { id: 'B1', name: '小明', phone: '138****1234', color: '#D85A30' },
  { id: 'B2', name: '小红', phone: '139****5678', color: '#1D9E75' },
  { id: 'B3', name: '小刚', phone: '137****9012', color: '#534AB7' },
  { id: 'B4', name: '小丽', phone: '136****3456', color: '#BA7517' },
  { id: 'B5', name: '小强', phone: '135****7890', color: '#185FA5' },
];

router.post('/all', async (req, res) => {
  try {
    const existing = await Gathering.countDocuments();
    if (existing > 0) {
      await Gathering.deleteMany({});
    }
    const records = sampleGatherings.map(g => ({
      ...g,
      dateTime: new Date(g.dateTime),
      totalCost: g.totalCost,
      photos: [],
    }));
    await Gathering.insertMany(records);

    const cuisines = [
      { id: 'chuan', name: '川菜', icon: '🌶️', color: '#D85A30', tags: ['辣', '麻辣', '重口'], enabled: true },
      { id: 'yue', name: '粤菜', icon: '🥟', color: '#1D9E75', tags: ['清淡', '鲜美', '精致'], enabled: true },
      { id: 'ri', name: '日料', icon: '🍣', color: '#534AB7', tags: ['清淡', '生鲜', '精致'], enabled: true },
      { id: 'han', name: '韩餐', icon: '🥘', color: '#185FA5', tags: ['辣', '重口', '烤肉'], enabled: true },
      { id: 'xi', name: '西餐', icon: '🥩', color: '#BA7517', tags: ['精致', '牛排', '浪漫'], enabled: true },
      { id: 'su', name: '素食', icon: '🥗', color: '#1D9E75', tags: ['清淡', '健康', '轻食'], enabled: true },
    ];
    await Cuisine.deleteMany({});
    await Cuisine.insertMany(cuisines);

    res.json({
      data: {
        gatherings: records.length,
        cuisines: cuisines.length,
        message: '种子数据已导入'
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/data', (req, res) => {
  res.json({
    data: {
      gatherings: sampleGatherings,
      buddies: sampleBuddies,
      message: '用于前端 localStorage 的种子数据'
    }
  });
});

module.exports = router;
