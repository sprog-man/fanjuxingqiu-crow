---
title: 关系概览修复 — 数据加载 + 未解锁称号隐藏 + 称号更换
date: 2026-05-20
status: draft
---

## Bug 清单

1. **头像不显示** — 后端 API 返回空 avatar 后 `processData` 用空串覆盖了本地值
2. **饭搭子数/聚餐次数为 0** — API 成功但返回空数据，`processData` 直接覆盖，不触发 `processLocal` 兜底
3. **未解锁称号展示在信息卡** — `highestTitle` 从 friends 条件计算，非从 `manuallyUnlocked` 取
4. **信息卡称号可点击更换** — 新功能：点击称号弹出已解锁列表，用户选择展示哪个

---

## 改动方案

### Bug 1: 头像不显示

**Root cause**: `processData` line 130:
```js
myAvatar: user.avatar || this.data.myAvatar,
```
当 API 返回 `user: { avatar: '' }`，`user.avatar` 为空字符串 — JS 中 `''` 是 falsy，所以 `this.data.myAvatar` 应生效。

但 `onLoad` 在 `loadData` **之前**设置 `myAvatar` 为 `app.globalData.userInfo.avatar_url`。如果 `avatar_url` 是临时路径（`wxfile://`）或 OSS 路径，需要确保不被覆盖。

**Fix**: 让 `onLoad` 中的 `myAvatar` 设置只在用户信息存在且头像 URL 是有效 HTTP URL 时使用：

```js
onLoad() {
  this.setData({ serverUrl: app.getServerUrl ? app.getServerUrl() : 'http://localhost:2001' })
  const userInfo = app.globalData.userInfo || {}
  const localAvatar = (userInfo.avatar_url && userInfo.avatar_url.indexOf('http') === 0) ? userInfo.avatar_url : ''
  this.setData({
    myNickname: userInfo.nickname || '我',
    myAvatar: localAvatar,
  })
  this.loadData()
},
```

同时 `processData` 保持 `myAvatar: user.avatar || this.data.myAvatar` 不变。

---

### Bug 2+3: 饭搭子数/聚餐次数为 0

**Root cause**: API `success` 回调直接覆盖数据，即使返回空 friends。`processLocal` 兜底只在 API `fail` 时触发。如果 API 成功但空数据（用户没在 DB 中找到），前端显示 0。

**Fix**: `processData` 处理后，如果 friends 为空，合并本地 buddies：

```js
processData(data) {
  const user = data.user || {}
  this.setData({
    myNickname: user.nickname || this.data.myNickname,
    myAvatar: user.avatar || this.data.myAvatar,
  })
  let friends = (data.friends || []).map((f, idx) => {
    const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
    return { ...f, initial: f.name ? f.name.slice(0, 1) : '?', avatarBg: ac.bg, avatarColor: ac.color }
  })
  
  // 如果 API 没返回数据，从本地 buddies 补充
  if (friends.length === 0) {
    const localBuddies = app.getAcceptedBuddies ? (app.getAcceptedBuddies() || []) : []
    const buddyFriends = localBuddies.map((b, idx) => {
      const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
      const name = b.remark || b.name
      return { name, gatherCount: 0, initial: name ? name.slice(0, 1) : '?', avatarBg: ac.bg, avatarColor: ac.color }
    })
    friends = buddyFriends
  }
  
  this.computeWithFriends(friends)
},
```

---

### Bug 4: 未解锁称号展示在信息卡

**Root cause**: `computeWithFriends` 中 `highestTitle` 从 `friends` 数据计算（条件达标），非从 `manuallyUnlocked`。

**Fix**: `highestTitle` 只从已手动解锁的称号中取最高的：

```js
computeWithFriends(friends) {
  let totalGatherCount = 0
  const conditionMetSet = new Set()
  friends.forEach(f => {
    totalGatherCount += f.gatherCount
    if (f.titleId) conditionMetSet.add(f.titleId)
  })

  const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []

  // 最高称号：只从已解锁的称号中取
  let highestTitle = ''
  let highestLevel = ''
  let highestIcon = ''
  if (manuallyUnlocked.length > 0) {
    for (const def of TITLE_DEFS) {
      if (manuallyUnlocked.includes(def.id)) {
        highestTitle = def.name
        highestLevel = def.level
        highestIcon = def.icon
        break  // TITLE_DEFS 按稀有度降序，第一个匹配的就是最高的
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
      highestIcon,
    }
  })
},
```

