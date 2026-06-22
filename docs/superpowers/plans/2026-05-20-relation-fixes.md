# 关系概览修复 Implementation Plan

**Goal:** 修复关系概览数据加载、头像显示、未解锁称号隐藏、称号更换

**Files:** `relation.js`, `relation.wxml`, `relation.wxss`

---

### Task: 修复全部

- [ ] **Step 1: onLoad 过滤临时头像**

```js
const localAvatar = (userInfo.avatar_url && userInfo.avatar_url.indexOf('http') === 0) ? userInfo.avatar_url : ''
this.setData({ myNickname: userInfo.nickname || '我', myAvatar: localAvatar })
```

- [ ] **Step 2: processData 空数据时从本地 buddies 补**

Add after mapping friends:
```js
if (friends.length === 0) {
  const localBuddies = app.getAcceptedBuddies ? (app.getAcceptedBuddies() || []) : []
  friends = localBuddies.map((b, idx) => {
    const ac = AVATAR_COLORS[idx % AVATAR_COLORS.length]
    const name = b.remark || b.name
    return { name, gatherCount: 0, initial: name ? name.slice(0, 1) : '?', avatarBg: ac.bg, avatarColor: ac.color }
  })
}
```

- [ ] **Step 3: computeWithFriends highestTitle 只从 manuallyUnlocked 取**

Replace highest logic:
```js
let highestTitle = ''
let highestLevel = ''
if (manuallyUnlocked.length > 0) {
  for (const def of TITLE_DEFS) {
    if (manuallyUnlocked.includes(def.id)) { highestTitle = def.name; highestLevel = def.level; break }
  }
}
```

- [ ] **Step 4: WXML 称号 badge 加 bindtap + 称号选择器弹窗**

Title badge: add `bindtap="openTitlePicker"`. Add picker modal after unlock modal.

- [ ] **Step 5: 称号选择器 JS 方法 + WXSS 样式**

Add: openTitlePicker, selectTitle, closeTitlePicker, titlePickerList in data.

- [ ] **Step 6: Commit**

```bash
git add project/frontend/miniapp/subpackages/mine/relation.js project/frontend/miniapp/subpackages/mine/relation.wxml project/frontend/miniapp/subpackages/mine/relation.wxss
git commit -m "fix: 关系概览数据加载/头像/未解锁称号/称号更换"
```
