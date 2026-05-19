const { WebSocketServer } = require('ws');
const { RoomManager } = require('./roomManager');
const { createGameHandler, handleGameEvent } = require('./gameHandler');

module.exports = function attachWS(server) {
  const wss = new WebSocketServer({ server });
  const rooms = new RoomManager();
  console.log('[ws] WebSocket server attached, room cleanup every 60s');

  wss.on('connection', (ws, req) => {
    ws.id = req.headers['sec-websocket-key'] || Math.random().toString(36).slice(2);
    ws.roomCode = null;
    ws.nickname = null;

    const send = (event, data) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ event, data }));
    };

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
      const { event, data } = msg;

      switch (event) {
        case 'room:create': {
          const nickname = (data && data.nickname) || '匿名';
          const avatar = (data && data.avatar) || '';
          console.log(`[ws] room:create -> nickname=${nickname}, avatar=${avatar}`);
          ws.nickname = nickname;
          ws.avatar = avatar;
          const room = rooms.createRoom(ws.id, nickname, avatar);
          ws.roomCode = room.code;
          console.log(`[ws] room:create -> code=${room.code} host=${nickname} totalRooms=${rooms.rooms.size}`);
          console.log(`[ws] room:create -> members=${JSON.stringify(room.members)}`);
          send('room:joined', { roomCode: room.code, members: room.members, isHost: true, mySocketId: ws.id });
          break;
        }
        case 'room:join': {
          const { roomCode, nickname: joinName, avatar: joinAvatar } = data || {};
          console.log(`[ws] room:join -> code=${roomCode} nickname=${joinName}, avatar=${joinAvatar}`);
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
          room.addMember(ws.id, ws.nickname, ws.avatar);
          console.log(`[ws] room:join OK -> code=${roomCode} joiner=${ws.nickname} members=${room.members.length}`);
          console.log(`[ws] room:join -> members=${JSON.stringify(room.members)}`);
          send('room:joined', { roomCode, members: room.members, isHost: false, mySocketId: ws.id });
          broadcast(roomCode, 'room:members', { members: room.members }, ws.id);
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
      const leaveCode = ws.roomCode;
      if (!leaveCode) return;
      const leaveRoom = rooms.getRoom(leaveCode);
      if (leaveRoom) {
        leaveRoom.removeMember(ws.id);
        console.log(`[ws] disconnect cleanup -> code=${leaveCode} remaining=${leaveRoom.members.length}`);
        if (leaveRoom.members.length > 0) {
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
};
