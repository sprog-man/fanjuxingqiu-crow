const app = getApp()

Page({
  data: {
    activeTab: 'draw',
    currentGame: null,
    // 抽签
    inputName: '', players: [], drawResult: null, drawing: false, drawIndex: -1,
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
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo.nickname) this.setData({ currentUser: userInfo.nickname })
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

  openDrawBuddy() {
    this.setData({
      showDrawBuddy: true, drawBuddySearch: '',
      drawBuddies: app.getBuddies(),
    })
  },
  closeDrawBuddy() { this.setData({ showDrawBuddy: false }) },
  onDrawBuddySearch(e) {
    const q = e.detail.value
    this.setData({ drawBuddySearch: q, drawBuddies: app.getBuddies().filter(b => b.name.includes(q)) })
  },
  pickDrawBuddy(e) {
    const name = e.currentTarget.dataset.name
    if (this.data.players.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ players: [...this.data.players, name] })
  },

  /* ========== 小游戏饭搭子 ========== */

  openGameBuddy() {
    this.setData({
      showGameBuddy: true, gameBuddySearch: '',
      gameBuddies: app.getBuddies(),
    })
  },
  closeGameBuddy() { this.setData({ showGameBuddy: false }) },
  onGameBuddySearch(e) {
    const q = e.detail.value
    this.setData({ gameBuddySearch: q, gameBuddies: app.getBuddies().filter(b => b.name.includes(q)) })
  },
  pickGameBuddy(e) {
    const name = e.currentTarget.dataset.name
    const game = this.data.currentGame
    if (game === 'croc') {
      if (this.data.gamePlayers.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
      this.setData({ gamePlayers: [...this.data.gamePlayers, name] })
    } else if (game === 'pirate') {
      if (this.data.piratePlayers.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
      this.setData({ piratePlayers: [...this.data.piratePlayers, name] })
    }
  },

  openAABuddy() {
    this.setData({
      showAABuddy: true, aaBuddySearch: '',
      aaBuddies: app.getBuddies(),
    })
  },
  closeAABuddy() { this.setData({ showAABuddy: false }) },
  onAABuddySearch(e) {
    const q = e.detail.value
    this.setData({ aaBuddySearch: q, aaBuddies: app.getBuddies().filter(b => b.name.includes(q)) })
  },
  pickAABuddy(e) {
    const name = e.currentTarget.dataset.name
    if (this.data.aaParticipants.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ aaParticipants: [...this.data.aaParticipants, name] })
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
    this.setData({ players, drawResult: null })
  },
  startDraw() {
    if (this.data.drawing) return
    if (this.data.players.length < 2) { wx.showToast({ title: '至少需要2人', icon: 'none' }); return }
    this.setData({ drawing: true, drawResult: null })
    const players = this.data.players, total = 6 + players.length
    let cycle = 0
    const self = this
    function run() {
      if (cycle >= total) {
        const w = Math.floor(Math.random() * players.length)
        self.setData({ drawResult: players[w], drawing: false, drawIndex: -1 }); return
      }
      self.setData({ drawIndex: cycle % players.length })
      cycle++
      setTimeout(run, 60 + (cycle / total) ** 2 * 240)
    }
    run()
  },
  resetDraw() { this.setData({ drawResult: null, drawing: false, drawIndex: -1 }) },

  /* ========== 鳄鱼 ========== */

  addGamePlayer() {
    const name = this.data.gameInput.trim()
    if (!name) return
    if (this.data.gamePlayers.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ gamePlayers: [...this.data.gamePlayers, name], gameInput: '' })
    if (this.data.gamePlayers.length >= 2 && !this.data.teeth.length) this.startGame()
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
    if (this.data.piratePlayers.length >= 2 && !this.data.pirateSlots.length) this.startPirate()
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
    const parts = (r.participants || []).map(name => ({
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
    this.setData({
      selectedGathering: g,
      aaParticipants: g.participants || [],
      aaAmount: String(g.totalCost || ''),
      showGatheringPicker: false,
    })
  },

  clearGathering() {
    this.setData({ selectedGathering: null, aaParticipants: [], aaAmount: '' })
  },

  request(url, method, data) {
    return new Promise((resolve, reject) => {
      wx.request({
        url, method: method || 'GET', data: data || {},
        timeout: 5000, success: resolve, fail: reject,
      })
    })
  },

  async fetchAA() {
    try {
      const res = await this.request(this.data.serverUrl + '/api/game/aa/next/' + this.data.groupId)
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
    if (this.data.aaParticipants.length < 1) { wx.showToast({ title: '请添加参与人', icon: 'none' }); return }
    const payer = this.data.currentUser
    const payload = {
      groupId: this.data.groupId,
      payer,
      participants: this.data.aaParticipants,
      amount: Number(this.data.aaAmount),
    }
    try {
      const res = await this.request(this.data.serverUrl + '/api/game/aa/record', 'POST', payload)
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
      const res = await this.request(this.data.serverUrl + '/api/game/aa/update-status', 'POST', {
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
