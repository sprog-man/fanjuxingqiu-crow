const config = {
  port: process.env.PORT || 2001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/fanjuxingqiu',
  jwtSecret: process.env.JWT_SECRET || 'fanjuxingqiu-dev-secret',
  wechat: {
    appid: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || '',
  },
  admin: {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'fanjuxingqiu2026',
  },
  oss: {
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    baseUrl: process.env.OSS_BASE_URL || '',
  },
};

module.exports = config;
