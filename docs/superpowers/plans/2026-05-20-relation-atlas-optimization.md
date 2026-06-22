# 关系图鉴优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 关系概览动态数据（用户头像/昵称/饭搭子列表）+ 称号手动解锁 + 按稀有度动画

**Architecture:** 后端 `/api/relation/graph` 增加 Buddy 查询和 User 信息返回。前端 relation 页增加头像展示、空状态提示、好友加载兜底。称号改用 storage 持久化手动解锁 + CSS 动画按稀有度区分。

**Tech Stack:** Node.js (Express/Mongoose), WeChat Mini Program

---

## File Structure

| 文件 | 任务 |
|------|------|
| `project/backend/src/routes/relation.js` | T1: 增加 Buddy+User 查询 |
| `project/frontend/miniapp/subpackages/mine/relation.js` | T2, T3, T4 |
| `project/frontend/miniapp/subpackages/mine/relation.wxml` | T2, T3, T4 |
| `project/frontend/miniapp/subpackages/mine/relation.wxss` | T2, T4 |

---

### Task 1: 后端 relation/graph 增加饭搭子列表 + 用户信息

**Files:**
- Modify: `project/backend/src/routes/relation.js`

- [ ] **Step 1: 增加 require**

```js
const User = require('../models/user');
const Buddy = require('../models/buddy');
```

- [ ] **Step 2: 重写 /graph handler**

替换现有的 `/graph` handler，增加 Buddy 查询和 User 信息返回：

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

    const buddyNames = buddyList.map(b => {
      if (b.fromOpenid === userId) return b.toRemark || b.toNickname || b.toOpenid;
      return b.fromRemark || b.fromNickname || b.fromOpenid;
    }).filter(Boolean);

    // 3. 查用户信息
    const allNames = [...new Set([...buddyNames, ...gatherings.flatMap(g => g.participants || []).filter(Boolean)])];
    const users = await User.find({ nickname: { $in: allNames } }).lean();
    const userMap = {};
    users.forEach(u => { userMap[u.nickname] = u; });

    // 4. 从 gathering 计算 friend 数据（现有逻辑）
    const friendMap = {};
    gatherings.forEach(g => {
      const participants = g.participants || [];
      if (!participants.includes(userId) && g.creatorId !== userId) return;
      participants.forEach(p => {
        if (p === userId) return;
        if (!friendMap[p]) {
          friendMap[p] = {
            name: p, gatherCount: 0, cities: new Set(),
            cuisines: new Set(), totalSpent: 0,
            moods: [], moodScores: [], payCount: 0, newPlaces: new Set(),
          };
        }
        const fr = friendMap[p];
        fr.gatherCount++;
        if (g.location && g.location.city) fr.cities.add(g.location.city);
        if (g.foodTags) g.foodTags.forEach(t => fr.cuisines.add(t));
        if (g.moodTags) fr.moods.push(...g.moodTags);
        if (g.moodScore) fr.moodScores.push(g.moodScore);
        if (g.totalCost) fr.totalSpent += g.totalCost / Math.max(participants.length - 1, 1);
        if (g.location && g.location.name) fr.newPlaces.add(g.location.name);
      });
    });

    // 5. 合并饭搭子：保证每个 buddy 在 friendMap 中
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

    // 6. 计算称号和 final friends 数组（现有逻辑不变）
    const payCounts = {};
    gatherings.forEach(g => {
      if (g.payer && (g.participants.includes(userId) || g.creatorId === userId) && g.payer !== userId) {
        payCounts[g.payer] = (payCounts[g.payer] || 0) + 1;
      }
    });
    const maxPay = Math.max(...Object.values(payCounts), 0);

    const titleRules = [
      { id: 'soulmate', name: '灵魂饭搭', level: '⭐⭐⭐⭐⭐', desc: '形影不离，吃遍人间的默契伙伴', check: (r) => r.gatherCount >= 8 },
      { id: 'food-conspirator', name: '美食同谋', level: '⭐⭐⭐⭐', desc: '跨越菜系国界的猎奇探险搭档', check: (r) => r.cuisineCount >= 6 },
      { id: 'wanderer', name: '流浪美食家', level: '⭐⭐⭐⭐', desc: '走遍山河，用胃丈量世界的同行者', check: (r) => r.cityCount >= 3 },
      { id: 'feast-king', name: '饭局天王', level: '⭐⭐⭐', desc: '财大气粗、豪气干云的聚餐主理人', check: (r) => r.payRank === 1 },
      { id: 'happy-partner', name: '快乐搭档', level: '⭐⭐⭐', desc: '每次相聚都欢声笑语的开心果', check: (r) => r.happyCount >= 3 },
      { id: 'core', name: '聚会核心', level: '⭐⭐⭐', desc: '永远准时出现，缺了你就不热闹', check: (r) => r.attendRate >= 0.9 },
      { id: 'explorer', name: '探店达人', level: '⭐⭐', desc: '总能发现隐藏小馆子的行走攻略', check: (r) => r.newPlaceCount >= 3 },
      { id: 'atmosphere', name: '气氛组长', level: '⭐⭐', desc: '点菜必点对，聊天必起哄的妙人', check: (r) => r.moodAvg >= 4 },
      { id: 'traveler', name: '偶遇旅人', level: '⭐', desc: '命运让我们共桌，期待下一次相逢', check: (r) => r.gatherCount >= 1 },
      { id: 'new-friend', name: '新晋饭友', level: '⭐', desc: '才刚开始的缘分，未来可期', check: () => true },
    ];

    function computeTitle(rd) {
      for (const rule of titleRules) {
        if (rule.check(rd)) return { title: rule.name, level: rule.level, desc: rule.desc, titleId: rule.id };
      }
      return { title: '新晋饭友', level: '⭐', desc: '才刚开始的缘分，未来可期', titleId: 'new-friend' };
    }

    const friends = Object.entries(friendMap).map(([name, data]) => {
      const friend = {
        name,
        gatherCount: data.gatherCount,
        cities: data.cities ? [...data.cities] : [],
        cityCount: data.cities ? data.cities.size || 0 : 0,
        cuisineCount: data.cuisines ? data.cuisines.size : 0,
        totalSpent: Math.round(data.totalSpent || 0),
        happyCount: (data.moods || []).filter(m => m === '开心' || m === '搞笑').length,
        moodAvg: (data.moodScores || []).length > 0
          ? data.moodScores.reduce((a, b) => a + b, 0) / data.moodScores.length : 0,
        attendRate: Math.min(1, data.gatherCount / Math.max(gatherings.length, 1)),
        payRank: payCounts[name] === maxPay && maxPay > 0 ? 1 : 0,
        newPlaceCount: data.newPlaces ? data.newPlaces.size : 0,
      };
      const titleInfo = computeTitle(friend);
      return {
        name,
        gatherCount: friend.gatherCount,
        cities: friend.cities,
        totalSpent: friend.totalSpent,
        ...titleInfo,
      };
    });

    friends.sort((a, b) => b.gatherCount - a.gatherCount);

    // 7. 查当前用户信息
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

