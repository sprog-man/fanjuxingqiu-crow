const app = getApp()

Page({
  data: {
    steps: ['基础信息', '参与人员', '消费信息', '心情标签'],
    currentStep: 0,
    form: { title: '', date: '', time: '', locationName: '', city: '', participants: [], totalCost: '', moodScore: 0, moodTags: [], note: '' },
    participantInput: '', payerIndex: -1, payMode: 'aa',
    moodTagOptions: ['开心', '搞笑', '美味', '难忘', '踩雷'],
    moodTagSelected: [],
    customTagInput: '',
    aaPerPerson: 0,
    showBuddyModal: false, buddySearch: '', filteredBuddies: [],
    photos: [], photoPreviews: [], uploading: false,
    currentUser: '我',
    serverUrl: 'http://localhost:2001',
  },

  onLoad() {
    const userInfo = app.globalData.userInfo
    if (userInfo && userInfo.nickname) {
      this.setData({
        currentUser: userInfo.nickname,
        'form.participants': [userInfo.nickname]
      })
    } else {
      this.setData({
        'form.participants': ['我']
      })
    }
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ ['form.' + field]: value })
    if (field === 'totalCost') this.updateAAPerPerson(value)
  },
  updateAAPerPerson(totalCost) {
    const total = Number(totalCost) || 0
    const count = this.data.form.participants.length || 1
    this.setData({ aaPerPerson: Math.round(total / count) })
  },
  onFieldChange(e) { this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }) },
  onParticipantInput(e) { this.setData({ participantInput: e.detail.value }) },

  pickPhotos() {
    wx.chooseImage({
      count: 9 - this.data.photos.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const photos = [...this.data.photos, ...res.tempFilePaths]
        this.setData({ photos, photoPreviews: photos })
      }
    })
  },

  removePhoto(e) {
    const idx = e.currentTarget.dataset.index
    const photos = this.data.photos.filter((_, i) => i !== idx)
    this.setData({ photos, photoPreviews: photos })
  },

  addParticipant() {
    const name = this.data.participantInput.trim()
    if (!name) return
    if (this.data.form.participants.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    this.setData({ 'form.participants': [...this.data.form.participants, name], participantInput: '' })
  },
  removeParticipant(e) {
    const list = [...this.data.form.participants]; list.splice(e.currentTarget.dataset.index, 1)
    this.setData({ 'form.participants': list, payerIndex: -1 })
  },

  // 消费方式
  setPayMode(e) { this.setData({ payMode: e.currentTarget.dataset.mode }) },
  onPayerChange(e) { this.setData({ payerIndex: e.detail.value }) },

  // 心情标签
  setScore(e) { this.setData({ 'form.moodScore': e.currentTarget.dataset.score }) },
  toggleMoodTag(e) {
    const tag = e.currentTarget.dataset.tag
    const idx = e.currentTarget.dataset.index
    const tags = [...this.data.form.moodTags]
    const sel = [...this.data.moodTagSelected]
    if (sel[idx]) { tags.splice(tags.indexOf(tag), 1); sel[idx] = false }
    else { tags.push(tag); sel[idx] = true }
    this.setData({ 'form.moodTags': tags, moodTagSelected: sel })
  },
  onCustomTagInput(e) { this.setData({ customTagInput: e.detail.value }) },
  addCustomTag() {
    const tag = this.data.customTagInput.trim()
    if (!tag) return
    if (this.data.moodTagOptions.includes(tag)) { wx.showToast({ title: '标签已存在', icon: 'none' }); return }
    this.setData({
      moodTagOptions: [...this.data.moodTagOptions, tag],
      moodTagSelected: [...this.data.moodTagSelected, true],
      'form.moodTags': [...this.data.form.moodTags, tag],
      customTagInput: ''
    })
  },

  // 饭搭子
  markBuddiesAdded(buddies, list) {
    return buddies.map(b => ({ ...b, added: list.includes(b.name) }))
  },
  showBuddyPicker() {
    this.setData({
      showBuddyModal: true, buddySearch: '',
      filteredBuddies: this.markBuddiesAdded(app.getBuddies(), this.data.form.participants),
    })
  },
  closeBuddyPicker() { this.setData({ showBuddyModal: false }) },
  onBuddySearch(e) {
    const q = e.detail.value
    const all = this.markBuddiesAdded(app.getBuddies(), this.data.form.participants)
    this.setData({ buddySearch: q, filteredBuddies: all.filter(b => b.name.includes(q)) })
  },
  pickBuddy(e) {
    const name = e.currentTarget.dataset.name
    if (this.data.form.participants.includes(name)) { wx.showToast({ title: '已存在', icon: 'none' }); return }
    const newList = [...this.data.form.participants, name]
    this.setData({
      'form.participants': newList,
      filteredBuddies: this.markBuddiesAdded(this.data.filteredBuddies, newList),
    })
  },

  jumpStep(e) {
    if (e.currentTarget.dataset.step <= this.data.currentStep) this.setData({ currentStep: e.currentTarget.dataset.step })
  },

  validateStep(step) {
    const f = this.data.form
    if (step === 0 && (!f.title || !f.date || !f.locationName)) { wx.showToast({ title: '请填写完整基础信息', icon: 'none' }); return false }
    if (step === 1 && f.participants.length < 1) { wx.showToast({ title: '至少添加1位参与人', icon: 'none' }); return false }
    if (step === 2 && !f.totalCost) { wx.showToast({ title: '请输入消费金额', icon: 'none' }); return false }
    return true
  },

  nextStep() {
    if (this.data.currentStep === 2) {
      const total = Number(this.data.form.totalCost) || 0
      const count = this.data.form.participants.length || 1
      this.setData({ aaPerPerson: Math.round(total / count) })
    }
    if (!this.validateStep(this.data.currentStep)) return
    this.setData({ currentStep: this.data.currentStep + 1 })
  },
  prevStep() { this.setData({ currentStep: this.data.currentStep - 1 }) },

  submitForm() {
    if (!this.validateStep(2)) return
    const f = this.data.form
    const photos = this.data.photos
    const record = {
      _id: 'local_' + Date.now(), gathering_id: 'G' + Date.now(),
      title: f.title, dateTime: `${f.date}T${f.time || '12:00'}`,
      location: { name: f.locationName, city: f.city || '未知', lat: 0, lng: 0 },
      participants: f.participants, totalCost: Number(f.totalCost),
      payer: this.data.payerIndex >= 0 ? f.participants[this.data.payerIndex] : null,
      moodScore: f.moodScore || null, moodTags: f.moodTags, note: f.note,
      photos, foodTags: [], createdAt: new Date().toISOString(),
      creatorId: this.data.currentUser
    }

    // Save locally
    const local = wx.getStorageSync('gatherings') || []
    local.unshift(record)
    wx.setStorageSync('gatherings', local)

    // Try API async (don't wait)
    wx.request({ url: this.data.serverUrl + '/api/gathering/create', method: 'POST', data: record, timeout: 3000 })

    // Upload photos async
    if (photos.length > 0) {
      this.uploadPhotos(photos, record._id)
    }

    wx.showToast({ title: '创建成功 🎉' })
    setTimeout(() => wx.navigateBack(), 800)
  },

  uploadPhotos(photos, gatheringId) {
    const uploadTasks = photos.map(path => {
      return new Promise((resolve) => {
        wx.uploadFile({
          url: this.data.serverUrl + '/api/gathering/upload',
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
    Promise.all(uploadTasks).then(results => {
      const urls = results.flat().map(r => r.url)
      if (urls.length > 0) {
        wx.request({
          url: this.data.serverUrl + '/api/gathering/update-photos',
          method: 'POST',
          data: { gatheringId, photos: urls },
          timeout: 3000,
        })
      }
    })
  }
})
