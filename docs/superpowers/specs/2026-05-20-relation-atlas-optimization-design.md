---
title: 关系图鉴优化 — 动态数据 + 称号手动解锁动画
date: 2026-05-20
status: draft
---

## 问题清单

1. **关系概览「我的信息卡」** — 静态内容：无用户头像、无用户昵称、显示 `✦` 和 `我的`
2. **关系概览统计栏** — 饭搭子数没有真实数据（当前只从聚餐记录中算，没关联饭搭子列表）
3. **关系概览下方区域** — 空白，未展示已添加的饭搭子关系（当前 friend-grid 只从聚餐参与人提取，不是从饭搭子列表）
4. **称号图鉴解锁** — 当前条件达标自动解锁。需改为：首次达标时手动点击解锁 + 播放动画，点亮后永久解锁（storage 持久化）
5. **称号解锁动画** — 当前仅星星填充动画，太平淡。需按稀有度区分动画效果

---

## 影响文件

| 文件 | 改动 |
|------|------|
| `project/frontend/miniapp/subpackages/mine/relation.js` | 用户信息加载、手动解锁逻辑、称号动画 |
| `project/frontend/miniapp/subpackages/mine/relation.wxml` | 信息卡头像/昵称、解锁按钮、弹窗动画 |
| `project/frontend/miniapp/subpackages/mine/relation.wxss` | 头像样式、动画 keyframes |
| `project/backend/src/routes/relation.js` | `/api/relation/graph` 增加用户信息返回 |

---

## 1. 关系概览 — 动态「我的信息卡」

### 现状

WXML line 13-25:
```xml
<view class="my-card">
  <view class="my-avatar">
    <text class="my-avatar-text">{{userTitleInfo.highestIcon ? '✦' : '😊'}}</text>
  </view>
  <view class="my-info">
    <text class="my-name">我的</text>
    <text class="my-sub">饭搭子宇宙</text>
    ...
  </view>
</view>
```

### 改动

**relation.js:**

`onLoad` 或 `onShow` 中从 `app.globalData.userInfo` 读取用户信息：

```js
onLoad() {
  this.setData({ serverUrl: app.getServerUrl ? app.getServerUrl() : 'http://localhost:2001' })
  const userInfo = app.globalData.userInfo || {}
  this.setData({
    myNickname: userInfo.nickname || '我',
    myAvatar: userInfo.avatar_url || '',
  })
  this.loadData()
},
```

data init 增加：
```js
myNickname: '我',
myAvatar: '',
```

**relation.wxml:**

我的信息卡替换：
```xml
<view class="my-card">
  <view class="my-avatar">
    <image wx:if="{{myAvatar}}" class="my-avatar-img" src="{{myAvatar}}" mode="aspectFill" />
    <text wx:else class="my-avatar-text">{{myNickname.slice(0,1)}}</text>
  </view>
  <view class="my-info">
    <text class="my-name">{{myNickname}}</text>
    <text class="my-sub">饭搭子宇宙</text>
    <view class="title-badge" wx:if="{{userTitleInfo.highestTitle}}">
      <text class="title-badge-icon">{{userTitleInfo.highestIcon || '✦'}}</text>
      <text class="title-badge-text">{{userTitleInfo.highestTitle}}</text>
    </view>
  </view>
</view>
```

**relation.wxss:**

```css
.my-avatar-img { width: 54px; height: 54px; border-radius: 50%; }
```

---

## 2. 关系概览 — 从饭搭子列表拉数据

### 根因

当前 `/api/relation/graph` 只从聚餐记录（Gathering model）提取参与人作为 friend 数据。若用户有饭搭子但无聚餐记录，返回的 friends 为空数组。

### 改动方案

**后端 `routes/relation.js`：**

增加 require：
```js
const User = require('../models/user');
const Buddy = require('../models/buddy');
```

`/graph` handler 修改：先从 Buddy 表查出用户的所有已接受饭搭子，再合并 gathering 参与人数据。

