const app = getApp()

Page({
  data: {
    albums: [], selectedAlbum: null, selectedIndex: 0, aiMemory: '',
    albumDate: '', albumLocation: '', albumAvgCost: 0, albumStars: '',
    coverColors: ['#D85A30', '#1D9E75', '#534AB7', '#185FA5', '#BA7517', '#2C2C2A'],
    serverUrl: 'http://localhost:2001',
    showCoverPicker: false,
  },

  onShow() {
    this.setData({ serverUrl: app.getServerUrl() })
    this.fetchAlbums()
  },

  fetchAlbums() {
    wx.request({
      url: this.data.serverUrl + '/api/gathering/list?limit=50',
      timeout: 3000,
      success: (res) => this.setData({ albums: res.data.data.items || [] }),
      fail: () => {
        const local = wx.getStorageSync('gatherings') || []
        this.setData({ albums: local })
      }
    })
  },

  getCover(album) {
    let url = ''
    if (album.cover) url = album.cover
    else if (album.photos && album.photos.length) url = album.photos[0]
    else return ''
    if (url.startsWith('/')) url = this.data.serverUrl + url
    return url
  },

  fullUrl(path) {
    if (!path) return ''
    return path.startsWith('http') ? path : this.data.serverUrl + path
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
  },

  openAlbum(e) {
    const { index } = e.currentTarget.dataset
    const album = this.data.albums[index]
    const participants = album.participants || []
    const loc = album.location || {}
    const avgCost = participants.length ? Math.round(album.totalCost / participants.length) : 0
    const stars = album.moodScore ? '★'.repeat(album.moodScore) : ''
    this.setData({
      selectedAlbum: album, selectedIndex: index, aiMemory: '',
      albumDate: this.formatDate(album.dateTime),
      albumLocation: loc.name || '',
      albumAvgCost: avgCost,
      albumStars: stars,
      showCoverPicker: false,
    })
    this.generateMemory()
  },

  previewPhoto(e) {
    const { url } = e.currentTarget.dataset
    const photos = (this.data.selectedAlbum.photos || []).map(p => this.fullUrl(p))
    wx.previewImage({ current: url, urls: photos })
  },

  closeAlbum() { this.setData({ selectedAlbum: null, showCoverPicker: false }) },

  generateMemory() {
    const g = this.data.selectedAlbum
    if (!g) return
    this.setData({ aiMemory: '生成中...' })
    wx.request({
      url: this.data.serverUrl + '/api/ai/memory',
      method: 'POST',
      data: {
        title: g.title, participants: g.participants, location: g.location,
        moodScore: g.moodScore, moodTags: g.moodTags, note: g.note,
        foodTags: g.foodTags, totalCost: g.totalCost
      },
      timeout: 3000,
      success: (res) => this.setData({ aiMemory: res.data.data.memory }),
      fail: () => {
        const fallbacks = [
          `${g.title}那天，大家聚在${(g.location && g.location.name) || '一起'}，度过了一段美好的时光。`,
          `和${(g.participants || []).slice(0,2).join('、')}一起的${g.title}，美食与欢笑，就是最好的时光。`
        ]
        this.setData({ aiMemory: fallbacks[Math.floor(Math.random() * fallbacks.length)] })
      }
    })
  },

  // --- 封面管理 ---
  showCoverSelector() {
    const album = this.data.selectedAlbum
    if (!album || !album.photos || album.photos.length === 0) {
      wx.showToast({ title: '当前相册没有照片', icon: 'none' })
      return
    }
    this.setData({ showCoverPicker: true })
  },

  closeCoverPicker() {
    this.setData({ showCoverPicker: false })
  },

  selectCover(e) {
    const url = e.currentTarget.dataset.url
    const album = this.data.selectedAlbum
    if (!album) return

    wx.showLoading({ title: '设置封面...' })

    // 找出 photos 数组中匹配的索引，保存为相对路径
    let coverPath = url
    if (url && url.startsWith('http')) {
      const idx = (album.photos || []).findIndex(p => p === url)
      if (idx > -1) coverPath = '/uploads/gatherings/' + url.split('/').pop()
      else coverPath = url
    }

    wx.request({
      url: this.data.serverUrl + '/api/gathering/update-cover/' + (album._id || album.id),
      method: 'PUT',
      data: { cover: coverPath },
      timeout: 3000,
      success: (res) => {
        wx.hideLoading()
        if (res.data && res.data.data) {
          const updated = res.data.data
          const albums = [...this.data.albums]
          albums[this.data.selectedIndex] = updated
          this.setData({ albums, selectedAlbum: updated, showCoverPicker: false })
          wx.showToast({ title: '封面已更新', icon: 'success' })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '设置失败', icon: 'none' })
      }
    })
  },

  // --- 分享海报（开发中） ---
  generatePoster() {
    wx.showToast({ title: '仍在开发中', icon: 'none' })
  },

  // --- Canvas 绘制（保留，后续开发） ---
  _drawPoster(ctx, w, h, album, photos, cb) {
    const colors = ['#D85A30', '#1D9E75', '#534AB7', '#185FA5', '#BA7517', '#2C2C2A']
    const c = colors[this.data.selectedIndex % colors.length]
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, c)
    grad.addColorStop(1, this._darken(c, 0.3))
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(album.title || '聚餐', w / 2, 160)

    ctx.font = '24px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    const dateStr = this.formatDate(album.dateTime)
    const loc = (album.location && album.location.name) || ''
    ctx.fillText((dateStr + ' · ' + loc).trim(), w / 2, 210)

    const participants = album.participants || []
    const avatarR = 30
    const startX = w / 2 - (Math.min(participants.length, 5) * (avatarR * 2 + 8)) / 2
    participants.slice(0, 5).forEach((p, i) => {
      const ax = startX + i * (avatarR * 2 + 8)
      ctx.beginPath(); ctx.arc(ax + avatarR, 310, avatarR, 0, 2 * Math.PI)
      ctx.fillStyle = this._stringToColor(p)
      ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(p.slice(0, 1), ax + avatarR, 310)
    })

    const avgCost = participants.length ? Math.round(album.totalCost / participants.length) : 0
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('总消费 ¥' + (album.totalCost || 0) + '  人均 ¥' + avgCost, w / 2, 400)

    if (album.moodScore) {
      ctx.fillStyle = 'rgba(255,215,0,0.9)'
      ctx.font = '28px sans-serif'
      ctx.fillText('★'.repeat(album.moodScore), w / 2, 450)
    }

    const tags = album.moodTags || []
    if (tags.length) {
      tags.slice(0, 4).forEach((tag, i) => {
        const tx = w / 2 - 80 + i * 40
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.beginPath(); ctx.roundRect(tx - 30, 480, 60, 28, 14)
        ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(tag, tx, 494)
      })
    }

    if (album.note) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '18px sans-serif'
      ctx.textAlign = 'center'
      this._wrapText(ctx, album.note, w / 2, 560, w - 80, 28)
    }

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('—— 饭局星球 ——', w / 2, h - 80)
    ctx.font = '14px sans-serif'
    ctx.fillText('每一桌聚餐，都是一颗独特的星球', w / 2, h - 50)
    cb()
  },

  _drawSingle(ctx, w, h, album, photos, cb) {
    wx.getImageInfo({
      src: photos[0],
      success: (info) => {
        ctx.drawImage(info.path, 0, 0, w, h)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(0, h - 180, w, 180)

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 30px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(album.title || '聚餐', w / 2, h - 130)

        ctx.font = '20px sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        const dateStr = this.formatDate(album.dateTime)
        const loc = (album.location && album.location.name) || ''
        ctx.fillText((dateStr + ' · ' + loc).trim(), w / 2, h - 90)

        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '14px sans-serif'
        ctx.fillText('饭局星球', w / 2, h - 30)
        cb()
      },
      fail: () => this._drawPoster(ctx, w, h, album, [], cb)
    })
  },

  _drawCollage(ctx, w, h, album, photos, cb) {
    const count = Math.min(photos.length, 4)
    const cols = count <= 2 ? count : 2
    const rows = count <= 2 ? 1 : Math.ceil(count / 2)
    const pw = (w - 10) / cols
    const ph = (h - 130 - 10) / rows
    let loaded = 0

    photos.slice(0, count).forEach((src, i) => {
      wx.getImageInfo({
        src,
        success: (info) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          ctx.drawImage(info.path, col * (pw + 5) + 5, row * (ph + 5) + 5, pw, ph)
          loaded++
          if (loaded === count) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillRect(0, h - 120, w, 120)
            ctx.fillStyle = '#fff'
            ctx.font = 'bold 24px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(album.title || '聚餐', w / 2, h - 78)
            ctx.font = '16px sans-serif'
            ctx.fillStyle = 'rgba(255,255,255,0.7)'
            ctx.fillText('总消费 ¥' + (album.totalCost || 0), w / 2, h - 42)
            ctx.fillStyle = 'rgba(255,255,255,0.4)'
            ctx.font = '12px sans-serif'
            ctx.fillText('饭局星球', w / 2, h - 12)
            cb()
          }
        },
        fail: () => { loaded++; if (loaded === count) cb() }
      })
    })
  },

  _drawGrid(ctx, w, h, album, photos, cb) {
    const gridSize = Math.floor((w - 16) / 3)
    const count = Math.min(photos.length, 9)
    let loaded = 0

    photos.slice(0, count).forEach((src, i) => {
      wx.getImageInfo({
        src,
        success: (info) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          ctx.drawImage(info.path, col * (gridSize + 4) + 4, row * (gridSize + 4) + 4, gridSize, gridSize)
          loaded++
          if (loaded === count || loaded + (count - i - 1) === count) {
            const bottomY = Math.ceil(count / 3) * (gridSize + 4) + 10
            ctx.fillStyle = 'rgba(0,0,0,0.05)'
            ctx.fillRect(0, bottomY, w, h - bottomY)
            ctx.fillStyle = '#2C2C2A'
            ctx.font = 'bold 22px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(album.title || '聚餐', w / 2, bottomY + 40)
            ctx.font = '16px sans-serif'
            ctx.fillStyle = '#5F5E5A'
            const dateStr = this.formatDate(album.dateTime)
            ctx.fillText(dateStr + '  ¥' + (album.totalCost || 0), w / 2, bottomY + 74)
            ctx.fillStyle = '#ccc'
            ctx.font = '12px sans-serif'
            ctx.fillText('饭局星球', w / 2, bottomY + 110)
            cb()
          }
        },
        fail: () => { loaded++; if (loaded === count) cb() }
      })
    })

    if (count === 0) this._drawPoster(ctx, w, h, album, [], cb)
  },

  _darken(hex, amount) {
    const num = parseInt(hex.slice(1), 16)
    const r = Math.min(255, Math.floor((num >> 16) * (1 - amount)))
    const g = Math.min(255, Math.floor(((num >> 8) & 0xFF) * (1 - amount)))
    const b = Math.min(255, Math.floor((num & 0xFF) * (1 - amount)))
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
  },

  _stringToColor(str) {
    const colors = ['#D85A30', '#1D9E75', '#534AB7', '#185FA5', '#BA7517', '#2C2C2A']
    let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  },

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('')
    let line = ''
    let ly = y
    for (const c of chars) {
      const test = line + c
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, ly)
        line = c
        ly += lineHeight
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, x, ly)
  },
})
