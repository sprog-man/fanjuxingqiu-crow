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

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:2001,http://127.0.0.1:2001,https://sprog-man.fanjuxingqiu.ccwu.cc').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// MongoDB 连接配置
const mongoOptions = {
  serverSelectionTimeoutMS: 5000, // 5秒连接超时
  socketTimeoutMS: 45000,        // 45秒socket超时
  retryWrites: true,
  w: 'majority'
};

// MongoDB 连接状态监控
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB 已连接');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB 连接错误:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB 已断开连接');
});

// 建立连接
mongoose.connect(config.mongoUri, mongoOptions)
  .then(() => {
    // 安全地隐藏密码后打印
    const safeUri = config.mongoUri
      .replace(/:([^:@/]+)@/, ':***@')  // 替换 password@ 部分
      .replace(/\/\/[^:]+:[^@]+@/, '//***@'); // 替换 user:password@ 部分
    console.log('🔗 MongoDB 正在连接 →', safeUri);
  })
  .catch(err => {
    console.error('💥 MongoDB 初始连接失败:', err.message);
    console.error('💥 请检查 MONGO_URI 环境变量是否正确配置');
  });

// 公开 API - 增强版健康检查
app.get('/api/health', (req, res) => {
  const state = mongoose.connection.readyState;
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: 'ok', 
    service: '饭局星球 API', 
    version: '1.0.0', 
    db: stateMap[state] || 'unknown',
    dbState: state,
    timestamp: new Date().toISOString()
  });
});

// 临时调试接口（上线前删除！）
app.get('/api/debug/env', (req, res) => {
  const mongoUri = process.env.MONGO_URI || 'NOT_SET';
  res.json({
    MONGO_URI_EXISTS: !!process.env.MONGO_URI,
    MONGO_URI_PREFIX: mongoUri.substring(0, 30) + '...',
    MONGO_URI_LENGTH: mongoUri.length,
    NODE_ENV: process.env.NODE_ENV || 'not set',
    ALL_ENV_KEYS: Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('mongo'))
  });
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
