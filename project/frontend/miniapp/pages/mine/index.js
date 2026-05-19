const app = getApp()

Page({
  data: {
    userInfo: null,
    tempAvatar: '',
    tempNickname: '',
    showLoginModal: false,
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo })
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    this.setData({ tempAvatar: avatarUrl, showLoginModal: true })
  },

  onNicknameInput(e) {
    const tempNickname = e.detail.value.trim()
    this.setData({ tempNickname })
  },

  doLogin() {
    const { tempAvatar, tempNickname } = this.data
    if (!tempAvatar) {
      wx.showToast({ title: '请先选择头像', icon: 'none' })
      return
    }
    const nickname = tempNickname || '微信用户'
    console.log('[Mine] 登录 - 临时头像:', tempAvatar)
    wx.showLoading({ title: '登录中...' })
    app.login(nickname, tempAvatar).then(user => {
      console.log('[Mine] 登录成功 - 用户信息:', JSON.stringify(user))
      wx.hideLoading()
      this.setData({ userInfo: user, showLoginModal: false, tempAvatar: '', tempNickname: '' })
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  },

  closeLoginModal() {
    this.setData({ showLoginModal: false, tempAvatar: '', tempNickname: '' })
  },

  doLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          this.setData({ userInfo: null, tempAvatar: '', tempNickname: '', showLoginModal: false })
        }
      }
    })
  },

  goRelation() { wx.navigateTo({ url: '/subpackages/mine/relation' }) },
  goAlbum() { wx.navigateTo({ url: '/subpackages/mine/album' }) },
  goBuddies() { wx.navigateTo({ url: '/subpackages/mine/buddies' }) },
})
