const app = getApp()

Page({
  data: {
    userInfo: null,
    showPref: false,
    prefCuisines: [],
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo })
    this.loadPreferences()
  },

  loadPreferences() {
    const localPref = wx.getStorageSync('preferences') || {}
    const liked = localPref.likedCuisines || []
    const allCuisines = [
      { id: 'chuan', name: '川菜', icon: '🌶️' },
      { id: 'yue', name: '粤菜', icon: '🥟' },
      { id: 'ri', name: '日料', icon: '🍣' },
      { id: 'han', name: '韩餐', icon: '🥘' },
      { id: 'xi', name: '西餐', icon: '🥩' },
      { id: 'su', name: '素食', icon: '🥗' },
    ]
    this.setData({
      prefCuisines: allCuisines.map(c => ({ ...c, liked: liked.includes(c.id) }))
    })
  },

  showPreference() {
    this.loadPreferences()
    this.setData({ showPref: true })
  },

  hidePreference() {
    this.setData({ showPref: false })
  },

  togglePrefCuisine(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.prefCuisines.map(c => {
      if (c.id === id) c.liked = !c.liked
      return c
    })
    const liked = list.filter(c => c.liked).map(c => c.id)
    this.setData({ prefCuisines: list })

    // 本地保存
    const local = wx.getStorageSync('preferences') || {}
    local.likedCuisines = liked
    wx.setStorageSync('preferences', local)

    // 后端同步
    const userId = app.globalData.userInfo ? app.globalData.userInfo.openid || '' : ''
    if (userId) {
      wx.request({
        url: app.globalData.serverUrl + '/api/preference',
        method: 'PUT',
        data: { userId, likedCuisines: liked },
        timeout: 2000,
      })
    }
  },

  doLogin() {
    if (this.data.userInfo) return
    wx.showLoading({ title: '登录中...' })
    app.getUserProfile().then(user => {
      wx.hideLoading()
      this.setData({ userInfo: user })
    })
  },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          this.setData({ userInfo: null })
        }
      }
    })
  },

  seedData() {
    wx.showModal({
      title: '导入示例数据',
      content: '将生成 12 条示例聚餐记录和 5 位饭搭子，让你立刻看到关系图鉴和成就效果。确定导入？',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '导入中...' })
        wx.request({
          url: app.globalData.serverUrl + '/api/seed/data',
          timeout: 3000,
          success: (r) => {
            const data = r.data.data
            // 写入 localStorage
            wx.setStorageSync('gatherings', data.gatherings)
            wx.setStorageSync('buddies', data.buddies)
            wx.hideLoading()
            wx.showToast({ title: '导入成功，可查看关系图鉴和成就' })
          },
          fail: () => {
            // 离线模式：使用内置种子
            const gatherings = [
              { title: '重庆火锅之夜', dateTime: '2026-05-15T19:00:00', location: { name: '渝味晓宇火锅', city: '重庆' }, participants: ['我','小明','小红'], totalCost: 368, moodScore: 5, moodTags: ['开心','美味'], foodTags: ['麻辣','火锅'], creatorId: '我' },
              { title: '胡同里的烤鸭', dateTime: '2026-05-10T12:00:00', location: { name: '四季民福烤鸭', city: '北京' }, participants: ['我','小明','小刚'], totalCost: 456, moodScore: 4, moodTags: ['美味'], foodTags: ['烤鸭'], creatorId: '我' },
              { title: '深夜居酒屋', dateTime: '2026-05-05T20:30:00', location: { name: '鸟安居酒屋', city: '上海' }, participants: ['我','小红','小丽'], totalCost: 520, moodScore: 5, moodTags: ['开心','美味'], foodTags: ['日料','刺身'], creatorId: '我' },
              { title: '街角烧烤摊', dateTime: '2026-04-28T21:00:00', location: { name: '老王烧烤', city: '成都' }, participants: ['我','小刚','小强'], totalCost: 280, moodScore: 4, moodTags: ['开心'], foodTags: ['烧烤'], creatorId: '我' },
              { title: '广式早茶', dateTime: '2026-04-20T09:00:00', location: { name: '点都德', city: '广州' }, participants: ['我','小明','小丽'], totalCost: 198, moodScore: 4, moodTags: ['美味'], foodTags: ['粤菜','点心'], creatorId: '我' },
              { title: '川菜馆辣翻', dateTime: '2026-04-15T12:30:00', location: { name: '眉州东坡', city: '北京' }, participants: ['我','小明','小红'], totalCost: 420, moodScore: 5, moodTags: ['开心','搞笑'], foodTags: ['川菜','辣'], creatorId: '我' },
              { title: '成都街头串串', dateTime: '2026-03-18T20:00:00', location: { name: '钢管厂五区小郡肝', city: '成都' }, participants: ['我','小红','小强'], totalCost: 180, moodScore: 4, moodTags: ['开心'], foodTags: ['串串'], creatorId: '我' },
              { title: '西湖边龙井虾仁', dateTime: '2026-03-05T18:30:00', location: { name: '楼外楼', city: '杭州' }, participants: ['我','小红'], totalCost: 380, moodScore: 4, moodTags: ['美味'], foodTags: ['杭帮菜'], creatorId: '我' },
            ]
            const buddies = [
              { id: 'B1', name: '小明', phone: '138****1234', color: '#D85A30' },
              { id: 'B2', name: '小红', phone: '139****5678', color: '#1D9E75' },
              { id: 'B3', name: '小刚', phone: '137****9012', color: '#534AB7' },
              { id: 'B4', name: '小丽', phone: '136****3456', color: '#BA7517' },
              { id: 'B5', name: '小强', phone: '135****7890', color: '#185FA5' },
            ]
            wx.setStorageSync('gatherings', gatherings)
            wx.setStorageSync('buddies', buddies)
            wx.hideLoading()
            wx.showToast({ title: '已导入本地示例数据' })
          }
        })
      }
    })
  },

  goRelation() { wx.navigateTo({ url: '/pages/mine/relation' }) },
  goAlbum() { wx.navigateTo({ url: '/pages/mine/album' }) },
  goBuddies() { wx.navigateTo({ url: '/pages/mine/buddies' }) },
})
