# 谁买单功能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 多人在线抽签结果展示头像、海盗动画、离线返回房间、单机抽签头像展示

**Architecture:** 5 个独立任务，各改各自文件。Server 侧改 `gameHandler.js`（winnerAvatar）+ `ws/index.js`（room:check）。前端改 room 页（reveal 头像、海盗动画、重连按钮）和 pay 页（players 模型改为对象、overflow 修复）。

**Tech Stack:** Node.js (ws), WeChat Mini Program

---

## File Structure

| 文件 | 任务 |
|------|------|
| `project/backend/src/ws/gameHandler.js` | T1: draw:reveal 加 winnerAvatar |
| `project/backend/src/ws/index.js` | T4: room:check 事件 |
| `project/frontend/miniapp/subpackages/room/index.wxml` | T1, T3, T4 |
| `project/frontend/miniapp/subpackages/room/index.wxss` | T1, T3, T4 |
| `project/frontend/miniapp/subpackages/room/index.js` | T1, T4 |
| `project/frontend/miniapp/subpackages/room/utils/ws.js` | T4: checkRoom, lastRoomCode 持久化 |
| `project/frontend/miniapp/pages/pay/index.js` | T5 |
| `project/frontend/miniapp/pages/pay/index.wxml` | T5 |
| `project/frontend/miniapp/pages/pay/index.wxss` | T2, T5 |

---

### Task 1: 多人在线抽签 reveal 展示头像

**Files:**
- Modify: `project/backend/src/ws/gameHandler.js:22-35`
- Modify: `project/frontend/miniapp/subpackages/room/index.js`
- Modify: `project/frontend/miniapp/subpackages/room/index.wxml:160-163`
- Modify: `project/frontend/miniapp/subpackages/room/index.wxss`

- [ ] **Step 1: Server draw:start broadcast 加 winnerAvatar**

在 `gameHandler.js` `draw:start` case 中，`draw:reveal` broadcast 数据增加 `winnerAvatar`：

```js
case 'draw:start': {
  if (!room.host || room.host.id !== ws.id) {
    send('room:error', { message: '只有房主可以开始' }); break;
  }
  const onlineMembers = room.members.filter(m => m.online !== false);
  const players = onlineMembers.map(m => m.nickname);
  const winner = players[Math.floor(Math.random() * players.length)];
  const winnerMember = onlineMembers.find(m => m.nickname === winner);
  const winnerAvatar = winnerMember ? (winnerMember.avatar || '') : '';

  const gh = createGameHandler(wss, rooms);
  gh.broadcast(roomCode, 'draw:countdown', { count: 3 });
  setTimeout(() => gh.broadcast(roomCode, 'draw:countdown', { count: 2 }), 1000);
  setTimeout(() => gh.broadcast(roomCode, 'draw:countdown', { count: 1 }), 2000);
  setTimeout(() => gh.broadcast(roomCode, 'draw:spinning', { candidates: players, winner }), 3000);
  setTimeout(() => gh.broadcast(roomCode, 'draw:reveal', { winner, winnerAvatar }), 8500);
  break;
}
```

- [ ] **Step 2: 前端 room/index.js 处理 winnerAvatar**

在 `index.js` data 初始化和 `draw:reveal` handler 中增加 `winnerAvatar`：

data 初始化（`drawWinner: ''` 附近）加：
```js
winnerAvatar: '',
```

`_setupListeners` 中 `draw:reveal` 回调：
```js
ws.on('draw:reveal', (data) => {
  this.setData({
    drawPhase: 'reveal', drawWinner: data.winner,
    winnerAvatar: data.winnerAvatar || '',
    humorLine: anim.randomHumor(),
  });
});
```

`resetDraw` 方法清空 `winnerAvatar`：
```js
resetDraw() {
  // ...
  this.setData({
    gameMode: '', drawPhase: 'idle', drawWinner: '',
    winnerAvatar: '',  // ← 新增
    spinAngle: 0, spinPhase: '', spinRadius: 80, humorLine: '',
    ejectStyles: [], ejectLabel: '',
  });
}
```

- [ ] **Step 3: 前端 room/index.wxml reveal 阶段显示头像**

替换 line 160-163：