```js
router.get('/graph', async (req, res) => {
  try {
    const userId = req.query.user_id || '我';
    
    // 1. 查聚餐记录
    const gatherings = await Gathering.find({
      $or: [
        { participants: userId },
        { creatorId: userId }
      ]
    }).lean();

    // 2. 查已接受饭搭子
    const buddyList = await Buddy.find({
      $or: [
        { fromOpenid: userId, status: 'accepted' },
        { toOpenid: userId, status: 'accepted' }
      ]
    }).lean();

    // 3. 从 buddyList 提取饭搭子名字
    const buddyNames = buddyList.map(b => {
      if (b.fromOpenid === userId) return b.toRemark || b.toNickname || b.toOpenid;
      return b.fromRemark || b.fromNickname || b.fromOpenid;
    }).filter(Boolean);

    // 4. 查所有相关用户信息（头像等）
    const allNames = [...new Set([...buddyNames, ...gatherings.flatMap(g => g.participants || [])])];
    const users = await User.find({ nickname: { $in: allNames } }).lean();
    const userMap = {};
    users.forEach(u => { userMap[u.nickname] = u; });

    // 5. 已有 gathering 计算的 friendMap（现有逻辑不变）
    const friendMap = {};
    // ... 现有的 gathering 循环计算代码不变 ...

    // 6. 合并饭搭子：确保每个 buddy 都在 friendMap 中
    buddyNames.forEach(name => {
      if (!friendMap[name]) {
        const u = userMap[name];
        friendMap[name] = {
          name, gatherCount: 0, cities: [], cityCount: 0,
          cuisineCount: 0, totalSpent: 0, happyCount: 0, moodAvg: 0,
          attendRate: 0, payRank: 0, newPlaceCount: 0,
        };
      }
    });

    // 7. 计算称号（现有逻辑不变）...
    // 8. 返回数据增加 user 信息 + buddyCount
    const userInfo = await User.findOne({ nickname: userId }).lean();

    res.json({
      data: {
        user: {
          name: userId,
          nickname: userInfo ? userInfo.nickname : userId,
          avatar: userInfo ? userInfo.avatar_url : '',
        },
        friends,
        buddyCount: buddyNames.length,
        totalGathers: gatherings.length,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

### 前端改动

**relation.js — 加载饭搭子列表兜底：**

`loadData` 中当 API 失败时，不仅从 gatherings 计算，还从本地 buddies 加载：

```js
loadData() {
  const serverUrl = app.getServerUrl ? app.getServerUrl() : 'http://localhost:2001'
  wx.request({
    url: serverUrl + '/api/relation/graph',
    method: 'GET',
    timeout: 3000,
    success: (res) => {
      const data = res.data.data
      this.processData(data)
    },
    fail: () => {
      // 兜底：同时从 gatherings + buddies 计算
      const local = wx.getStorageSync('gatherings') || []
      const localBuddies = app.getAcceptedBuddies() || []
      this.processLocal(local, localBuddies)
    }
  })
},
```

`processLocal` 增加 buddy 参数：
```js
processLocal(gatherings, localBuddies) {
  // ...现有 gathering 计算逻辑...
  
  // 确保所有饭搭子都在 friendMap 中
  localBuddies.forEach(b => {
    const name = b.remark || b.name
    if (name && !friendMap[name]) {
      friendMap[name] = {
        name, gatherCount: 0, cities: [], cityCount: 0,
        cuisineCount: 0, totalSpent: 0, happyCount: 0, moodAvg: 0,
        attendRate: 0, payRank: 0, newPlaceCount: 0,
      }
    }
  })
  
  // ...后续计算不变...
}
```

`computeWithFriends` 中 `totalFriends` 统计改为 `friends.length`（已包含所有饭搭子）。

---

## 3. 关系概览 — 饭搭子关系展示

当前 friend-grid 已展示好友卡片。修复 #2 后饭搭子数据能正确填充，grid 自动展示。无需额外布局改动。

空状态处理：当 `friends` 为空时显示提示：
```xml
<view wx:if="{{friends.length === 0}}" class="empty-state">
  <text class="empty-icon">👥</text>
  <text class="empty-text">还没有饭搭子关系</text>
  <text class="empty-hint">去添加饭搭子或创建聚餐记录吧</text>
