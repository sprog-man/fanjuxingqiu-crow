App({
  globalData: {
    userInfo: null,
    token: '',
    serverUrl: 'http://localhost:2001',
    ossBase: 'https://fanjuxingqiu.oss-cn-beijing.aliyuncs.com'
  },

  onLaunch() {
    // 恢复登录态
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  },

  // 微信登录
  login(nickName, avatarUrl) {
    const self = this;
    return new Promise((resolve, reject) => {
      wx.login({
        success(res) {
          if (!res.code) {
            wx.showToast({ title: '登录失败', icon: 'none' });
            reject(res.errMsg);
            return;
          }
          // 调用后端登录接口
          wx.request({
            url: self.globalData.serverUrl + '/api/auth/login',
            method: 'POST',
            data: {
              code: res.code,
              nickName: nickName || '',
              avatarUrl: avatarUrl || '',
            },
            timeout: 5000,
            success(r) {
              if (r.data && r.data.data) {
                const { token, user } = r.data.data;
                self.globalData.token = token;
                self.globalData.userInfo = user;
                wx.setStorageSync('token', token);
                wx.setStorageSync('userInfo', user);
                resolve(user);
              } else {
                reject(r.data.error || '登录失败');
              }
            },
            fail() {
              // 离线模式：本地匿名登录
              const anon = { id: 'local', openid: 'local', nickname: nickName || '用户', avatar_url: avatarUrl || '' };
              self.globalData.token = 'local_token';
              self.globalData.userInfo = anon;
              wx.setStorageSync('userInfo', anon);
              resolve(anon);
            }
          });
        },
        fail() {
          // wx.login 失败时也走匿名
          const anon = { id: 'local', openid: 'local', nickname: nickName || '用户', avatar_url: avatarUrl || '' };
          self.globalData.token = 'local_token';
          self.globalData.userInfo = anon;
          wx.setStorageSync('userInfo', anon);
          resolve(anon);
        }
      });
    });
  },

  // 获取用户信息（微信接口）
  getUserProfile() {
    const self = this;
    return new Promise((resolve) => {
      wx.getUserProfile({
        desc: '用于展示用户信息',
        success: (res) => {
          const { nickName, avatarUrl } = res.userInfo;
          self.login(nickName, avatarUrl).then(resolve);
        },
        fail: () => {
          // 用户拒绝授权，用已有信息或匿名
          resolve(self.globalData.userInfo || { nickname: '用户' });
        }
      });
    });
  },

  // 退出登录
  logout() {
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  },

  // 饭搭子管理
  getBuddies() { return wx.getStorageSync('buddies') || []; },
  saveBuddy(buddy) {
    let buddies = this.getBuddies();
    if (buddy.id) { const idx = buddies.findIndex(b => b.id === buddy.id); if (idx > -1) buddies[idx] = buddy; }
    else { buddy.id = 'B' + Date.now(); buddies.push(buddy); }
    wx.setStorageSync('buddies', buddies);
    return buddies;
  },
  deleteBuddy(id) {
    const buddies = this.getBuddies().filter(b => b.id !== id);
    wx.setStorageSync('buddies', buddies);
    return buddies;
  }
});
