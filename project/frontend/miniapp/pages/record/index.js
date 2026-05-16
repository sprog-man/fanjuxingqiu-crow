const app = getApp()

Page({
  data: { records: [], stats: {}, maxBar: 0, serverUrl: 'http://localhost:2001' },

  onShow() {
    this.loadRecords()
    this.loadStats()
  },

  loadRecords() {
    wx.request({
      url: this.data.serverUrl + '/api/gathering/list',
      timeout: 3000,
      success: (res) => {
        const items = this._normalize(res.data.data.items)
        this.setData({ records: items })
        wx.setStorageSync('gatherings', items)
      },
      fail: () => {
        const local = this._normalize(wx.getStorageSync('gatherings') || [])
        this.setData({ records: local })
      }
    })
  },

  loadStats() {
    wx.request({
      url: this.data.serverUrl + '/api/gathering/stats',
      timeout: 3000,
      success: (res) => {
        const stats = res.data.data
        const maxBar = Math.max(...(stats.monthly || []).map(m => m.count), 1)
        stats.monthly = (stats.monthly || []).map(m => ({ ...m, monthShort: m.month.slice(5) }))
        this.setData({ stats, maxBar })
      },
      fail: () => {
        const local = wx.getStorageSync('gatherings') || []
        const total = local.length
        const totalCost = local.reduce((s, g) => s + (g.totalCost || 0), 0)
        this.setData({
          stats: { total, totalCost, avgCost: total ? Math.round(totalCost / total) : 0, topFriends: [], monthly: [] },
          maxBar: 1
        })
      }
    })
  },

  _normalize(items) {
    return (items || []).map(r => ({
      ...r,
      id: r._id || r.gathering_id || 'id_' + Math.random(),
      locationName: (r.location && r.location.name) || '',
      participantShort: (r.participants || []).map(p => p.slice(0, 1))
    }))
  },

  formatTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  },

  goCreate() { wx.navigateTo({ url: '/pages/record/create' }) },
  goDetail(e) { wx.navigateTo({ url: '/pages/record/detail?id=' + (e.currentTarget.dataset.id) }) }
})
