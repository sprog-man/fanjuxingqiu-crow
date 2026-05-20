---
title: 关系图鉴最终修复 — 头像/饭搭子锁/称号条件/好友解锁
date: 2026-05-20
status: draft
---

## Bug 清单

1. **用户头像不显示** — `onLoad` 一次性读取，页面加载时 `userInfo` 可能为空
2. **饭搭子卡片被锁** — `lock-overlay` 条件 `gatherCount < 2`，本地兜底的数据 gatherCount=0
3. **新晋饭友未解锁** — `processData` 本地兜底没算 `titleId`，`conditionMetSet` 为空
4. **称号条件使用不可靠数据** — 改为基于 gatherCount / totalSpent / moodAvg

---

## 改动

### Bug 1: 头像不显示

`relation.js` 加 `onShow`，每次页面出现时刷新 userInfo：

```js
onShow() {
  const userInfo = app.globalData.userInfo || {}
  const localAvatar = (userInfo.avatar_url && userInfo.avatar_url.indexOf('http') === 0) ? userInfo.avatar_url : ''
  this.setData({
    myNickname: userInfo.nickname || this.data.myNickname,
    myAvatar: localAvatar || this.data.myAvatar,
  })
},
```

### Bug 2: 移除饭搭子锁

`relation.wxml` 移除 lock-overlay 相关元素（lines 47-51, 67）：

删除：
```xml
<!-- 锁定遮罩 -->
<view wx:if="{{item.gatherCount < 2}}" class="lock-overlay">
  <text class="lock-icon">🔒</text>
  <text class="lock-text">{{getLockHint(item.gatherCount)}}</text>
</view>
```

和
```xml
<view wx:if="{{item.gatherCount < 2}}" class="lock-overlay-bottom"></view>
```

### Bug 3: 本地兜底补 titleId

`processData` fallback 中加 title 计算：

```js
friends = localBuddies.map((b, idx) => {
  const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
  const name = b.remark || b.name
  const friendData = { name, gatherCount: 0 }
  const titleInfo = this.computeTitle(friendData)
  return { name, gatherCount: 0, initial: name ? name.slice(0, 1) : '?', avatarBg: ac.bg, avatarColor: ac.color, ...titleInfo }
})
```

### Bug 4: 称号条件修改

**前端** `TITLE_DEFS`：

| id | 条件 |
|----|------|
| soul_partner | gatherCount >= 8 |
| food_accomplice | totalSpent >= 500 |
| food_wanderer | gatherCount >= 5 |
| feast_king | totalSpent >= 300 |
| happy_partner | gatherCount >= 5 && moodAvg >= 4 |
| party_core | gatherCount >= 5 |
| explorer | gatherCount >= 3 |
| vibe_leader | moodAvg >= 3.5 |
| passing_traveler | gatherCount >= 1 |
| new_friend | () => true（保留）|

**后端** `routes/relation.js` 同步更新相同的 10 条规则。

`computeWithFriends` 中 `new_friend` 的 conditionMet 改为由 `friends.length >= 1` 触发：

```js
// computeWithFriends 中 conditionMetSet 构建后：
if (friends.length >= 1) conditionMetSet.add('new_friend')
```

### 影响文件

| 文件 | 改动 |
|------|------|
| `project/frontend/miniapp/subpackages/mine/relation.js` | +onShow、修正 fallback titleId、称号条件、new_friend 全局判断 |
| `project/frontend/miniapp/subpackages/mine/relation.wxml` | 移除 lock-overlay |
| `project/backend/src/routes/relation.js` | 同步称号条件 |
