// usage: node utils/backup-db.js
// Run from project root: cd D:\my-ai-project\fanjuxingqiu-crow && node utils/backup-db.js
// Requires mongoose installed in project/backend:
//   NODE_PATH=project/backend/node_modules node utils/backup-db.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Resolve mongoose from backend's node_modules
const backendDir = path.resolve(__dirname, '..', 'project', 'backend');
global.process.env.NODE_PATH = (global.process.env.NODE_PATH || '') + path.delimiter + path.join(backendDir, 'node_modules');
require('module').Module._initPaths();

async function backup() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fanjuxingqiu';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const dateStr = new Date().toISOString().slice(0, 10);
  const backupDir = path.resolve(__dirname, '..', 'database', 'backup', dateStr);

  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const summary = { backupTime: new Date().toISOString(), collections: {}, totalRecords: 0 };

  for (const col of collections) {
    const name = col.name;
    const docs = await db.collection(name).find({}).toArray();
    summary.collections[name] = docs.length;
    summary.totalRecords += docs.length;
    fs.writeFileSync(path.join(backupDir, name + '.json'), JSON.stringify(docs, null, 2), 'utf8');
    console.log('  ' + name + ': ' + docs.length + ' docs');
  }

  fs.writeFileSync(path.join(backupDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log('\nBackup saved to: ' + backupDir);
  console.log('Total records: ' + summary.totalRecords);
  await mongoose.disconnect();
}

backup().catch(e => { console.error('Backup failed:', e); process.exit(1); });
