require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('./config');

const app = express();

// === 安全中间件 ===
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: '请求过于频繁，请稍后再试' },
});
app.use('/api', apiLimiter);

// 登录限流（防暴力破解）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试过多，请15分钟后再试' },
});
app.use('/api/admin/login', loginLimiter);

app.use(cors({
  origin: ['http://localhost:2001', 'http://127.0.0.1:2001'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// MongoDB
mongoose.connect(config.mongoUri)
  .then(() => console.log('MongoDB 已连接 →', config.mongoUri))
  .catch(err => console.error('MongoDB 连接失败:', err.message));

// 公开 API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '饭局星球 API', version: '1.0.0', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/wheel', require('./routes/wheel'));
app.use('/api/tarot', require('./routes/tarot'));
app.use('/api/game', require('./routes/game'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/gathering', require('./routes/gathering'));
app.use('/api/relation', require('./routes/relation'));
app.use('/api/map', require('./routes/map'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/preference', require('./routes/preference'));
app.use('/api/buddy', require('./routes/buddy'));
app.use('/api/seed', require('./routes/seed'));

// 管理后台 API（需认证）
app.use('/api/admin', require('./routes/admin'));

// 上传文件静态访问
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// 塔罗图片静态服务（从代码包移出，减轻主包体积）
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// 管理后台前端静态文件
app.use('/admin', express.static(path.join(__dirname, '../../frontend/admin')));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/admin/index.html'));
});

const server = http.createServer(app);
require('./ws')(server);

server.listen(config.port, () => {
  console.log(`饭局星球 → http://localhost:${config.port}`);
  console.log(`  小程序 API   → /api/*（公开）`);
  console.log(`  管理后台     → /admin（认证后使用）`);
});
