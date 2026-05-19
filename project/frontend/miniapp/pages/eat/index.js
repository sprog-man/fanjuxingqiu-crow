const app = getApp()

// 图片 OSS 远程地址（移出代码包以减小主包体积）
const IMG_BASE = 'https://fanjuxingqiu.oss-cn-beijing.aliyuncs.com/tarot'

function request(path, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    const app = getApp()
    const serverUrl = app.globalData.serverUrl || 'http://localhost:2001'
    wx.request({
      url: serverUrl + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => resolve(res.data),
      fail: (err) => reject(err)
    })
  })
}

const defaultDishes = {
  chuan: ['麻婆豆腐', '水煮鱼', '宫保鸡丁', '回锅肉', '夫妻肺片', '辣子鸡'],
  yue: ['白切鸡', '烧鹅', '虾饺', '肠粉', '叉烧', '煲仔饭'],
  ri: ['三文鱼刺身', '拉面', '天妇罗', '寿司拼盘', '烤鳗鱼', '章鱼小丸子'],
  han: ['韩式烤肉', '石锅拌饭', '泡菜汤', '炸鸡', '冷面', '部队锅'],
  xi: ['牛排', '意面', '凯撒沙拉', '奶油蘑菇汤', '披萨', '焗蜗牛'],
  su: ['罗汉斋', '素炒时蔬', '豆腐煲', '素饺子', '凉拌木耳', '素汉堡'],
  lu: ['糖醋鲤鱼', '九转大肠', '葱烧海参', '锅塌豆腐', '爆炒腰花', '德州扒鸡'],
  xiang: ['剁椒鱼头', '小炒黄牛肉', '农家小炒肉', '毛氏红烧肉', '腊味合蒸', '口味虾'],
  huaiyang: ['狮子头', '大煮干丝', '松鼠鳜鱼', '扬州炒饭', '水晶肴肉', '文思豆腐'],
  dongbei: ['锅包肉', '地三鲜', '铁锅炖', '酸菜白肉', '烤冷面', '酱骨架'],
  xibei: ['羊肉泡馍', '肉夹馍', '兰州拉面', '手抓羊肉', '凉皮', '大盘鸡'],
  xiaochi: ['臭豆腐', '煎饼果子', '麻辣烫', '烤串', '糖葫芦', '生煎包'],
}

const dishTags = {
  chuan: ['麻辣', '下饭', '鲜香', '甜辣', '咸香', '干香'],
  yue: ['清淡', '原味', '香脆', '蜜汁', '鲜美', '嫩滑'],
  ri: ['生鲜', '清淡', '浓郁', '酥脆', '精致', '街头'],
  han: ['烤肉', '辣酱', '酸辣', '酥脆', '清凉', '丰富'],
  xi: ['牛排', '精致', '番茄', '清爽', '浓郁', '芝士'],
  su: ['清淡', '养生', '健康', '家常', '爽脆', '轻食'],
  lu: ['酸甜', '经典', '高档', '家常', '快炒', '酥烂'],
  xiang: ['辣', '下饭', '家常', '甜咸', '咸香', '夜宵'],
  huaiyang: ['醇厚', '清淡', '酸甜', '经典', '冷盘', '刀工'],
  dongbei: ['酸甜', '家常', '豪放', '暖胃', '街头', '酱香'],
  xibei: ['面食', '肉香', '牛肉', '羊肉', '清凉', '辣'],
  xiaochi: ['街头', '面食', '辣', '烧烤', '甜食', '鲜美'],
}

