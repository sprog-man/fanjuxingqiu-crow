const EVENTS = {};
let socketOpen = false;
let pendingMessages = [];
let currentRoomCode = '';
let currentNickname = '';
let currentAvatar = '';
let currentOpenid = '';
let listenersRegistered = false;
let connectedRoomCode = '';
let amIHost = false;
let reconnectAttempt = 0;
let reconnectTimer = null;
const MAX_RECONNECT_ATTEMPTS = 5;

function connect(roomCode, nickname, avatar, openid) {
  // 清除过期消息（防止断线期间堆积的消息在重连后被发送）
  pendingMessages = [];
  // 清除重连定时器（防止多次重连叠加）
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  currentRoomCode = roomCode || '';
  currentNickname = nickname || '我';
  currentAvatar = avatar || '';
  currentOpenid = openid || '';
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
      // 注册用户身份（用于接收邀请推送）
      if (currentOpenid) {
        send('room:register', { openid: currentOpenid, nickname: currentNickname });
      }
      console.log('[WS] Socket 打开，发送消息:', JSON.stringify({ roomCode: currentRoomCode, openid: currentOpenid }));
      if (currentRoomCode) {
        if (connectedRoomCode) {
          // 已有房间记录 → 断线重连
          console.log('[WS] 断线重连 -> room:rejoin', currentRoomCode);
          send('room:rejoin', { roomCode: currentRoomCode, nickname: currentNickname, avatar: currentAvatar });
        } else {
          console.log('[WS] 首次加入 -> room:join', currentRoomCode);
          send('room:join', { roomCode: currentRoomCode, nickname: currentNickname, avatar: currentAvatar });
        }
      } else {
        console.log('[WS] 创建房间 -> room:create');
        send('room:create', { nickname: currentNickname, avatar: currentAvatar });
      }
    });
    wx.onSocketMessage(res => {
      try {
        const { event, data } = JSON.parse(res.data);
        console.log('[WS] 收到消息:', event, JSON.stringify(data));
      // 成功加入房间后保存房间信息（用于断线重连）
      if (event === 'room:joined' && data && data.roomCode) {
        connectedRoomCode = data.roomCode;
        amIHost = !!data.isHost;
        reconnectAttempt = 0;
      }
        if (EVENTS[event]) EVENTS[event].forEach(fn => fn(data));
      } catch (e) {}
    });
    wx.onSocketClose(() => {
      console.log('[WS] Socket 关闭');
      socketOpen = false;
      // 自动重连：如果之前在房间中，尝试重新连接
      if (connectedRoomCode && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempt++;
        const delay = Math.min(1000 * reconnectAttempt, 5000);
        console.log(`[WS] ${delay}ms 后自动重连 (第${reconnectAttempt}次)`);
        reconnectTimer = setTimeout(() => {
          connect(connectedRoomCode, currentNickname, currentAvatar, currentOpenid);
        }, delay);
      }
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
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  wx.closeSocket();
  socketOpen = false;
  connectedRoomCode = '';
  amIHost = false;
  reconnectAttempt = 0;
}

module.exports = { connect, send, on, off, close };