注意：`totalFriends` 统计的是 `friends.length`（好友数），不是饭搭子总数。如果要区分"饭搭子数"和"好友数"，需增加字段。但 friends 数组已包含所有饭搭子 + 聚餐伙伴，`friends.length` 即为饭搭子数。

---

### Bug 5: 称号更换功能

**需求**：点击信息卡上的称号 badge，弹出已解锁称号列表，用户选择展示哪个。

**新增 data**：
```js
showTitlePicker: false,
```

**新增方法**：
```js
openTitlePicker() {
  const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []
  if (manuallyUnlocked.length === 0) return
  const unlockedList = TITLE_DEFS.filter(d => manuallyUnlocked.includes(d.id))
  const currentTitle = this.data.userTitleInfo.highestTitle
  this.setData({
    titlePickerList: unlockedList.map(d => ({
      ...d,
      active: d.name === currentTitle,
    })),
    showTitlePicker: true,
  })
},

selectTitle(e) {
  const titleId = e.currentTarget.dataset.titleId
  const def = TITLE_DEFS.find(d => d.id === titleId)
  if (!def) return
  // 更新显示的称号（存入 storage 以便持久）
  const titles = wx.getStorageSync('manuallyUnlockedTitles') || []
  if (titles.includes(titleId)) {
    // 更新 userTitleInfo 中的 highestTitle 为选中项
    this.setData({
      showTitlePicker: false,
      'userTitleInfo.highestTitle': def.name,
      'userTitleInfo.highestLevel': def.level,
      'userTitleInfo.highestIcon': def.icon,
    })
    wx.setStorageSync('selectedDisplayTitle', titleId)
  }
},

closeTitlePicker() {
  this.setData({ showTitlePicker: false })
},
```

`onLoad` 时恢复上次选中的称号：
```js
const savedTitleId = wx.getStorageSync('selectedDisplayTitle') || ''
```

**WXML 改动**：
信息卡 title-badge 加 `bindtap`：
```xml
<view class="title-badge" wx:if="{{userTitleInfo.highestTitle}}" bindtap="openTitlePicker">
  <text class="title-badge-icon">✦</text>
  <text class="title-badge-text">{{userTitleInfo.highestTitle}}</text>
</view>
```

新增弹窗：
```xml
<view wx:if="{{showTitlePicker}}" class="modal-overlay" bindtap="closeTitlePicker">
  <view class="title-picker-card" catchtap="preventClose">
    <text class="title-picker-title">选择展示称号</text>
    <view wx:for="{{titlePickerList}}" wx:key="id" class="title-picker-item {{item.active ? 'active' : ''}}" data-title-id="{{item.id}}" bindtap="selectTitle">
      <view class="tp-icon" style="background:{{item.bg}};color:{{item.color}}">✦</view>
      <view class="tp-info">
        <text class="tp-name">{{item.name}}</text>
        <text class="tp-level">{{item.level}}</text>
      </view>
      <text wx:if="{{item.active}}" class="tp-check">✓</text>
    </view>
    <button class="title-picker-close" bindtap="closeTitlePicker">取消</button>
  </view>
</view>
```

**WXSS 样式**：
```css
.title-picker-card { background: #fff; border-radius: 20px; padding: 24px 20px; width: 280px; }
.title-picker-title { display: block; font-size: 16px; font-weight: 600; color: #2C2C2A; text-align: center; margin-bottom: 16px; }
.title-picker-item { display: flex; align-items: center; gap: 10px; padding: 12px 10px; border-radius: 12px; }
.title-picker-item:active { background: #f5f5f5; }
.title-picker-item.active { background: #FAECE7; }
.tp-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.tp-info { flex: 1; }
.tp-name { display: block; font-size: 14px; font-weight: 500; color: #2C2C2A; }
.tp-level { display: block; font-size: 11px; color: #888; margin-top: 2px; }
.tp-check { font-size: 18px; color: #D85A30; font-weight: 700; }
.title-picker-close { width: 100%; height: 40px; line-height: 40px; background: #f5f5f5; color: #2C2C2A; font-size: 14px; border-radius: 10px; margin-top: 12px; border: none; }
```

---

## 影响文件

| 文件 | 改动 |
|------|------|
| `project/frontend/miniapp/subpackages/mine/relation.js` | processData 本地补数据、computeWithFriends 只算已解锁称号、称号选择器 |
| `project/frontend/miniapp/subpackages/mine/relation.wxml` | 标题 badge 可点击、称号选择弹窗 |
| `project/frontend/miniapp/subpackages/mine/relation.wxss` | 称号选择器样式 |