- [ ] **Step 3: 提交**

```bash
git add project/backend/src/routes/relation.js
git commit -m "feat: relation/graph 增加饭搭子列表和用户信息"
```

---

### Task 2: 前端信息卡动态头像/昵称 + 空状态

**Files:**
- Modify: `project/frontend/miniapp/subpackages/mine/relation.js`
- Modify: `project/frontend/miniapp/subpackages/mine/relation.wxml`
- Modify: `project/frontend/miniapp/subpackages/mine/relation.wxss`

- [ ] **Step 1: relation.js data init + onLoad 读 userInfo**

data init 增加：
```js
myNickname: '我',
myAvatar: '',
```

`onLoad` 中读用户信息：
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

- [ ] **Step 2: processData 从后台数据提取用户信息**

```js
processData(data) {
  const user = data.user || {}
  // 后台数据优先，回退本地
  this.setData({
    myNickname: user.nickname || this.data.myNickname,
    myAvatar: user.avatar || this.data.myAvatar,
  })
  const friends = (data.friends || []).map((f, idx) => {
    const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
    return { ...f, initial: f.name ? f.name.slice(0, 1) : '?', avatarBg: ac.bg, avatarColor: ac.color }
  })
  this.computeWithFriends(friends)
},
```

- [ ] **Step 3: processLocal 增加 buddy 参数 + 合并到 friendMap**

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
      const local = wx.getStorageSync('gatherings') || []
      const localBuddies = app.getAcceptedBuddies ? (app.getAcceptedBuddies() || []) : []
      this.processLocal(local, localBuddies)
    }
  })
},
```

`processLocal(gatherings, localBuddies)` — 在函数签名加参数，在 friendMap 构建完后添加：

```js
processLocal(gatherings, localBuddies) {
  // ... 现有 gathering 循环计算代码，不变 ...
  
  // 在 building friendMap 之后、computeWithFriends 之前加入：
  ;(localBuddies || []).forEach(b => {
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

- [ ] **Step 4: WXML 信息卡展示头像 + 昵称 + 空状态**

替换我的信息卡：
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

好友网格后加空状态：
```xml
<view wx:if="{{friends.length === 0}}" class="empty-state">
  <text class="empty-icon">👥</text>
  <text class="empty-text">还没有饭搭子关系</text>
  <text class="empty-hint">去添加饭搭子或创建聚餐记录吧</text>
</view>
```

- [ ] **Step 5: WXSS 加头像/空状态样式**

```css
.my-avatar-img { width: 54px; height: 54px; border-radius: 50%; }
.empty-state { text-align: center; padding: 40px 24px; }
.empty-icon { display: block; font-size: 36px; margin-bottom: 8px; }
.empty-text { display: block; font-size: 15px; color: #2C2C2A; font-weight: 500; }
.empty-hint { display: block; font-size: 12px; color: #888; margin-top: 4px; }
```

- [ ] **Step 6: 提交**

```bash
git add project/frontend/miniapp/subpackages/mine/relation.js project/frontend/miniapp/subpackages/mine/relation.wxml project/frontend/miniapp/subpackages/mine/relation.wxss
git commit -m "feat: 关系概览动态头像/昵称 + 饭搭子列表 + 空状态"
```

---

### Task 3: 称号图鉴手动解锁 + storage 持久化

**Files:**
- Modify: `project/frontend/miniapp/subpackages/mine/relation.js`
- Modify: `project/frontend/miniapp/subpackages/mine/relation.wxml`

- [ ] **Step 1: data init 增加字段**

```js
manualUnlocked: [],
unlockableTitles: [],
```

- [ ] **Step 2: 替换 computeWithFriends 为手动解锁逻辑**

```js
computeWithFriends(friends) {
  let totalGatherCount = 0
  const conditionMetSet = new Set()
  let highestIdx = TITLE_DEFS.length
  friends.forEach(f => {
    totalGatherCount += f.gatherCount
    if (f.titleId) conditionMetSet.add(f.titleId)
    const idx = TITLE_DEFS.findIndex(t => t.id === f.titleId)
    if (idx >= 0 && idx < highestIdx) highestIdx = idx
  })
  const highest = highestIdx < TITLE_DEFS.length ? TITLE_DEFS[highestIdx] : TITLE_DEFS[TITLE_DEFS.length - 1]

  const manuallyUnlocked = wx.getStorageSync('manuallyUnlockedTitles') || []

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
      highestTitle: highest.name,
      highestLevel: highest.level,
      highestIcon: highest.icon,
    }
  })
},
```

- [ ] **Step 3: 添加 startUnlock 和 _confirmUnlock 方法**

```js
startUnlock(e) {
  const titleId = e.currentTarget.dataset.titleId
  const def = TITLE_DEFS.find(t => t.id === titleId)
  if (!def) return
  this.setData({
    unlockModalData: { ...def, friendName: '饭搭子', animReady: false, animPhase: 0 },
  })
  setTimeout(() => {
    this.setData({ 'unlockModalData.animReady': true })
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
```

- [ ] **Step 4: WXML 图鉴卡片增加「点击解锁」按钮**

在每个 `atlas-card` 内部（每个 rarity section 的卡片），增加 `canUnlock` 按钮：

```xml
<view wx:if="{{item.canUnlock}}" class="atlas-unlock-btn" data-title-id="{{item.id}}" bindtap="startUnlock">
  <text>✦ 点击解锁</text>
</view>
```

移除底部的演示按钮：
```xml
<!-- 删除这行 -->
<button class="demo-btn" bindtap="demoUnlock">演示称号解锁动画</button>
```

- [ ] **Step 5: 提交**

```bash
git add project/frontend/miniapp/subpackages/mine/relation.js project/frontend/miniapp/subpackages/mine/relation.wxml
git commit -m "feat: 称号手动解锁 + storage 持久化"
```

---

### Task 4: 称号解锁动画按稀有度区分

**Files:**
- Modify: `project/frontend/miniapp/subpackages/mine/relation.js`
- Modify: `project/frontend/miniapp/subpackages/mine/relation.wxml`
- Modify: `project/frontend/miniapp/subpackages/mine/relation.wxss`

- [ ] **Step 1: relation.js 添加 _runUnlockAnim 方法**

```js
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
    // Phase 4 = fully animated, show confirm button
  }, duration)
},
```

- [ ] **Step 2: WXML 解锁弹窗按稀有度渲染**

替换现有解锁弹窗内容，增加粒子特效、稀有度条件 class：

```xml
<view wx:if="{{unlockModalData}}" class="modal-overlay" bindtap="hideUnlockModal">
  <view class="modal-card {{unlockModalData?'modal-show':''}}" catchtap="preventClose">
    <!-- 传说专属粒子装饰 -->
    <view wx:if="{{unlockModalData.rarity === '传说' && unlockModalData.animPhase >= 1}}" class="particle-container">
      <view class="particle p1"></view><view class="particle p2"></view>
      <view class="particle p3"></view><view class="particle p4"></view>
      <view class="particle p5"></view><view class="particle p6"></view>
    </view>

    <text class="modal-kicker">✦ 称号解锁 ✦</text>

    <view class="modal-icon-wrap
      {{unlockModalData.animPhase >= 1 ? (
        unlockModalData.rarity === '传说' ? 'anim-godray' :
        unlockModalData.rarity === '史诗' ? 'anim-epicpop' :
        unlockModalData.rarity === '稀有' ? 'anim-bounce' :
        unlockModalData.rarity === '进阶' ? 'anim-scaleup' :
        'anim-fadein'
      ) : ''}}"
      style="background:{{unlockModalData.bg}}">
      <text class="modal-icon-text" style="color:{{unlockModalData.color}}">✦</text>
    </view>

    <text class="modal-title" style="opacity:{{unlockModalData.animPhase >= 2 ? 1 : 0}};transition:opacity 0.4s">{{unlockModalData.name}}</text>
    <text class="modal-stars">{{unlockModalData.level}}</text>
    <text class="modal-sub">与{{unlockModalData.friendName}}的羁绊升级了！</text>
    <text class="modal-desc" style="opacity:{{unlockModalData.animPhase >= 3 ? 1 : 0}};transition:opacity 0.4s">{{unlockModalData.desc}}</text>

    <button wx:if="{{unlockModalData.animPhase >= 4}}" class="modal-btn" bindtap="_confirmUnlock">领取称号</button>
  </view>
</view>
```

- [ ] **Step 3: WXSS 动画 keyframes**

添加各稀有度动画和粒子样式：

```css
/* 称号动画 */
.anim-godray { animation: iconGodRay 1.2s ease-out; }
.anim-epicpop { animation: iconEpicPop 0.8s ease-out; }
.anim-bounce { animation: iconBounce 0.6s ease-out; }
.anim-scaleup { animation: iconScaleUp 0.4s ease-out; }
.anim-fadein { animation: fadeInUp 0.3s ease-out; }

@keyframes iconGodRay {
  0% { transform: scale(0.3); opacity: 0; box-shadow: 0 0 0 rgba(255,215,0,0); }
  30% { transform: scale(1.4); box-shadow: 0 0 60px rgba(255,215,0,0.8), 0 0 120px rgba(255,215,0,0.4); }
  60% { transform: scale(0.95); box-shadow: 0 0 30px rgba(255,215,0,0.5); }
  100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 rgba(255,215,0,0); }
}
@keyframes iconEpicPop {
  0% { transform: scale(0.3); opacity: 0; }
  40% { transform: scale(1.3); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes iconBounce {
  0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(5deg); }
  70% { transform: scale(0.9) rotate(-3deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
@keyframes iconScaleUp {
  0% { transform: scale(0.7); opacity: 0.3; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes fadeInUp {
  0% { transform: translateY(15px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

/* 粒子容器 */
.particle-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; }
.particle { position: absolute; width: 8px; height: 8px; background: #FFD700; border-radius: 50%; opacity: 0; }
.particle.p1 { top: 10%; left: 20%; animation: particleBurst 0.8s ease-out 0.1s; }
.particle.p2 { top: 30%; right: 15%; animation: particleBurst 0.9s ease-out 0.2s; }
.particle.p3 { bottom: 40%; left: 10%; animation: particleBurst 0.7s ease-out 0.15s; }
.particle.p4 { bottom: 20%; right: 25%; animation: particleBurst 1.0s ease-out 0.25s; }
.particle.p5 { top: 50%; left: 5%; animation: particleBurst 0.8s ease-out 0.3s; }
.particle.p6 { top: 15%; right: 5%; animation: particleBurst 0.9s ease-out 0.35s; }

@keyframes particleBurst {
  0% { transform: scale(0) translateY(0); opacity: 1; }
  50% { transform: scale(2) translateY(-30px); opacity: 0.6; }
  100% { transform: scale(3) translateY(-60px); opacity: 0; }
}
```

- [ ] **Step 4: 确认弹窗 `.modal-card` 需要 `position: relative` 使粒子相对定位**

在 `.modal-card` 样式中添加 `position: relative; overflow: hidden;`。

- [ ] **Step 5: 提交**

```bash
git add project/frontend/miniapp/subpackages/mine/relation.js project/frontend/miniapp/subpackages/mine/relation.wxml project/frontend/miniapp/subpackages/mine/relation.wxss
git commit -m "feat: 称号解锁动画按稀有度区分"
```

---

## 自检清单

| 检查项 | 结果 |
|--------|------|
| Spec #1（信息卡头像）→ Task 2 | ✓ |
| Spec #2（饭搭子数据）→ Task 1 + Task 2 Step 3 | ✓ |
| Spec #3（关系展示）→ Task 2 Step 4（空状态） | ✓ |
| Spec #4（手动解锁）→ Task 3 | ✓ |
| Spec #5（稀有度动画）→ Task 4 | ✓ |
| 无占位符 | ✓ |
| 类型/方法名一致 | ✓ — `manuallyUnlockedTitles` storage key 统一 |