</view>
```

---

## 4. 称号图鉴 — 首次手动解锁 + 永久点亮

### 核心规则

- **条件达标** → 显示「✦ 点击解锁」按钮（仅首次）
- **用户手动点击** → 播放解锁动画 → 写入 `wx.setStorageSync('manuallyUnlockedTitles')`
- **解锁后永久点亮** — 即使条件不再满足，已解锁称号始终保持 `unlocked: true`
- 统计栏「解锁称号」数从 `manuallyUnlocked.length` 读取

### 现状

`titleAtlas` 每个条目有 `unlocked: boolean`，通过 `computeWithFriends` 自动计算。用户无操作。

### 改动

**称号状态跟踪：**

```js
// data init
manualUnlocked: [],       // 已手动解锁的称号 id 列表（storage 持久化）
unlockableTitles: [],     // 可解锁但未解锁的称号 id 列表
```

`computeWithFriends` 中区分"可解锁"和"已手动解锁"：

```js
computeWithFriends(friends) {
  // ...计算 friends 和 unlockedSet 不变...

  const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []

  const atlas = TITLE_DEFS.map(def => {
    const conditionMet = unlockedSet.has(def.id)  // 原自动解锁条件
    const alreadyUnlocked = manuallyUnlocked.includes(def.id)
    return {
      ...def,
      unlocked: alreadyUnlocked,
      conditionMet: conditionMet,   // 新增：是否达到条件
      canUnlock: conditionMet && !alreadyUnlocked,  // 可手动解锁
    }
  })

  this.setData({
    friends,
    titleAtlas: atlas,
    unlockableTitles: atlas.filter(t => t.canUnlock).map(t => t.id),
    userTitleInfo: {
      totalFriends: friends.length,
      totalGatherCount,
      unlockedTitles: manuallyUnlocked.length,  // 改为手动解锁数
      highestTitle: highest.name,
      highestLevel: highest.level,
      highestIcon: highest.icon,
    }
  })
}
```

**可解锁称号的 UI 提示：**

在图鉴卡片上，当 `canUnlock` 为 true 时，显示「点击解锁」按钮：

```xml
<view wx:if="{{item.canUnlock}}" class="atlas-unlock-btn" data-title-id="{{item.id}}" bindtap="startUnlock">
  <text>✦ 点击解锁</text>
</view>
```

**手动解锁流程：**

```js
startUnlock(e) {
  const titleId = e.currentTarget.dataset.titleId
  const def = TITLE_DEFS.find(t => t.id === titleId)
  if (!def) return
  const friendName = '饭搭子' // 可从 friends 中找关联
  this.setData({
    unlockModalData: { ...def, friendName, animReady: false, animPhase: 0 },
  })
  // 启动动画
  setTimeout(() => {
    this.setData({ 'unlockModalData.animReady': true })
    this._runUnlockAnim(def.rarity)
  }, 300)
}

