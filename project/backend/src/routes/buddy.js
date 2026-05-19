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

// 搜索用户（按昵称或饭搭子ID模糊匹配，排除自己）
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ data: [] });

    const openid = getOpenid(req);
    const currentUserId = getUserId(req);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const filter = {
      buddy_id: { $exists: true, $ne: '' },
      $or: [{ nickname: regex }, { buddy_id: regex }],
    };
    if (currentUserId) {
      filter._id = { $ne: currentUserId };
    } else if (openid) {
      filter.openid = { $ne: openid };
    }

    const users = await User.find(filter)
      .select('nickname avatar_url phone openid buddy_id')
      .limit(20)
      .lean();

    // 获取当前用户已发送的申请状态
    const sentRequests = await Buddy.find({ openid, targetUserId: { $in: users.map(u => u._id) } }).lean();
    const requestStatusMap = new Map();
    sentRequests.forEach(r => {
      requestStatusMap.set(r.targetUserId.toString(), {
        status: r.status,
        id: r._id.toString(),
      });
    });

    const result = users.map(u => {
      const reqStatus = requestStatusMap.get(u._id.toString());
      return {
        _id: u._id,
        name: u.nickname,
        avatar: u.avatar_url,
        phone: u.phone,
        openid: u.openid,
        buddy_id: u.buddy_id || '',
        request_status: reqStatus ? reqStatus.status : 'none',
        request_id: reqStatus ? reqStatus.id : null,
      };
    });

    res.json({ data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取饭搭子列表（包含已接受、待审核的申请）
router.get('/list', async (req, res) => {
  try {
    const openid = getOpenid(req);
    if (!openid) return res.status(400).json({ error: '缺少 openid' });

    // 获取当前用户ID
    const currentUser = await User.findOne({ openid }).select('_id').lean();
    if (!currentUser) return res.status(404).json({ error: '用户不存在' });

    // 我发送的申请（包括已接受和待审核的）
    const sentRequests = await Buddy.find({ openid })
      .populate('targetUserId', 'nickname avatar_url phone openid buddy_id')
      .sort({ createdAt: -1 })
      .lean();

    // 我收到的申请（别人添加我的）
    const receivedRequests = await Buddy.find({ targetUserId: currentUser._id })
      .sort({ createdAt: -1 })
      .lean();

    // 查询发送者的用户信息（openid 是发送者，不是 ref，需要手动查）
    const senderOpenids = [...new Set(receivedRequests.map(r => r.openid))];
    const senders = await User.find({ openid: { $in: senderOpenids } })
      .select('nickname avatar_url phone openid buddy_id')
      .lean();
    const senderMap = new Map(senders.map(s => [s.openid, s]));

    // 合并数据
    const buddiesMap = new Map();
    
    // 处理我发送的申请
    for (const b of sentRequests) {
      const targetId = b.targetUserId ? b.targetUserId._id.toString() : null;
      if (!targetId) continue;
      
      buddiesMap.set(targetId, {
        _id: b._id,
        targetUserId: targetId,
        remark: b.remark,
        name: b.targetUserId ? b.targetUserId.nickname : '未知用户',
        avatar: b.targetUserId ? b.targetUserId.avatar_url : '',
        phone: b.targetUserId ? b.targetUserId.phone : '',
        buddy_id: b.targetUserId ? (b.targetUserId.buddy_id || '') : '',
        status: b.status,
        requestMessage: b.requestMessage || '',
        rejectedReason: b.rejectedReason || '',
        createdAt: b.createdAt,
        direction: 'sent',
      });
    }

    // 处理我收到的申请
    for (const b of receivedRequests) {
      const sender = senderMap.get(b.openid);
      if (!sender) continue;
      const senderId = sender._id.toString();

      if (buddiesMap.has(senderId)) {
        const existing = buddiesMap.get(senderId);
        // 双方都有记录，只要有一方 accepted 就算互为饭搭子
        if (b.status === 'accepted' || existing.status === 'accepted') {
          existing.status = 'accepted';
        }
        existing.direction = 'mutual';
      } else {
        buddiesMap.set(senderId, {
          _id: b._id,
          targetUserId: senderId,
          remark: b.remark,
          name: sender.nickname,
          avatar: sender.avatar_url,
          phone: sender.phone,
          buddy_id: sender.buddy_id || '',
          status: b.status,
          requestMessage: b.requestMessage || '',
          rejectedReason: b.rejectedReason || '',
          createdAt: b.createdAt,
          direction: 'received',
        });
      }
    }

    const result = Array.from(buddiesMap.values());
    res.json({ data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 发送饭搭子申请
router.post('/create', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const { targetUserId, remark, requestMessage } = req.body;
    if (!openid || !targetUserId) return res.status(400).json({ error: '缺少必填字段' });

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: '用户不存在' });
    if (targetUser.openid === openid) return res.status(400).json({ error: '不能添加自己' });

    // 检查是否已经发送过申请
    const existing = await Buddy.findOne({ openid, targetUserId });
    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: '该用户已是你的饭搭子' });
      } else if (existing.status === 'pending') {
        return res.status(400).json({ error: '已发送申请，等待对方确认' });
      } else if (existing.status === 'rejected') {
        // 被拒绝后可以重新申请
        existing.status = 'pending';
        existing.remark = remark || targetUser.nickname;
        existing.requestMessage = requestMessage || '';
        existing.rejectedReason = '';
        await existing.save();
        
        const populated = await Buddy.findById(existing._id)
          .populate('targetUserId', 'nickname avatar_url phone buddy_id')
          .lean();
        
        return res.json({
          data: {
            _id: populated._id,
            targetUserId: populated.targetUserId ? populated.targetUserId._id : null,
            remark: populated.remark,
            name: populated.targetUserId ? populated.targetUserId.nickname : '未知用户',
            avatar: populated.targetUserId ? populated.targetUserId.avatar_url : '',
            phone: populated.targetUserId ? populated.targetUserId.phone : '',
            buddy_id: populated.targetUserId ? (populated.targetUserId.buddy_id || '') : '',
            status: 'pending',
            requestMessage: populated.requestMessage || '',
            createdAt: populated.createdAt,
          }
        });
      }
    }

    const buddy = await Buddy.create({
      openid,
      targetUserId,
      remark: remark || targetUser.nickname,
      requestMessage: requestMessage || '',
      status: 'pending',
    });

    const populated = await Buddy.findById(buddy._id)
      .populate('targetUserId', 'nickname avatar_url phone buddy_id')
      .lean();

    res.json({
      data: {
        _id: populated._id,
        targetUserId: populated.targetUserId ? populated.targetUserId._id : null,
        remark: populated.remark,
        name: populated.targetUserId ? populated.targetUserId.nickname : '未知用户',
        avatar: populated.targetUserId ? populated.targetUserId.avatar_url : '',
        phone: populated.targetUserId ? populated.targetUserId.phone : '',
        buddy_id: populated.targetUserId ? (populated.targetUserId.buddy_id || '') : '',
        status: 'pending',
        requestMessage: populated.requestMessage || '',
        createdAt: populated.createdAt,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 接受饭搭子申请
router.put('/accept/:id', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '申请不存在' });
    
    // 获取被申请方用户信息
    const targetUser = await User.findById(buddy.targetUserId);
    if (!targetUser || targetUser.openid !== openid) {
      return res.status(403).json({ error: '无权操作' });
    }

    buddy.status = 'accepted';
    await buddy.save();

    // 同时创建反向关系（互相成为饭搭子）
    const senderUser = await User.findOne({ openid: buddy.openid });
    if (senderUser) {
      const reverseExists = await Buddy.findOne({ 
        openid: targetUser.openid, 
        targetUserId: senderUser._id
      });
      if (!reverseExists) {
        await Buddy.create({
          openid: targetUser.openid,
          targetUserId: senderUser._id,
          remark: senderUser.nickname,
          status: 'accepted',
        });
      }
      // 如果当前用户也发过申请给对方，一并接受（避免双向 pending）
      await Buddy.updateOne(
        { openid: targetUser.openid, targetUserId: senderUser._id, status: 'pending' },
        { $set: { status: 'accepted' } }
      );
    }

    const populated = await Buddy.findById(buddy._id)
      .populate('targetUserId', 'nickname avatar_url phone buddy_id')
      .lean();

    res.json({
      data: {
        _id: populated._id,
        status: 'accepted',
        name: populated.targetUserId ? populated.targetUserId.nickname : '未知用户',
        avatar: populated.targetUserId ? populated.targetUserId.avatar_url : '',
        buddy_id: populated.targetUserId ? (populated.targetUserId.buddy_id || '') : '',
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 拒绝饭搭子申请
router.put('/reject/:id', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const { rejectedReason } = req.body;
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '申请不存在' });
    
    // 获取被申请方用户信息
    const targetUser = await User.findById(buddy.targetUserId);
    if (!targetUser || targetUser.openid !== openid) {
      return res.status(403).json({ error: '无权操作' });
    }

    buddy.status = 'rejected';
    buddy.rejectedReason = rejectedReason || '';
    await buddy.save();

    res.json({
      data: {
        _id: buddy._id,
        status: 'rejected',
        rejectedReason: buddy.rejectedReason,
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
      .populate('targetUserId', 'nickname avatar_url phone buddy_id')
      .lean();

    res.json({
      data: {
        _id: populated._id,
        targetUserId: populated.targetUserId ? populated.targetUserId._id : null,
        remark: populated.remark,
        name: populated.targetUserId ? populated.targetUserId.nickname : '未知用户',
        avatar: populated.targetUserId ? populated.targetUserId.avatar_url : '',
        phone: populated.targetUserId ? populated.targetUserId.phone : '',
        buddy_id: populated.targetUserId ? (populated.targetUserId.buddy_id || '') : '',
        status: populated.status,
        createdAt: populated.createdAt,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除饭搭子（双向清理 + 通知对方）
router.delete('/delete/:id', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '饭搭子不存在' });

    const currentUser = await User.findOne({ openid });
    if (!currentUser) return res.status(404).json({ error: '用户不存在' });

    // 确定对方是谁
    let otherUser;
    if (buddy.openid === openid) {
      otherUser = await User.findById(buddy.targetUserId);
    } else {
      otherUser = await User.findOne({ openid: buddy.openid });
    }
    if (!otherUser) return res.status(404).json({ error: '对方用户不存在' });

    // 1. 删除我发给对方的所有记录
    await Buddy.deleteMany({ openid, targetUserId: otherUser._id });

    // 2. 标记对方发给我的记录为 rejected
    await Buddy.updateMany(
      { openid: otherUser.openid, targetUserId: currentUser._id },
      { $set: { status: 'rejected', rejectedReason: '对方已解除饭搭子关系' } }
    );

    res.json({ data: { deleted: true } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
