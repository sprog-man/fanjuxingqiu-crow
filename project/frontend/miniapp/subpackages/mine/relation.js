const app = getApp()

const TITLE_DEFS = [
  { id: 'soul_partner', name: '灵魂饭搭', rarity: '传说', icon: 'crown',
    level: '⭐⭐⭐⭐⭐', bg: '#FAECE7', color: '#993C1D',
    condition: '与同一人共餐 ≥ 8次',
    desc: '形影不离，吃遍人间的默契伙伴。每次聚餐都少不了你。',
    check: (r) => r.gatherCount >= 8 },
  { id: 'food_accomplice', name: '美食同谋', rarity: '史诗', icon: 'ufo',
    level: '⭐⭐⭐⭐', bg: '#EEEDFE', color: '#534AB7',
    condition: '共同消费 ≥ 500元',
    desc: '跨越菜系国界的猎奇搭档，没有你不敢吃的、没有你不敢点的。',
    check: (r) => r.totalSpent >= 500 },
  { id: 'food_wanderer', name: '流浪美食家', rarity: '史诗', icon: 'plane',
    level: '⭐⭐⭐⭐', bg: '#EEEDFE', color: '#534AB7',
    condition: '共同聚餐 ≥ 5次',
    desc: '走遍山河，用胃丈量世界的同行人。足迹在地图上连成诗。',
    check: (r) => r.gatherCount >= 5 },
  { id: 'feast_king', name: '饭局天王', rarity: '稀有', icon: 'pig-money',
    level: '⭐⭐⭐', bg: '#FAEEDA', color: '#854F0B',
    condition: '共同消费 ≥ 300元',
    desc: '财大气粗、豪气干云。每次都是最后一个放下筷子、第一个掏钱包的人。',
    check: (r) => r.totalSpent >= 300 },
  { id: 'happy_partner', name: '快乐搭档', rarity: '稀有', icon: 'confetti',
    level: '⭐⭐⭐', bg: '#FCEBEB', color: '#A32D2D',
    condition: '共餐 ≥ 5次且心情均分 ≥ 4',
    desc: '每次相聚都欢声笑语，吃什么不重要，重要的是和你一起。',
    check: (r) => r.gatherCount >= 5 && r.moodAvg >= 4 },
  { id: 'party_core', name: '聚会核心', rarity: '稀有', icon: 'users',
    level: '⭐⭐⭐', bg: '#E6F1FB', color: '#185FA5',
    condition: '共同聚餐 ≥ 5次',
    desc: '永远准时到场，缺了你就不热闹，你就是气氛的锚点。',
    check: (r) => r.gatherCount >= 5 },
  { id: 'explorer', name: '探店达人', rarity: '进阶', icon: 'map-search',
    level: '⭐⭐', bg: '#EAF3DE', color: '#3B6D11',
    condition: '共同聚餐 ≥ 3次',
    desc: '总能发现隐藏在小巷里的神仙馆子，是行走的美食攻略本。',
    check: (r) => r.gatherCount >= 3 },
  { id: 'vibe_leader', name: '气氛组长', rarity: '进阶', icon: 'sparkles',
    level: '⭐⭐', bg: '#EAF3DE', color: '#3B6D11',
    condition: '心情均分 ≥ 3.5',
    desc: '点菜必点对，聊天必起哄，有你在的饭桌永远不冷场。',
    check: (r) => r.moodAvg >= 3.5 },
  { id: 'passing_traveler', name: '偶遇旅人', rarity: '普通', icon: 'user',
    level: '⭐', bg: '#F1EFE8', color: '#5F5E5A',
    condition: '共同聚餐 1次',
    desc: '命运让我们共桌，期待下一次相逢。',
    check: (r) => r.gatherCount >= 1 },
  { id: 'new_friend', name: '新晋饭友', rarity: '普通', icon: 'user-plus',
    level: '⭐', bg: '#F1EFE8', color: '#5F5E5A',
    condition: '添加好友即解锁',
    desc: '才刚开始的缘分，未来可期。',
    check: () => true },
]

