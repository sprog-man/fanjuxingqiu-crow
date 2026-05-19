const EVENTS = {};
let socketOpen = false;
let pendingMessages = [];
let currentRoomCode = '';
let currentNickname = '';
let currentAvatar = '';
let listenersRegistered = false;

function connect(roomCode, nickname, avatar) {
  currentRoomCode = roomCode || '';
  currentNickname = nickname || '我';
  currentAvatar = avatar || '';
  console.log('[WS] connect 调用 - roomCode:', roomCode, 'nickname:', nickname, 'avatar:', avatar);
  const app = getApp();
  const httpUrl = (app && app.getServerUrl) ? app.getServerUrl() : 'http://localhost:2001';
  const wsUrl = httpUrl.replace(/^http/, 'ws');
  console.log('[WS] 连接地址:', wsUrl);
  wx.connectSocket({ url: wsUrl });

  if (!listenersRegistered) {
    listenersRegistered = true;
    wx.onSocketOpen(() => {
      socketOpen = true;
      pendingMessages.forEach(msg => wx.sendSocketMessage({ data: msg }));
      pendingMessages = [];
      const msg = currentRoomCode 
        ? { roomCode: currentRoomCode, nickname: currentNickname, avatar: currentAvatar }
        : { nickname: currentNickname, avatar: currentAvatar };
      console.log('[WS] Socket 打开，发送消息:', JSON.stringify(msg));
      if (currentRoomCode) {
        send('room:join', { roomCode: currentRoomCode, nickname: currentNickname, avatar: currentAvatar });
      } else {
        send('room:create', { nickname: currentNickname, avatar: currentAvatar });
      }
    });
    wx.onSocketMessage(res => {
      try {
        const { event, data } = JSON.parse(res.data);
        console.log('[WS] 收到消息:', event, JSON.stringify(data));
        if (EVENTS[event]) EVENTS[event].forEach(fn => fn(data));
      } catch (e) {}
    });
    wx.onSocketClose(() => {
      console.log('[WS] Socket 关闭');
      socketOpen = false;
    });
    wx.onSocketError((err) => { 
      console.log('[WS] Socket 错误:', err);
      socketOpen = false; 
    });
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
