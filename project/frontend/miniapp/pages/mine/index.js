const app = getApp()

Page({
  data: {
    userInfo: null,
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo })
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



  goRelation() { wx.navigateTo({ url: '/subpackages/mine/relation' }) },
  goAlbum() { wx.navigateTo({ url: '/subpackages/mine/album' }) },
  goBuddies() { wx.navigateTo({ url: '/subpackages/mine/buddies' }) },
})
