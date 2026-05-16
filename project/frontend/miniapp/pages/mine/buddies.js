const app = getApp()

Page({
  data: {
    buddies: [],
    showModal: false,
    editBuddyId: null,
    editName: '',
    editPhone: '',
    colors: ['#D85A30', '#1D9E75', '#534AB7', '#185FA5', '#BA7517', '#e67e22', '#2C3E50', '#8e44ad'],
  },

  onShow() {
    this.loadBuddies()
  },

  loadBuddies() {
    const buddies = app.getBuddies()
    this.setData({ buddies })
  },

  showAdd() {
    this.setData({ showModal: true, editBuddyId: null, editName: '', editPhone: '' })
  },

  editBuddy(e) {
    const id = e.currentTarget.dataset.id
    const buddy = this.data.buddies.find(b => b.id === id)
    if (buddy) this.setData({ showModal: true, editBuddyId: id, editName: buddy.name, editPhone: buddy.phone || '' })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  onNameInput(e) {
    this.setData({ editName: e.detail.value })
  },
  onPhoneInput(e) {
    this.setData({ editPhone: e.detail.value })
  },
  preventClose() {},

  saveBuddy() {
    if (!this.data.editName.trim()) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return }
    const buddy = {
      id: this.data.editBuddyId,
      name: this.data.editName.trim(),
      phone: this.data.editPhone.trim(),
      color: this.data.editBuddyId
        ? this.data.buddies.find(b => b.id === this.data.editBuddyId)?.color
        : this.data.colors[this.data.buddies.length % this.data.colors.length],
    }
    app.saveBuddy(buddy)
    this.setData({ showModal: false })
    this.loadBuddies()
  },

  deleteBuddy(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个饭搭子吗？',
      success: (res) => {
        if (res.confirm) {
          app.deleteBuddy(id)
          this.loadBuddies()
        }
      }
    })
  }
})
