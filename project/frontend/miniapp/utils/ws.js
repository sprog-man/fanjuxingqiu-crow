const EVENTS = {};
let socketOpen = false;
let pendingMessages = [];
let currentRoomCode = '';
let currentNickname = '';
let listenersRegistered = false;

function connect(roomCode, nickname) {
  currentRoomCode = roomCode || '';
  currentNickname = nickname || '我';
  const serverUrl = 'ws://localhost:2001';
  wx.connectSocket({ url: serverUrl });

  if (!listenersRegistered) {
    listenersRegistered = true;
    wx.onSocketOpen(() => {
      socketOpen = true;
      pendingMessages.forEach(msg => wx.sendSocketMessage({ data: msg }));
      pendingMessages = [];
      if (currentRoomCode) {
        send('room:join', { roomCode: currentRoomCode, nickname: currentNickname });
      } else {
        send('room:create', { nickname: currentNickname });
      }
    });
    wx.onSocketMessage(res => {
      try {
        const { event, data } = JSON.parse(res.data);
        if (EVENTS[event]) EVENTS[event].forEach(fn => fn(data));
      } catch (e) {}
    });
    wx.onSocketClose(() => {
      socketOpen = false;
    });
    wx.onSocketError(() => { socketOpen = false; });
  }
}

function send(event, data) {
  const msg = JSON.stringify({ event, data });
  if (socketOpen) wx.sendSocketMessage({ data: msg });
  else pendingMessages.push(msg);
}

function on(event, callback) {
  if (!EVENTS[event]) EVENTS[event] = [];
  EVENTS[event].push(callback);
  return () => {
    EVENTS[event] = EVENTS[event].filter(fn => fn !== callback);
  };
}

function off(event, callback) {
  if (EVENTS[event]) EVENTS[event] = EVENTS[event].filter(fn => fn !== callback);
}

function close() {
  wx.closeSocket();
  socketOpen = false;
}

module.exports = { connect, send, on, off, close };
