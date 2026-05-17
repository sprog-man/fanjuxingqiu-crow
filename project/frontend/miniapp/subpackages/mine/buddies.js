const app = getApp()

Page({
  data: {
    buddies: [],
    serverUrl: '',
    showModal: false,
    selectMode: 'search',   // 'search' | 'confirm'
    searchQuery: '',
    searchResults: [],
    selectedUser: null,
    editRemark: '',
    editingId: null,
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
        b.displayName = b.remark || b.name
        b.initial = b.displayName.slice(0, 1)
      })
      this.setData({ buddies })
    })
  },

  showAdd() {
    this.setData({
      showModal: true,
      selectMode: 'search',
      searchQuery: '',
      searchResults: [],
      selectedUser: null,
      editRemark: '',
      editingId: null,
    })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  preventClose() {},

  onSearchInput(e) {
    const query = e.detail.value.trim()
    this.setData({ searchQuery: query, selectedUser: null })
    if (query.length < 1) {
      this.setData({ searchResults: [] })
      return
    }
    wx.showLoading({ title: '搜索中...', mask: true })
    app.apiSearchUsers(query).then(results => {
      wx.hideLoading()
      results.forEach(r => { r._initial = r.name ? r.name.slice(0, 1) : '?' })
      this.setData({ searchResults: results })
    }).catch(() => {
      wx.hideLoading()
    })
  },

  selectUser(e) {
    const idx = e.currentTarget.dataset.index
    const user = this.data.searchResults[idx]
    if (!user) return
    user._initial = user.name.slice(0, 1)
    this.setData({
      selectedUser: user,
      editRemark: user.name,
      selectMode: 'confirm',
    })
  },

  onRemarkInput(e) {
    this.setData({ editRemark: e.detail.value })
  },

  saveBuddy() {
    const user = this.data.selectedUser
    if (!user) return

    wx.showLoading({ title: '添加中...' })
    app.apiSaveBuddy({
      targetUserId: user._id,
      remark: this.data.editRemark.trim() || user.name,
    }).then(saved => {
      wx.hideLoading()
      this.setData({ showModal: false })
      this.loadBuddies()
      wx.showToast({ title: '添加成功', icon: 'success' })
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '添加失败', icon: 'none' })
    })
  },

  setRemark(e) {
    const id = e.currentTarget.dataset.id
    const buddy = this.data.buddies.find(b => (b._id || b.id) === id)
    if (!buddy) return
    buddy._initial = (buddy.remark || buddy.name).slice(0, 1)
    this.setData({
      showModal: true,
      selectMode: 'confirm',
      selectedUser: buddy,
      editRemark: buddy.remark || buddy.name,
      editingId: id,
    })
  },

  saveRemark() {
    const id = this.data.editingId
    if (!id) return

    wx.showLoading({ title: '保存中...' })
    app.apiSaveBuddy({
      _id: id,
      remark: this.data.editRemark.trim() || this.data.selectedUser.name,
    }).then(saved => {
      wx.hideLoading()
      this.setData({ showModal: false })
      this.loadBuddies()
      wx.showToast({ title: '已更新', icon: 'success' })
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
      content: `确定要删除饭搭子「${buddy ? (buddy.remark || buddy.name) : ''}」吗？`,
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
  },
})
