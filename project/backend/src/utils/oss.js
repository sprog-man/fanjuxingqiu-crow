const OSS = require('ali-oss');
const config = require('../config');

let client = null;

function getClient() {
  if (!client) {
    const { region, accessKeyId, accessKeySecret, bucket } = config.oss;
    if (!accessKeyId || !accessKeySecret || !bucket) {
      const err = new Error('OSS 配置不完整，请在 .env 中设置 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET');
      err.code = 'OSS_MISCONFIG';
      throw err;
    }
    client = new OSS({ region, accessKeyId, accessKeySecret, bucket });
  }
  return client;
}

async function uploadBuffer(buffer, ossPath) {
  const c = getClient();
  const result = await c.put(ossPath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  const base = config.oss.baseUrl.replace(/\/+$/, '');
  return base + '/' + ossPath;
}

async function deleteObject(ossPath) {
  try {
    const c = getClient();
    await c.delete(ossPath);
  } catch (e) {
    if (e.code === 'NoSuchKey' || e.code === 'AccessDenied') return;
    throw e;
  }
}

function parsePathFromUrl(url) {
  if (!url) return '';
  const base = config.oss.baseUrl.replace(/\/+$/, '');
  if (url.startsWith(base)) return url.slice(base.length + 1);
  return '';
}

module.exports = { uploadBuffer, deleteObject, parsePathFromUrl, getClient };
