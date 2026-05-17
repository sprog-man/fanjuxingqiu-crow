const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Buddy = require('../models/buddy');
const User = require('../models/user');
const config = require('../config');

function getOpenid(req) {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const decoded = jwt.verify(auth.slice(7), config.jwtSecret);
      if (decoded.openid) return decoded.openid;
    }
  } catch (e) {}
  return req.body.openid || req.query.openid || '';
}

function getUserId(req) {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const decoded = jwt.verify(auth.slice(7), config.jwtSecret);
      if (decoded.userId) return decoded.userId;
    }
  } catch (e) {}
  return '';
}

// 搜索用户（按昵称模糊匹配）
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ data: [] });

    const openid = getOpenid(req);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const users = await User.find({
      openid: { $ne: openid },
      nickname: regex,
    })
      .select('nickname avatar_url phone openid')
      .limit(20)
      .lean();

    const result = users.map(u => ({
      _id: u._id,
      name: u.nickname,
      avatar: u.avatar_url,
      phone: u.phone,
      openid: u.openid,
    }));

    res.json({ data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取饭搭子列表
router.get('/list', async (req, res) => {
  try {
    const openid = getOpenid(req);
    if (!openid) return res.status(400).json({ error: '缺少 openid' });

    const buddies = await Buddy.find({ openid })
      .populate('targetUserId', 'nickname avatar_url phone')
      .sort({ createdAt: -1 })
      .lean();

    const result = buddies.map(b => ({
      _id: b._id,
      targetUserId: b.targetUserId ? b.targetUserId._id : null,
      remark: b.remark,
      name: b.targetUserId ? b.targetUserId.nickname : '未知用户',
      avatar: b.targetUserId ? b.targetUserId.avatar_url : '',
      phone: b.targetUserId ? b.targetUserId.phone : '',
      createdAt: b.createdAt,
    }));

    res.json({ data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 添加饭搭子（按目标用户 ID）
router.post('/create', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const { targetUserId, remark } = req.body;
    if (!openid || !targetUserId) return res.status(400).json({ error: '缺少必填字段' });

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: '用户不存在' });
    if (targetUser.openid === openid) return res.status(400).json({ error: '不能添加自己' });

    const existing = await Buddy.findOne({ openid, targetUserId });
    if (existing) return res.status(400).json({ error: '该用户已在你的饭搭子列表中' });

    const buddy = await Buddy.create({
      openid,
      targetUserId,
      remark: remark || targetUser.nickname,
    });

    const populated = await Buddy.findById(buddy._id)
      .populate('targetUserId', 'nickname avatar_url phone')
      .lean();

    res.json({
      data: {
        _id: populated._id,
        targetUserId: populated.targetUserId ? populated.targetUserId._id : null,
        remark: populated.remark,
        name: populated.targetUserId ? populated.targetUserId.nickname : '未知用户',
        avatar: populated.targetUserId ? populated.targetUserId.avatar_url : '',
        phone: populated.targetUserId ? populated.targetUserId.phone : '',
        createdAt: populated.createdAt,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 更新饭搭子（仅允许修改备注）
router.put('/update/:id', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '饭搭子不存在' });
    if (buddy.openid !== openid) return res.status(403).json({ error: '无权修改' });

    const { remark } = req.body;
    if (remark !== undefined) buddy.remark = remark.trim();
    await buddy.save();

    const populated = await Buddy.findById(buddy._id)
      .populate('targetUserId', 'nickname avatar_url phone')
      .lean();

    res.json({
      data: {
        _id: populated._id,
        targetUserId: populated.targetUserId ? populated.targetUserId._id : null,
        remark: populated.remark,
        name: populated.targetUserId ? populated.targetUserId.nickname : '未知用户',
        avatar: populated.targetUserId ? populated.targetUserId.avatar_url : '',
        phone: populated.targetUserId ? populated.targetUserId.phone : '',
        createdAt: populated.createdAt,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除饭搭子
router.delete('/delete/:id', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '饭搭子不存在' });
    if (buddy.openid !== openid) return res.status(403).json({ error: '无权删除' });

    await Buddy.findByIdAndDelete(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
