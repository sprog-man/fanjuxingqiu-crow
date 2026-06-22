# 房间成员在线状态 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 断线不删成员，只标记 `online: false`，游戏只取在线成员参与。

**Architecture:** 后端 `close` 事件从 `removeMember` 改为设 `online=false` + 广播；`room:rejoin` 恢复 `online=true`；game handlers 只取 `online=true` 的成员。前端展示离线状态（灰色半透明 + 标签）。

**Tech Stack:** Node.js (ws), WeChat Mini Program

---

## File Structure

| 文件 | 改动 | 职责 |
|------|------|------|
| `project/backend/src/ws/roomManager.js` | 修改 | 成员模型加 `online` 字段 |
| `project/backend/src/ws/index.js` | 修改 | close 标离线，rejoin 恢复在线，room:leave 真删除 |
| `project/backend/src/ws/gameHandler.js` | 修改 | 游戏只取 `online=true` 成员 |
| `project/frontend/miniapp/subpackages/room/index.wxml` | 修改 | 离线状态标签 |
| `project/frontend/miniapp/subpackages/room/index.wxss` | 修改 | 离线样式 |

---

### Task 1: 成员模型加 `online` 字段

**Files:**
- Modify: `project/backend/src/ws/roomManager.js:4-21`

- [ ] **Step 1: 构造函数初始化成员加 `online: true`**

在 `Room` 构造函数的 `members` 初始成员对象中加 `online: true`：

```js
// roomManager.js line 7-9
this.members = [{
  id: hostId, nickname: hostNickname, avatar: hostAvatar || '',
  openid: hostOpenid || '', isHost: true, online: true
}];
```

- [ ] **Step 2: `addMember` 方法加 `online: true`**

```js
// roomManager.js line 17
addMember(id, nickname, avatar, openid) {
  this.members.push({
    id, nickname, avatar: avatar || '', openid: openid || '',
    isHost: false, online: true
  });
  this.touch();
}
```

- [ ] **Step 3: 提交**

```bash
git add project/backend/src/ws/roomManager.js
git commit -m "feat: room member 增加 online 字段"
```

---

### Task 2: close 事件改标离线，room:leave 保持不变

**Files:**
- Modify: `project/backend/src/ws/index.js:157-171`

- [ ] **Step 1: close 事件改为标记 `online: false` + 广播**

```js
// ws/index.js line 157-171 —— 替换 close 处理
ws.on('close', () => {
  // 清理 userSockets 映射
  if (ws.openid) userSockets.delete(ws.openid);

  const leaveCode = ws.roomCode;
  if (!leaveCode) return;
  const leaveRoom = rooms.getRoom(leaveCode);
  if (leaveRoom) {
    const member = leaveRoom.findMember(ws.id);
    if (member) {
      member.online = false;
      console.log(`[ws] disconnect -> code=${leaveCode} member=${member.nickname} 标记离线`);
      broadcast(leaveCode, 'room:members', { members: leaveRoom.members });
    }
  }
});
```

逻辑变化：
- 不再调用 `removeMember`，而是找对应 member 设 `online: false`
- 移除 `if (leaveRoom.members.length > 0)` 条件，即使全员离线也要广播（让前端显示离线状态）
- 输出日志改为 `标记离线`

- [ ] **Step 2: 验证 `room:leave` 事件（显式退出）**

`room:leave` 保持现有逻辑不变（行 137-149），用户点"退出"按钮仍真删除成员：

```js
// ws/index.js line 137-149 —— 不做任何改动
case 'room:leave': {
  const leaveCode = ws.roomCode;
  if (!leaveCode) break;
  const leaveRoom = rooms.getRoom(leaveCode);
  if (leaveRoom) {
    leaveRoom.removeMember(ws.id);
    console.log(`[ws] room:leave -> code=${leaveCode} remaining=${leaveRoom.members.length}`);
    if (leaveRoom.members.length > 0) {
      broadcast(leaveCode, 'room:members', { members: leaveRoom.members });
    }
  }
  ws.roomCode = null;
  break;
}
```

- [ ] **Step 3: 提交**

```bash
git add project/backend/src/ws/index.js
git commit -m "feat: close 事件标记离线而非删除成员"
```

---

### Task 3: room:rejoin 恢复在线状态

**Files:**
- Modify: `project/backend/src/ws/index.js:88-103`

- [ ] **Step 1: rejoin 找到旧成员时恢复 `online: true`**

```js
// ws/index.js line 88-96 —— 替换 existing 分支
const existing = ws.openid ? rejoinRoom.findMemberByOpenid(ws.openid) : null;
if (existing) {
  existing.id = ws.id;
  existing.nickname = ws.nickname;
  existing.avatar = ws.avatar;
  existing.online = true;  // ← 新增
  console.log(`[ws] room:rejoin -> 已找到旧成员 openid=${ws.openid}，更新 socket id，恢复在线`);
}
```

`else` 分支（新增成员）不做改动，因为 `addMember` 已经在新 member 里设了 `online: true`。

