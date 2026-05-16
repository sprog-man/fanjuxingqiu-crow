const express = require('express');
const router = express.Router();
const Gathering = require('../models/gathering');

const titleRules = [
  { id: 'soulmate', name: '灵魂饭搭', level: '⭐⭐⭐⭐⭐', desc: '形影不离，吃遍人间的默契伙伴', check: (r) => r.gatherCount >= 8 },
  { id: 'food-conspirator', name: '美食同谋', level: '⭐⭐⭐⭐', desc: '跨越菜系国界的猎奇探险搭档', check: (r) => r.cuisineCount >= 6 },
  { id: 'wanderer', name: '流浪美食家', level: '⭐⭐⭐⭐', desc: '走遍山河，用胃丈量世界的同行者', check: (r) => r.cityCount >= 3 },
  { id: 'feast-king', name: '饭局天王', level: '⭐⭐⭐', desc: '财大气粗、豪气干云的聚餐主理人', check: (r) => r.payRank === 1 },
  { id: 'happy-partner', name: '快乐搭档', level: '⭐⭐⭐', desc: '每次相聚都欢声笑语的开心果', check: (r) => r.happyCount >= 3 },
  { id: 'core', name: '聚会核心', level: '⭐⭐⭐', desc: '永远准时出现，缺了你就不热闹', check: (r) => r.attendRate >= 0.9 },
  { id: 'explorer', name: '探店达人', level: '⭐⭐', desc: '总能发现隐藏小馆子的行走攻略', check: (r) => r.newPlaceCount >= 3 },
  { id: 'atmosphere', name: '气氛组长', level: '⭐⭐', desc: '点菜必点对，聊天必起哄的妙人', check: (r) => r.moodAvg >= 4 },
  { id: 'traveler', name: '偶遇旅人', level: '⭐', desc: '命运让我们共桌，期待下一次相逢', check: (r) => r.gatherCount >= 1 },
  { id: 'new-friend', name: '新晋饭友', level: '⭐', desc: '才刚开始的缘分，未来可期', check: () => true },
];

function computeTitle(friend) {
  for (const rule of titleRules) {
    if (rule.check(friend)) return { title: rule.name, level: rule.level, desc: rule.desc };
  }
  return { title: '新晋饭友', level: '⭐', desc: '才刚开始的缘分，未来可期' };
}

function getNodeColor(level) {
  if (level === '⭐⭐⭐⭐⭐') return '#FFD700';
  if (level === '⭐⭐⭐⭐') return '#D85A30';
  if (level === '⭐⭐⭐') return '#D85A30';
  if (level === '⭐⭐') return '#185FA5';
  return '#5F5E5A';
}

function getNodeSize(count) {
  return Math.max(30, Math.min(60, 20 + count * 4));
}

router.get('/graph', async (req, res) => {
  try {
    const userId = req.query.user_id || '我';
    const gatherings = await Gathering.find({
      $or: [
        { participants: userId },
        { creatorId: userId }
      ]
    }).lean();

    const friendMap = {};
    gatherings.forEach(g => {
      const participants = g.participants || [];
      if (!participants.includes(userId) && g.creatorId !== userId) return;
      participants.forEach(p => {
        if (p === userId) return;
        if (!friendMap[p]) {
          friendMap[p] = {
            name: p, gatherCount: 0, cities: new Set(),
            cuisines: new Set(), totalSpent: 0,
            moods: [], moodScores: [], payCount: 0, newPlaces: new Set(),
          };
        }
        const fr = friendMap[p];
        fr.gatherCount++;
        if (g.location && g.location.city) fr.cities.add(g.location.city);
        if (g.foodTags) g.foodTags.forEach(t => fr.cuisines.add(t));
        if (g.moodTags) fr.moods.push(...g.moodTags);
        if (g.moodScore) fr.moodScores.push(g.moodScore);
        if (g.totalCost) fr.totalSpent += g.totalCost / Math.max(participants.length - 1, 1);
        if (g.location && g.location.name) fr.newPlaces.add(g.location.name);
      });
    });

    const payCounts = {};
    gatherings.forEach(g => {
      if (g.payer && (g.participants.includes(userId) || g.creatorId === userId) && g.payer !== userId) {
        payCounts[g.payer] = (payCounts[g.payer] || 0) + 1;
      }
    });
    const maxPay = Math.max(...Object.values(payCounts), 0);

    const friends = Object.entries(friendMap).map(([name, data]) => {
      const friend = {
        ...data,
        cities: [...data.cities],
        cityCount: data.cities.size,
        cuisineCount: data.cuisines.size,
        happyCount: data.moods.filter(m => m === '开心' || m === '搞笑').length,
        moodAvg: data.moodScores.length > 0
          ? data.moodScores.reduce((a, b) => a + b, 0) / data.moodScores.length : 0,
        attendRate: Math.min(1, data.gatherCount / Math.max(gatherings.length, 1)),
        payRank: payCounts[name] === maxPay && maxPay > 0 ? 1 : 0,
        totalSpent: Math.round(data.totalSpent),
      };
      const titleInfo = computeTitle(friend);
      return {
        name,
        gatherCount: friend.gatherCount,
        cities: friend.cities,
        totalSpent: friend.totalSpent,
        ...titleInfo,
        color: getNodeColor(titleInfo.level),
        size: getNodeSize(friend.gatherCount),
      };
    });

    friends.sort((a, b) => b.gatherCount - a.gatherCount);
    res.json({ data: { user: { name: userId }, friends } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
