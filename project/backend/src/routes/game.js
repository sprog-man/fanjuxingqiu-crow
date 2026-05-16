const express = require('express');
const router = express.Router();
const AARecord = require('../models/aaRecord');

router.post('/draw', (req, res) => {
  const { participants } = req.body;
  if (!participants || participants.length < 2) {
    return res.status(400).json({ error: '至少需要2人参与' });
  }
  const index = Math.floor(Math.random() * participants.length);
  res.json({ data: { winner: participants[index], participants, index } });
});

router.post('/aa/record', async (req, res) => {
  try {
    const { groupId, payer, participants, amount } = req.body;
    const paidStatus = {};
    (participants || []).forEach(p => { paidStatus[p] = p === payer; });
    const record = await AARecord.create({
      groupId, payer,
      participants: participants || [],
      amount: Number(amount || 0),
      paidStatus,
    });
    res.json({ data: record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/aa/update-status', async (req, res) => {
  try {
    const { recordId, participant, paid } = req.body;
    const record = await AARecord.findById(recordId);
    if (!record) return res.status(404).json({ error: '记录不存在' });
    record.paidStatus.set(participant, paid);
    await record.save();
    res.json({ data: record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/aa/next/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const records = await AARecord.find({ groupId }).sort({ createdAt: -1 }).lean();
    if (records.length === 0) {
      return res.json({ data: { next: null, message: '还没有买单记录' } });
    }
    const lastRecord = records[0];
    const allPayers = [...new Set(records.flatMap(r => r.participants || []))];
    const currentIdx = allPayers.indexOf(lastRecord.payer);
    const nextIdx = (currentIdx + 1) % allPayers.length;
    res.json({ data: { next: allPayers[nextIdx], lastPayer: lastRecord.payer, history: records } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/aa/history/:groupId', async (req, res) => {
  try {
    const records = await AARecord.find({ groupId: req.params.groupId }).sort({ createdAt: -1 }).lean();
    res.json({ data: records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
