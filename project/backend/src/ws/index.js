const { WebSocketServer } = require('ws');
const { RoomManager } = require('./roomManager');
const { createGameHandler, handleGameEvent } = require('./gameHandler');

// openid → {ws, nickname} 映射，用于向在线用户推送邀请
const userSockets = new Map();

module.exports = function attachWS(server) {
  const wss = new WebSocketServer({ server });
  const rooms = new RoomManager();
  console.log('[ws] WebSocket server attached, room cleanup every 60s');

  wss.on('connection', (ws, req) => {
    ws.id = req.headers['sec-websocket-key'] || Math.random().toString(36).slice(2);
    ws.roomCode = null;
    ws.nickname = null;
    ws.openid = null;
    ws._alive = true;
    ws.on('pong', () => { ws._alive = true; });

    const send = (event, data) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ event, data }));
    };

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
      const { event, data } = msg;

      switch (event) {
        case 'room:register': {
          // 注册用户 openid 以便接收邀请推送
          if (data && data.openid) {
            ws.openid = data.openid;
            userSockets.set(data.openid, { ws, nickname: data.nickname || '' });
            console.log(`[ws] room:register -> openid=${data.openid}`);
          }
          break;
        }
        case 'room:create': {
          const nickname = (data && data.nickname) || '匿名';
          const avatar = (data && data.avatar) || '';
          console.log(`[ws] room:create -> nickname=${nickname}, avatar=${avatar}, openid=${ws.openid || ''}`);
          ws.nickname = nickname;
          ws.avatar = avatar;
          const room = rooms.createRoom(ws.id, nickname, avatar, ws.openid);
          ws.roomCode = room.code;
          console.log(`[ws] room:create -> code=${room.code} host=${nickname} totalRooms=${rooms.rooms.size}`);
          console.log(`[ws] room:create -> members=${JSON.stringify(room.members)}`);
          send('room:joined', { roomCode: room.code, members: room.members, isHost: true, mySocketId: ws.id });
          break;
        }
        case 'room:join': {
          const { roomCode, nickname: joinName, avatar: joinAvatar } = data || {};
          console.log(`[ws] room:join -> code=${roomCode} nickname=${joinName}, avatar=${joinAvatar}, openid=${ws.openid || ''}`);
          if (!roomCode) { send('room:error', { message: '缺少房间码' }); break; }
          const room = rooms.getRoom(roomCode);
          if (!room) {
            console.log(`[ws] room:join FAIL -> room not found, existing codes=[${Array.from(rooms.rooms.keys()).join(',')}]`);
            send('room:error', { message: '房间不存在或已过期' });
            break;
          }
          ws.nickname = joinName || '匿名';
          ws.avatar = joinAvatar || '';
          ws.roomCode = roomCode;
          room.addMember(ws.id, ws.nickname, ws.avatar, ws.openid);
          console.log(`[ws] room:join OK -> code=${roomCode} joiner=${ws.nickname} members=${room.members.length}`);
          console.log(`[ws] room:join -> members=${JSON.stringify(room.members)}`);
          send('room:joined', { roomCode, members: room.members, isHost: false, mySocketId: ws.id });
          broadcast(roomCode, 'room:members', { members: room.members }, ws.id);
          break;
        }
        case 'room:rejoin': {
          const { roomCode: rejoinCode, nickname: rejoinName, avatar: rejoinAvatar } = data || {};
          console.log(`[ws] room:rejoin -> code=${rejoinCode} nickname=${rejoinName} openid=${ws.openid || ''}`);
          if (!rejoinCode) { send('room:error', { message: '缺少房间码' }); break; }
          const rejoinRoom = rooms.getRoom(rejoinCode);
          if (!rejoinRoom) {
            console.log(`[ws] room:rejoin FAIL -> room not found, codes=[${Array.from(rooms.rooms.keys()).join(',')}]`);
            send('room:error', { message: '房间不存在或已过期' });
            break;
          }
          ws.nickname = rejoinName || '匿名';
          ws.avatar = rejoinAvatar || '';
          ws.roomCode = rejoinCode;

          // 按 openid 查找已有成员（断线重连场景）
          const existing = ws.openid ? rejoinRoom.findMemberByOpenid(ws.openid) : null;
          if (existing) {
            existing.id = ws.id;
            existing.nickname = ws.nickname;
            existing.avatar = ws.avatar;
            console.log(`[ws] room:rejoin -> 已找到旧成员 openid=${ws.openid}，更新 socket id`);
          } else {
            rejoinRoom.addMember(ws.id, ws.nickname, ws.avatar, ws.openid);
            console.log(`[ws] room:rejoin -> 未找到旧成员，作为新成员添加`);
            // 检查是否是原始房主（close 时被移除后重连）
            if (ws.openid && ws.openid === rejoinRoom.hostOpenid && rejoinRoom.members.length > 0) {
              const last = rejoinRoom.members[rejoinRoom.members.length - 1];
              last.isHost = true;
              console.log(`[ws] room:rejoin -> 恢复 openid=${ws.openid} 的房主身份`);
            }
          }

          const isHost = rejoinRoom.host && rejoinRoom.host.id === ws.id;
          send('room:joined', { roomCode: rejoinCode, members: rejoinRoom.members, isHost, mySocketId: ws.id });
          broadcast(rejoinCode, 'room:members', { members: rejoinRoom.members }, ws.id);
          break;
        }
        case 'room:invite': {
          // 邀请好友：data = { toOpenid, roomCode, fromNickname }
          const { toOpenid, roomCode: invRoomCode, fromNickname } = data || {};
          console.log(`[ws] room:invite -> to=${toOpenid} room=${invRoomCode} from=${fromNickname}`);
          if (!toOpenid || !invRoomCode) { send('room:error', { message: '参数不全' }); break; }
          const target = userSockets.get(toOpenid);
          if (target && target.ws && target.ws.readyState === 1) {
            // 对方在线 → 直接推送
            target.ws.send(JSON.stringify({
              event: 'room:invitation',
              data: { fromNickname, roomCode: invRoomCode },
            }));
            send('room:invite:sent', { toOpenid, status: 'pushed' });
          } else {
            // 对方离线 → 已存在 DB，告知发送方
            send('room:invite:sent', { toOpenid, status: 'stored' });
          }
          break;
        }
        case 'room:invite:accept': {
          // 被邀请人接受 → 发送房间码让客户端加入
          const { roomCode: accRoomCode } = data || {};
          if (accRoomCode) {
            send('room:join:invited', { roomCode: accRoomCode });
          }
          break;
        }
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
        default: {
          handleGameEvent(ws, msg, rooms, wss, send, broadcast);
        }
      }
    });

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
  });

  function broadcast(roomCode, event, data, excludeId) {
    const room = rooms.getRoom(roomCode);
    if (!room) return;
    wss.clients.forEach(client => {
      if (client.roomCode === roomCode && client.readyState === 1 && client.id !== excludeId) {
        client.send(JSON.stringify({ event, data }));
      }
    });
  }

  // 心跳保活：每 30s ping，超出 1 个周期无 pong 响应则 terminate
  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws._alive) {
        console.log('[ws] 心跳超时，断开连接:', ws.nickname || ws.id);
        return ws.terminate();
      }
      ws._alive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
};
