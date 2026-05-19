const app = getApp()

Page({
  data: {
    records: [], filteredRecords: [],
    stats: {}, maxBar: 0, serverUrl: 'http://localhost:2001',
    filterMode: 'all', filterMonth: '', filterMonthLabel: '', filterDate: '', filterDateLabel: '',
    availableMonths: [],
  },

  onShow() {
    this.setData({ serverUrl: app.getServerUrl() })
    this.loadRecords()
    this.loadStats()
  },

  loadRecords() {
    const serverUrl = app.getServerUrl ? app.getServerUrl() : 'http://localhost:2001'
    wx.request({
      url: serverUrl + '/api/gathering/list',
      method: 'GET',
      timeout: 3000,
      success: (res) => {
        const items = this._normalize(res.data.data.items)
        this._updateRecords(items)
        wx.setStorageSync('gatherings', items)
      },
      fail: () => {
        const local = this._normalize(wx.getStorageSync('gatherings') || [])
        this._updateRecords(local)
      }
    })
  },

  _updateRecords(items) {
    const months = this._extractMonths(items)
    this.setData({ records: items, availableMonths: months })
    this._applyFilter({ mode: this.data.filterMode, month: this.data.filterMonth, date: this.data.filterDate })
  },

  _extractMonths(records) {
    const set = new Set()
    records.forEach(r => {
      if (r.dateTime) set.add(r.dateTime.slice(0, 7))
    })
    return [...set].sort()
  },

  _applyFilter(opts) {
    const mode = opts?.mode ?? this.data.filterMode
    const month = opts?.month ?? this.data.filterMonth
    const date = opts?.date ?? this.data.filterDate
    let list = this.data.records
    if (mode === 'month' && month) {
      list = list.filter(r => r.dateTime && r.dateTime.startsWith(month))
    } else if (mode === 'day' && date) {
      list = list.filter(r => r.dateTime && r.dateTime.startsWith(date))
    }
    this.setData({ filteredRecords: list })
  },

  loadStats() {
    const serverUrl = app.getServerUrl ? app.getServerUrl() : 'http://localhost:2001'
    wx.request({
      url: serverUrl + '/api/gathering/stats',
      method: 'GET',
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
    return (items || []).map(r => {
      const fd = this._parseCardDate(r.dateTime)
      return {
        ...r,
        id: r._id || r.gathering_id || 'id_' + Math.random(),
        locationName: (r.location && r.location.name) || '',
        participantShort: (r.participants || []).map(p => p.slice(0, 1)),
        cardYear: fd.year, cardDate: fd.dateLabel,
        cardWeekday: fd.weekday, cardTime: fd.time,
      }
    })
  },

  _parseCardDate(dateStr) {
    if (!dateStr) return { year: '', dateLabel: '', weekday: '', time: '' }
    const d = new Date(dateStr)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return {
      year: String(d.getFullYear()),
      dateLabel: `${d.getMonth() + 1}月${d.getDate()}日`,
      weekday: `周${weekdays[d.getDay()]}`,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    }
  },

  /* ===== 筛选 ===== */

  switchFilter(e) {
    const mode = e.currentTarget.dataset.mode
    const data = { filterMode: mode }
    if (mode === 'all') { data.filterMonth = ''; data.filterMonthLabel = ''; data.filterDate = ''; data.filterDateLabel = '' }
    if (mode === 'day') { data.filterMonth = '' }
    if (mode === 'month') { data.filterDate = ''; data.filterDateLabel = ''; data.filterMonthLabel = '' }
    this.setData(data)
    this._applyFilter({ mode, month: data.filterMonth ?? this.data.filterMonth, date: data.filterDate ?? this.data.filterDate })
  },

  onMonthChange(e) {
    const month = e.detail.value.slice(0, 7)
    const label = this.formatMonth(month)
    this.setData({ filterMonth: month, filterMonthLabel: label, filterMode: 'month' })
    this._applyFilter({ mode: 'month', month })
  },

  onDateChange(e) {
    const val = e.detail.value
    const label = this.formatDateOnly(val)
    this.setData({ filterDate: val, filterDateLabel: label, filterMode: 'day' })
    this._applyFilter({ mode: 'day', date: val })
  },

  clearFilter() {
    this.setData({ filterMode: 'all', filterMonth: '', filterMonthLabel: '', filterDate: '', filterDateLabel: '' })
    this._applyFilter({ mode: 'all' })
  },

  /* ===== 格式化 ===== */

  formatDateOnly(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 周${weekdays[d.getDay()]}`
  },

  formatTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  },

  formatCardDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const month = d.getMonth() + 1
    const day = d.getDate()
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return {
      dateLabel: `${month}月${day}日`,
      weekday: `周${weekdays[d.getDay()]}`,
      time: `${hour}:${min}`,
      year: String(d.getFullYear()),
    }
  },

  formatMonth(monthStr) {
    if (!monthStr) return ''
    const p = monthStr.split('-')
    return `${p[0]}年${parseInt(p[1])}月`
  },

  goCreate() { wx.navigateTo({ url: '/subpackages/record/create' }) },
  goDetail(e) { wx.navigateTo({ url: '/subpackages/record/detail?id=' + (e.currentTarget.dataset.id) }) }
})
