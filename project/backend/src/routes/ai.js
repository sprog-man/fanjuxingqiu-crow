const express = require('express');
const router = express.Router();

const memoryTemplates = [
  (g) => `${g.title}那天，${g.participants.slice(0,3).join('、')}${g.participants.length > 3 ? `等${g.participants.length}人` : ''}聚在${g.location.name}。${g.moodTags?.includes('美味') ? '每一道菜都惊艳了味蕾，' : ''}${g.moodTags?.includes('开心') ? '笑声此起彼伏，' : ''}留下了难忘的回忆。${g.note ? g.note : '期待下一次的相聚！'}`,
  (g) => `在${g.location.name}的这顿${g.title}，是专属于${g.participants.slice(0,2).join('和')}的美食记忆。${g.moodScore >= 4 ? '气氛满分，吃得畅快淋漓！' : '平淡中也有滋有味～'} ${g.totalCost}元的快乐，人均${Math.round(g.totalCost/g.participants.length)}元，值了！`,
  (g) => `🌙 ${g.title} · ${g.location.name}\n和${g.participants.join('、')}一起，解锁了新的美食地图。${g.foodTags?.length ? '尝了' + g.foodTags.slice(0,3).join('、') + '，' : ''}每一口都是快乐的味道。下一次聚餐，已经在路上了！`,
];

router.post('/memory', (req, res) => {
  const { title, participants, location, moodScore, moodTags, note, foodTags, totalCost } = req.body;
  if (!title) return res.status(400).json({ error: '缺少聚餐名称' });

  const gathering = { title, participants: participants || [], location: location || {}, moodScore, moodTags: moodTags || [], note, foodTags: foodTags || [], totalCost: totalCost || 0 };
  const template = memoryTemplates[Math.floor(Math.random() * memoryTemplates.length)];
  const memory = template(gathering);

  res.json({ data: { memory, style: '轻松活泼', generatedAt: new Date() } });
});

module.exports = router;
