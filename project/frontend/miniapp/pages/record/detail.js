const app = getApp()

Page({
  data: { gathering: null, avgCost: 0, starDisplay: '', serverUrl: 'http://localhost:2001' },

  onLoad(options) {
    if (options.id) this.fetchDetail(options.id)
  },

  fetchDetail(id) {
    wx.request({
      url: this.data.serverUrl + '/api/gathering/detail/' + id,
      timeout: 3000,
      success: (res) => this.setGathering(res.data.data),
      fail: () => {
        const local = wx.getStorageSync('gatherings') || []
        const found = local.find(g => g.gathering_id === id || g._id === id)
        if (found) this.setGathering(found)
      }
    })
  },

  setGathering(g) {
    const avg = g.participants && g.participants.length ? Math.round(g.totalCost / g.participants.length) : 0
    const stars = g.moodScore ? '★'.repeat(g.moodScore) : ''
    this.setData({ gathering: g, avgCost: avg, starDisplay: stars })
  },

  formatTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
})