```xml
<!-- 中奖者 -->
<view class="reveal-winner reveal-bounce-in">
  <image wx:if="{{winnerAvatar}}" class="rw-avatar-img golden-flash" src="{{winnerAvatar}}" mode="aspectFill" />
  <view wx:else class="rw-avatar golden-flash">{{drawWinner ? drawWinner.slice(0,1) : '?'}}</view>
  <text class="rw-name draw-name">{{drawWinner}}</text>
</view>
```

- [ ] **Step 4: 前端 room/index.wxss 加头像样式**

在 `.rw-avatar` 附近添加：

```css
.rw-avatar-img { width: 110px; height: 110px; border-radius: 50%; }
```

- [ ] **Step 5: 提交**

```bash
git add project/backend/src/ws/gameHandler.js project/frontend/miniapp/subpackages/room/index.js project/frontend/miniapp/subpackages/room/index.wxml project/frontend/miniapp/subpackages/room/index.wxss
git commit -m "feat: 多人在线抽签 reveal 展示中奖人头像"
```

---

### Task 2: 单机海盗 overflow hidden 修复

**Files:**
- Modify: `project/frontend/miniapp/pages/pay/index.wxss:90`

- [ ] **Step 1: 改 overflow**

`.barrel-wrap` line 90：
```css
/* 改前 */
.barrel-wrap { background: #fff; border-radius: 20px; padding: 30px 16px 24px; margin-bottom: 12px; position: relative; overflow: hidden; min-height: 300px; }
/* 改后 */
.barrel-wrap { background: #fff; border-radius: 20px; padding: 30px 16px 24px; margin-bottom: 12px; position: relative; overflow: visible; min-height: 360px; }
```

- [ ] **Step 2: 提交**

```bash
git add project/frontend/miniapp/pages/pay/index.wxss
git commit -m "fix: 海盗插刀弹窗被 overflow hidden 裁剪"
```

---

### Task 3: 多人在线海盗弹出动画

**Files:**
- Modify: `project/frontend/miniapp/subpackages/room/index.wxml:193-204`
- Modify: `project/frontend/miniapp/subpackages/room/index.wxss`

- [ ] **Step 1: 房间 WXML 海盗区域加弹出元素**

`room/index.wxml` 的 pirate section（当前 line 193-204），在 `.barrel-body` 之后、`.barrel` 结束之前添加：

