---
title: 谁买单功能优化 — avatar 展示 / 海盗动画 / 离线返回房间
date: 2026-05-20
status: approved
---

## 问题清单

1. 多人在线抽签结果只显示名字首字，不显示头像
2. 单机海盗插刀弹出海盗被 `overflow: hidden` 裁剪
3. 多人在线海盗游戏缺少海盗跳出动画
4. 用户离线后无法直接返回房间，被迫重新加入导致重复成员
5. 单机抽签参与者从饭搭子添加后不显示头像

---

## #1 多人在线抽签 — reveal 阶段展示头像

### Server 改动

`project/backend/src/ws/gameHandler.js` — `draw:start` handler (line 22-35):

- 在 `draw:reveal` broadcast 中增加 `winnerAvatar` 字段
- 从 `room.members` 中找到 winner name 对应的 member，取其 `avatar` URL
- 示例：

```js
const winnerMember = room.members.find(m => m.nickname === winner);
const winnerAvatar = winnerMember ? winnerMember.avatar : '';
setTimeout(() => gh.broadcast(roomCode, 'draw:reveal', { winner, winnerAvatar }), 8500);
```

### Frontend 改动

`project/frontend/miniapp/subpackages/room/index.wxml` line 160-163:

- 当前：`<view class="rw-avatar golden-flash">{{drawWinner ? drawWinner.slice(0,1) : '?'}}</view>`
- 改为：优先显示 `<image>`，无头像时回退为首字

```xml
<view class="reveal-winner reveal-bounce-in">
  <image wx:if="{{winnerAvatar}}" class="rw-avatar-img golden-flash" src="{{winnerAvatar}}" mode="aspectFill" />
  <view wx:else class="rw-avatar golden-flash">{{drawWinner ? drawWinner.slice(0,1) : '?'}}</view>
  <text class="rw-name draw-name">{{drawWinner}}</text>
</view>
```

`project/frontend/miniapp/subpackages/room/index.js` — `draw:reveal` event handler:

- `setData` 中增加 `winnerAvatar` 字段存储
- 页面 data 初始化增加 `winnerAvatar: ''`

`project/frontend/miniapp/subpackages/room/index.wxss`:

- 新增 `.rw-avatar-img` 样式：`width: 110px; height: 110px; border-radius: 50%;`

---

## #2 单机海盗插刀 — 海盗弹出被裁剪

### Root cause

`project/frontend/miniapp/pages/pay/index.wxss` line 90:

```css
.barrel-wrap { overflow: hidden; ... }
```

`.pirate` 元素定位在 `top: -68px`，被父容器 `overflow: hidden` 裁剪。

### Fix

改为 `overflow: visible`，同时增加 `.barrel-wrap` 的 `min-height` 或 `padding-top` 给海盗弹出留空间：

```css
.barrel-wrap { overflow: visible; min-height: 360px; }
```

---

## #3 多人在线海盗 — 添加海盗跳出动画

### Server 改动

`project/backend/src/ws/gameHandler.js` — `pirate:start` / `pirate:result`:

不需要 server 改动。pirate:result 已广播 `{ loser, board }`。前端根据 `gameMode === 'pirate'` + `gameResult` 触发动画。

### Frontend 改动

`project/frontend/miniapp/subpackages/room/index.wxml` line 193-204:

在 `.barrel-section` 内的 `.barrel-body` 之后添加海盗弹出元素：

```xml
<view wx:if="{{gameMode === 'pirate'}}" class="barrel-section {{gameResult ? 'boomed' : ''}}">
  <view class="barrel {{gameResult ? 'shake' : ''}}">
    ...
    <view class="pirate {{gameResult ? 'pop' : ''}}">
      <text class="pirate-icon">🏴‍☠️</text>
    </view>
  </view>
</view>
```

`project/frontend/miniapp/subpackages/room/index.wxss`:

移植单机版海盗弹出相关 CSS（适配深色主题）：

```css
.pirate { position: absolute; top: -80px; left: 50%; transform: translateX(-50%) translateY(100%); transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); opacity: 0; z-index: 10; }
.pirate.pop { transform: translateX(-50%) translateY(0); opacity: 1; }
.pirate-icon { display: block; width: 52px; height: 52px; line-height: 52px; text-align: center; border-radius: 50%; font-size: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: pirateBounce 0.5s ease-in-out; }
```

注意 `.pirate-icon` 背景色用深色主题色（`#1a1a2e` 背景下的样式）。

`project/frontend/miniapp/subpackages/room/index.wxss` 增加 `@keyframes pirateBounce`。

`.barrel-section` 需要设置 `position: relative` 使 `.pirate` 相对定位。

---

## #4 离线返回房间按钮

### 设计思路

入口页面增加"返回房间"按钮。按钮点击前先向 server 查询房间是否还存在。存在则跳转，不存在则显示已过期。

### Server 改动

`project/backend/src/ws/index.js` — 新增 `room:check` 事件处理：

```js
case 'room:check': {
  const { roomCode: checkCode } = data || {};
  if (!checkCode) { send('room:check:result', { exists: false }); break; }
  const exists = !!rooms.getRoom(checkCode);
  send('room:check:result', { exists, roomCode: checkCode });
  break;
}
```

### Frontend 改动

**ws.js** — 需要在 `connect()` 之外提供一个只发 `room:check` 的轻量方法。新增函数：

```js
function checkRoom(roomCode) {
  return new Promise((resolve) => {
    const off = on('room:check:result', (data) => {
      off();
      resolve(data.exists);
    });
    send('room:check', { roomCode });
    setTimeout(() => { off(); resolve(false); }, 3000);
  });
}
```

