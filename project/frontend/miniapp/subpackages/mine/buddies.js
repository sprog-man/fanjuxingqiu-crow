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
    requestMessage: '',
    colors: ['#D85A30', '#1D9E75', '#534AB7', '#185FA5', '#BA7517', '#e67e22', '#2C3E50', '#8e44ad'],
    activeTab: 'all', // 'all' | 'pending' | 'accepted'
    filteredBuddies: [],
    pendingCount: 0,
    showRejectModal: false,
    rejectBuddyId: '',
    rejectReason: '',
    // 房间邀请
    roomInvitations: [],
  },

  onShow() {
    this.setData({ serverUrl: app.getServerUrl() })
    this.loadBuddies()
    this.loadRoomInvitations()
  },

  loadBuddies() {
    app.apiGetBuddies().then(buddies => {
      buddies.forEach((b, i) => {
        if (!b.color) b.color = this.data.colors[i % this.data.colors.length]
        b.displayName = b.remark || b.name
        b.initial = b.displayName.slice(0, 1)
        b.statusLabel = this.getStatusLabel(b.status, b.direction, b.rejectedReason)
      })
      const pendingCount = buddies.filter(b => b.status === 'pending' && b.direction === 'received').length
      this.setData({ buddies, pendingCount })
      this.filterBuddies()
    })
  },

  getStatusLabel(status, direction, rejectedReason) {
    if (status === 'accepted') return '已互为饭搭子'
    if (status === 'rejected' && rejectedReason === '对方已解除饭搭子关系') return '您已被对方抛弃'
    if (direction === 'sent') {
      if (status === 'pending') return '等待对方确认'
      if (status === 'rejected') return '已被拒绝'
    }
    if (direction === 'received') {
      if (status === 'pending') return '待处理申请'
    }
    return ''
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.filterBuddies()
  },

  filterBuddies() {
    const { buddies, activeTab } = this.data
    let filtered = buddies
    if (activeTab === 'pending') {
      filtered = buddies.filter(b => b.status === 'pending' && b.direction === 'received')
    } else if (activeTab === 'accepted') {
      filtered = buddies.filter(b => b.status === 'accepted' && b.rejectedReason !== '对方已解除饭搭子关系')
    }
    this.setData({ filteredBuddies: filtered })
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
      requestMessage: '',
    })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  preventClose() {},

  onSearchInput(e) {
    const query = e.detail.value.trim()
    this.setData({ searchQuery: query, selectedUser: null })
    if (this._searchTimer) clearTimeout(this._searchTimer)
    if (query.length < 1) {
      this.setData({ searchResults: [] })
      return
    }
    this._searchTimer = setTimeout(() => {
      wx.showLoading({ title: '搜索中...', mask: true })
      app.apiSearchUsers(query).then(results => {
        wx.hideLoading()
        results.forEach(r => { r._initial = r.name ? r.name.slice(0, 1) : '?' })
        this.setData({ searchResults: results })
      }).catch(() => {
        wx.hideLoading()
      })
    }, 300)
  },

  selectUser(e) {
    const idx = e.currentTarget.dataset.index
    const user = this.data.searchResults[idx]
    if (!user) return
    user._initial = user.name.slice(0, 1)
    this.setData({
      selectedUser: user,
      editRemark: user.name,
      requestMessage: '',
      selectMode: 'confirm',
    })
  },

  onRemarkInput(e) {
    this.setData({ editRemark: e.detail.value })
  },

  onRequestMessageInput(e) {
    this.setData({ requestMessage: e.detail.value })
  },

  sendRequest() {
    const user = this.data.selectedUser
    if (!user) return

    wx.showLoading({ title: '发送申请中...' })
    app.apiSaveBuddy({
      targetUserId: user._id,
      remark: this.data.editRemark.trim() || user.name,
      requestMessage: this.data.requestMessage.trim(),
    }).then(saved => {
      wx.hideLoading()
      this.setData({ showModal: false })
      this.loadBuddies()
      wx.showToast({ title: '申请已发送，等待对方确认', icon: 'success' })
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: err.message || '发送失败', icon: 'none' })
    })
  },

  acceptBuddy(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '处理中...' })
    app.apiAcceptBuddy(id).then(() => {
      wx.hideLoading()
      this.loadBuddies()
      wx.showToast({ title: '已同意，互为饭搭子', icon: 'success' })
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    })
  },

  showRejectModal(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      showRejectModal: true,
      rejectBuddyId: id,
      rejectReason: '',
    })
  },

  closeRejectModal() {
    this.setData({ showRejectModal: false })
  },

  onRejectReasonInput(e) {
    this.setData({ rejectReason: e.detail.value })
  },

  rejectBuddy() {
    const id = this.data.rejectBuddyId
    if (!id) return

    wx.showLoading({ title: '处理中...' })
    app.apiRejectBuddy(id, this.data.rejectReason.trim()).then(() => {
      wx.hideLoading()
      this.setData({ showRejectModal: false })
      this.loadBuddies()
      wx.showToast({ title: '已拒绝申请', icon: 'success' })
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
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

  /* ===== 待处理房间邀请 ===== */

  loadRoomInvitations() {
    const openid = app.getOpenid ? app.getOpenid() : ''
    if (!openid) return
    wx.request({
      url: this.data.serverUrl + '/api/room/invitations?openid=' + encodeURIComponent(openid),
      success: (res) => {
        if (!res.data || !res.data.data) return
        const list = res.data.data.filter(inv => inv.status === 'pending').map(inv => ({
          ...inv,
          timeAgo: this._timeAgo(inv.createdAt),
        }))
        this.setData({ roomInvitations: list })
      },
    })
  },

  _timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return '刚刚'
    if (min < 60) return min + '分钟前'
    return Math.floor(min / 60) + '小时前'
  },

  acceptRoomInvite(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '处理中...' })
    wx.request({
      url: this.data.serverUrl + '/api/room/invitations/' + id + '/accept',
      method: 'POST',
      success: (res) => {
        wx.hideLoading()
        if (res.data && res.data.data) {
          const code = res.data.data.roomCode
          this.loadRoomInvitations()
          wx.showToast({ title: '已接受邀请', icon: 'success' })
          // 跳转到房间页
          wx.navigateTo({ url: '/subpackages/room/index?roomCode=' + code })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '操作失败', icon: 'none' })
      },
    })
  },

  rejectRoomInvite(e) {
    const id = e.currentTarget.dataset.id
    wx.request({
      url: this.data.serverUrl + '/api/room/invitations/' + id + '/reject',
      method: 'POST',
      success: () => {
        this.loadRoomInvitations()
        wx.showToast({ title: '已拒绝', icon: 'success' })
      },
    })
  },
})
