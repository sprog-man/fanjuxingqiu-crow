function createGameHandler(wss, rooms) {
  const broadcast = (roomCode, event, data, excludeId) => {
    const room = rooms.getRoom(roomCode);
    if (!room) return;
    wss.clients.forEach(client => {
      if (client.roomCode === roomCode && client.readyState === 1 && client.id !== excludeId) {
        client.send(JSON.stringify({ event, data }));
      }
    });
  };
  return { broadcast };
}

function handleGameEvent(ws, msg, rooms, wss, send, broadcast) {
  const { event, data } = msg;
  const roomCode = ws.roomCode;
  if (!roomCode) { send('room:error', { message: '不在房间中' }); return; }
  const room = rooms.getRoom(roomCode);
  if (!room) { send('room:error', { message: '房间已过期' }); return; }

  switch (event) {
    case 'draw:start': {
      if (!room.host || room.host.id !== ws.id) {
        send('room:error', { message: '只有房主可以开始' }); break;
      }
      const players = room.members.map(m => m.nickname);
      const winner = players[Math.floor(Math.random() * players.length)];

      const gh = createGameHandler(wss, rooms);
      gh.broadcast(roomCode, 'draw:countdown', { count: 3 });
      setTimeout(() => gh.broadcast(roomCode, 'draw:countdown', { count: 2 }), 1000);
      setTimeout(() => gh.broadcast(roomCode, 'draw:countdown', { count: 1 }), 2000);
      setTimeout(() => gh.broadcast(roomCode, 'draw:spinning', { candidates: players, winner }), 3000);
      setTimeout(() => gh.broadcast(roomCode, 'draw:reveal', { winner }), 8500);
      break;
    }
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
      room.gameState = {
        mode: 'croc', phase: 'playing', board,
        turnIndex: 0, playerOrder: room.members.map(m => m.id),
      };
      const gh = createGameHandler(wss, rooms);
      gh.broadcast(roomCode, 'croc:start', {
        board,
        currentTurnName: room.members[0].nickname,
        currentTurnId: room.members[0].id,
      });
      break;
    }
    case 'croc:press': {
      if (!room.gameState || room.gameState.mode !== 'croc') break;
      const gs = room.gameState;
      const currentPlayerId = gs.playerOrder[gs.turnIndex];
      if (ws.id !== currentPlayerId) {
        send('room:error', { message: '还没轮到你' }); break;
      }
      const toothIdx = data && data.toothIdx;
      if (toothIdx === undefined || toothIdx < 0 || toothIdx >= gs.board.length) break;
      const tooth = gs.board[toothIdx];
      if (tooth.state !== 'active') break;

      const gh = createGameHandler(wss, rooms);
      if (tooth.isDanger) {
        tooth.state = 'danger';
        gs.phase = 'result';
        gh.broadcast(roomCode, 'croc:result', {
          loser: room.members[gs.turnIndex].nickname,
          board: gs.board,
        });
      } else {
        tooth.state = 'safe';
        gs.turnIndex = (gs.turnIndex + 1) % gs.playerOrder.length;
        gh.broadcast(roomCode, 'croc:state', {
          board: gs.board,
          currentTurnName: room.members[gs.turnIndex].nickname,
          currentTurnId: room.members[gs.turnIndex].id,
          phase: 'playing',
        });
      }
      break;
    }
    case 'pirate:start': {
      if (!room.host || room.host.id !== ws.id) {
        send('room:error', { message: '只有房主可以开始' }); break;
      }
      const totalSlots = 12;
      const boomIdx = Math.floor(Math.random() * totalSlots);
      const board = [];
      for (let i = 0; i < totalSlots; i++) {
        board.push({ index: i, isBoom: i === boomIdx, state: 'empty' });
      }
      room.gameState = {
        mode: 'pirate', phase: 'playing', board,
        turnIndex: 0, playerOrder: room.members.map(m => m.id),
      };
      const gh = createGameHandler(wss, rooms);
      gh.broadcast(roomCode, 'pirate:start', {
        board,
        currentTurnName: room.members[0].nickname,
        currentTurnId: room.members[0].id,
      });
      break;
    }
    case 'pirate:stab': {
      if (!room.gameState || room.gameState.mode !== 'pirate') break;
      const gs = room.gameState;
      const currentPlayerId = gs.playerOrder[gs.turnIndex];
      if (ws.id !== currentPlayerId) {
        send('room:error', { message: '还没轮到你' }); break;
      }
      const slotIdx = data && data.slotIdx;
      if (slotIdx === undefined || slotIdx < 0 || slotIdx >= gs.board.length) break;
      const slot = gs.board[slotIdx];
      if (slot.state !== 'empty') break;

      const gh = createGameHandler(wss, rooms);
      if (slot.isBoom) {
        slot.state = 'boom';
        gs.phase = 'result';
        gh.broadcast(roomCode, 'pirate:result', {
          loser: room.members[gs.turnIndex].nickname,
          board: gs.board,
        });
      } else {
        slot.state = 'stabbed';
        gs.turnIndex = (gs.turnIndex + 1) % gs.playerOrder.length;
        gh.broadcast(roomCode, 'pirate:state', {
          board: gs.board,
          currentTurnName: room.members[gs.turnIndex].nickname,
          currentTurnId: room.members[gs.turnIndex].id,
          phase: 'playing',
        });
      }
      break;
    }
    default:
      send('room:error', { message: '未知事件: ' + event });
  }
}

module.exports = { createGameHandler, handleGameEvent };