const RARITY_ORDER = ['传说', '史诗', '稀有', '进阶', '普通']
const RARITY_LABELS = {
  '传说': '传说',
  '史诗': '史诗',
  '稀有': '稀有',
  '进阶': '进阶',
  '普通': '普通',
}

const AVATAR_COLORS = [
  { bg: '#FAECE7', color: '#993C1D' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FCEBEB', color: '#A32D2D' },
  { bg: '#EAF3DE', color: '#3B6D11' },
  { bg: '#F1EFE8', color: '#5F5E5A' },
]

Page({
  data: {
    currentTab: 'overview',
    friends: [],
    detailFriend: null,
    userTitleInfo: { totalFriends: 0, totalGatherCount: 0, unlockedTitles: 0, highestTitle: '', highestLevel: '', highestIcon: '' },
    titleAtlas: [],
    recentMeals: [],
    myNickname: '我',
    myAvatar: '',
    serverUrl: 'http://localhost:2001',
    manualUnlocked: [],
    unlockableTitles: [],
    unlockModalData: null,
    animStarTimer: null,
    showTitlePicker: false,
    titlePickerList: [],
  },

  onLoad() {
    this.setData({ serverUrl: app.getServerUrl ? app.getServerUrl() : 'http://localhost:2001' })
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      myNickname: userInfo.nickname || '我',
      myAvatar: userInfo.avatar_url || '',
    })
    this.loadData()
  },

  onShow() {
    const userInfo = app.globalData.userInfo || {}
    if (userInfo.avatar_url) {
      this.setData({ myNickname: userInfo.nickname || this.data.myNickname, myAvatar: userInfo.avatar_url })
    }
  },

  onUnload() {
    if (this._avatarTimer) clearTimeout(this._avatarTimer)
    if (this.data.animStarTimer) clearTimeout(this.data.animStarTimer)
  },

  loadData() {
    const serverUrl = app.getServerUrl ? app.getServerUrl() : 'http://localhost:2001'
    const openid = (app.getOpenid && app.getOpenid()) || ''
    wx.request({
      url: serverUrl + '/api/relation/graph?openid=' + encodeURIComponent(openid),
      method: 'GET',
      timeout: 3000,
      success: (res) => {
        const data = res.data.data
        this.processData(data)
      },
      fail: () => {
        const local = wx.getStorageSync('gatherings') || []
        const localBuddies = app.getAcceptedBuddies ? (app.getAcceptedBuddies() || []) : []
        this.processLocal(local, localBuddies)
      }
    })
  },

  processData(data) {
    const user = data.user || {}
    const localUserInfo = app.globalData.userInfo || {}
    // 注意：不要在此处设置 myAvatar — 由 onLoad/onShow 负责
    this.setData({ myNickname: user.nickname || this.data.myNickname })
    // 从本地饭搭子数据中查找头像
    const localBuddies = app.getAcceptedBuddies ? (app.getAcceptedBuddies() || []) : []
    const buddyAvatarMap = {}
    localBuddies.forEach(b => {
      const name = b.remark || b.name
      buddyAvatarMap[name] = b._avatarUrl || b.avatar || b.avatar_url || ''
    })
    let friends = (data.friends || []).map((f, idx) => {
      const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
      return { ...f, avatar: f.avatar || buddyAvatarMap[f.name] || '', initial: f.name ? f.name.slice(0, 1) : '?', avatarBg: ac.bg, avatarColor: ac.color }
    })
    // API 空数据时从本地饭搭子补
    if (friends.length === 0) {
      friends = localBuddies.map((b, idx) => {
        const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
        const name = b.remark || b.name
        const friendData = { name, gatherCount: 0 }
        const titleInfo = this.computeTitle(friendData)
        const avatar = b._avatarUrl || b.avatar || b.avatar_url || ''
        return { name, avatar, gatherCount: 0, initial: name ? name.slice(0, 1) : '?', avatarBg: ac.bg, avatarColor: ac.color, ...titleInfo }
      })
    }
    this.computeWithFriends(friends)
  },

  processLocal(gatherings, localBuddies) {
    const userId = app.globalData.userInfo ? (app.globalData.userInfo.nickname || '我') : '我'
    const friendMap = {}
    const allGathers = gatherings.filter(g => {
      const p = g.participants || []; return p.includes(userId) || g.creatorId === userId
    })
    allGathers.forEach(g => {
      ;(g.participants || []).forEach(p => {
        if (p === userId) return
        if (!friendMap[p]) friendMap[p] = { name: p, gatherCount: 0, cities: new Set(), cuisines: new Set(), totalSpent: 0, moods: [], moodScores: [], payCount: 0, newPlaces: new Set() }
        const fr = friendMap[p]; fr.gatherCount++
        if (g.location && g.location.city) fr.cities.add(g.location.city)
        if (g.foodTags) g.foodTags.forEach(t => fr.cuisines.add(t))
        if (g.moodTags) fr.moods.push(...g.moodTags)
        if (g.moodScore) fr.moodScores.push(g.moodScore)
        if (g.totalCost) fr.totalSpent += g.totalCost / Math.max(g.participants.length - 1, 1)
        if (g.location && g.location.name) fr.newPlaces.add(g.location.name)
      })
    })
    // 合并本地饭搭子
    ;(localBuddies || []).forEach(b => {
      const name = b.remark || b.name
      if (name && !friendMap[name]) {
        friendMap[name] = { name, gatherCount: 0 }
      }
    })
    const payCounts = {}
    allGathers.forEach(g => { if (g.payer && g.payer !== userId) payCounts[g.payer] = (payCounts[g.payer] || 0) + 1 })
    const maxPay = Math.max(...Object.values(payCounts), 0)

    const friends = Object.entries(friendMap).map(([name, data], idx) => {
      const friend = {
        name, gatherCount: data.gatherCount,
        cities: [...data.cities], cityCount: data.cities.size,
        cuisineCount: data.cuisines.size,
        totalSpent: Math.round(data.totalSpent),
        happyCount: data.moods.filter(m => m === '开心' || m === '搞笑').length,
        moodAvg: data.moodScores.length > 0 ? data.moodScores.reduce((a, b) => a + b, 0) / data.moodScores.length : 0,
        attendRate: Math.min(1, data.gatherCount / Math.max(allGathers.length, 1)),
        payRank: payCounts[name] === maxPay && maxPay > 0 ? 1 : 0,
        newPlaceCount: data.newPlaces.size,
      }
      const titleInfo = this.computeTitle(friend)
      const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
      return {
        name, gatherCount: friend.gatherCount, cities: friend.cities,
        totalSpent: friend.totalSpent, initial: name ? name.slice(0, 1) : '?',
        avatarBg: ac.bg, avatarColor: ac.color,
        ...titleInfo,
      }
    })
    friends.sort((a, b) => b.gatherCount - a.gatherCount)
    this.computeWithFriends(friends)
  },

  computeTitle(rd) {
    for (const def of TITLE_DEFS) {
      if (def.check(rd)) return { title: def.name, level: def.level, titleId: def.id, desc: def.desc, titleBg: def.bg, titleColor: def.color, titleIcon: def.icon }
    }
    const d = TITLE_DEFS[TITLE_DEFS.length - 1]
    return { title: d.name, level: d.level, titleId: d.id, desc: d.desc, titleBg: d.bg, titleColor: d.color, titleIcon: d.icon }
  },

  computeWithFriends(friends) {
    let totalGatherCount = 0
    const conditionMetSet = new Set()
    friends.forEach(f => {
      totalGatherCount += f.gatherCount
      if (f.titleId) conditionMetSet.add(f.titleId)
    })

    // 新晋饭友：有饭搭子即解锁
    if (friends.length >= 1) conditionMetSet.add('new_friend')

    const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []

    // 最高称号只从已手动解锁的取
    let highestTitle = ''
    let highestLevel = ''
    if (manuallyUnlocked.length > 0) {
      // 优先用上次选中的称号
      const savedTitleId = wx.getStorageSync('selectedDisplayTitle') || ''
      if (savedTitleId && manuallyUnlocked.includes(savedTitleId)) {
        const savedDef = TITLE_DEFS.find(d => d.id === savedTitleId)
        if (savedDef) { highestTitle = savedDef.name; highestLevel = savedDef.level }
      }
      // 无保存记录则取最高稀有度的已解锁称号
      if (!highestTitle) {
        for (const def of TITLE_DEFS) {
          if (manuallyUnlocked.includes(def.id)) {
            highestTitle = def.name
            highestLevel = def.level
            break
          }
        }
      }
    }

    const atlas = TITLE_DEFS.map(def => ({
      ...def,
      unlocked: manuallyUnlocked.includes(def.id),
      conditionMet: conditionMetSet.has(def.id),
      canUnlock: conditionMetSet.has(def.id) && !manuallyUnlocked.includes(def.id),
    }))

    this.setData({
      friends,
      titleAtlas: atlas,
      unlockableTitles: atlas.filter(t => t.canUnlock).map(t => t.id),
      userTitleInfo: {
        totalFriends: friends.length,
        totalGatherCount,
        unlockedTitles: manuallyUnlocked.length,
        highestTitle,
        highestLevel,
        highestIcon: '',
      }
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab, detailFriend: null, unlockModalData: null })
  },

  showDetail(e) {
    const name = e.currentTarget.dataset.name
    const friend = this.data.friends.find(f => f.name === name)
    if (!friend) return
    const gatherings = wx.getStorageSync('gatherings') || []
    const userId = app.globalData.userInfo ? (app.globalData.userInfo.nickname || '我') : '我'
    const withFriend = gatherings.filter(g => {
      const p = g.participants || []
      return (p.includes(userId) || g.creatorId === userId) && p.includes(name)
    }).sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))

    let totalSpentByFriend = 0
    withFriend.forEach(g => {
      if (g.payer === name) totalSpentByFriend++
    })

    const recent = withFriend.slice(0, 5).map(g => ({
      title: g.title,
      date: g.dateTime,
      moodColor: this._moodToColor(g.moodScore),
      moodScore: g.moodScore || 0,
    }))

    const foodTags = [...new Set(withFriend.flatMap(g => g.foodTags || []))]
    const uniqueCities = [...new Set(withFriend.map(g => (g.location && g.location.city) || '').filter(Boolean))]

    const totalCost = withFriend.reduce((s, g) => s + (g.totalCost || 0), 0)
    const cityCount = uniqueCities.length

    this.setData({
      detailFriend: {
        ...friend,
        gatherCount: friend.gatherCount,
        cities: uniqueCities,
        cityCount,
        totalCost,
        payCount: totalSpentByFriend,
        recentMeals: recent,
        foodTags,
      }
    })
  },

  backToList() {
    this.setData({ detailFriend: null })
  },

  preventClose() {},

  _runUnlockAnim(rarity) {
    const durations = { '传说': 2500, '史诗': 2000, '稀有': 1500, '进阶': 1000, '普通': 600 }
    const duration = durations[rarity] || 1000
    this.setData({ 'unlockModalData.animPhase': 1 })

    setTimeout(() => {
      this.setData({ 'unlockModalData.animPhase': 2 })
    }, duration * 0.4)

    setTimeout(() => {
      this.setData({ 'unlockModalData.animPhase': 3 })
    }, duration * 0.7)

    setTimeout(() => {
      this.setData({ 'unlockModalData.animPhase': 4 })
    }, duration)
  },

  startUnlock(e) {
    const titleId = e.currentTarget.dataset.titleId
    const def = TITLE_DEFS.find(t => t.id === titleId)
    if (!def) return
    this.setData({
      unlockModalData: { ...def, friendName: '饭搭子', animReady: false, animPhase: 0 },
    })
    setTimeout(() => {
      const animClass = def.rarity === '传说' ? 'anim-godray' : def.rarity === '史诗' ? 'anim-epicpop' : def.rarity === '稀有' ? 'anim-bounce' : def.rarity === '进阶' ? 'anim-scaleup' : 'anim-fadein'
      this.setData({ 'unlockModalData.animReady': true, 'unlockModalData.animClass': animClass })
      this._runUnlockAnim(def.rarity)
    }, 300)
  },

  _confirmUnlock() {
    const titleId = this.data.unlockModalData.id
    const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []
    if (!manuallyUnlocked.includes(titleId)) {
      manuallyUnlocked.push(titleId)
      wx.setStorageSync('manuallyUnlockedTitles', manuallyUnlocked)
    }
    this.computeWithFriends(this.data.friends)
    this.setData({ unlockModalData: null })
  },

  openTitlePicker() {
    const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []
    if (manuallyUnlocked.length === 0) return
    const currentTitle = this.data.userTitleInfo.highestTitle
    const list = TITLE_DEFS.filter(d => manuallyUnlocked.includes(d.id)).map(d => ({ ...d, active: d.name === currentTitle }))
    this.setData({ titlePickerList: list, showTitlePicker: true })
  },
  selectTitle(e) {
    const titleId = e.currentTarget.dataset.titleId
    const def = TITLE_DEFS.find(d => d.id === titleId)
    if (!def) return
    wx.setStorageSync('selectedDisplayTitle', titleId)
    this.setData({
      showTitlePicker: false,
      'userTitleInfo.highestTitle': def.name,
      'userTitleInfo.highestLevel': def.level,
    })
  },
  closeTitlePicker() {
    this.setData({ showTitlePicker: false })
  },
  hideUnlockModal() {
    if (this.data.animStarTimer) clearTimeout(this.data.animStarTimer)
    this.setData({ unlockModalData: null })
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  },

  getProgressStyle(gatherCount) {
    const pct = Math.min(gatherCount / 10, 1) * 100
    let color = '#B4B2A9'
    if (pct >= 80) color = '#D85A30'
    else if (pct >= 40) color = '#1D9E75'
    return `width:${pct}%;background:${color}`
  },

  getLockHint(gatherCount) {
    if (gatherCount >= 2) return ''
    return `再聚${2 - gatherCount}次解锁`
  },

  getFoodTagStyle(tag) {
    const chuanYu = ['老火锅', '酸辣粉', '串串香', '钟水饺', '麻辣烫', '毛血旺', '辣子鸡', '水煮鱼', '烤鱼', '火锅', '麻辣', '川菜', '重庆']
    const riHan = ['日式拉面', '寿司', '刺身', '天妇罗', '味增汤', '韩式烤肉', '泡菜', '石锅拌饭', '日料', '韩式', '拉面']
    const xiShi = ['牛排', '披萨', '意面', '沙拉', '三明治', '汉堡', '薯条', '面包', '西餐', '蛋糕', '咖啡']
    const isChuanYu = chuanYu.some(k => tag.includes(k))
    const isRiHan = riHan.some(k => tag.includes(k))
    const isXiShi = xiShi.some(k => tag.includes(k))
    if (isChuanYu) return { bg: '#FAECE7', color: '#993C1D', label: '川渝' }
    if (isRiHan) return { bg: '#E1F5EE', color: '#0F6E56', label: '日韩' }
    if (isXiShi) return { bg: '#EEEDFE', color: '#534AB7', label: '西式' }
    return { bg: '#E6F1FB', color: '#185FA5', label: '其他' }
  },

  getMoodEmoji(score) {
    if (score >= 5) return '😄'
    if (score >= 4) return '😊'
    if (score >= 3) return '🙂'
    return '😐'
  },

  _moodToColor(score) {
    if (!score) return '#B4B2A9'
    if (score >= 4) return '#1D9E75'
    if (score >= 3) return '#D85A30'
    return '#B4B2A9'
  },

  previewImage(e) {
    // placeholder - avatar preview not needed in this view
  },
})
