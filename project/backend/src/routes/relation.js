const express = require('express');
const router = express.Router();
const Gathering = require('../models/gathering');
const User = require('../models/user');
const Buddy = require('../models/buddy');

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
    const rawId = req.query.user_id || '';
    const openid = req.query.openid || '';

    // 优先用 nickname 查 gatherings，用 openid 查 buddies
    let userId = rawId || openid;
    let userNickname = rawId;

    // 如果有 openid 没 nickname，查 User 表获取 nickname
    if (!userNickname && openid) {
      const userDoc = await User.findOne({ openid }).lean();
      if (userDoc && userDoc.nickname) {
        userNickname = userDoc.nickname;
        userId = userNickname;
      }
    }

    // 兜底
    if (!userNickname) userNickname = '我';
    if (!userId) userId = userNickname;

    // 1. 查聚餐记录
    const gatherings = await Gathering.find({
      $or: [
        { participants: userId },
        { creatorId: userId }
      ]
    }).lean();

    // 2. 查已接受饭搭子（用 openid，而非 nickname）
    const effectiveOpenid = openid || rawId;
    const buddyQuery = effectiveOpenid ? {
      $or: [
        { fromOpenid: effectiveOpenid, status: 'accepted' },
        { toOpenid: effectiveOpenid, status: 'accepted' }
      ]
    } : { _id: null };

    const buddyList = await Buddy.find(buddyQuery).lean();

    const buddyNames = buddyList.map(b => {
      if (b.fromOpenid === effectiveOpenid) return b.toRemark || b.toNickname || b.toOpenid;
      return b.fromRemark || b.fromNickname || b.fromOpenid;
    }).filter(Boolean);

    // 3. 查用户信息
    const allNames = [...new Set([...buddyNames, ...gatherings.flatMap(g => g.participants || []).filter(Boolean)])];
    const users = await User.find({ nickname: { $in: allNames } }).lean();
    const userMap = {};
    users.forEach(u => { userMap[u.nickname] = u; });

    // 4. 从 gathering 计算 friend 数据（现有逻辑）
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

    // 5. 合并饭搭子：保证每个 buddy 在 friendMap 中
    buddyNames.forEach(name => {
      if (!friendMap[name]) {
        friendMap[name] = { name, gatherCount: 0 };
      }
    });

    // 6. 计算称号
    const titleRules = [
      { id: 'soul_partner', name: '灵魂饭搭', level: '⭐⭐⭐⭐⭐', desc: '形影不离，吃遍人间的默契伙伴', check: (r) => r.gatherCount >= 8 },
      { id: 'food_accomplice', name: '美食同谋', level: '⭐⭐⭐⭐', desc: '跨越菜系国界的猎奇探险搭档', check: (r) => r.totalSpent >= 500 },
      { id: 'food_wanderer', name: '流浪美食家', level: '⭐⭐⭐⭐', desc: '走遍山河，用胃丈量世界的同行者', check: (r) => r.gatherCount >= 5 },
      { id: 'feast_king', name: '饭局天王', level: '⭐⭐⭐', desc: '财大气粗、豪气干云的聚餐主理人', check: (r) => r.totalSpent >= 300 },
      { id: 'happy_partner', name: '快乐搭档', level: '⭐⭐⭐', desc: '每次相聚都欢声笑语的开心果', check: (r) => r.gatherCount >= 5 && r.moodAvg >= 4 },
      { id: 'party_core', name: '聚会核心', level: '⭐⭐⭐', desc: '永远准时出现，缺了你就不热闹', check: (r) => r.gatherCount >= 5 },
      { id: 'explorer', name: '探店达人', level: '⭐⭐', desc: '总能发现隐藏小馆子的行走攻略', check: (r) => r.gatherCount >= 3 },
      { id: 'vibe_leader', name: '气氛组长', level: '⭐⭐', desc: '点菜必点对，聊天必起哄的妙人', check: (r) => r.moodAvg >= 3.5 },
      { id: 'passing_traveler', name: '偶遇旅人', level: '⭐', desc: '命运让我们共桌，期待下一次相逢', check: (r) => r.gatherCount >= 1 },
      { id: 'new_friend', name: '新晋饭友', level: '⭐', desc: '才刚开始的缘分，未来可期', check: () => true },
    ];

    function computeTitle(rd) {
      for (const rule of titleRules) {
        if (rule.check(rd)) return { title: rule.name, level: rule.level, desc: rule.desc, titleId: rule.id };
      }
      return { title: '新晋饭友', level: '⭐', desc: '才刚开始的缘分，未来可期', titleId: 'new_friend' };
    }

    const payCounts = {};
    gatherings.forEach(g => {
      if (g.payer && (g.participants.includes(userId) || g.creatorId === userId) && g.payer !== userId) {
        payCounts[g.payer] = (payCounts[g.payer] || 0) + 1;
      }
    });
    const maxPay = Math.max(...Object.values(payCounts), 0);

    const friends = Object.entries(friendMap).map(([name, data]) => {
      const friend = {
        name,
        gatherCount: data.gatherCount || 0,
        cities: data.cities ? [...data.cities] : [],
        cityCount: data.cities ? data.cities.size : 0,
        cuisineCount: data.cuisines ? data.cuisines.size : 0,
        totalSpent: Math.round(data.totalSpent || 0),
        happyCount: (data.moods || []).filter(m => m === '开心' || m === '搞笑').length,
        moodAvg: (data.moodScores || []).length > 0
          ? data.moodScores.reduce((a, b) => a + b, 0) / data.moodScores.length : 0,
        attendRate: Math.min(1, data.gatherCount / Math.max(gatherings.length, 1)),
        payRank: payCounts[name] === maxPay && maxPay > 0 ? 1 : 0,
        newPlaceCount: data.newPlaces ? data.newPlaces.size : 0,
      };
      const titleInfo = computeTitle(friend);
      return { name, gatherCount: friend.gatherCount, cities: friend.cities, totalSpent: friend.totalSpent, ...titleInfo };
    });

    friends.sort((a, b) => b.gatherCount - a.gatherCount);

    // 7. 查当前用户信息
    const userInfo = await User.findOne({ nickname: userId }).lean();

    res.json({
      data: {
        user: {
          name: userId,
          nickname: userInfo ? userInfo.nickname : userId,
          avatar: userInfo ? userInfo.avatar_url : '',
        },
        friends,
        buddyCount: buddyNames.length,
        totalGathers: gatherings.length,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