_confirmUnlock() {
  const titleId = this.data.unlockModalData.id
  const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []
  if (!manuallyUnlocked.includes(titleId)) {
    manuallyUnlocked.push(titleId)
    wx.setStorageSync('manuallyUnlockedTitles', manuallyUnlocked)
  }
  // 刷新图鉴
  this.computeWithFriends(this.data.friends)
  this.setData({ unlockModalData: null })
}
```

---

## 5. 称号解锁动画 — 按稀有度区分

### 当前动画

`showUnlockModal` / `demoUnlock`：星星逐个填充 `★→★★→★★★→★★★★→★★★★★`，间隔 150ms。

### 设计

每个稀有度动画效果：

| 稀有度 | 视觉效果 | 持续时间 | CSS 实现 |
|--------|----------|----------|----------|
| 传说 | 全屏金色粒子爆炸 + 图标放大发光 + 延迟渐显称号 + 闪烁边框 | 2.5s | particleField + iconPulse + glowBorder |
| 史诗 | 彩色粒子爆发 + 图标放大 + 称号渐显 | 2.0s | particleField(小) + iconPop + fadeIn |
| 稀有 | 图标弹跳 + 旋转光晕 | 1.5s | iconBounce + ringSpin |
| 进阶 | 图标放大 + 轻微弹跳 | 1.0s | iconScaleUp |
| 普通 | 淡入 + 微小上移 | 0.6s | fadeInUp |

**实现方式：**

使用 CSS animation + JS 控制动画阶段：

```js
_runUnlockAnim(rarity) {
  const durations = { '传说': 2500, '史诗': 2000, '稀有': 1500, '进阶': 1000, '普通': 600 }
  const duration = durations[rarity] || 1000
  this.setData({ 'unlockModalData.animPhase': 1 })

  // 阶段1: 入口特效
  setTimeout(() => {
    this.setData({ 'unlockModalData.animPhase': 2 })
  }, duration * 0.4)

  // 阶段2: 称号文字显示
  setTimeout(() => {
    this.setData({ 'unlockModalData.animPhase': 3 })
  }, duration * 0.7)

  // 阶段3: 完成
  setTimeout(() => {
    this.setData({ 'unlockModalData.animPhase': 4 })
  }, duration)
}
```

**WXSS keyframes by rarity:**

```css
/* 传说 - 粒子爆发 */
@keyframes particleBurst {
  0% { transform: scale(0); opacity: 1; }
  50% { transform: scale(3); opacity: 0.6; }
  100% { transform: scale(5); opacity: 0; }
}
@keyframes iconGodRay {
  0% { box-shadow: 0 0 0 rgba(255,215,0,0); }
  30% { box-shadow: 0 0 60px rgba(255,215,0,0.8), 0 0 120px rgba(255,215,0,0.4); }
  60% { box-shadow: 0 0 30px rgba(255,215,0,0.5); }
  100% { box-shadow: 0 0 0 rgba(255,215,0,0); }
}

/* 史诗 */
@keyframes iconEpicPop {
  0% { transform: scale(0.3); opacity: 0; }
  40% { transform: scale(1.3); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

/* 稀有 */
@keyframes iconBounce {
  0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(5deg); }
  70% { transform: scale(0.9) rotate(-3deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

/* 进阶 */
@keyframes iconScaleUp {
  0% { transform: scale(0.7); opacity: 0.3; }
  100% { transform: scale(1); opacity: 1; }
}

/* 普通 */
@keyframes fadeInUp {
  0% { transform: translateY(15px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
```

**弹窗 WXML 根据稀有度应用不同动画：**

```xml
<view class="modal-icon-wrap {{unlockModalData.animPhase >= 1 ? 'anim-' + (unlockModalData.rarity === '传说' ? 'godray' : unlockModalData.rarity === '史诗' ? 'epicpop' : unlockModalData.rarity === '稀有' ? 'bounce' : unlockModalData.rarity === '进阶' ? 'scaleup' : 'fadein') : ''}}">
  ...
</view>
```

**弹窗增加粒子装饰（传说/史诗专属）：**

```xml
<view wx:if="{{unlockModalData.rarity === '传说' && unlockModalData.animPhase >= 1}}" class="particle-container">
  <view class="particle p1"></view>
  <view class="particle p2"></view>
  <view class="particle p3"></view>
  <view class="particle p4"></view>
</view>
```

**移除演示按钮** — `demoUnlock` 按钮在称号图鉴 tab 中移除（改为真实解锁体验）。

---

## 边界情况

- **手动解锁前离开页面**：解锁弹窗关闭，storage 未写入，下次打开仍可解锁
- **旧数据兼容**：首次更新后，现有用户需登录一次触发初始化，已达标称号显示「点击解锁」
- **永久性**：一旦解锁写入 storage，永远不回退。即使聚餐记录删除，称号仍然点亮
- **同一设备多用户**：storage 按设备存储，切换用户不影响
- **后端无用户信息**：回退显示 `app.globalData.userInfo` 中的本地信息
