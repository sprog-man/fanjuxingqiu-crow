const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const Buddy = require('../models/buddy');
const config = require('../config');
const oss = require('../utils/oss');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
  }
});

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

function generateOssPath(originalname) {
  const ext = path.extname(originalname).toLowerCase() || '.jpg';
  const filename = crypto.randomUUID() + ext;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `buddies/avatars/${year}/${month}/${filename}`;
}

router.get('/list', async (req, res) => {
  try {
    const openid = getOpenid(req);
    if (!openid) return res.status(400).json({ error: '缺少 openid' });
    const buddies = await Buddy.find({ openid }).sort({ createdAt: -1 }).lean();
    res.json({ data: buddies });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const { name, phone } = req.body;
    if (!openid || !name) return res.status(400).json({ error: '缺少必填字段' });
    const buddy = await Buddy.create({ openid, name: name.trim(), phone: phone || '' });
    res.json({ data: buddy });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/update/:id', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '饭搭子不存在' });
    if (buddy.openid !== openid) return res.status(403).json({ error: '无权修改' });
    const { name, phone } = req.body;
    if (name !== undefined) buddy.name = name.trim();
    if (phone !== undefined) buddy.phone = phone;
    await buddy.save();
    res.json({ data: buddy });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    const openid = getOpenid(req);
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '饭搭子不存在' });
    if (buddy.openid !== openid) return res.status(403).json({ error: '无权删除' });
    if (buddy.avatar) {
      const ossPath = oss.parsePathFromUrl(buddy.avatar);
      if (ossPath) await oss.deleteObject(ossPath);
    }
    await Buddy.findByIdAndDelete(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload-avatar/:id', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择图片' });
    const openid = getOpenid(req);
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '饭搭子不存在' });
    if (buddy.openid !== openid) return res.status(403).json({ error: '无权修改' });

    if (buddy.avatar) {
      const oldPath = oss.parsePathFromUrl(buddy.avatar);
      if (oldPath) await oss.deleteObject(oldPath);
    }

    const ossPath = generateOssPath(req.file.originalname);
    const url = await oss.uploadBuffer(req.file.buffer, ossPath);
    buddy.avatar = url;
    await buddy.save();
    res.json({ data: { avatar: url, buddy } });
  } catch (e) {
    if (e.code === 'OSS_MISCONFIG') {
      return res.status(500).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

router.delete('/remove-avatar/:id', async (req, res) => {
  try {
    const buddy = await Buddy.findById(req.params.id);
    if (!buddy) return res.status(404).json({ error: '饭搭子不存在' });
    if (buddy.avatar) {
      const ossPath = oss.parsePathFromUrl(buddy.avatar);
      if (ossPath) await oss.deleteObject(ossPath);
      buddy.avatar = '';
      await buddy.save();
    }
    res.json({ data: { avatar: '' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
