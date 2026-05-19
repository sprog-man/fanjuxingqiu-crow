const express = require('express');
const router = express.Router();
const Invitation = require('../models/invitation');

// 发送邀请
router.post('/invite', async (req, res) => {
  try {
    const { fromOpenid, fromNickname, toOpenid, roomCode } = req.body;
    if (!fromOpenid || !toOpenid || !roomCode) {
      return res.status(400).json({ error: '参数不全' });
    }

    // 5 分钟内已有未处理的邀请 → 不允许重复发
    const recent = await Invitation.findOne({
      fromOpenid, toOpenid, roomCode,
      status: 'pending',
      createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) },
    });
    if (recent) {
      return res.status(400).json({ error: '已发送过邀请，请等待对方处理' });
    }

    const inv = await Invitation.create({ fromOpenid, fromNickname, toOpenid, roomCode });
    res.json({ data: inv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 查询待处理邀请
router.get('/invitations', async (req, res) => {
  try {
    const { openid } = req.query;
    if (!openid) return res.json({ data: [] });

    // 标记超 5 分钟的为过期
    await Invitation.updateMany(
      { toOpenid: openid, status: 'pending', createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
      { status: 'expired' }
    );

    const list = await Invitation.find({ toOpenid: openid })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ data: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 接受邀请
router.post('/invitations/:id/accept', async (req, res) => {
  try {
    const inv = await Invitation.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: '邀请不存在' });
    if (inv.status !== 'pending') return res.status(400).json({ error: '邀请已处理' });
    if (new Date() - inv.createdAt > 5 * 60 * 1000) {
      inv.status = 'expired';
      await inv.save();
      return res.status(400).json({ error: '邀请已过期' });
    }
    inv.status = 'accepted';
    await inv.save();
    res.json({ data: inv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 拒绝邀请
router.post('/invitations/:id/reject', async (req, res) => {
  try {
    const inv = await Invitation.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: '邀请不存在' });
    if (inv.status !== 'pending') return res.status(400).json({ error: '邀请已处理' });
    inv.status = 'rejected';
    await inv.save();
    res.json({ data: inv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
