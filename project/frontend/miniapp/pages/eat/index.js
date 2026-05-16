const app = getApp()

Page({
  data: {
    mode: 'single',
    moods: [],
    cuisines: [],
    selectedMood: null,
    selectedTags: [],
    tagStates: [false, false, false, false, false, false, false, false],
    spinning: false,
    result: null,
    showResult: false,
    voteProgress: { submitted: 0, total: 5 },
    canvasWidth: 280,
    canvasHeight: 280,
    serverUrl: 'http://localhost:2001',
  },

  onLoad() {
    this.fetchMoods()
    this.fetchCuisines()
    this.setData({
      moods: [
        { id: 'celebrate', name: '庆祝', icon: '🎉' },
        { id: 'daily', name: '日常', icon: '☕' },
        { id: 'explore', name: '探店', icon: '🔍' },
        { id: 'relax', name: '解压', icon: '🫂' },
      ],
      cuisines: [
        { id: 'chuan', name: '川菜', icon: '🌶️', color: '#D85A30', tags: ['辣', '麻辣', '重口'] },
        { id: 'yue', name: '粤菜', icon: '🥟', color: '#1D9E75', tags: ['清淡', '鲜美', '精致'] },
        { id: 'ri', name: '日料', icon: '🍣', color: '#534AB7', tags: ['清淡', '生鲜', '精致'] },
        { id: 'han', name: '韩餐', icon: '🥘', color: '#185FA5', tags: ['辣', '重口', '烤肉'] },
        { id: 'xi', name: '西餐', icon: '🥩', color: '#BA7517', tags: ['精致', '牛排', '浪漫'] },
        { id: 'su', name: '素食', icon: '🥗', color: '#1D9E75', tags: ['清淡', '健康', '轻食'] },
      ]
    })
  },

  onReady() {
    this.initCanvas()
  },

  initCanvas() {
    const self = this
    const query = wx.createSelectorQuery()
    query.select('#wheelCanvas').node(res => {
      if (!res || !res.node) {
        // Retry if canvas not ready
        setTimeout(() => self.initCanvas(), 200)
        return
      }
      const canvas = res.node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio
      canvas.width = this.data.canvasWidth * dpr
      canvas.height = this.data.canvasHeight * dpr
      ctx.scale(dpr, dpr)
      this.canvas = canvas
      this.ctx = ctx
      this.drawWheel(0)
    }).exec()
  },

  async fetchMoods() {
    try {
      const res = await wx.request({ url: this.data.serverUrl + '/api/wheel/moods', timeout: 3000 })
      if (res.data && res.data.data) this.setData({ moods: res.data.data })
    } catch (e) { /* already have fallback data */ }
  },

  async fetchCuisines() {
    try {
      const res = await wx.request({ url: this.data.serverUrl + '/api/wheel/cuisines', timeout: 3000 })
      if (res.data && res.data.data) this.setData({ cuisines: res.data.data })
    } catch (e) { /* already have fallback data */ }
  },

  selectMood(e) {
    const { id } = e.currentTarget.dataset
    this.setData({ selectedMood: this.data.selectedMood === id ? null : id })
  },

  toggleTag(e) {
    const { tag } = e.currentTarget.dataset
    const tags = [...this.data.selectedTags]
    const states = [...this.data.tagStates]
    const idx = tags.indexOf(tag)
    if (idx > -1) {
      tags.splice(idx, 1)
      const allTags = ['辣', '清淡', '重口', '鲜美', '精致', '健康', '烤肉', '浪漫']
      states[allTags.indexOf(tag)] = false
    } else {
      tags.push(tag)
      const allTags = ['辣', '清淡', '重口', '鲜美', '精致', '健康', '烤肉', '浪漫']
      states[allTags.indexOf(tag)] = true
    }
    this.setData({ selectedTags: tags, tagStates: states })
  },

  switchMode() {
    this.setData({
      mode: this.data.mode === 'single' ? 'multi' : 'single',
      result: null,
      showResult: false
    })
  },

  drawWheel(rotation) {
    const ctx = this.ctx
    if (!ctx) return
    const w = this.data.canvasWidth
    const h = this.data.canvasHeight
    const cx = w / 2, cy = h / 2
    const r = w / 2 - 10
    const cuisines = this.data.cuisines
    const sliceAngle = (2 * Math.PI) / cuisines.length

    ctx.clearRect(0, 0, w, h)

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    ctx.translate(-cx, -cy)

    cuisines.forEach((c, i) => {
      const startAngle = i * sliceAngle
      const endAngle = startAngle + sliceAngle

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = c.color
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()

      const labelAngle = startAngle + sliceAngle / 2
      const labelR = r * 0.65
      const lx = cx + Math.cos(labelAngle) * labelR
      const ly = cy + Math.sin(labelAngle) * labelR
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(c.name, lx, ly)
    })

    ctx.restore()

    // Center circle
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#DDDDDD'
    ctx.lineWidth = 2
    ctx.stroke()
  },

  spin() {
    if (this.data.spinning) return
    this.setData({ spinning: true, showResult: false })

    const cuisines = this.data.cuisines
    const extraSpins = 3 + Math.floor(Math.random() * 3)
    const userId = app.globalData.userInfo ? app.globalData.userInfo.openid || '' : ''

    wx.request({
      url: this.data.serverUrl + '/api/wheel/spin',
      method: 'POST',
      data: { tags: this.data.selectedTags, userId },
      timeout: 3000,
      success: (res) => {
        const data = res.data.data
        const targetSlice = cuisines.findIndex(c => c.id === data.id)
        if (targetSlice >= 0) {
          const sliceAngle = 360 / cuisines.length
          const targetAngle = extraSpins * 360 + targetSlice * sliceAngle + Math.random() * sliceAngle * 0.3
          const startAngle = this.data.currentAngle || 0
          this.setData({ currentAngle: startAngle + targetAngle })
          this.animateWheel(startAngle, startAngle + targetAngle, () => {
            this.setData({ result: data, showResult: true, spinning: false })
            this.savePreference(data.id, data.tags, userId)
          })
        }
      },
      fail: () => {
        const targetSlice = Math.floor(Math.random() * cuisines.length)
        const sliceAngle = 360 / cuisines.length
        const targetAngle = extraSpins * 360 + targetSlice * sliceAngle + Math.random() * sliceAngle * 0.3
        const startAngle = this.data.currentAngle || 0
        this.setData({ currentAngle: startAngle + targetAngle })
        this.animateWheel(startAngle, startAngle + targetAngle, () => {
          this.setData({ result: cuisines[targetSlice], showResult: true, spinning: false })
        })
      }
    })
  },

  savePreference(cuisineId, tags, userId) {
    if (!userId) return
    wx.request({
      url: this.data.serverUrl + '/api/preference',
      method: 'POST',
      data: { userId, cuisineId, cuisineName: '', tags: tags || this.data.selectedTags },
      timeout: 2000,
    })
    // 本地缓存
    const local = wx.getStorageSync('preferences') || { cuisines: {}, totalSpins: 0 }
    local.cuisines[cuisineId] = (local.cuisines[cuisineId] || 0) + 1
    local.totalSpins++
    wx.setStorageSync('preferences', local)
  },

  animateWheel(fromAngle, toAngle, callback) {
    const duration = 1500
    const startTime = Date.now()
    const self = this

    function animate() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentRotation = fromAngle + (toAngle - fromAngle) * eased

      self.drawWheel(currentRotation * Math.PI / 180)

      if (progress < 1) {
        setTimeout(animate, 16)
      } else {
        callback()
      }
    }
    animate()
  },

  resetSpin() {
    const self = this
    this.setData({
      result: null,
      showResult: false,
      currentAngle: 0
    })
    // Wait for wx:if to recreate canvas DOM, then re-init
    setTimeout(() => {
      self.initCanvas()
    }, 100)
  }
})