```xml
<view wx:if="{{gameMode === 'pirate'}}" class="barrel-section {{gameResult ? 'boomed' : ''}}">
  <view class="barrel {{gameResult ? 'shake' : ''}}">
    <view class="barrel-body">
      <view class="slot-grid">
        <view wx:for="{{gameBoard}}" wx:key="index" class="slot {{item.state}} {{isMyTurn ? 'clickable' : ''}}" data-index="{{index}}" bindtap="stabSlot">
          <view wx:if="{{item.state === 'stabbed'}}" class="knife"></view>
          <view wx:if="{{item.state === 'boom'}}" class="boom-effect">💥</view>
        </view>
      </view>
    </view>
    <!-- 海盗弹出 -->
    <view class="pirate {{gameResult ? 'pop' : ''}}">
      <text class="pirate-icon">🏴‍☠️</text>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 房间 WXSS 加海盗弹出样式**

在 `.barrel-section` 相关样式附近添加：

```css
/* 多人在线海盗弹出（适配深色主题） */
.barrel-section { position: relative; }
.pirate { position: absolute; top: -80px; left: 50%; transform: translateX(-50%) translateY(100%); transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); opacity: 0; z-index: 10; }
.pirate.pop { transform: translateX(-50%) translateY(0); opacity: 1; }
.pirate-icon { display: block; width: 52px; height: 52px; line-height: 52px; text-align: center; background: linear-gradient(135deg, #f5d6a8, #e8c090); border-radius: 50%; font-size: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: pirateBounce 0.5s ease-in-out; }
@keyframes pirateBounce { 0% { transform: scale(0.3) translateY(20px); } 50% { transform: scale(1.15) translateY(-5px); } 70% { transform: scale(0.95); } 100% { transform: scale(1) translateY(0); } }
```

`.barrel-section` 加 `position: relative`（使 `.pirate` 相对 .barrel 定位）。

`.barrel` 已具有 `position: relative`（没有的话在 room 的 WXSS 中添加）。

`.barrel-section` 已有 `background: rgba(255,255,255,0.06)` 与深色主题匹配。

- [ ] **Step 3: 提交**

```bash
git add project/frontend/miniapp/subpackages/room/index.wxml project/frontend/miniapp/subpackages/room/index.wxss
git commit -m "feat: 多人在线海盗游戏添加海盗跳出动画"
```

---

### Task 4: 离线返回房间按钮

**Files:**
- Modify: `project/backend/src/ws/index.js`
- Modify: `project/frontend/miniapp/subpackages/room/utils/ws.js`
- Modify: `project/frontend/miniapp/subpackages/room/index.js`
- Modify: `project/frontend/miniapp/subpackages/room/index.wxml`
- Modify: `project/frontend/miniapp/subpackages/room/index.wxss`

- [ ] **Step 1: Server 新增 room:check 事件**

在 `ws/index.js` switch 中，`default` 之前添加：

```js
case 'room:check': {
  const { roomCode: checkCode } = data || {};
  if (!checkCode) { send('room:check:result', { exists: false }); break; }
  const exists = !!rooms.getRoom(checkCode);
  send('room:check:result', { exists, roomCode: checkCode });
  break;
}
```

- [ ] **Step 2: 前端 ws.js 加 checkRoom 函数和 lastRoomCode 持久化**

在 `ws.js` 中新增：

```js
// 新增函数
function checkRoom(roomCode) {
  return new Promise((resolve) => {
    // 临时监听一次 room:check:result
    const handler = (data) => {
      off('room:check:result', handler);
      clearTimeout(timer);
      resolve(data.exists);
    };
    on('room:check:result', handler);
    send('room:check', { roomCode });
    const timer = setTimeout(() => {
      off('room:check:result', handler);
      resolve(false);
    }, 3000);
  });
}
```

在 `wx.onSocketMessage` 中，`room:joined` 处理加持久化（与 `connectedRoomCode = data.roomCode` 在同一块）：

```js
if (event === 'room:joined' && data && data.roomCode) {
  connectedRoomCode = data.roomCode;
  amIHost = !!data.isHost;
  reconnectAttempt = 0;
  wx.setStorageSync('lastRoomCode', data.roomCode);  // 新增
}
```

在 `close()` 函数中，不清除 `lastRoomCode`。但需要确保 `module.exports` 包括 `checkRoom`：

```js
module.exports = { connect, send, on, off, close, checkRoom };
```

- [ ] **Step 3: 前端 room/index.js 加返回房间逻辑**

data 初始化增加：
```js
lastRoomCode: '',
lastRoomValid: false,
```

`onShow` 中检查 `lastRoomCode`（如无 `onShow`，加在回调中。可在 `onLoad` 中处理）：

```js
onShow() {
  const saved = wx.getStorageSync('lastRoomCode') || '';
  if (saved) {
    this.setData({ lastRoomCode: saved });
    ws.checkRoom(saved).then(valid => {
      this.setData({ lastRoomValid: valid });
    });
  }
},
```

新增 `_rejoinRoom` 方法：
```js
_rejoinRoom() {
  if (!this.data.lastRoomValid) return;
  const app = getApp();
  const userInfo = app.globalData.userInfo || {};
  const nickname = userInfo.nickname || '我';
  const avatar = userInfo.avatar_url || '';
  const openid = (app.getOpenid && app.getOpenid()) || '';
  ws.connect(this.data.lastRoomCode, nickname, avatar, openid);
},
```

修改 `leaveRoom`，手动退出时清除 `lastRoomCode`：
```js
leaveRoom() {
  // ... 清理计时器 ...
  wx.removeStorageSync('lastRoomCode');
  ws.close();
  this.setData({
    pageState: 'entry', connecting: false,
    roomCode: '', members: [], isHost: false, mySocketId: '',
    gameMode: '', drawPhase: 'idle', gameResult: '',
    lastRoomCode: '', lastRoomValid: false,
  });
},
```

- [ ] **Step 4: 前端 room/index.wxml 入口页加返回按钮**

在 `entry-body` 内、"创建房间"卡片之上添加：

```xml
<view wx:if="{{lastRoomCode}}" class="rejoin-section">
  <button class="rejoin-btn {{lastRoomValid ? '' : 'disabled'}}"
    disabled="{{!lastRoomValid}}" bindtap="_rejoinRoom">
    {{lastRoomValid ? '↩ 返回房间 ' + lastRoomCode : '⏳ 房间已过期'}}
  </button>
</view>
```

- [ ] **Step 5: 前端 room/index.wxss 加返回按钮样式**

在 `.entry-body` 附近添加：

```css
.rejoin-section { text-align: center; padding: 4px 0 12px; }
.rejoin-btn { height: 44px; line-height: 44px; padding: 0 24px; background: linear-gradient(135deg, #FFD700, #FFA500); border-radius: 22px; font-size: 15px; font-weight: 600; color: #1a1a2e; border: none; width: 100%; }
.rejoin-btn.disabled { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); }
```

- [ ] **Step 6: 提交**

```bash
git add project/backend/src/ws/index.js project/frontend/miniapp/subpackages/room/utils/ws.js project/frontend/miniapp/subpackages/room/index.js project/frontend/miniapp/subpackages/room/index.wxml project/frontend/miniapp/subpackages/room/index.wxss
git commit -m "feat: 离线返回房间按钮 + room:check 事件"
```

---

### Task 5: 单机抽签饭搭子导入显示头像

**Files:**
- Modify: `project/frontend/miniapp/pages/pay/index.js`
- Modify: `project/frontend/miniapp/pages/pay/index.wxml`
- Modify: `project/frontend/miniapp/pages/pay/index.wxss`

**核心改动：** `players` 从 `string[]` 改为 `{name, avatar}[]`

- [ ] **Step 1: pay/index.js addPlayer 改为对象**

```js
addPlayer() {
  const name = this.data.inputName.trim()
  if (!name) return
  if (this.data.players.some(p => (p.name || p) === name)) {
    wx.showToast({ title: '已存在', icon: 'none' }); return
  }
  this.setData({ players: [...this.data.players, {name, avatar: ''}], inputName: '' })
},
```

- [ ] **Step 2: pickDrawBuddy 传 avatar**

```js
pickDrawBuddy(e) {
  const name = e.currentTarget.dataset.name
  const buddy = this.data.drawBuddies.find(b => b.name === name)
  if (!buddy) { wx.showToast({ title: '未找到', icon: 'none' }); return }
  if (this.data.players.some(p => (p.name || p) === name)) {
    wx.showToast({ title: '已存在', icon: 'none' }); return
  }
  const avatar = buddy._avatarUrl || buddy.avatar || ''
  const newPlayers = [...this.data.players, {name, avatar}]
  this.setData({
    players: newPlayers,
    drawBuddies: this.markBuddiesAdded(this.data.drawBuddies, newPlayers.map(p => p.name || p)),
  })
},
```

- [ ] **Step 3: removePlayer 按 index 删（逻辑不变，不需改）**

`removePlayer` 用 `splice(index, 1)` 操作数组，不需要改。

- [ ] **Step 4: markBuddiesAdded 适配对象数组**

当前检查 players.includes(name)。改为兼容新格式：

```js
markBuddiesAdded(buddies, list) {
  const names = list.map(p => p.name || p)
  return buddies.map(b => ({
    ...b,
    added: names.includes(b.name),
    _avatarUrl: b.avatar ? (b.avatar.indexOf('http') === 0 ? b.avatar : this.fullUrl(b.avatar)) : '',
  }))
},
```

注意：`_avatarUrl` 在 `openDrawBuddy` 调用时已设置，`pickDrawBuddy` 后重设 `drawBuddies` 时需确保重新计算 `markBuddiesAdded`。上面 `Step 2` 传递的第二个参数使用 `newPlayers.map(p => p.name || p)` 保持兼容。

- [ ] **Step 5: _ejectWinner 用 .name 取值**

```js
_ejectWinner() {
  const players = this.data.players;
  const winner = players.length ? players[Math.floor(Math.random() * players.length)].name : '';
  if (!players.length || !winner) return;
  // 以下不变...
},
```

`humorLine` 之后存 `winnerAvatar`：
```js
const winnerPlayer = players.find(p => (p.name || p) === winner);
const winnerAvatar = winnerPlayer ? (winnerPlayer.avatar || '') : '';
this.setData({
  ...
  drawWinner: winner,
  winnerAvatar,
  ...
});
```

在 `resetDraw` 中加 `winnerAvatar: ''` 清理。

- [ ] **Step 6: WXML 所有 players 循环改为对象渲染**

在 `pay/index.wxml` 中，搜索所有 `wx:for="{{players}}"` 的位置，每个 `item` 改为 `item.name` + 条件 avatar：

**准备阶段 circle (line 107-109)：**
```xml
<view wx:for="{{players}}" wx:key="index" class="dic-item" style="transform:rotate({{index * 360 / (players.length || 1)}}deg) translateY(-70px)">
  <image wx:if="{{item.avatar}}" class="dic-avatar-img" src="{{item.avatar}}" mode="aspectFill" />
  <view wx:else class="dic-avatar" style="background:{{['#D85A30','#1D9E75','#534AB7','#FF8C00','#E91E63','#00BCD4','#8BC34A','#FF5722'][index % 8]}}">{{(item.name || item).slice(0,1)}}</view>
  <text class="dic-name">{{item.name || item}}</text>
</view>
```

**Spin items (line 65)：**
```xml
<view wx:for="{{players}}" wx:key="index" class="spin-item {{spinPhase === 'cruise' ? 'si-blur' : ''}}" style="transform: rotate({{index * 360 / players.length}}deg) translateY(-{{spinRadius}}px)">
  <image wx:if="{{item.avatar}}" class="si-avatar-img" src="{{item.avatar}}" mode="aspectFill" />
  <view wx:else class="si-avatar" style="background:{{['#D85A30','#1D9E75','#534AB7','#FF8C00','#E91E63','#00BCD4','#8BC34A','#FF5722'][index % 8]}}">{{(item.name || item).slice(0,1)}}</view>
  <text class="si-name">{{item.name || item}}</text>
</view>
```

**Eject items (line 76-78)：**
```xml
<view wx:for="{{players}}" wx:key="index" class="eject-item"
      style="background:{{['#D85A30','#1D9E75','#534AB7','#FF8C00','#E91E63','#00BCD4','#8BC34A','#FF5722'][index % 8]}};{{ejectStyles[index]}}">
  <image wx:if="{{item.avatar}}" class="eject-item-img" src="{{item.avatar}}" mode="aspectFill" />
  <text wx:else>{{(item.name || item).slice(0,1)}}</text>
</view>
```

**Reveal (line 92)：** 添加头像展示（参考 Task 1 Step 3 的 reveal 写法，但用 pay 页的 class 名）：
```xml
<view class="reveal-winner reveal-bounce-in">
  <image wx:if="{{winnerAvatar}}" class="rw-avatar-img golden-flash" src="{{winnerAvatar}}" mode="aspectFill" />
  <view wx:else class="rw-avatar golden-flash">{{drawWinner ? drawWinner.slice(0,1) : '?'}}</view>
  <text class="rw-name">{{drawWinner}}</text>
</view>
```

**Player tags (line 42-45)：** 显示名字（兼容新旧格式）：
```xml
<view wx:for="{{players}}" wx:key="index" class="player-tag">
  <text>{{item.name || item}}</text>
  <text class="player-remove" data-index="{{index}}" bindtap="removePlayer">×</text>
</view>
```

- [ ] **Step 7: WXSS 加 avatar img 样式**

在 `pay/index.wxss` 添加：

```css
/* 抽签头像 */
.dic-avatar-img { width: 32px; height: 32px; border-radius: 50%; }
.si-avatar-img { width: 36px; height: 36px; border-radius: 50%; }
.eject-item-img { width: 44px; height: 44px; border-radius: 50%; }
.rw-avatar-img { width: 100px; height: 100px; border-radius: 50%; }
```

- [ ] **Step 8: 提交**

```bash
git add project/frontend/miniapp/pages/pay/index.js project/frontend/miniapp/pages/pay/index.wxml project/frontend/miniapp/pages/pay/index.wxss
git commit -m "feat: 单机抽签饭搭子导入显示头像"
```

---

## 自检清单

| 检查项 | 结果 |
|--------|------|
| Spec 每项都有对应 task？ | 是 — #1(T1) #2(T2) #3(T3) #4(T4) #5(T5) |
| 无占位符？ | 是 — 所有代码块完整 |
| 类型一致？ | 是 — winnerAvatar、players 对象结构在各 task 中一致 |
| 向后兼容？ | 是 — T5 `item.name \|\| item` 兼容旧字符串格式 |
