const app = getApp()

Page({
  data: {
    buddies: [],
    serverUrl: '',
    showModal: false,
    editBuddyId: null,
    editName: '',
    editPhone: '',
    editAvatar: '',
    editAvatarFile: null,
    colors: ['#D85A30', '#1D9E75', '#534AB7', '#185FA5', '#BA7517', '#e67e22', '#2C3E50', '#8e44ad'],
  },

  onShow() {
    this.setData({ serverUrl: app.getServerUrl() })
    this.loadBuddies()
  },

  loadBuddies() {
    app.apiGetBuddies().then(buddies => {
      buddies.forEach((b, i) => {
        if (!b.color) b.color = this.data.colors[i % this.data.colors.length]
        if (b.avatar) {
          if (b.avatar.indexOf('http') === 0) {
            // 已经是 OSS HTTPS 完整 URL，直接使用
          } else if (b.avatar.startsWith('/uploads/')) {
            // 旧本地路径（HTTP），WeChat 已不支持，清掉让它显示字母头像
            b.avatar = ''
          } else {
            b.avatar = this.data.serverUrl + b.avatar
          }
        }
      })
      this.setData({ buddies })
    })
  },

  showAdd() {
    this.setData({
      showModal: true,
      editBuddyId: null,
      editName: '',
      editPhone: '',
      editAvatar: '',
      editAvatarFile: null,
    })
  },

  editBuddy(e) {
    const id = e.currentTarget.dataset.id
    const buddy = this.data.buddies.find(b => (b._id || b.id) === id)
    if (!buddy) return
    this.setData({
      showModal: true,
      editBuddyId: id,
      editName: buddy.name,
      editPhone: buddy.phone || '',
      editAvatar: buddy.avatar || '',
      editAvatarFile: null,
    })
  },

  closeModal() {
    this.setData({ showModal: false, editAvatarFile: null })
  },

  onNameInput(e) { this.setData({ editName: e.detail.value }) },
  onPhoneInput(e) { this.setData({ editPhone: e.detail.value }) },
  preventClose() {},

  pickAvatar() {
    const self = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success(res) {
        const tempFile = res.tempFiles[0]
        self.setData({
          editAvatar: tempFile.tempFilePath,
          editAvatarFile: tempFile,
        })
      }
    })
  },

  saveBuddy() {
    const name = this.data.editName.trim()
    if (!name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return }

    const buddy = {
      _id: this.data.editBuddyId || null,
      name: name,
      phone: this.data.editPhone.trim(),
      avatar: '',
    }

    wx.showLoading({ title: '保存中...' })

    app.apiSaveBuddy(buddy).then(saved => {
      // 如果有新头像文件，上传头像
      if (this.data.editAvatarFile && (saved._id || saved.id)) {
        const id = saved._id || saved.id
        app.apiUploadBuddyAvatar(id, this.data.editAvatarFile.tempFilePath).then(result => {
          wx.hideLoading()
          this.setData({ showModal: false, editAvatarFile: null })
          this.loadBuddies()
          wx.showToast({ title: '保存成功', icon: 'success' })
        }).catch(err => {
          wx.hideLoading()
          this.setData({ showModal: false, editAvatarFile: null })
          this.loadBuddies()
          wx.showToast({ title: '头像上传失败，信息已保存', icon: 'none' })
        })
      } else {
        wx.hideLoading()
        this.setData({ showModal: false, editAvatarFile: null })
        this.loadBuddies()
        wx.showToast({ title: '保存成功', icon: 'success' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  },

  deleteBuddy(e) {
    const id = e.currentTarget.dataset.id
    const buddy = this.data.buddies.find(b => (b._id || b.id) === id)
    wx.showModal({
      title: '确认删除',
      content: `确定要删除饭搭子「${buddy ? buddy.name : ''}」吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          app.apiDeleteBuddy(id).then(() => {
            wx.hideLoading()
            this.loadBuddies()
            wx.showToast({ title: '已删除', icon: 'success' })
          })
        }
      }
    })
  }
})
