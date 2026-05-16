const ws = require('../../utils/ws');
const anim = require('../../utils/anim');

const MEMBER_COLORS = ['#D85A30','#1D9E75','#534AB7','#FF8C00','#E91E63','#00BCD4','#8BC34A','#FF5722'];

Page({
  data: {
    roomCode: '', members: [], isHost: false, mySocketId: '',
    gameMode: '', drawPhase: 'idle', countdown: 0,
    spinHighlight: '', shortlist: [], drawWinner: '', humorLine: '',
    gameBoard: [], gamePhase: 'idle', currentTurnName: '',
    currentTurnId: '', isMyTurn: false, gameResult: '',
  },

  onLoad(opts) {
    const roomCode = opts.roomCode || '';
    const nickname = getApp().globalData.userInfo?.nickname || '我';
    ws.connect(roomCode, nickname);

    ws.on('room:joined', (data) => {
      const members = (data.members || []).map((m, i) => ({ ...m, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }));
      this.setData({
        roomCode: data.roomCode, members, isHost: data.isHost,
        mySocketId: data.mySocketId || '',
      });
    });

    ws.on('room:members', (data) => {
      const members = (data.members || []).map((m, i) => ({ ...m, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }));
      this.setData({ members });
    });

    ws.on('room:error', (data) => {
      wx.showToast({ title: data.message, icon: 'none' });
    });

    ws.on('draw:countdown', (data) => {
      this.setData({ gameMode: 'draw', drawPhase: 'countdown', countdown: data.count });
    });
    ws.on('draw:spinning', () => {
      this.setData({ drawPhase: 'spinning' });
      this._runSpinAnim();
    });
    ws.on('draw:focus', (data) => {
      this.setData({ drawPhase: 'focus', shortlist: data.shortlist || [] });
    });
    ws.on('draw:reveal', (data) => {
      this.setData({
        drawPhase: 'reveal', drawWinner: data.winner,
        humorLine: anim.randomHumor(),
      });
    });
    ws.on('croc:start', (data) => this._initGame('croc', data));
    ws.on('croc:state', (data) => this._updateGame(data));
    ws.on('croc:result', (data) => this.setData({ gameResult: data.loser, gameBoard: data.board }));
    ws.on('pirate:start', (data) => this._initGame('pirate', data));
    ws.on('pirate:state', (data) => this._updateGame(data));
    ws.on('pirate:result', (data) => this.setData({ gameResult: data.loser, gameBoard: data.board }));
  },

  onUnload() { ws.close(); },

  shareRoom() {
    wx.shareAppMessage({
      title: '快来一起抽签谁买单！',
      path: '/pages/room/index?roomCode=' + this.data.roomCode,
    });
  },

  // === 抽签 ===
  startDraw() { this.setData({ gameMode: 'draw', drawPhase: 'idle' }); },
  doDraw() { ws.send('draw:start', { roomCode: this.data.roomCode }); },
  resetDraw() {
    this.setData({ gameMode: '', drawPhase: 'idle', drawWinner: '', spinHighlight: '', shortlist: [], humorLine: '' });
  },

  _runSpinAnim() {
    const members = this.data.members;
    if (!members.length) return;
    let count = 0;
    const total = 20 + Math.floor(Math.random() * 10);
    const timer = setInterval(() => {
      const idx = count % members.length;
      this.setData({ spinHighlight: members[idx].nickname });
      count++;
      if (count >= total) { clearInterval(timer); }
    }, 90);
  },

  // === 小游戏 ===
  startGame(e) {
    const mode = e.currentTarget.dataset.mode;
    ws.send(mode + ':start', { roomCode: this.data.roomCode });
  },

  _initGame(mode, data) {
    this.setData({
      gameMode: mode, gameBoard: data.board,
      currentTurnName: data.currentTurnName,
      currentTurnId: data.currentTurnId,
      gamePhase: 'playing', gameResult: '',
      isMyTurn: data.currentTurnId === this.data.mySocketId,
    });
  },

  _updateGame(data) {
    this.setData({
      gameBoard: data.board,
      currentTurnName: data.currentTurnName,
      currentTurnId: data.currentTurnId,
      gamePhase: data.phase || 'playing',
      isMyTurn: data.currentTurnId === this.data.mySocketId,
    });
  },

  pressTooth(e) {
    if (!this.data.isMyTurn) return;
    ws.send('croc:press', { roomCode: this.data.roomCode, toothIdx: e.currentTarget.dataset.index });
  },

  stabSlot(e) {
    if (!this.data.isMyTurn) return;
    ws.send('pirate:stab', { roomCode: this.data.roomCode, slotIdx: e.currentTarget.dataset.index });
  },

  resetGame() {
    this.setData({ gameMode: '', gameBoard: [], gamePhase: 'idle', gameResult: '' });
  },
});
