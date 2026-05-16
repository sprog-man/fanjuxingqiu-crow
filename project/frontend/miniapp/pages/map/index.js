const app = getApp()

Page({
  data: {
    // Map
    latitude: 39.9042,
    longitude: 116.4074,
    scale: 5,
    markers: [],
    checkins: [],

    // Stats
    cities: [],
    isEmptyCities: true,
    stats: {},

    // Achievements
    achievements: [],
    unlockedCount: 0,
    totalCount: 0,
    showAchievements: false,
    achArrow: '▼',
    noPhotos: true,
    hasPhotos: false,
    firstPhoto: '',
    locInfo: '',
    submitBtnText: '✅ 打卡',
    submitBtnClass: '',

    // Import picker
    showImport: false,
    importList: [],

    // Checkin form
    showForm: false,
    formBodyH: 400,
    formLoading: false,
    checkin: {
      restaurant: '',
      food: '',
      note: '',
      photos: [],
      city: '',
      province: '',
      lat: 0,
      lng: 0,
    },
    locationAuthorized: false,
    locating: false,

    serverUrl: 'http://localhost:2001',
  },

  onShow() {
    this.fetchFootprints()
    this.fetchAchievements()
    this.fetchCheckins()
    this.tryAutoLocate()
  },

  /* ===== Location ===== */

  tryAutoLocate() {
    const cached = wx.getStorageSync('lastLocation')
    if (cached) {
      this.setData({
        latitude: cached.lat, longitude: cached.lng,
        locationAuthorized: true,
      })
    }
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        wx.setStorageSync('lastLocation', { lat: res.latitude, lng: res.longitude })
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          scale: 14,
          locationAuthorized: true,
        })
      },
      fail: () => {
        if (!cached) {
          this.centerOnChina()
        }
      }
    })
  },

  centerOnChina() {
    this.setData({ latitude: 34.0, longitude: 108.0, scale: 4 })
  },

  /* ===== Map Markers ===== */

  buildMarkers(cities, checkins) {
    const markers = []

    // Use checkin precise coordinates first
    const usedCities = new Set()
    if (checkins && checkins.length) {
      checkins.forEach((c, i) => {
        if (c.location && c.location.lat && c.location.lng) {
          markers.push({
            id: i + 100,
            width: 30, height: 30,
            latitude: c.location.lat,
            longitude: c.location.lng,
            title: c.location.name || c.location.city || '打卡',
            callout: {
              content: c.title || c.location.name || '打卡',
              fontSize: 12,
              borderRadius: 6,
              padding: '4px 8px',
              display: 'BYCLICK',
            },
          })
          if (c.location.city) usedCities.add(c.location.city)
        }
      })
    }

    // Add city-level markers for cities without precise checkin
    const cityCoords = {
      '北京': { lat: 39.9042, lng: 116.4074 },
      '上海': { lat: 31.2304, lng: 121.4737 },
      '广州': { lat: 23.1291, lng: 113.2644 },
      '深圳': { lat: 22.5431, lng: 114.0579 },
      '成都': { lat: 30.5728, lng: 104.0668 },
      '杭州': { lat: 30.2741, lng: 120.1551 },
      '重庆': { lat: 29.4316, lng: 106.9123 },
      '武汉': { lat: 30.5928, lng: 114.3055 },
      '西安': { lat: 34.3416, lng: 108.9398 },
      '南京': { lat: 32.0603, lng: 118.7969 },
      '长沙': { lat: 28.2282, lng: 112.9388 },
      '天津': { lat: 39.0842, lng: 117.2009 },
      '苏州': { lat: 31.2990, lng: 120.5853 },
      '昆明': { lat: 25.0389, lng: 102.7183 },
      '青岛': { lat: 36.0671, lng: 120.3826 },
    }

    if (cities && cities.length) {
      cities.forEach((c, i) => {
        if (usedCities.has(c.city)) return
        const coord = cityCoords[c.city] || this.fuzzyCityCoord(c.city)
        if (coord) {
          markers.push({
            id: i,
            width: 30, height: 30,
            latitude: coord.lat,
            longitude: coord.lng,
            title: c.city,
            callout: {
              content: `${c.city} · ${c.count}次`,
              fontSize: 11,
              borderRadius: 6,
              padding: '3px 6px',
              display: 'BYCLICK',
            },
          })
        }
      })
    }

    this.setData({ markers })
  },

  fuzzyCityCoord(cityName) {
    return null
  },

  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const marker = this.data.markers.find(m => m.id === markerId)
    if (marker) {
      wx.showToast({ title: marker.title || marker.callout?.content || '打卡点', icon: 'none' })
    }
  },

  /* ===== Data Fetch ===== */

  enrichCities(cities) {
    return (cities || []).map((c, i) => ({
      ...c,
      foodsStr: (c.foods || []).join(' · '),
      rankClass: i < 3 ? 'top' : '',
      rankNum: i + 1,
    }))
  },

  request(url, method, data) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: method || 'GET',
        data: data || {},
        timeout: 5000,
        success: (res) => resolve(res),
        fail: (err) => reject(err),
      })
    })
  },

  async fetchFootprints() {
    try {
      const res = await this.request(this.data.serverUrl + '/api/map/footprints')
      const body = res.data
      if (!body || !body.data) return
      const { cities, ...stats } = body.data
      const enriched = this.enrichCities(cities)
      this.setData({ cities: enriched, isEmptyCities: !enriched.length, stats })
      this.buildMarkers(enriched, this.data.checkins)
    } catch (e) { /* offline */ }
  },

  enrichAchievements(achievements) {
    return (achievements || []).map(a => ({
      ...a,
      cardClass: a.unlocked ? 'unlocked' : 'locked',
      iconDisplay: a.unlocked ? a.icon : '🔒',
      statusText: a.unlocked ? '已解锁' : '未达成',
    }))
  },

  async fetchAchievements() {
    try {
      const res = await this.request(this.data.serverUrl + '/api/map/achievements')
      const body = res.data
      if (!body || !body.data) return
      const { achievements, unlockedCount, totalCount } = body.data
      const enriched = this.enrichAchievements(achievements)
      this.setData({ achievements: enriched, unlockedCount, totalCount, achArrow: '▼' })
    } catch (e) { /* offline */ }
  },

  async fetchCheckins() {
    try {
      const res = await this.request(this.data.serverUrl + '/api/map/checkins')
      const body = res.data
      if (!body || !body.data) return
      const checkins = body.data || []
      this.setData({ checkins })
      this.buildMarkers(this.data.cities, checkins)
    } catch (e) { /* offline */ }
  },

  /* ===== Check-in Flow ===== */

  startCheckin() {
    this.setData({ formLoading: true })
    wx.getLocation({
      type: 'wgs84',
      success: (res) => {
        this.reverseGeocode(res.latitude, res.longitude)
      },
      fail: () => {
        wx.showToast({ title: '定位失败，请开启位置权限', icon: 'none' })
        this.setData({ formLoading: false })
        this.openFormManually()
      }
    })
  },

  async reverseGeocode(lat, lng) {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=zh`,
          timeout: 5000,
          success: resolve,
          fail: reject,
        })
      })
      const addr = res.data.address || {}
      const city = addr.city || addr.town || addr.county || addr.state || ''
      const province = addr.state || ''
      this.setData({
        'checkin.city': city,
        'checkin.province': province,
        'checkin.lat': lat,
        'checkin.lng': lng,
        locInfo: province ? city + ' · ' + province : city,
        noPhotos: true,
        hasPhotos: false,
        firstPhoto: '',
        submitBtnText: '✅ 打卡',
        submitBtnClass: '',
        formBodyH: this.calcFormBodyH(),
        formLoading: false,
        showForm: true,
      })
      wx.setStorageSync('lastLocation', { lat, lng })
    } catch (e) {
      wx.showToast({ title: '获取位置信息失败，请手动填写', icon: 'none' })
      this.setData({ formLoading: false })
      this.openFormManually()
    }
  },

  calcFormBodyH() {
    const sys = wx.getSystemInfoSync()
    const winH = sys.windowHeight || 600
    const bodyH = Math.round(winH * 0.8) - 134
    return Math.max(bodyH, 280)
  },

  openFormManually() {
    this.setData({
      showForm: true,
      formBodyH: this.calcFormBodyH(),
      formLoading: false,
      noPhotos: true,
      hasPhotos: false,
      firstPhoto: '',
      locInfo: '',
      submitBtnText: '✅ 打卡',
      submitBtnClass: '',
    })
  },

  closeForm() {
    this.setData({
      showForm: false,
      locInfo: '',
      noPhotos: true,
      hasPhotos: false,
      firstPhoto: '',
      submitBtnText: '✅ 打卡',
      submitBtnClass: '',
      checkin: { restaurant: '', food: '', note: '', photos: [], city: '', province: '', lat: 0, lng: 0 }
    })
  },

  onCheckinInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['checkin.' + field]: e.detail.value })
  },

  pickCheckinPhoto() {
    wx.chooseImage({
      count: 3,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          'checkin.photos': res.tempFilePaths,
          firstPhoto: res.tempFilePaths[0] || '',
          noPhotos: false,
          hasPhotos: true,
        })
      }
    })
  },

  removeCheckinPhoto() {
    this.setData({ 'checkin.photos': [], firstPhoto: '', noPhotos: true, hasPhotos: false })
  },

  async submitCheckin() {
    const c = this.data.checkin
    if (!c.city && !c.restaurant) {
      wx.showToast({ title: '请填写餐厅或城市信息', icon: 'none' })
      return
    }

    this.setData({ formLoading: true, submitBtnText: '打卡中…', submitBtnClass: 'loading' })

    const payload = {
      userId: '我',
      restaurant: c.restaurant,
      food: c.food,
      lat: c.lat,
      lng: c.lng,
      city: c.city,
      province: c.province,
      photos: c.photos,
      note: c.note,
      dateTime: new Date().toISOString(),
    }

    try {
      const res = await this.request(this.data.serverUrl + '/api/map/checkin', 'POST', payload)
      if (res.statusCode !== 200) throw new Error('API error: ' + (res.data && res.data.error))

      // Save locally for offline
      const localCheckins = wx.getStorageSync('checkins') || []
      localCheckins.unshift(payload)
      wx.setStorageSync('checkins', localCheckins)

      wx.showToast({ title: '打卡成功 🎉' })
      this.closeForm()
      this.fetchFootprints()
      this.fetchAchievements()
      this.fetchCheckins()
    } catch (e) {
      console.error('[打卡失败]', e)
      wx.showToast({ title: '打卡失败，请重试', icon: 'none' })
      this.setData({ formLoading: false, submitBtnText: '✅ 打卡', submitBtnClass: '' })
      return
    }
    this.setData({ formLoading: false })
  },

  /* ===== Achievement Toggle ===== */

  toggleAchievements() {
    const newVal = !this.data.showAchievements
    this.setData({ showAchievements: newVal, achArrow: newVal ? '▲' : '▼' })
  },

  /* ===== Import from Gatherings ===== */

  showImportPicker() {
    const gatherings = wx.getStorageSync('gatherings') || []
    const list = gatherings.slice(0, 20).map(g => ({
      _id: g._id || g.gathering_id,
      title: g.title || '',
      dateTime: g.dateTime ? g.dateTime.slice(0, 10) : '',
      location: g.location || {},
      foodTags: g.foodTags || [],
      note: g.note || '',
      photos: g.photos || [],
      lat: (g.location && g.location.lat) || 0,
      lng: (g.location && g.location.lng) || 0,
      city: (g.location && g.location.city) || '',
    }))
    this.setData({ importList: list, showImport: true })
  },

  closeImport() {
    this.setData({ showImport: false })
  },

  pickImport(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.importList[idx]
    if (!item) return
    const photos = item.photos || []
    this.setData({
      'checkin.restaurant': item.title || '',
      'checkin.food': (item.foodTags && item.foodTags[0]) || '',
      'checkin.note': item.note || '',
      'checkin.photos': photos,
      'checkin.city': item.city || '',
      'checkin.lat': item.lat || 0,
      'checkin.lng': item.lng || 0,
      locInfo: item.city || '',
      noPhotos: photos.length === 0,
      hasPhotos: photos.length > 0,
      firstPhoto: photos[0] || '',
      showImport: false,
    })
    wx.showToast({ title: '已导入 ✔', icon: 'none' })
  },

  /* ===== City Detail ===== */

  showCityDetail(e) {
    const city = e.currentTarget.dataset.city
    const cityData = this.data.cities.find(c => c.city === city)
    if (cityData) {
      wx.showModal({
        title: cityData.city,
        content: `共 ${cityData.count} 次聚餐\n美食: ${(cityData.foods || []).join('、') || '暂无'}`,
        showCancel: false,
      })
    }
  },
})