- [ ] **Step 2: 提交**

```bash
git add project/backend/src/ws/index.js
git commit -m "feat: room:rejoin 恢复 member online=true"
```

---

### Task 4: 游戏只取在线成员

**Files:**
- Modify: `project/backend/src/ws/gameHandler.js:22-111`

- [ ] **Step 1: draw:start 只取 online=true 的成员**

```js
// gameHandler.js line 26
const players = room.members.filter(m => m.online !== false).map(m => m.nickname);
```

- [ ] **Step 2: croc:start 只取 online=true 的成员做 playerOrder**

```js
// gameHandler.js line 49
turnIndex: 0, playerOrder: room.members.filter(m => m.online !== false).map(m => m.id),
```

对应行调整 currentTurnName 和 currentTurnId 也使用过滤后的成员：
```js
// gameHandler.js line 55
const onlineMembers = room.members.filter(m => m.online !== false);
// 下面引用 onlineMembers 而非 room.members
```

完整替换 `croc:start` 的对应片段：

```js
case 'croc:start': {
  if (!room.host || room.host.id !== ws.id) {
    send('room:error', { message: '只有房主可以开始' }); break;
  }
  const totalTeeth = 14;
  const dangerIdx = Math.floor(Math.random() * totalTeeth);
  const board = [];
  for (let i = 0; i < totalTeeth; i++) {
    board.push({ index: i, isDanger: i === dangerIdx, state: 'active' });
  }
  const onlineMembers = room.members.filter(m => m.online !== false);
  room.gameState = {
    mode: 'croc', phase: 'playing', board,
    turnIndex: 0, playerOrder: onlineMembers.map(m => m.id),
  };
  const gh = createGameHandler(wss, rooms);
  gh.broadcast(roomCode, 'croc:start', {
    board,
    currentTurnName: onlineMembers[0].nickname,
    currentTurnId: onlineMembers[0].id,
  });
  break;
}
```

- [ ] **Step 3: pirate:start 做同样修改**

```js
// gameHandler.js line 103 —— 替换 playerOrder 行
const onlineMembers = room.members.filter(m => m.online !== false);
room.gameState = {
  mode: 'pirate', phase: 'playing', board,
  turnIndex: 0, playerOrder: onlineMembers.map(m => m.id),
};
```

以及 `pirate:start` 的 broadcast 数据（更新行 106-110）：

```js
gh.broadcast(roomCode, 'pirate:start', {
  board,
  currentTurnName: onlineMembers[0].nickname,
  currentTurnId: onlineMembers[0].id,
});
```

- [ ] **Step 4: 提交**

```bash
git add project/backend/src/ws/gameHandler.js
git commit -m "feat: 游戏只取在线成员参与"
```

---

### Task 5: 前端显示离线状态

**Files:**
- Modify: `project/frontend/miniapp/subpackages/room/index.wxml:61-66`
- Modify: `project/frontend/miniapp/subpackages/room/index.wxss`

- [ ] **Step 1: WXML 成员模板加离线标签**

在 `index.wxml` 行 61-66，成员渲染区加离线判断：

```xml
<view wx:for="{{members}}" wx:key="id" class="member-avatar {{item.online === false ? 'member-offline' : ''}}">
  <image wx:if="{{item.avatar}}" class="ma-circle-img {{item.online === false ? 'ma-offline-img' : ''}}" src="{{item.avatar}}" mode="aspectFill" />
  <view wx:else class="ma-circle {{item.online === false ? 'ma-offline-circle' : ''}}" style="background:{{item.color}}">{{item.nickname.slice(0,1)}}</view>
  <text class="ma-name {{item.online === false ? 'ma-offline-text' : ''}}">{{item.nickname}}</text>
  <text wx:if="{{item.isHost}}" class="ma-host">房主</text>
  <text wx:if="{{item.online === false}}" class="ma-offline-badge">离线</text>
</view>
```

- [ ] **Step 2: WXSS 加离线样式**

在 `index.wxss` 末尾添加：

```css
/* 离线状态 */
.member-offline { opacity: 0.55; }
.ma-offline-img { filter: grayscale(1); }
.ma-offline-circle { filter: grayscale(1); }
.ma-offline-text { color: rgba(255,255,255,0.35); }
.ma-offline-badge { font-size: 9px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 6px; margin-top: 1px; }
```

- [ ] **Step 3: 提交**

```bash
git add project/frontend/miniapp/subpackages/room/index.wxml project/frontend/miniapp/subpackages/room/index.wxss
git commit -m "feat: 前端展示成员离线状态"
```

---

## 自检清单

| 检查项 | 结果 |
|--------|------|
| 每个 spec 需求都有对应 task？ | 是 — 离线标记(T1-2)、恢复在线(T3)、游戏过滤(T4)、前端展示(T5) |
| 无占位符？ | 是 — 所有代码块都是完整代码 |
| 类型/方法签名一致？ | 是 — `online` 字段在所有文件中使用同一语义 |
| 无引用未定义的类型？ | 是 |
