const app = getApp()

Page({
  data: {
    activeTab: 'draw',
    currentGame: null,
    // 抽签
    inputName: '', players: [], drawPhase: 'idle', countdown: 0,
    spinAngle: 0, spinPhase: '', spinRadius: 80, drawWinner: '', humorLine: '',
    ejectStyles: [], ejectLabel: '',
    showDrawBuddy: false, drawBuddySearch: '', drawBuddies: [],
    showGameBuddy: false, gameBuddySearch: '', gameBuddies: [],
    // 鳄鱼
    gameInput: '', gamePlayers: [], teeth: [], currentTurn: 0,
    gameOver: false, gameLoser: '', biting: false, totalTeeth: 14,
    // 海盗
    pirateInput: '', piratePlayers: [], pirateSlots: [], pirateTurn: 0,
    pirateGameOver: false, pirateLoser: '', pirateBoom: false,
    // AA
    aaAmount: '', aaParticipants: [], aaParticipantInput: '',
    aaHistory: [], aaTotal: 0, groupId: 'default-group',
    showAABuddy: false, aaBuddySearch: '', aaBuddies: [],
    gatherings: [], selectedGathering: null, showGatheringPicker: false, currentUser: '我',
    serverUrl: 'http://localhost:2001',
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onShow() {
    this.setData({ serverUrl: app.getServerUrl() })
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo.nickname) this.setData({ currentUser: userInfo.nickname })
  },

  fullUrl(path) {
    if (!path) return ''
    return path.indexOf('http') === 0 ? path : this.data.serverUrl + path
  },
  onUnload() {
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab, currentGame: null })
    if (tab === 'aa') { this.fetchAA(); this.loadGatherings() }
  },

  pickGame(e) {
    this.setData({ currentGame: e.currentTarget.dataset.game })
  },
  backToPicker() {
    this.setData({ currentGame: null })
  },

  /* ========== 通用饭搭子导入 ========== */

  markBuddiesAdded(buddies, list) {
    return buddies.map(b => ({
      ...b,
      added: list.includes(b.name),
      _avatarUrl: b.avatar ? this.fullUrl(b.avatar) : '',
    }))
  },

  openDrawBuddy() {
    this.setData({
      showDrawBuddy: true, drawBuddySearch: '',
      drawBuddies: this.markBuddiesAdded(app.getAcceptedBuddies(), this.data.players),
    })
  },
  closeDrawBuddy() { this.setData({ showDrawBuddy: false }) },
  onDrawBuddySearch(e) {
    const q = e.detail.value
    const all = this.markBuddiesAdded(app.getAcceptedBuddies(), this.data.players)
    this.setData({ drawBuddySearch: q, drawBuddies: all.filter(b => b.name.includes(q)) })
  },
  pickDrawBuddy(e) {
    const name = e.currentTarget.dataset.name
    if (this.data.players.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({
      players: [...this.data.players, name],
      drawBuddies: this.markBuddiesAdded(this.data.drawBuddies, [...this.data.players, name]),
    })
  },

  /* ========== 小游戏饭搭子 ========== */

  getGamePlayerList() {
    const g = this.data.currentGame
    return g === 'croc' ? this.data.gamePlayers : g === 'pirate' ? this.data.piratePlayers : []
  },

  openGameBuddy() {
    this.setData({
      showGameBuddy: true, gameBuddySearch: '',
      gameBuddies: this.markBuddiesAdded(app.getAcceptedBuddies(), this.getGamePlayerList()),
    })
  },
  closeGameBuddy() { this.setData({ showGameBuddy: false }) },
  onGameBuddySearch(e) {
    const q = e.detail.value
    const all = this.markBuddiesAdded(app.getAcceptedBuddies(), this.getGamePlayerList())
    this.setData({ gameBuddySearch: q, gameBuddies: all.filter(b => b.name.includes(q)) })
  },
  pickGameBuddy(e) {
    const name = e.currentTarget.dataset.name
    const game = this.data.currentGame
    const listKey = game === 'croc' ? 'gamePlayers' : game === 'pirate' ? 'piratePlayers' : null
    if (!listKey) return
    if (this.data[listKey].includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    const newList = [...this.data[listKey], name]
    this.setData({
      [listKey]: newList,
      gameBuddies: this.markBuddiesAdded(this.data.gameBuddies, newList),
    })
  },

  openAABuddy() {
    this.setData({
      showAABuddy: true, aaBuddySearch: '',
      aaBuddies: this.markBuddiesAdded(app.getAcceptedBuddies(), this.data.aaParticipants),
    })
  },
  closeAABuddy() { this.setData({ showAABuddy: false }) },
  onAABuddySearch(e) {
    const q = e.detail.value
    const all = this.markBuddiesAdded(app.getAcceptedBuddies(), this.data.aaParticipants)
    this.setData({ aaBuddySearch: q, aaBuddies: all.filter(b => b.name.includes(q)) })
  },
  pickAABuddy(e) {
    const name = e.currentTarget.dataset.name
    if (this.data.aaParticipants.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    const newList = [...this.data.aaParticipants, name]
    this.setData({
      aaParticipants: newList,
      aaBuddies: this.markBuddiesAdded(this.data.aaBuddies, newList),
    })
  },

  goMultiplayer() {
    wx.navigateTo({ url: '/subpackages/room/index' });
  },

  /* ========== 抽签 ========== */

  addPlayer() {
    const name = this.data.inputName.trim()
    if (!name) return
    if (this.data.players.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ players: [...this.data.players, name], inputName: '' })
  },
  removePlayer(e) {
    const { index } = e.currentTarget.dataset
    const players = [...this.data.players]; players.splice(index, 1)
    this.setData({ players, drawPhase: 'idle', drawWinner: '' })
  },
  /* ========== 抽签动画 — 多人在线复刻版 ========== */
  startDraw() {
    if (this.data.drawPhase !== 'idle' && this.data.drawPhase !== 'reveal' && this.data.drawPhase !== '') return
    if (this.data.players.length < 2) { wx.showToast({ title: '至少需要2人', icon: 'none' }); return }
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
    this.setData({ drawPhase: 'countdown', countdown: 3, spinAngle: 0, drawWinner: '', humorLine: '', ejectStyles: [], ejectLabel: '' });
    let count = 3;
    const tick = () => {
      count--;
      if (count > 0) { this.setData({ countdown: count }); this._spinTimer = setTimeout(tick, 800); }
      else { this.setData({ drawPhase: 'spinning' }); this._runSpinAnim(); }
    };
    this._spinTimer = setTimeout(tick, 800);
  },
  resetDraw() {
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
    this.setData({ drawPhase: 'idle', countdown: 0, spinAngle: 0, spinPhase: '', spinRadius: 80, drawWinner: '', humorLine: '', ejectStyles: [], ejectLabel: '' });
  },
  _runSpinAnim() {
    const players = this.data.players;
    if (!players.length) return;
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
    this.setData({ spinAngle: 0, spinPhase: 'accelerate', spinRadius: 150 });
    const startTime = Date.now();
    let angle = 0;
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      let speed, radius, phase;
      if (elapsed < 0.5) {
        speed = (elapsed / 0.5) * 360; radius = 150; phase = 'accelerate';
      } else if (elapsed < 2.0) {
        speed = 540; radius = 150; phase = 'cruise';
      } else if (elapsed < 4.0) {
        const t = (elapsed - 2.0) / 2.0;
        speed = Math.round(540 * (1 - t * 0.6));
        radius = Math.round(150 - 120 * t);
        phase = 'shrink';
      } else {
        this.setData({ spinPhase: 'clustered', spinAngle: angle % 360, spinRadius: 30 });
        this._spinTimer = null;
        this._ejectWinner();
        return;
      }
      angle += speed * 0.016;
      this.setData({ spinAngle: angle, spinPhase: phase, spinRadius: radius });
      this._spinTimer = setTimeout(tick, 16);
    };
    tick();
  },
  _ejectWinner() {
    const players = this.data.players;
    const winner = players.length ? players[Math.floor(Math.random() * players.length)] : '';
    if (!players.length || !winner) return;
    this.setData({
      drawPhase: 'eject',
      ejectStyles: players.map(() => 'transform:translate(0,0);'),
      ejectLabel: '🎯 幸运儿弹出！',
    });
    this._ejectTimer = setTimeout(() => {
      this._ejectTimer = null;
      const flyX = (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 100);
      const flyY = (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 100);
      const flyRotate = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360);
      const finalStyles = players.map(p =>
        p === winner
          ? `transform:translate(${flyX}px,${flyY}px) rotate(${flyRotate}deg) scale(1.4);opacity:0;`
          : 'transform:translate(0,0) scale(0.6);opacity:0.7;'
      );
      const humorLines = ['恭喜成为本局幸运鹅 🦆','今晚这顿安排上了 🍷','这顿饭你请，大家记住你了 😎','运气也是实力的一部分 👏','恭喜中奖！下次继续努力 💪','恭喜成为今晚的「财务大臣」💰','这一顿，值得！🍽️'];
      this.setData({
        ejectStyles: finalStyles,
        ejectLabel: `💥 ${winner} 被撞飞！他就是幸运儿！`,
        drawWinner: winner,
        humorLine: humorLines[Math.floor(Math.random() * humorLines.length)],
      });
      this._ejectTimer = setTimeout(() => {
        this._ejectTimer = null;
        this.setData({ drawPhase: 'reveal' });
      }, 700);
    }, 50);
  },

  /* ========== 鳄鱼 ========== */

  addGamePlayer() {
    const name = this.data.gameInput.trim()
    if (!name) return
    if (this.data.gamePlayers.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ gamePlayers: [...this.data.gamePlayers, name], gameInput: '' })
  },
  removeGamePlayer(e) {
    const { index } = e.currentTarget.dataset
    const list = [...this.data.gamePlayers]; list.splice(index, 1)
    this.setData({ gamePlayers: list })
    if (list.length < 2) this.resetGame()
  },
  startGame() {
    const n = this.data.totalTeeth, dangerIdx = Math.floor(Math.random() * n)
    const teeth = []
    for (let i = 0; i < n; i++) teeth.push({ index: i, isDanger: i === dangerIdx, state: 'active', wiggleDelay: (Math.random() * 0.5).toFixed(2) })
    this.setData({ teeth, currentTurn: 0, gameOver: false, gameLoser: '', biting: false })
  },
  pressTooth(e) {
    if (this.data.gameOver || this.data.biting) return
    const idx = e.currentTarget.dataset.index, teeth = this.data.teeth
    if (teeth[idx].state !== 'active') return
    if (teeth[idx].isDanger) {
      teeth[idx].state = 'danger'
      this.setData({ teeth, gameOver: true, gameLoser: this.data.gamePlayers[this.data.currentTurn], biting: true })
      setTimeout(() => this.setData({ biting: false }), 800)
    } else {
      teeth[idx].state = 'safe'
      this.setData({ teeth, currentTurn: (this.data.currentTurn + 1) % this.data.gamePlayers.length })
    }
  },
  resetGame() { this.setData({ teeth: [], currentTurn: 0, gameOver: false, gameLoser: '', biting: false }) },

  /* ========== 海盗 ========== */

  addPiratePlayer() {
    const name = this.data.pirateInput.trim()
    if (!name) return
    if (this.data.piratePlayers.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ piratePlayers: [...this.data.piratePlayers, name], pirateInput: '' })
  },
  removePiratePlayer(e) {
    const { index } = e.currentTarget.dataset
    const list = [...this.data.piratePlayers]; list.splice(index, 1)
    this.setData({ piratePlayers: list })
    if (list.length < 2) this.resetPirate()
  },
  startPirate() {
    const total = 12, boomIdx = Math.floor(Math.random() * total)
    const slots = []
    for (let i = 0; i < total; i++) slots.push({ index: i, isBoom: i === boomIdx, state: 'empty' })
    this.setData({ pirateSlots: slots, pirateTurn: 0, pirateGameOver: false, pirateLoser: '', pirateBoom: false })
  },
  pressSlot(e) {
    if (this.data.pirateGameOver || this.data.pirateBoom) return
    const idx = e.currentTarget.dataset.index, slots = this.data.pirateSlots
    if (slots[idx].state !== 'empty') return
    if (slots[idx].isBoom) {
      slots[idx].state = 'boom'
      this.setData({ pirateSlots: slots, pirateGameOver: true, pirateLoser: this.data.piratePlayers[this.data.pirateTurn], pirateBoom: true })
    } else {
      slots[idx].state = 'stabbed'
      this.setData({ pirateSlots: slots, pirateTurn: (this.data.pirateTurn + 1) % this.data.piratePlayers.length })
    }
  },
  resetPirate() { this.setData({ pirateSlots: [], pirateTurn: 0, pirateGameOver: false, pirateLoser: '', pirateBoom: false }) },

  /* ========== AA 记账 ========== */

  enrichRecord(r) {
    const ps = r.paidStatus || {}
    const me = this.data.currentUser
    const parts = (r.participants || [])
      .filter(name => name !== me)
      .map(name => ({
        name,
        paidClass: ps[name] ? 'paid' : 'unpaid',
        paidText: ps[name] ? '已A' : '未A',
      }))
    return { ...r, parts }
  },

  addAAParticipant() {
    const name = this.data.aaParticipantInput.trim()
    if (!name) return
    if (this.data.aaParticipants.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ aaParticipants: [...this.data.aaParticipants, name], aaParticipantInput: '' })
  },
  removeAAParticipant(e) {
    const idx = e.currentTarget.dataset.index
    const list = [...this.data.aaParticipants]; list.splice(idx, 1)
    this.setData({ aaParticipants: list })
  },

  /* ========== 聚餐记录选择 ========== */

  loadGatherings() {
    const gs = wx.getStorageSync('gatherings') || []
    this.setData({ gatherings: gs })
  },

  openGatheringPicker() { this.setData({ showGatheringPicker: true }) },
  closeGatheringPicker() { this.setData({ showGatheringPicker: false }) },

  pickGathering(e) {
    const id = e.currentTarget.dataset.id
    const g = this.data.gatherings.find(x => (x._id || x.gathering_id) === id)
    if (!g) return
    const me = this.data.currentUser
    const buddies = (g.participants || []).filter(p => p !== me)
    this.setData({
      selectedGathering: g,
      aaParticipants: buddies,
      aaAmount: String(g.totalCost || ''),
      showGatheringPicker: false,
    })
  },

  clearGathering() {
    this.setData({ selectedGathering: null, aaParticipants: [], aaAmount: '' })
  },

  request(path, method, data) {
    return new Promise((resolve, reject) => {
      const serverUrl = app.globalData.serverUrl || 'http://localhost:2001'
      wx.request({
        url: serverUrl + path,
        method: method || 'GET',
        data: data || {},
        timeout: 5000,
        success: resolve,
        fail: reject,
      })
    })
  },

  async fetchAA() {
    try {
      const res = await this.request('/api/game/aa/next/' + this.data.groupId)
      const body = res.data
      if (!body || !body.data) return
      const d = body.data
      const total = (d.history || []).reduce((s, r) => s + (Number(r.amount) || 0), 0)
      const history = (d.history || []).map(r => this.enrichRecord(r))
      this.setData({ aaHistory: history, aaTotal: total })
    } catch (e) {}
  },

  async submitAA() {
    if (!this.data.aaAmount) { wx.showToast({ title: '请填写金额', icon: 'none' }); return }
    const payer = this.data.currentUser
    const participants = this.data.aaParticipants.filter(p => p !== payer)
    if (participants.length < 1) { wx.showToast({ title: '请添加参与人', icon: 'none' }); return }
    const payload = {
      groupId: this.data.groupId,
      payer,
      participants,
      amount: Number(this.data.aaAmount),
    }
    try {
      const res = await this.request('/api/game/aa/record', 'POST', payload)
      if (res.statusCode !== 200) throw new Error('submit failed')
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' }); return
    }
    const newRecord = this.enrichRecord({ payer, participants: payload.participants, amount: payload.amount, paidStatus: {} })
    this.setData({
      aaHistory: [newRecord, ...this.data.aaHistory],
      aaTotal: this.data.aaTotal + payload.amount,
      aaAmount: '', aaParticipants: [], selectedGathering: null,
    })
    wx.showToast({ title: '已记录' })
    setTimeout(() => this.fetchAA(), 500)
  },

  async togglePaid(e) {
    const { recordid, participant } = e.currentTarget.dataset
    const record = this.data.aaHistory.find(r => r._id === recordid)
    if (!record) return
    const paidStatus = record.paidStatus || {}
    const current = paidStatus[participant]
    const newStatus = !current
    try {
      const res = await this.request('/api/game/aa/update-status', 'POST', {
        recordId: recordid, participant, paid: newStatus,
      })
      if (res.statusCode !== 200) throw new Error('update failed')
    } catch (e) {
      wx.showToast({ title: '修改失败', icon: 'none' }); return
    }
    const history = this.data.aaHistory.map(r => {
      if (r._id !== recordid) return r
      const ps = { ...(r.paidStatus || {}), [participant]: newStatus }
      return this.enrichRecord({ ...r, paidStatus: ps })
    })
    this.setData({ aaHistory: history })
  },
})
