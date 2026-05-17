const path = require('path');
const fs = require('fs');
const modulePath = path.join(__dirname, '../project/backend/node_modules');
const OSS = require(modulePath + '/ali-oss');

require(modulePath + '/dotenv/lib/main').config({ path: path.join(__dirname, '../project/backend/.env') });

const config = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  baseUrl: process.env.OSS_BASE_URL || '',
};

if (!config.accessKeyId || !config.accessKeySecret || !config.bucket) {
  console.error('错误: OSS 配置不完整，请检查 .env 文件');
  process.exit(1);
}

const client = new OSS(config);

const tarotDir = path.join(__dirname, '../project/backend/public/images/tarot');

async function uploadDir(localDir, ossPrefix) {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    if (entry.isDirectory()) {
      await uploadDir(localPath, ossPrefix + entry.name + '/');
    } else {
      const ossKey = ossPrefix + entry.name;
      try {
        const result = await client.put(ossKey, localPath);
        const url = config.baseUrl
          ? config.baseUrl + '/' + ossKey
          : result.url;
        console.log(`  OK  ${ossKey}  →  ${url}`);
      } catch (err) {
        console.error(`  FAIL  ${ossKey}: ${err.message}`);
      }
    }
  }
}

(async () => {
  console.log('开始上传 tarot 图片到 OSS...\n');
  await uploadDir(tarotDir, 'tarot/');
  console.log('\n上传完成！');
})();
