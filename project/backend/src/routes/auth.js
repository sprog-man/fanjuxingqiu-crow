const express = require('express');
const jwt = require('jsonwebtoken');
const https = require('https');
const router = express.Router();
const config = require('../config');
const User = require('../models/user');

// 生成唯一饭搭子ID
function generateBuddyId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 微信登录（支持开发环境 mock）
router.post('/login', async (req, res) => {
  try {
    const { code, nickName, avatarUrl, savedOpenid } = req.body;

    let openid;
    if (config.wechat.appid && config.wechat.secret && code !== 'dev_mode') {
      // 真实微信登录
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wechat.appid}&secret=${config.wechat.secret}&js_code=${code}&grant_type=authorization_code`;
      const wxRes = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      if (wxRes.errcode) {
        return res.status(400).json({ error: '微信登录失败: ' + wxRes.errmsg });
      }
      openid = wxRes.openid;
    } else {
      // 开发模式 mock — 优先使用已保存的 openid，确保同一用户登录稳定
      openid = savedOpenid || ('dev_' + (code || 'mock') + '_' + Date.now());
    }

    // 查找或创建用户
    let user = await User.findOne({ openid });
    if (!user) {
      // 生成唯一饭搭子ID
      let buddyId = generateBuddyId();
      while (await User.findOne({ buddy_id: buddyId })) {
        buddyId = generateBuddyId();
      }
      user = await User.create({
        openid,
        nickname: nickName || '微信用户',
        avatar_url: avatarUrl || '',
        buddy_id: buddyId,
      });
    } else {
      // 每次登录都更新头像昵称（如果有新值）
      if (nickName) user.nickname = nickName;
      if (avatarUrl) user.avatar_url = avatarUrl;
      // 如果没有饭搭子ID，生成一个
      if (!user.buddy_id) {
        let buddyId = generateBuddyId();
        while (await User.findOne({ buddy_id: buddyId })) {
          buddyId = generateBuddyId();
        }
        user.buddy_id = buddyId;
      }
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id.toString(), openid: user.openid, role: 'user' },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      data: {
        token,
        user: {
          id: user._id,
          openid: user.openid,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          buddy_id: user.buddy_id,
          preference_tags: user.preference_tags,
        }
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 更新用户资料
router.put('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: '未登录' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const { nickName, avatarUrl, preferenceTags } = req.body;
    const update = {};
    if (nickName) update.nickname = nickName;
    if (avatarUrl) update.avatar_url = avatarUrl;
    if (preferenceTags) update.preference_tags = preferenceTags;

    const user = await User.findByIdAndUpdate(decoded.userId, update, { new: true });
    res.json({ data: user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
