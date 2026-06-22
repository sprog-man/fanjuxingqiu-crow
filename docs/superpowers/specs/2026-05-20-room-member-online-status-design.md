---
title: 房间成员在线状态 — 断线不删成员方案设计
date: 2026-05-20
status: approved
---

## 问题

用户 A 创建房间后切到微信发消息，WebSocket 被微信断开。服务端 `close` 事件执行 `removeMember` 把 A 从房间移除。此时用户 B 加入房间，成员列表只有自己一人，看不到 A。

## 根因

`ws/index.js` 的 `close` 事件处理是一刀切的 `removeMember`，没有区分"主动离开"和"临时断线"。

## 方案：断开不删人，只标记 `online: false`

### 数据模型变化（`roomManager.js`）

`Room` 构造时，`members` 中的每个成员新增字段：

```js
{
  id: "socket-id",
  nickname: "陈安",
  avatar: "...",
  openid: "...",
  isHost: true,
  online: true   // ← 新增
}
```

### 逻辑变化

#### `ws/index.js`

| 事件 | 当前行为 | 新行为 |
|------|---------|--------|
| `close`（断线） | `removeMember(ws.id)` | `member.online = false` + `broadcast('room:members')` |
| `room:rejoin`（重连） | 按 openid 查找更新 id | 额外把 `online` 设回 `true` |
| `room:leave`（主动退出） | 不变：`removeMember` | 不变：真删除 |

主动退出（用户点"退出"按钮）通过 `room:leave` 事件处理，不触发 `close` 的自动移除逻辑。`close` 只标记离线，不删除。

#### `gameHandler.js`

游戏开始（`draw:start`、`croc:start`、`pirate:start`）时，`players` / `playerOrder` 只从 `online === true` 的成员中选取。

#### `ws.js`（前端客户端）

`connectedRoomCode` 生命周期保持不变：

- 用户点退出 → `ws.close()` → `connectedRoomCode = ''` → 不会自动重连
- 被动断线 → `connectedRoomCode` 有值 → 自动重连 → `room:rejoin` → 恢复 `online: true`

小程序切后台被微信断线后，回到小程序时 `onSocketClose` 触发自动重连。

#### 前端展示（`index.wxml` + `index.wxss`）

成员头像右侧加离线标识：

```
[头像] 陈安  房主     ← 彩色，正常
[头像] 小王  离线     ← 灰色半透明 + 标签
```

### 边界情况

| 场景 | 处理 |
|------|------|
| 房主离线 | 其他成员不能开始游戏（房主校验保留），房主重连恢复 `isHost` |
| 全员离线 | 房间 10 分钟后自动过期回收（现有 cleanup 逻辑） |
| 断线重连时 openid 为空 | 作为新成员 addMember（和现在一样） |
| 房主离线期间另一人加入 | 新人能看到离线状态的房主 |

## 影响范围

- `project/backend/src/ws/roomManager.js` — 成员模型加 `online` 字段
- `project/backend/src/ws/index.js` — close 逻辑改为标记离线，rejoin 恢复在线
- `project/backend/src/ws/gameHandler.js` — 游戏只取在线成员
- `project/frontend/miniapp/subpackages/room/index.wxml` — 离线状态展示
- `project/frontend/miniapp/subpackages/room/index.wxss` — 离线样式