**room/index.js** — 入口页面逻辑：

1. `onLoad` / `onShow` 时从 `wx.getStorageSync('lastRoomCode')` 读取上次房间号
2. 如果 `lastRoomCode` 有值，调用 `checkRoom(lastRoomCode)` 
3. 根据结果设置 `{ lastRoomCode, lastRoomValid: true/false }`
4. 入口页面显示"返回房间"按钮（有效时高亮，失效时灰色）
5. 点击按钮 → 调用 `ws.connect(lastRoomCode, ...)` → `room:rejoin`

**room/index.wxml** — 入口页面加按钮：

```xml
<view wx:if="{{lastRoomCode}}" class="rejoin-section">
  <button class="rejoin-btn {{lastRoomValid ? '' : 'disabled'}}" 
    disabled="{{!lastRoomValid}}" bindtap="_rejoinRoom">
    {{lastRoomValid ? '↩ 返回房间 ' + lastRoomCode : '⏳ 房间已过期'}}
  </button>
</view>
```

**room/index.wxss** — 按钮样式：

```css
.rejoin-section { text-align: center; padding: 12px 0; }
.rejoin-btn { height: 44px; line-height: 44px; background: linear-gradient(135deg, #FFD700, #FFA500); border-radius: 22px; font-size: 15px; font-weight: 600; color: #1a1a2e; border: none; }
.rejoin-btn.disabled { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); }
```

**ws.js** — `room:joined` 事件处理中持久化 room code：

```js
if (event === 'room:joined' && data && data.roomCode) {
  connectedRoomCode = data.roomCode;
  amIHost = !!data.isHost;
  reconnectAttempt = 0;
  wx.setStorageSync('lastRoomCode', data.roomCode);  // 新增
}
```

`ws.close()` 时不清除 `lastRoomCode`（只在用户明确手动退出时清除）。

`leaveRoom()` 中调用 `wx.removeStorageSync('lastRoomCode')`。

---

## #5 单机抽签 — 饭搭子导入显示头像

### Data Model Change

`project/frontend/miniapp/pages/pay/index.js`:

**data 初始化：** `players: []` 保持数组，元素从 string 改为 object `{name, avatar}`。

**addPlayer()** (line 151-156):
```js
addPlayer() {
  const name = this.data.inputName.trim()
  if (!name) return
  if (this.data.players.some(p => p.name === name)) { ... return }
  this.setData({ players: [...this.data.players, {name, avatar: ''}], inputName: '' })
}
```

**pickDrawBuddy(e)** (line 82-88):
```js
pickDrawBuddy(e) {
  const name = e.currentTarget.dataset.name
  const buddy = this.data.drawBuddies.find(b => b.name === name)
  if (!buddy) return
  if (this.data.players.some(p => p.name === name)) { ... return }
  const avatar = buddy._avatarUrl || buddy.avatar || ''
  this.setData({
    players: [...this.data.players, {name, avatar}],
    drawBuddies: this.markBuddiesAdded(this.data.drawBuddies, [...this.data.players, {name, avatar}]),
  })
}
```

**removePlayer(e)** (line 157-161): 按 index splice，不需要改。

### WXML Changes

所有 `wx:for="{{players}}"` 循环中，`.name` 替换 `item.name`，avatar 显示加条件判断：

**Circle items** (line 108):
```xml
<image wx:if="{{item.avatar}}" class="dic-avatar-img" src="{{item.avatar}}" mode="aspectFill" />
<view wx:else class="dic-avatar" style="background:{{colors[index % 8]}}">{{item.name.slice(0,1)}}</view>
```

**Spin items** (line 66): 同理。

**Eject items** (line 76-78): 同理，加 image 分支。

**Reveal phase** (line 92):
```xml
<image wx:if="{{winnerAvatar}}" class="rw-avatar-img golden-flash" src="{{winnerAvatar}}" mode="aspectFill" />
<view wx:else class="rw-avatar golden-flash">{{drawWinner ? drawWinner.slice(0,1) : '?'}}</view>
```

**Draw logic**: `_ejectWinner()` 中 winner 选取从 `players[Math.floor(Math.random() * players.length)]` 改为取 `.name`；`drawWinner` 只存 name；`winnerAvatar` 存对应 avatar URL。

**markBuddiesAdded**: 检查 `added` 时从 `list.includes(b.name)` 改为 `list.some(p => p.name === b.name)`。

### 边界情况

- 手动输入玩家 → avatar = ''
- 饭搭子导入 → avatar = 好友头像 URL
- 兼容旧数据：如果 `players` 中元素是字符串（老用户 session），`item.name || item` 兼容读取

---

## 影响文件清单

| 文件 | 改动 |
|------|------|
| `project/backend/src/ws/index.js` | 新增 `room:check` 事件 |
| `project/backend/src/ws/gameHandler.js` | `draw:reveal` 加 `winnerAvatar` |
| `project/frontend/miniapp/subpackages/room/index.wxml` | reveal 头像、海盗弹出、重连按钮 |
| `project/frontend/miniapp/subpackages/room/index.wxss` | 海盗弹出样式、重连按钮样式 |
| `project/frontend/miniapp/subpackages/room/index.js` | winnerAvatar 处理、重连逻辑 |
| `project/frontend/miniapp/subpackages/room/utils/ws.js` | checkRoom 函数、lastRoomCode 持久化 |
| `project/frontend/miniapp/pages/pay/index.js` | players 改为对象数组、avatar 传递 |
| `project/frontend/miniapp/pages/pay/index.wxml` | 各阶段 avatar 条件展示 |
| `project/frontend/miniapp/pages/pay/index.wxss` | 修复 overflow hidden、avatar img 样式 |
