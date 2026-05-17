App({
  globalData: {
    userInfo: null,
    token: '',
    serverUrl: 'http://localhost:2001',
    cloudUrl: 'https://express-p1bi-258936-9-1434048439.sh.run.tcloudbase.com',
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
    // 自动识别环境：开发版走本地，体验版/正式版走云托管
    try {
      const env = wx.getAccountInfoSync().miniProgram.envVersion;
      if (env === 'trial' || env === 'release') {
        this.globalData.serverUrl = this.globalData.cloudUrl;
      }
    } catch (e) {}
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
  getBuddies() {
    const local = wx.getStorageSync('buddies') || [];
    return local;
  },
  saveBuddyToLocal(buddy) {
    let buddies = this.getBuddies();
    if (buddy._id || buddy.id) {
      const idKey = buddy._id || buddy.id;
      const idx = buddies.findIndex(b => (b._id || b.id) === idKey);
      if (idx > -1) buddies[idx] = buddy;
    } else {
      buddy.id = buddy._id || 'B' + Date.now();
      buddies.push(buddy);
    }
    wx.setStorageSync('buddies', buddies);
    return buddies;
  },
  deleteBuddyFromLocal(id) {
    const buddies = this.getBuddies().filter(b => (b._id || b.id) !== id);
    wx.setStorageSync('buddies', buddies);
    return buddies;
  },
  // 后端 API 同步饭搭子
  getServerUrl() { return this.globalData.serverUrl; },
  getOpenid() {
    const user = this.globalData.userInfo;
    return user ? (user.openid || user.id || '') : '';
  },
  apiSearchUsers(query) {
    const self = this;
    return new Promise((resolve) => {
      const openid = self.getOpenid();
      if (!openid || !self.globalData.token || self.globalData.token === 'local_token') {
        resolve([]);
        return;
      }
      wx.request({
        url: self.globalData.serverUrl + '/api/buddy/search?q=' + encodeURIComponent(query) + '&openid=' + encodeURIComponent(openid),
        method: 'GET',
        header: { 'Authorization': 'Bearer ' + self.globalData.token },
        success(r) {
          if (r.data && r.data.data) resolve(r.data.data);
          else resolve([]);
        },
        fail() { resolve([]); }
      });
    });
  },
  apiGetBuddies() {
    const self = this;
    return new Promise((resolve) => {
      const openid = self.getOpenid();
      if (!openid || !self.globalData.token || self.globalData.token === 'local_token') {
        resolve(self.getBuddies());
        return;
      }
      wx.request({
        url: self.globalData.serverUrl + '/api/buddy/list?openid=' + encodeURIComponent(openid),
        method: 'GET',
        header: { 'Authorization': 'Bearer ' + self.globalData.token },
        success(r) {
          if (r.data && r.data.data) {
            const list = r.data.data;
            wx.setStorageSync('buddies', list);
            resolve(list);
          } else { resolve(self.getBuddies()); }
        },
        fail() { resolve(self.getBuddies()); }
      });
    });
  },
  apiSaveBuddy(buddy) {
    const self = this;
    return new Promise((resolve) => {
      const openid = self.getOpenid();
      if (!openid || !self.globalData.token || self.globalData.token === 'local_token') {
        resolve(self.saveBuddyToLocal(buddy));
        return;
      }
      const url = buddy._id
        ? self.globalData.serverUrl + '/api/buddy/update/' + buddy._id
        : self.globalData.serverUrl + '/api/buddy/create';
      const method = buddy._id ? 'PUT' : 'POST';
      const data = buddy._id
        ? { openid, remark: buddy.remark || '' }
        : { openid, targetUserId: buddy.targetUserId, remark: buddy.remark || '' };
      wx.request({
        url, method,
        data,
        header: { 'Authorization': 'Bearer ' + self.globalData.token, 'Content-Type': 'application/json' },
        success(r) {
          if (r.data && r.data.data) {
            const saved = r.data.data;
            let buddies = self.getBuddies();
            if (buddy._id) {
              const idx = buddies.findIndex(b => (b._id || b.id) === buddy._id);
              if (idx > -1) buddies[idx] = saved;
            } else { buddies.push(saved); }
            wx.setStorageSync('buddies', buddies);
            resolve(saved);
          } else { resolve(self.saveBuddyToLocal(buddy)); }
        },
        fail() { resolve(self.saveBuddyToLocal(buddy)); }
      });
    });
  },
  apiDeleteBuddy(id) {
    const self = this;
    return new Promise((resolve) => {
      const openid = self.getOpenid();
      if (!openid || !self.globalData.token || self.globalData.token === 'local_token') {
        resolve(self.deleteBuddyFromLocal(id));
        return;
      }
      wx.request({
        url: self.globalData.serverUrl + '/api/buddy/delete/' + id,
        method: 'DELETE',
        header: { 'Authorization': 'Bearer ' + self.globalData.token },
        success() { resolve(self.deleteBuddyFromLocal(id)); },
        fail() { resolve(self.deleteBuddyFromLocal(id)); }
      });
    });
  },
});
