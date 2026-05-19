const ws = require('./utils/ws');
const anim = require('./utils/anim');

const MEMBER_COLORS = ['#D85A30','#1D9E75','#534AB7','#FF8C00','#E91E63','#00BCD4','#8BC34A','#FF5722'];

Page({
  data: {
    pageState: 'entry',
    inputRoomCode: '',
    canJoin: false,
    connecting: false,
    roomCode: '', members: [], isHost: false, mySocketId: '',
    gameMode: '', drawPhase: 'idle', countdown: 0,
    spinAngle: 0, spinPhase: '', spinRadius: 80, drawWinner: '', humorLine: '',
    ejectStyles: [], ejectLabel: '',
    gameBoard: [], gamePhase: 'idle', currentTurnName: '',
    currentTurnId: '', isMyTurn: false, gameResult: '',
  },

  onLoad(opts) {
    this._setupListeners();
    if (opts.roomCode) {
      const code = opts.roomCode.toUpperCase();
      this.data.inputRoomCode = code;
      this.setData({ inputRoomCode: code, canJoin: true });
      this._joinRoom();
    }
  },

  _setupListeners() {
    ws.on('room:joined', (data) => {
      console.log('[Room] room:joined 数据:', JSON.stringify(data));
      const members = (data.members || []).map((m, i) => ({ ...m, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }));
      console.log('[Room] 处理后的 members:', JSON.stringify(members));
      this.setData({
        pageState: 'inroom', connecting: false,
        roomCode: data.roomCode, members, isHost: data.isHost,
        mySocketId: data.mySocketId || '',
      });
    });

    ws.on('room:members', (data) => {
      console.log('[Room] room:members 数据:', JSON.stringify(data));
      const members = (data.members || []).map((m, i) => ({ ...m, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }));
      console.log('[Room] 处理后的 members:', JSON.stringify(members));
      this.setData({ members });
    });

    ws.on('room:error', (data) => {
      this.setData({ connecting: false });
      wx.showToast({ title: data.message || '连接失败', icon: 'none' });
    });

    ws.on('draw:countdown', (data) => {
      this.setData({ gameMode: 'draw', drawPhase: 'countdown', countdown: data.count });
    });
    ws.on('draw:spinning', (data) => {
      this._serverWinner = data.winner || '';
      this.setData({ drawPhase: 'spinning' });
      this._runSpinAnim();
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

  onUnload() {
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
    ws.close();
  },

  /* ====== 创建 / 加入房间 ====== */

  onInputRoomCode(e) {
    const val = e.detail.value.toUpperCase();
    this.setData({ inputRoomCode: val, canJoin: val.trim().length > 0 });
  },

  _createRoom() {
    if (this.data.connecting) return;
    this.setData({ connecting: true });
    const userInfo = getApp().globalData.userInfo || {};
    const nickname = userInfo.nickname || '我';
    const avatar = userInfo.avatar_url || '';
    console.log('[Room] 创建房间 - 用户信息:', JSON.stringify(userInfo));
    console.log('[Room] 创建房间 - 头像URL:', avatar);
    ws.connect('', nickname, avatar);
  },

  _joinRoom() {
    if (this.data.connecting) return;
    const code = this.data.inputRoomCode.trim();
    if (!code) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    this.setData({ connecting: true });
    const userInfo = getApp().globalData.userInfo || {};
    const nickname = userInfo.nickname || '我';
    const avatar = userInfo.avatar_url || '';
    console.log('[Room] 加入房间 - 用户信息:', JSON.stringify(userInfo));
    console.log('[Room] 加入房间 - 头像URL:', avatar);
    ws.connect(code, nickname, avatar);
  },

  /* ====== 分享 ====== */

  shareRoom() {
    wx.shareAppMessage({
      title: '快来一起抽签谁买单！',
      path: '/subpackages/room/index?roomCode=' + this.data.roomCode,
    });
  },

  /* ====== 退出房间 ====== */
  leaveRoom() {
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
    ws.close();
    this.setData({
      pageState: 'entry', connecting: false,
      roomCode: '', members: [], isHost: false, mySocketId: '',
      gameMode: '', drawPhase: 'idle', gameResult: '',
    });
  },

  /* ====== 抽签 ====== */
  startDraw() { this.setData({ gameMode: 'draw', drawPhase: 'idle' }); },
  doDraw() { ws.send('draw:start', { roomCode: this.data.roomCode }); },
  resetDraw() {
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
    this._serverWinner = '';
    this.setData({
      gameMode: '', drawPhase: 'idle', drawWinner: '',
      spinAngle: 0, spinPhase: '', spinRadius: 80, humorLine: '',
      ejectStyles: [], ejectLabel: '',
    });
  },

  _runSpinAnim() {
    const members = this.data.members;
    if (!members.length) return;
    if (this._spinTimer) { clearTimeout(this._spinTimer); this._spinTimer = null; }
    if (this._ejectTimer) { clearTimeout(this._ejectTimer); this._ejectTimer = null; }
    this.setData({ spinAngle: 0, spinPhase: 'accelerate', spinRadius: 150 });
    const startTime = Date.now();
    let angle = 0;
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      let speed, radius, phase;
      if (elapsed < 0.5) {
        speed = (elapsed / 0.5) * 360; radius = 150; phase = 'accelerate';
      } else if (elapsed < 2.0) {
        speed = 540; radius = 150; phase = 'cruise';
      } else if (elapsed < 4.0) {
        const t = (elapsed - 2.0) / 2.0;
        speed = Math.round(540 * (1 - t * 0.6));
        radius = Math.round(150 - 120 * t);
        phase = 'shrink';
      } else {
        this.setData({ spinPhase: 'clustered', spinAngle: angle % 360, spinRadius: 30 });
        this._spinTimer = null;
        this._ejectWinner();
        return;
      }
      angle += speed * 0.016;
      this.setData({ spinAngle: angle, spinPhase: phase, spinRadius: radius });
      this._spinTimer = setTimeout(tick, 16);
    };
    tick();
  },

  _ejectWinner() {
    const members = this.data.members;
    const winner = this._serverWinner || (members.length ? members[0].nickname : '');
    if (!members.length || !winner) return;

    // Step 1: render all at center (starting state for transition)
    this.setData({
      drawPhase: 'eject',
      ejectStyles: members.map(() => 'transform:translate(0,0);'),
      ejectLabel: '🎯 幸运儿弹出！',
    });

    // Step 2: next frame — winner flies off, others shrink
    this._ejectTimer = setTimeout(() => {
      this._ejectTimer = null;
      const flyX = (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 100);
      const flyY = (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 100);
      const flyRotate = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360);
      const finalStyles = members.map(m =>
        m.nickname === winner
          ? `transform:translate(${flyX}px,${flyY}px) rotate(${flyRotate}deg) scale(1.4);opacity:0;`
          : 'transform:translate(0,0) scale(0.6);opacity:0.7;'
      );
      this.setData({
        ejectStyles: finalStyles,
        ejectLabel: `💥 ${winner} 被撞飞！他就是幸运儿！`,
      });
    }, 50);
  },

  /* ====== 小游戏 ====== */
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
