const app = getApp()

Page({
  data: {
    friends: [],
    detailFriend: null,
    serverUrl: 'http://localhost:2001',
    canvasW: 375,
    canvasH: 440,
  },

  onLoad() {
    this.loadGraph()
  },

  onUnload() {
    if (this._animTimer) clearTimeout(this._animTimer)
  },

  loadGraph() {
    wx.request({
      url: this.data.serverUrl + '/api/relation/graph',
      timeout: 3000,
      success: (res) => {
        const data = res.data.data
        this.setData({ friends: this._normalize(data.friends || []) })
        this.initGraph(data)
      },
      fail: () => {
        const local = wx.getStorageSync('gatherings') || []
        const data = this._computeLocal(local)
        this.setData({ friends: this._normalize(data.friends || []) })
        this.initGraph(data)
      }
    })
  },

  _normalize(friends) {
    return (friends || []).map(f => ({ ...f, initial: f.name ? f.name.slice(0, 1) : '?' }))
  },

  _computeLocal(gatherings) {
    const userId = '我'
    const friendMap = {}
    const realmGatherings = gatherings.filter(g => {
      const p = g.participants || []; return p.includes(userId) || g.creatorId === userId
    })
    realmGatherings.forEach(g => {
      ;(g.participants || []).forEach(p => {
        if (p === userId) return
        if (!friendMap[p]) friendMap[p] = { name: p, gatherCount: 0, cities: new Set(), cuisines: new Set(), totalSpent: 0, moods: [], moodScores: [], payCount: 0, newPlaces: new Set() }
        const fr = friendMap[p]; fr.gatherCount++
        if (g.location && g.location.city) fr.cities.add(g.location.city)
        if (g.foodTags) g.foodTags.forEach(t => fr.cuisines.add(t))
        if (g.moodTags) fr.moods.push(...g.moodTags)
        if (g.moodScore) fr.moodScores.push(g.moodScore)
        if (g.totalCost) fr.totalSpent += g.totalCost / Math.max(g.participants.length - 1, 1)
        if (g.location && g.location.name) fr.newPlaces.add(g.location.name)
      })
    })
    const payCounts = {}
    realmGatherings.forEach(g => { if (g.payer && g.payer !== userId) payCounts[g.payer] = (payCounts[g.payer] || 0) + 1 })
    const maxPay = Math.max(...Object.values(payCounts), 0)
    const friends = Object.entries(friendMap).map(([name, data]) => {
      const cc = data.cities.size, cuc = data.cuisines.size
      const hc = data.moods.filter(m => m === '开心' || m === '搞笑').length
      const ma = data.moodScores.length > 0 ? data.moodScores.reduce((a, b) => a + b, 0) / data.moodScores.length : 0
      const ar = Math.min(1, data.gatherCount / Math.max(realmGatherings.length, 1))
      const pr = payCounts[name] === maxPay && maxPay > 0 ? 1 : 0
      const nc = data.newPlaces.size
      let title = '新晋饭友', level = '⭐', desc = '才刚开始的缘分，未来可期'
      if (data.gatherCount >= 8) { title = '灵魂饭搭'; level = '⭐⭐⭐⭐⭐'; desc = '形影不离，吃遍人间的默契伙伴' }
      else if (cuc >= 6) { title = '美食同谋'; level = '⭐⭐⭐⭐'; desc = '跨越菜系国界的猎奇探险搭档' }
      else if (cc >= 3) { title = '流浪美食家'; level = '⭐⭐⭐⭐'; desc = '走遍山河，用胃丈量世界的同行者' }
      else if (pr === 1) { title = '饭局天王'; level = '⭐⭐⭐'; desc = '财大气粗、豪气干云的聚餐主理人' }
      else if (hc >= 3) { title = '快乐搭档'; level = '⭐⭐⭐'; desc = '每次相聚都欢声笑语的开心果' }
      else if (ar >= 0.9) { title = '聚会核心'; level = '⭐⭐⭐'; desc = '永远准时出现，缺了你就不热闹' }
      else if (nc >= 3) { title = '探店达人'; level = '⭐⭐'; desc = '总能发现隐藏小馆子的行走攻略' }
      else if (ma >= 4) { title = '气氛组长'; level = '⭐⭐'; desc = '点菜必点对，聊天必起哄的妙人' }
      else if (data.gatherCount >= 1) { title = '偶遇旅人'; level = '⭐'; desc = '命运让我们共桌，期待下一次相逢' }
      let color = '#5F5E5A'
      if (level === '⭐⭐⭐⭐⭐') color = '#FFD700'
      else if (level === '⭐⭐⭐⭐') color = '#D85A30'
      else if (level === '⭐⭐⭐') color = '#D85A30'
      else if (level === '⭐⭐') color = '#185FA5'
      return { name, gatherCount: data.gatherCount, cities: [...data.cities], totalSpent: Math.round(data.totalSpent), title, level, desc, color }
    })
    friends.sort((a, b) => b.gatherCount - a.gatherCount)
    return { user: { name: userId }, friends }
  },

  /* ============= Init ============= */

  initGraph(data) {
    const query = wx.createSelectorQuery()
    query.select('#graphCanvas').node(res => {
      if (!res || !res.node) return
      const canvas = res.node, ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio
      const w = this.data.canvasW, h = this.data.canvasH
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.scale(dpr, dpr)
      this.canvas = canvas; this.ctx = ctx; this.dpr = dpr

      wx.createSelectorQuery().select('#graphCanvas').boundingClientRect(r => { this._canvasRect = r }).exec()
      this._buildNodes(data, w, h)
      this._buildStars(w, h)
      this._buildFlows()
      this._animFrame()
    }).exec()
  },

  _buildNodes(data, w, h) {
    const cx = w / 2, cy = h / 2 - 10
    const friends = data.friends || []
    const radius = Math.min(cx, cy) - 55

    const nodes = [{
      name: data.user.name || '我', x: cx, y: cy, r: 34,
      color: '#D85A30', borderColor: '#FFD700',
      isCenter: true, level: '⭐⭐⭐⭐⭐', size: 34,
      initial: (data.user.name || '我').slice(0, 1),
    }]

    friends.forEach((f, i) => {
      const angle = (i / Math.max(friends.length, 1)) * 2 * Math.PI - Math.PI / 2
      const nr = Math.max(22, Math.min(36, 16 + f.gatherCount * 1.6))
      const bc = this._borderColor(f.level)
      nodes.push({
        name: f.name, initial: f.name.slice(0, 1),
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: nr, color: f.color, borderColor: bc,
        gatherCount: f.gatherCount, title: f.title,
        desc: f.desc, level: f.level,
        totalSpent: f.totalSpent, cities: f.cities || [],
        idx: nodes.length, drag: false,
        ox: cx + Math.cos(angle) * radius,
        oy: cy + Math.sin(angle) * radius,
      })
    })
    this.nodeList = nodes
    this.lines = []
    for (let i = 1; i < nodes.length; i++) {
      this.lines.push({ from: nodes[0], to: nodes[i] })
    }
    this.animTime = 0
    this.dragNode = null
    this.dragOffX = 0; this.dragOffY = 0
  },

  _borderColor(level) {
    if (level === '⭐⭐⭐⭐⭐') return '#FFD700'
    if (level === '⭐⭐⭐⭐') return '#D85A30'
    if (level === '⭐⭐⭐') return '#FF8C5A'
    if (level === '⭐⭐') return '#5AB0FF'
    return '#8A8A8A'
  },

  _buildStars(w, h) {
    this.stars = []
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.5 + Math.random() * 1.5,
        a: 0.2 + Math.random() * 0.5,
        s: 0.5 + Math.random() * 1.5,
      })
    }
  },

  _buildFlows() {
    this.flows = []
    this.lines.forEach((line, i) => {
      this.flows.push({
        lineIdx: i, progress: Math.random(),
        speed: 0.003 + Math.random() * 0.005,
        r: 1.5 + Math.random() * 1.5,
      })
    })
  },

  _animFrame() {
    this.animTime += 0.025
    this._draw()
    this._animTimer = setTimeout(() => this._animFrame(), 33)
  },

  /* ============= Draw ============= */

  _draw() {
    const ctx = this.ctx
    if (!ctx) return
    const w = this.data.canvasW, h = this.data.canvasH
    const t = this.animTime

    ctx.clearRect(0, 0, w, h)

    this._drawBG(ctx, w, h)
    this._drawStars(ctx, t)
    this._drawLines(ctx, t)
    this._drawFlows(ctx, t)
    this._drawNodes(ctx, t)
  },

  _drawBG(ctx, w, h) {
    const grad = ctx.createRadialGradient(w / 2, h / 2 - 10, 10, w / 2, h / 2 - 10, w * 0.7)
    grad.addColorStop(0, '#1a1a2e')
    grad.addColorStop(0.5, '#16213e')
    grad.addColorStop(1, '#0f0f1a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  },

  _drawStars(ctx, t) {
    this.stars.forEach(s => {
      const flicker = s.a * (0.6 + 0.4 * Math.sin(t * s.s + s.x))
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255,255,255,${flicker})`
      ctx.fill()
    })
  },

  _drawLines(ctx, t) {
    this.lines.forEach((line, li) => {
      const f = line.from, to = line.to
      const th = Math.min(2.5, 0.8 + (to.gatherCount || 0) * 0.2)
      const alpha = 0.15 + 0.2 * (0.6 + 0.4 * Math.sin(t * 1.2 + li))

      const cpx = (f.x + to.x) / 2 + (to.y - f.y) * 0.12
      const cpy = (f.y + to.y) / 2 - (to.x - f.x) * 0.12

      ctx.beginPath()
      ctx.moveTo(f.x, f.y)
      ctx.quadraticCurveTo(cpx, cpy, to.x, to.y)
      ctx.strokeStyle = `rgba(180,160,255,${alpha})`
      ctx.lineWidth = th
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(f.x, f.y)
      ctx.quadraticCurveTo(cpx, cpy, to.x, to.y)
      ctx.strokeStyle = `rgba(120,100,220,${alpha * 0.5})`
      ctx.lineWidth = th + 3
      ctx.stroke()
    })
  },

  _drawFlows(ctx, t) {
    this.flows.forEach(fl => {
      const line = this.lines[fl.lineIdx]
      if (!line) return
      fl.progress += fl.speed
      if (fl.progress > 1) fl.progress = 0

      const f = line.from, to = line.to
      const cpx = (f.x + to.x) / 2 + (to.y - f.y) * 0.12
      const cpy = (f.y + to.y) / 2 - (to.x - f.x) * 0.12
      const pr = fl.progress
      const t1 = 1 - pr
      const px = t1 * t1 * f.x + 2 * t1 * pr * cpx + pr * pr * to.x
      const py = t1 * t1 * f.y + 2 * t1 * pr * cpy + pr * pr * to.y

      const glow = ctx.createRadialGradient(px, py, 0, px, py, fl.r + 4)
      glow.addColorStop(0, 'rgba(200,180,255,0.8)')
      glow.addColorStop(0.5, 'rgba(200,180,255,0.3)')
      glow.addColorStop(1, 'rgba(200,180,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, py, fl.r + 4, 0, 2 * Math.PI)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(px, py, fl.r, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fill()
    })
  },

  _drawNodes(ctx, t) {
    this.nodeList.forEach((node, i) => {
      if (node.isCenter) {
        this._drawCenterNode(ctx, node, t, i)
      } else {
        this._drawFriendNode(ctx, node, t, i)
      }
    })
  },

  _drawCenterNode(ctx, node, t, i) {
    const pulse = 1 + 0.03 * Math.sin(t * 2 + i)

    // Outer glow rings
    for (let g = 4; g > 0; g--) {
      const gr = node.r * pulse + g * 10 + 6 * Math.sin(t * 2.5 + g)
      ctx.beginPath()
      ctx.arc(node.x, node.y, gr, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255,215,0,${0.04 - g * 0.008})`
      ctx.fill()
    }

    // Orbital ring
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.r + 14 + 4 * Math.sin(t * 1.5), 0, 2 * Math.PI)
    ctx.strokeStyle = `rgba(255,215,0,${0.12 + 0.06 * Math.sin(t * 2)})`
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 8])
    ctx.stroke()
    ctx.setLineDash([])

    // Core gradient
    const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * pulse)
    grad.addColorStop(0, '#FF6B3D')
    grad.addColorStop(0.5, '#D85A30')
    grad.addColorStop(1, '#A04020')
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.r * pulse, 0, 2 * Math.PI)
    ctx.fillStyle = grad
    ctx.shadowColor = 'rgba(216,90,48,0.5)'
    ctx.shadowBlur = 20
    ctx.fill()
    ctx.shadowBlur = 0

    // Border
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.r * pulse, 0, 2 * Math.PI)
    ctx.strokeStyle = 'rgba(255,215,0,0.6)'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Name
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(node.name, node.x, node.y)

    // Glint
    ctx.beginPath()
    ctx.arc(node.x - node.r * 0.35, node.y - node.r * 0.35, 3, 0, 2 * Math.PI)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fill()
  },

  _drawFriendNode(ctx, node, t, i) {
    const pulse = 1 + 0.03 * Math.sin(t * 1.8 + i * 1.2)
    const nr = node.r * pulse

    // Outer glow
    for (let g = 2; g > 0; g--) {
      const gr = nr + g * 7 + 3 * Math.sin(t * 2 + i)
      ctx.beginPath()
      ctx.arc(node.x, node.y, gr, 0, 2 * Math.PI)
      ctx.fillStyle = `rgba(255,255,255,${0.015})`
      ctx.fill()
    }

    // Light ring (like 王者荣耀 constellation ring)
    ctx.beginPath()
    ctx.arc(node.x, node.y, nr + 6 + 2 * Math.sin(t * 1.3 + i), 0, 2 * Math.PI)
    ctx.strokeStyle = `rgba(200,180,255,${0.08 + 0.05 * Math.sin(t * 1.5 + i)})`
    ctx.lineWidth = 1
    ctx.stroke()

    // Node body with gradient
    const grad = ctx.createRadialGradient(node.x - nr * 0.3, node.y - nr * 0.3, 0, node.x, node.y, nr)
    grad.addColorStop(0, this._lighten(node.color, 0.35))
    grad.addColorStop(0.6, node.color)
    grad.addColorStop(1, this._darken(node.color, 0.2))
    ctx.beginPath()
    ctx.arc(node.x, node.y, nr, 0, 2 * Math.PI)
    ctx.fillStyle = grad
    ctx.shadowColor = this._hexToRgba(node.color, 0.3)
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0

    // Border glow
    ctx.beginPath()
    ctx.arc(node.x, node.y, nr, 0, 2 * Math.PI)
    ctx.strokeStyle = node.borderColor
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2 + i)
    ctx.stroke()
    ctx.globalAlpha = 1

    // Initial
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.min(14, nr * 0.55)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(node.initial, node.x, node.y)

    // Gather count badge
    if (node.gatherCount) {
      const badgeR = 10
      const bx = node.x + nr * 0.6
      const by = node.y - nr * 0.6
      ctx.beginPath()
      ctx.arc(bx, by, badgeR, 0, 2 * Math.PI)
      ctx.fillStyle = node.color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 8px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(node.gatherCount), bx, by)
    }

    // Name label below node
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(node.name, node.x, node.y + nr + 6)
  },

  /* ============= Touch / Drag / Tap ============= */

  _getTouchPos(e) {
    if (e.detail && e.detail.x !== undefined) return { x: e.detail.x, y: e.detail.y }
    const touch = e.touches ? e.touches[0] : e.changedTouches[0]
    if (touch.x !== undefined) return { x: touch.x, y: touch.y }
    if (touch.clientX !== undefined) {
      const rect = this._canvasRect || { left: 0, top: 0 }
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: 0, y: 0 }
  },

  _hitTest(x, y) {
    for (let i = this.nodeList.length - 1; i >= 0; i--) {
      const n = this.nodeList[i]
      const dx = x - n.x, dy = y - n.y
      if (dx * dx + dy * dy <= (n.r + 12) * (n.r + 12)) return n
    }
    return null
  },

  onTouchStart(e) {
    const pos = this._getTouchPos(e)
    const node = this._hitTest(pos.x, pos.y)
    if (node && !node.isCenter) {
      this.dragNode = node
      this.dragOffX = pos.x - node.x
      this.dragOffY = pos.y - node.y
    } else {
      this._tapPos = pos
    }
  },

  onTouchMove(e) {
    if (!this.dragNode) return
    const pos = this._getTouchPos(e)
    this.dragNode.x = pos.x - this.dragOffX
    this.dragNode.y = pos.y - this.dragOffY
  },

  onTouchEnd(e) {
    if (this.dragNode) { this.dragNode = null; return }

    const pos = this._getTouchPos(e)
    if (this._tapPos) {
      const dx = pos.x - this._tapPos.x, dy = pos.y - this._tapPos.y
      if (dx * dx + dy * dy < 100) {
        const hit = this._hitTest(pos.x, pos.y)
        if (hit && !hit.isCenter) {
          const friend = this.data.friends.find(f => f.name === hit.name)
          if (friend) this.setData({ detailFriend: friend })
        }
      }
      this._tapPos = null
    }
  },

  showDetail(e) {
    const name = e.currentTarget.dataset.name
    const friend = this.data.friends.find(f => f.name === name)
    if (friend) this.setData({ detailFriend: friend })
  },

  closeDetail() {
    this.setData({ detailFriend: null })
  },

  preventClose() {},

  _lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.min(255, ((n >> 16) & 0xFF) + Math.floor(255 * amt))
    const g = Math.min(255, ((n >> 8) & 0xFF) + Math.floor(255 * amt))
    const b = Math.min(255, (n & 0xFF) + Math.floor(255 * amt))
    return `rgb(${r},${g},${b})`
  },

  _darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.floor(((n >> 16) & 0xFF) * (1 - amt))
    const g = Math.floor(((n >> 8) & 0xFF) * (1 - amt))
    const b = Math.floor((n & 0xFF) * (1 - amt))
    return `rgb(${r},${g},${b})`
  },

  _hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 0xFF},${(n >> 8) & 0xFF},${n & 0xFF},${a})`
  },
})