Page({
  data: {
    view: 'categories',
    categories: [
      { id: 'chuan', name: '川菜', tarotCover: IMG_BASE + '/category/cat-chuan.png', tags: ['辣', '麻辣', '重口'] },
      { id: 'yue', name: '粤菜', tarotCover: IMG_BASE + '/category/cat-yue.png', tags: ['清淡', '鲜美', '精致'] },
      { id: 'ri', name: '日料', tarotCover: IMG_BASE + '/category/cat-ri.png', tags: ['清淡', '生鲜', '精致'] },
      { id: 'han', name: '韩餐', tarotCover: IMG_BASE + '/category/cat-han.png', tags: ['辣', '重口', '烤肉'] },
      { id: 'xi', name: '西餐', tarotCover: IMG_BASE + '/category/cat-xi.png', tags: ['精致', '牛排', '浪漫'] },
      { id: 'su', name: '素食', tarotCover: IMG_BASE + '/category/cat-su.png', tags: ['清淡', '健康', '轻食'] },
      { id: 'lu', name: '鲁菜', tarotCover: IMG_BASE + '/category/cat-lu.png', tags: ['咸鲜', '醇厚', '经典'] },
      { id: 'xiang', name: '湘菜', tarotCover: IMG_BASE + '/category/cat-xiang.png', tags: ['辣', '酸辣', '下饭'] },
      { id: 'huaiyang', name: '淮扬菜', tarotCover: IMG_BASE + '/category/cat-huaiyang.png', tags: ['醇厚', '清淡', '酸甜', '经典', '冷盘', '刀工'] },
      { id: 'dongbei', name: '东北菜', tarotCover: IMG_BASE + '/category/cat-dongbei.png', tags: ['量大', '炖菜', '豪放'] },
      { id: 'xibei', name: '西北菜', tarotCover: IMG_BASE + '/category/cat-xibei.png', tags: ['面食', '羊肉', '粗犷'] },
      { id: 'xiaochi', name: '小吃', tarotCover: IMG_BASE + '/category/cat-xiaochi.png', tags: ['街头', '零食', '特色'] },
    ],
    selectedCategory: null,
    moods: [
      { id: 'celebrate', name: '庆祝', icon: '🎉' },
      { id: 'daily', name: '日常', icon: '☕' },
      { id: 'explore', name: '探店', icon: '🔍' },
      { id: 'relax', name: '解压', icon: '🫂' },
    ],
    selectedMood: null,
    cards: [],
    flippedCount: 0,
    showResult: false,
    serverUrl: app.globalData.serverUrl || 'http://localhost:2001',
    backImages: [
      IMG_BASE + '/back/back-1.png',
      IMG_BASE + '/back/back-2.png',
      IMG_BASE + '/back/back-3.png',
      IMG_BASE + '/back/back-4.png',
      IMG_BASE + '/back/back-5.png',
    ],
    showAddDish: false,
    showManageDish: false,
    newDishName: '',
    newDishDesc: '',
    newDishTags: [],
    newDishImage: '',
    newDishImagePath: '',
    editingDishId: null,
    availableTags: ['辣', '清淡', '重口', '鲜美', '精致', '健康', '烤肉', '浪漫', '下饭', '家常', '特色', '甜品'],
    categoryDishes: [],
    allDishes: [],
    hasDishes: false,
    // Custom tag
    customTagInput: '',
    // Manage filter
    filterText: '',
    filterTags: [],
    filteredManageDishes: [],
    allDishTags: [],
    drawnDishes: [],
    activeCardIndex: -1,
    activeDish: null,
    showContinue: false,
    isLastFlip: false,
    resultDish: null,
  },

  stop() {},

  onLoad() {
    this.fetchCategories()
  },

  async fetchCategories() {
    try {
      const res = await request('/api/tarot/categories')
      if (res && res.data && res.data.length > 0) {
        const categories = res.data.map(c => {
          let tarotCover = c.tarotCover || ''
          if (tarotCover && !tarotCover.startsWith('http')) {
            tarotCover = IMG_BASE + tarotCover.replace('/images/tarot', '')
          }
          return { ...c, tarotCover }
        })
        this.setData({ categories })
      }
    } catch (e) {
      console.log('使用本地分类数据')
    }
  },

  async selectCategory(e) {
    const { id } = e.currentTarget.dataset
    const cat = this.data.categories.find(c => c.id === id)
    if (!cat) return

    this.setData({
      selectedCategory: cat,
      view: 'flip',
      selectedMood: null,
      flippedCount: 0,
      showResult: false,
      activeCardIndex: -1,
      activeDish: null,
      showContinue: false,
      isLastFlip: false,
      resultDish: null,
      drawnDishes: [],
    })

    await this.fetchCategoryDishes(id)
    this.initCards()
  },

  initCards() {
    const cards = []
    for (let i = 0; i < 5; i++) {
      cards.push({
        index: i,
        flipped: false,
        animating: false,
        expanded: false,
        backImage: this.data.backImages[i % this.data.backImages.length],
        dish: null,
      })
    }
    this.setData({ cards })
  },

  selectMood(e) {
    const { id } = e.currentTarget.dataset
    this.setData({ selectedMood: this.data.selectedMood === id ? null : id })
  },

  async flipCard(e) {
    const { index } = e.currentTarget.dataset
    const cards = [...this.data.cards]
    const card = cards[index]
    if (!card || card.flipped || card.animating) return

    if (!this.data.hasDishes) {
      wx.showModal({
        title: '暂无菜品',
        content: '该分类还没有菜品，请先添加菜品后再翻牌',
        confirmText: '去添加',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.openAddDish()
          }
        },
      })
      return
    }

    card.animating = true
    this.setData({ cards, activeCardIndex: index })

    const dish = await this.pickUniqueDish(this.data.selectedCategory.id)
    card.dish = dish

    this.setData({
      cards,
      activeDish: dish,
      showContinue: true,
      isLastFlip: this.data.flippedCount === 4,
    })
  },

  async pickUniqueDish(cuisineId) {
    const drawnNames = this.data.drawnDishes
    let pool = [...this.data.allDishes]

    if (pool.length === 0) {
      const localNames = defaultDishes[cuisineId] || ['神秘菜品']
      const localTags = dishTags[cuisineId] || []
      pool = localNames.map((name, i) => ({
        _uid: 'local_' + cuisineId + '_' + i,
        name,
        cuisineId,
        tags: [localTags[i % localTags.length]],
        description: '',
        image: '',
      }))
    }

    const available = pool.filter(d => !drawnNames.includes(d.name))
    if (available.length === 0) {
      this.setData({ drawnDishes: [] })
      const picked = pool[Math.floor(Math.random() * pool.length)]
      return { ...picked }
    }

    const picked = available[Math.floor(Math.random() * available.length)]
    this.setData({ drawnDishes: [...drawnNames, picked.name] })
    return { ...picked }
  },

  continueFlip() {
    const cards = [...this.data.cards]
    const idx = this.data.activeCardIndex
    if (idx >= 0 && cards[idx]) {
      cards[idx].flipped = true
      cards[idx].animating = false
      cards[idx].expanded = false
    }

    const flippedCount = cards.filter(c => c.flipped).length

    this.setData({
      cards,
      flippedCount,
      activeCardIndex: -1,
      activeDish: null,
      showContinue: false,
    })

    if (flippedCount === 5) {
      const flippedDishes = cards.filter(c => c.dish).map(c => c.dish)
      const pick = flippedDishes[Math.floor(Math.random() * flippedDishes.length)]
      this.setData({
        showResult: true,
        resultDish: pick,
      })
    }
  },

  dismissFlipResult() {
    const cards = [...this.data.cards]
    const idx = this.data.activeCardIndex
    if (idx >= 0 && cards[idx]) {
      cards[idx].flipped = true
      cards[idx].animating = false
      cards[idx].expanded = false
    }
    this.setData({
      cards,
      flippedCount: cards.filter(c => c.flipped).length,
      activeCardIndex: -1,
      activeDish: null,
      showContinue: false,
      isLastFlip: false,
    })
  },

  confirmDish() {
    const dish = this.data.activeDish
    if (!dish) return

    const cards = [...this.data.cards]
    const idx = this.data.activeCardIndex
    if (idx >= 0 && cards[idx]) {
      cards[idx].flipped = true
      cards[idx].animating = false
      cards[idx].expanded = false
    }

    wx.showToast({ title: '就吃「' + dish.name + '」！', icon: 'success' })
    this.setData({
      cards,
      flippedCount: cards.filter(c => c.flipped).length,
      activeCardIndex: -1,
      activeDish: null,
      showContinue: false,
      isLastFlip: false,
    })
  },

  backToCategories() {
    this.setData({
      view: 'categories',
      selectedCategory: null,
      showResult: false,
      resultDish: null,
    })
  },

  confirmResult() {
    const name = this.data.resultDish ? this.data.resultDish.name : '这个'
    wx.showToast({ title: '就吃「' + name + '」！', icon: 'success' })
  },

  retryFlip() {
    this.setData({
      flippedCount: 0,
      showResult: false,
      activeCardIndex: -1,
      activeDish: null,
      showContinue: false,
      isLastFlip: false,
      resultDish: null,
      drawnDishes: [],
    })
    this.initCards()
  },

  openAddDish() {
    this.setData({
      showAddDish: true,
      showManageDish: false,
      editingDishId: null,
      newDishName: '',
      newDishDesc: '',
      newDishTags: [],
      newDishImage: '',
      newDishImagePath: '',
      customTagInput: '',
    })
    this.fetchCategoryDishes(this.data.selectedCategory.id)
  },

  openManageDish() {
    this.setData({
      showManageDish: true,
      showAddDish: false,
      filterText: '',
      filterTags: [],
    })
    this.fetchCategoryDishes(this.data.selectedCategory.id)
  },

  closeAddDish() {
    this.setData({ showAddDish: false, editingDishId: null })
  },

  closeManageDish() {
    this.setData({ showManageDish: false, filterText: '', filterTags: [] })
  },

  /* ===== Custom Tag ===== */

  onCustomTagInput(e) {
    this.setData({ customTagInput: e.detail.value })
  },

  addCustomTag() {
    const tag = this.data.customTagInput.trim()
    if (!tag) return
    const tags = [...this.data.newDishTags]
    if (tags.includes(tag)) {
      wx.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    tags.push(tag)
    this.setData({ newDishTags: tags, customTagInput: '' })
  },

  /* ===== Manage Filter ===== */

  onFilterInput(e) {
    const filterText = e.detail.value
    this.setData({ filterText })
    this.applyManageFilter()
  },

  toggleFilterTag(e) {
    const tag = e.currentTarget.dataset.tag
    let filterTags = [...this.data.filterTags]
    const idx = filterTags.indexOf(tag)
    if (idx > -1) {
      filterTags.splice(idx, 1)
    } else {
      filterTags.push(tag)
    }
    this.setData({ filterTags })
    this.applyManageFilter()
  },

  applyManageFilter() {
    const text = this.data.filterText.trim().toLowerCase()
    const tags = this.data.filterTags
    let filtered = this.data.allDishes
    if (text) {
      filtered = filtered.filter(d => d.name.toLowerCase().includes(text))
    }
    if (tags.length > 0) {
      filtered = filtered.filter(d => d.tags && d.tags.some(t => tags.includes(t)))
    }
    this.setData({ filteredManageDishes: filtered })
  },

  clearFilter() {
    this.setData({ filterText: '', filterTags: [] })
    this.applyManageFilter()
  },

  onDishNameInput(e) {
    this.setData({ newDishName: e.detail.value })
  },

  onDishDescInput(e) {
    this.setData({ newDishDesc: e.detail.value })
  },

  toggleDishTag(e) {
    const { tag } = e.currentTarget.dataset
    const tags = [...this.data.newDishTags]
    const idx = tags.indexOf(tag)
    if (idx > -1) {
      tags.splice(idx, 1)
    } else {
      tags.push(tag)
    }
    this.setData({ newDishTags: tags })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        this.setData({ newDishImage: tempPath, newDishImagePath: tempPath })
      },
    })
  },

  removeImage() {
    this.setData({ newDishImage: '', newDishImagePath: '' })
  },

  async uploadImage(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: this.data.serverUrl + '/api/tarot/upload',
        filePath,
        name: 'file',
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (data.data && data.data.url) {
              resolve(data.data.url)
            } else {
              reject(new Error('upload failed'))
            }
          } catch (e) {
            reject(e)
          }
        },
        fail: reject,
      })
    })
  },

  async submitDish() {
    const name = this.data.newDishName.trim()
    if (!name) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    let imageUrl = this.data.newDishImage
    if (this.data.newDishImagePath) {
      try {
        imageUrl = await this.uploadImage(this.data.newDishImagePath)
      } catch (e) {
        wx.hideLoading()
        wx.showToast({ title: '图片上传失败', icon: 'none' })
        return
      }
    }

    const dishData = {
      name,
      cuisineId: this.data.selectedCategory.id,
      openid: app.getOpenid(),
      description: this.data.newDishDesc,
      tags: this.data.newDishTags,
      image: imageUrl,
    }

    try {
      if (this.data.editingDishId) {
        await request('/api/tarot/dishes/' + this.data.editingDishId, 'PUT', dishData)
        wx.hideLoading()
        wx.showToast({ title: '修改成功', icon: 'success' })
      } else {
        await request('/api/tarot/dishes', 'POST', dishData)
        wx.hideLoading()
        wx.showToast({ title: '添加成功', icon: 'success' })
      }

      this.setData({
        newDishName: '',
        newDishDesc: '',
        newDishTags: [],
        newDishImage: '',
        newDishImagePath: '',
        editingDishId: null,
        customTagInput: '',
      })
      await this.fetchCategoryDishes(this.data.selectedCategory.id)
    } catch (e) {
      console.error('submit dish error:', e)
      wx.hideLoading()
      wx.showToast({ title: '操作失败: ' + (e.message || ''), icon: 'none' })
    }
  },

  async fetchCategoryDishes(cuisineId) {
    let dbDishes = []
    try {
      const openid = app.getOpenid()
      const res = await request('/api/tarot/dishes', 'GET', { cuisineId, openid })
      if (res && res.data && Array.isArray(res.data)) {
        dbDishes = res.data.map(d => ({
          ...d,
          _uid: d._id || d.id,
          image: d.image && d.image.startsWith('/uploads/') ? this.data.serverUrl + d.image : d.image,
        }))
        console.log('dbDishes loaded:', dbDishes.length)
      }
    } catch (e) {
      console.error('fetch dishes failed:', e)
    }

    const allDishes = dbDishes
    const hasDishes = allDishes.length > 0
    const tagSet = new Set()
    allDishes.forEach(d => (d.tags || []).forEach(t => tagSet.add(t)))
    const allDishTags = [...tagSet]

    this.setData({ categoryDishes: dbDishes, allDishes, hasDishes, allDishTags })
    if (this.data.showManageDish) this.applyManageFilter()
  },

  async deleteDish(e) {
    const { id } = e.currentTarget.dataset
    const dish = this.data.allDishes.find(d => d._id === id || d._uid === id)
    if (!dish) return

    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${dish.name}」吗？`,
      success: async (res) => {
        if (!res.confirm) return

        try {
          const openid = app.getOpenid()
          await request('/api/tarot/dishes/' + (dish._id || id) + '?openid=' + encodeURIComponent(openid), 'DELETE')
          wx.showToast({ title: '已删除', icon: 'success' })
          await this.fetchCategoryDishes(this.data.selectedCategory.id)
        } catch (e) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  async clearCategoryDishes() {
    const cat = this.data.selectedCategory
    if (!cat) return
    wx.showModal({
      title: '清空本菜系菜品',
      content: `确定要清空「${cat.name}」中所有你添加的菜品吗？系统预设菜品不受影响。`,
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '清空中...' })
        try {
          const openid = app.getOpenid()
          const r = await request('/api/tarot/dishes/clear?cuisineId=' + cat.id + '&openid=' + encodeURIComponent(openid), 'DELETE')
          wx.hideLoading()
          wx.showToast({ title: `已清空 ${r.data.deleted} 道菜品`, icon: 'success' })
          await this.fetchCategoryDishes(cat.id)
          this.applyManageFilter()
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '清空失败', icon: 'none' })
        }
      },
    })
  },

  editDish(e) {
    const { id } = e.currentTarget.dataset
    const dish = this.data.allDishes.find(d => d._id === id || d._uid === id)
    if (!dish) return

    this.setData({
      showAddDish: true,
      showManageDish: false,
      editingDishId: dish._id || null,
      newDishName: dish.name,
      newDishDesc: dish.description || '',
      newDishTags: dish.tags || [],
      newDishImage: dish.image || '',
      newDishImagePath: '',
      customTagInput: '',
    })
  },

  onCoverError(e) {
    const { index } = e.currentTarget.dataset
    const categories = [...this.data.categories]
    if (categories[index]) {
      categories[index].tarotCover = ''
      this.setData({ categories })
    }
  },
})
