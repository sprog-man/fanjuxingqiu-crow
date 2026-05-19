const app = getApp()
const citySelector = requirePlugin('citySelector')

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

    // City detail expand
    expandedCity: '',
    cityRecords: [],

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

    // City selector
    showCitySelector: false,
    tencentMapKey: 'DMMBZ-JWCKI-VHEGO-UCKRA-ZKTA7-KMFCF',
    tencentMapReferer: '饭局星球',

    // Edit mode
    editingId: '',
    isEditMode: false,

    serverUrl: 'http://localhost:2001',
    uploadingPhotos: false,
  },

  onShow() {
    this.setData({ serverUrl: app.getServerUrl() })
    this.fetchFootprints()
    this.fetchAchievements()
    this.fetchCheckins()
    this._useCachedLoc() // 仅用缓存，不弹权限；用户点 📍 按钮触发真实定位

    // 从城市选择器插件返回后获取城市信息
    const selectedCity = citySelector.getCity()
    if (selectedCity) {
      console.log('[城市选择器] 选择的城市:', JSON.stringify(selectedCity))
      this.handleCitySelected(selectedCity)
      citySelector.clearCity()
    }
  },

  onUnload() {
    citySelector.clearCity()
  },

  handleCitySelected(cityInfo) {
    if (!cityInfo || !cityInfo.location) return
    
    const lat = cityInfo.location.latitude
    const lng = cityInfo.location.longitude
    const cityName = cityInfo.name || ''
    const fullName = cityInfo.fullname || ''
    
    console.log('[城市选择器] 处理城市选择:', cityName, lat, lng)
    
    this.setData({
      'checkin.city': cityName,
      'checkin.province': fullName,
      'checkin.lat': lat,
      'checkin.lng': lng,
      locInfo: fullName,
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
  },

  /* ===== Location ===== */

  tryAutoLocate() { // 用户手势触发（定位按钮），权限+定位都能正常工作
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this._doGetLocate()
        } else if (res.authSetting['scope.userLocation'] === undefined) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => this._doGetLocate(),
            fail: () => this._locFailFallback(),
          })
        } else {
          wx.showModal({
            title: '位置权限已拒绝',
            content: '请前往设置开启位置权限',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting() },
          })
        }
      },
      fail: () => this._locFailFallback(),
    })
  },

  _useCachedLoc() { // onShow 静默使用缓存，不弹权限窗
    const cached = wx.getStorageSync('lastLocation')
    if (cached && cached.lat) {
      this.setData({ latitude: cached.lat, longitude: cached.lng, locationAuthorized: true })
    }
  },

  _doGetLocate() {
    wx.getLocation({
      type: 'wgs84',
      isHighAccuracy: true,
      success: (res) => {
        wx.setStorageSync('lastLocation', { lat: res.latitude, lng: res.longitude })
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          scale: 14,
          locationAuthorized: true,
        })
      },
      fail: () => this._locFailFallback(),
    })
  },

  _locFailFallback() {
    const cached = wx.getStorageSync('lastLocation')
    if (cached && cached.lat) {
      this.setData({ latitude: cached.lat, longitude: cached.lng, locationAuthorized: true })
    } else {
      this.centerOnChina()
    }
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

  request(path, method, data) {
    return new Promise((resolve, reject) => {
      const serverUrl = app.globalData.serverUrl || 'http://localhost:2001'
      wx.request({
        url: serverUrl + path,
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
      const res = await this.request('/api/map/footprints')
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
      const res = await this.request('/api/map/achievements')
      const body = res.data
      if (!body || !body.data) return
      const { achievements, unlockedCount, totalCount } = body.data
      const enriched = this.enrichAchievements(achievements)
      this.setData({ achievements: enriched, unlockedCount, totalCount, achArrow: '▼' })
    } catch (e) { /* offline */ }
  },

  async fetchCheckins() {
    try {
      const res = await this.request('/api/map/checkins')
      const body = res.data
      if (!body || !body.data) return
      const checkins = body.data || []
      this.setData({ checkins })
      this.buildMarkers(this.data.cities, checkins)
    } catch (e) { /* offline */ }
  },

  /* ===== Check-in Flow ===== */

  startCheckin() {
    console.log('[打卡] 点击打卡按钮')
    this.setData({ formLoading: true })
    
    // 优先使用缓存的位置（避免频繁调用 wx.getLocation 导致权限问题）
    const cached = wx.getStorageSync('lastLocation')
    console.log('[打卡] 缓存位置:', cached)
    if (cached && cached.lat && cached.lng) {
      // 检查缓存是否过期（30分钟内有效）
      const cacheTime = wx.getStorageSync('lastLocationTime') || 0
      const now = Date.now()
      console.log('[打卡] 缓存时间:', now - cacheTime, 'ms')
      if (now - cacheTime < 30 * 60 * 1000) {
        console.log('[打卡] 使用缓存位置:', cached)
        this.reverseGeocode(cached.lat, cached.lng)
        return
      }
    }

    // 缓存过期或不存在，使用腾讯地图城市选择器插件
    console.log('[打卡] 打开腾讯地图城市选择器')
    this.openCitySelector()
  },

  openCitySelector() {
    const { tencentMapKey, tencentMapReferer } = this.data
    wx.navigateTo({
      url: `plugin://citySelector/index?key=${tencentMapKey}&referer=${tencentMapReferer}&accurate=1`,
      fail: (err) => {
        console.error('[城市选择器] 打开失败:', err)
        wx.showToast({ title: '定位服务不可用', icon: 'none' })
        this.setData({ formLoading: false })
        this.openFormManually()
      }
    })
  },

  async reverseGeocode(lat, lng) {
    console.log('[逆地理编码] 开始:', lat, lng)
    
    // 使用腾讯地图城市选择器插件获取地址信息
    this.openCitySelector()
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
      editingId: '',
      isEditMode: false,
      checkin: { restaurant: '', food: '', note: '', photos: [], city: '', province: '', lat: 0, lng: 0 }
    })
  },

  async editCheckin(e) {
    const id = e.currentTarget.dataset.id
    console.log('[编辑打卡] ID:', id)
    
    // 从城市记录中找到对应的数据
    const record = this.data.cityRecords.find(r => r._id === id)
    if (!record) {
      wx.showToast({ title: '未找到记录', icon: 'none' })
      return
    }

    // 填充表单数据
    this.setData({
      'checkin.restaurant': record.title || '',
      'checkin.food': (record.foodTags && record.foodTags[0]) || '',
      'checkin.note': record.note || '',
      'checkin.photos': record.photosList || [],
      'checkin.city': record.city || '',
      'checkin.province': record.province || '',
      'checkin.lat': record.lat || 0,
      'checkin.lng': record.lng || 0,
      locInfo: record.city || '',
      noPhotos: !record.photosList || record.photosList.length === 0,
      hasPhotos: record.photosList && record.photosList.length > 0,
      firstPhoto: (record.photosList && record.photosList[0]) || '',
      editingId: id,
      isEditMode: true,
      showForm: true,
      formBodyH: this.calcFormBodyH(),
      formLoading: false,
      submitBtnText: '💾 保存',
      submitBtnClass: '',
    })
    
    wx.showToast({ title: '已进入编辑模式', icon: 'none' })
  },

  async deleteCheckin(e) {
    const id = e.currentTarget.dataset.id
    console.log('[删除打卡] ID:', id)

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条打卡记录吗？此操作不可撤销。',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '删除中...' })
        
        try {
          const response = await this.request('/api/map/checkin/' + id, 'DELETE')
          if (response.statusCode !== 200) throw new Error('API error')

          // 从本地存储中删除
          const localCheckins = wx.getStorageSync('checkins') || []
          const filtered = localCheckins.filter(item => item._id !== id)
          wx.setStorageSync('checkins', filtered)

          wx.hideLoading()
          wx.showToast({ title: '删除成功', icon: 'success' })

          // 刷新数据
          this.fetchFootprints()
          this.fetchAchievements()
          this.fetchCheckins()
          
          // 如果在城市详情页面，刷新当前城市的记录
          if (this.data.expandedCity) {
            this.showCityDetail({ currentTarget: { dataset: { city: this.data.expandedCity } } })
          }
        } catch (err) {
          console.error('[删除失败]', err)
          wx.hideLoading()
          wx.showToast({ title: '删除失败，请重试', icon: 'none' })
        }
      }
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

  uploadCheckinPhotos(photos) {
    const tasks = photos.map(path => {
      return new Promise((resolve) => {
        if (path.indexOf('http') === 0) { resolve([{ url: path }]); return }
        wx.uploadFile({
          url: this.data.serverUrl + '/api/map/upload',
          filePath: path,
          name: 'photos',
          timeout: 10000,
          success: (res) => {
            try { resolve(JSON.parse(res.data).data || []) } catch (e) { resolve([]) }
          },
          fail: () => resolve([])
        })
      })
    })
    return Promise.all(tasks).then(results => results.flat())
  },

  async submitCheckin() {
    const c = this.data.checkin
    if (!c.city && !c.restaurant) {
      wx.showToast({ title: '请填写餐厅或城市信息', icon: 'none' })
      return
    }

    this.setData({ formLoading: true, submitBtnText: '打卡中…', submitBtnClass: 'loading' })

    // Step 1: upload photos to OSS first
    let photoUrls = c.photos
    if (c.photos.length > 0 && c.photos[0].indexOf('http') !== 0) {
      const uploaded = await this.uploadCheckinPhotos(c.photos)
      photoUrls = uploaded.map(r => r.url).filter(Boolean)
    }

    const payload = {
      userId: '我',
      restaurant: c.restaurant,
      food: c.food,
      lat: c.lat,
      lng: c.lng,
      city: c.city,
      province: c.province,
      photos: photoUrls,
      note: c.note,
      dateTime: new Date().toISOString(),
    }

    try {
      let res
      if (this.data.isEditMode && this.data.editingId) {
        // 编辑模式：更新打卡记录
        res = await this.request('/api/map/checkin/' + this.data.editingId, 'PUT', payload)
      } else {
        // 新增模式：创建打卡记录
        res = await this.request('/api/map/checkin', 'POST', payload)
      }
      
      if (res.statusCode !== 200) throw new Error('API error: ' + (res.data && res.data.error))

      // Save locally for offline
      const localCheckins = wx.getStorageSync('checkins') || []
      if (this.data.isEditMode) {
        const idx = localCheckins.findIndex(item => item._id === this.data.editingId)
        if (idx !== -1) {
          localCheckins[idx] = { ...localCheckins[idx], ...payload }
        }
      } else {
        localCheckins.unshift(payload)
      }
      wx.setStorageSync('checkins', localCheckins)

      wx.showToast({ title: this.data.isEditMode ? '更新成功 🎉' : '打卡成功 🎉' })
      this.closeForm()
      this.fetchFootprints()
      this.fetchAchievements()
      this.fetchCheckins()
      
      // 如果在城市详情页面，刷新当前城市的记录
      if (this.data.expandedCity) {
        this.showCityDetail({ currentTarget: { dataset: { city: this.data.expandedCity } } })
      }
    } catch (e) {
      console.error(this.data.isEditMode ? '[更新失败]' : '[打卡失败]', e)
      wx.showToast({ title: this.data.isEditMode ? '更新失败，请重试' : '打卡失败，请重试', icon: 'none' })
      this.setData({ formLoading: false, submitBtnText: this.data.isEditMode ? '💾 保存' : '✅ 打卡', submitBtnClass: '' })
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

  /* ===== City Detail Expand ===== */

  async showCityDetail(e) {
    const city = e.currentTarget.dataset.city
    // Toggle: collapse if same city tapped
    if (this.data.expandedCity === city) {
      this.setData({ expandedCity: '', cityRecords: [] })
      return
    }
    // Show the city expand area immediately with loading
    this.setData({ expandedCity: city, cityRecords: [] })
    try {
      const res = await this.request('/api/map/city-records?city=' + encodeURIComponent(city))
      const body = res.data
      const records = ((body && body.data) || [])
        .map(r => ({
          ...r,
          cardYear: r.dateTime ? new Date(r.dateTime).getFullYear() : '',
          cardDate: r.dateTime ? ('0' + new Date(r.dateTime).getDate()).slice(-2) : '',
          cardMonth: r.dateTime ? ('0' + (new Date(r.dateTime).getMonth() + 1)).slice(-2) : '',
          cardWeekday: r.dateTime ? ['日','一','二','三','四','五','六'][new Date(r.dateTime).getDay()] : '',
          cardTime: r.dateTime ? new Date(r.dateTime).toTimeString().slice(0, 5) : '',
          foodsStr: (r.foodTags || []).join('、'),
          photosList: r.photos || [],
        }))
      this.setData({ cityRecords: records })
    } catch (e) {
      this.setData({ cityRecords: [] })
    }
  },
})
