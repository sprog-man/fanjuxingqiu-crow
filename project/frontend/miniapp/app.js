App({
  globalData: {
    userInfo: null,
    token: '',
    serverUrl: 'http://localhost:2001',
    prodServerUrl: 'https://sprog-man.fanjuxingqiu.ccwu.cc',
    ossBase: 'https://fanjuxingqiu.oss-cn-beijing.aliyuncs.com'
  },

  onLaunch() {
    // 初始化云开发环境
    wx.cloud.init({
      env: 'prod-d4guifrt160355bbc',
      traceUser: true
    });
    console.log('[云开发] 已初始化环境:', 'prod-d4guifrt160355bbc');
    
    // 恢复登录态
    const token = wx.getStorageSync('token');
    let userInfo = wx.getStorageSync('userInfo');
    if (token) {
      // 检查头像是否是临时路径，如果是则清除本地存储
      if (userInfo && userInfo.avatar_url && (userInfo.avatar_url.startsWith('wxfile://') || userInfo.avatar_url.includes('tmp'))) {
        console.log('[登录] 检测到临时头像，清除本地存储');
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        this.globalData.token = '';
        this.globalData.userInfo = null;
      } else {
        this.globalData.token = token;
        this.globalData.userInfo = userInfo;
      }
    }
    // [youhua] 强制本地开发模式，不根据环境切换地址
    console.log('[youhua] 开发模式 → 本地服务器:', this.globalData.serverUrl);
  },

  // 上传头像到服务器
  uploadAvatar(filePath) {
    const self = this;
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: self.globalData.serverUrl + '/api/tarot/upload',
        filePath,
        name: 'file',
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.data && data.data.url) {
              resolve(data.data.url);
            } else {
              reject(new Error('upload failed'));
            }
          } catch (e) {
            reject(e);
          }
        },
        fail: reject,
      });
    });
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
          // 如果头像是临时路径，先上传到服务器
          const processLogin = (finalAvatarUrl) => {
            wx.request({
              url: self.globalData.serverUrl + '/api/auth/login',
              method: 'POST',
              data: {
                code: res.code,
                nickName: nickName || '',
                avatarUrl: finalAvatarUrl || '',
                savedOpenid: self.getSavedOpenid() || undefined,
              },
              header: {
                'Content-Type': 'application/json'
              },
              success(r) {
                if (r.data && r.data.data) {
                  const { token, user } = r.data.data;
                  self.globalData.token = token;
                  self.globalData.userInfo = user;
                  wx.setStorageSync('token', token);
                  wx.setStorageSync('userInfo', user);
                  if (user.openid) self.saveOpenid(user.openid);
                  resolve(user);
                } else {
                  reject(r.data.error || '登录失败');
                }
              },
              fail(err) {
                console.error('[登录] 请求失败:', err);
                const anon = { id: 'local', openid: 'local', nickname: nickName || '用户', avatar_url: finalAvatarUrl || '' };
                self.globalData.token = 'local_token';
                self.globalData.userInfo = anon;
                wx.setStorageSync('userInfo', anon);
                resolve(anon);
              }
            });
          };

          // 判断是否是临时路径（wxfile:// 或 http://tmp/）
          if (avatarUrl && (avatarUrl.startsWith('wxfile://') || avatarUrl.includes('tmp'))) {
            self.uploadAvatar(avatarUrl).then(uploadedUrl => {
              processLogin(uploadedUrl);
            }).catch(() => {
              // 上传失败，使用原始路径
              processLogin(avatarUrl);
            });
          } else {
            processLogin(avatarUrl);
          }
        },
        fail() {
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

  // 获取已互为饭搭子的好友（过滤掉待处理的申请）
  getAcceptedBuddies() {
    const buddies = this.getBuddies();
    return buddies.filter(b => b.status === 'accepted' || !b.status);
  },

  // 持久化 openid / buddy_id（确保退出重登后不丢失）
  saveOpenid(openid) {
    if (openid) wx.setStorageSync('saved_openid', openid);
  },
  getSavedOpenid() {
    return wx.getStorageSync('saved_openid') || '';
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
        url: this.globalData.serverUrl + '/api/buddy/search?q=' + encodeURIComponent(query) + '&openid=' + encodeURIComponent(openid),
        method: 'GET',
        header: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.globalData.token
        },
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
        url: this.globalData.serverUrl + '/api/buddy/list?openid=' + encodeURIComponent(openid),
        method: 'GET',
        header: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.globalData.token
        },
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
        : { openid, targetUserId: buddy.targetUserId, remark: buddy.remark || '', requestMessage: buddy.requestMessage || '' };
      wx.request({
        url: url,
        method,
        data,
        header: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.globalData.token
        },
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
  apiAcceptBuddy(id) {
    const self = this;
    return new Promise((resolve, reject) => {
      const openid = self.getOpenid();
      if (!openid || !self.globalData.token || self.globalData.token === 'local_token') {
        reject(new Error('未登录'));
        return;
      }
      wx.request({
        url: this.globalData.serverUrl + '/api/buddy/accept/' + id,
        method: 'PUT',
        header: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.globalData.token
        },
        success(r) {
          if (r.data && r.data.data) {
            resolve(r.data.data);
          } else { reject(new Error(r.data.error || '操作失败')); }
        },
        fail() { reject(new Error('网络请求失败')); }
      });
    });
  },
  apiRejectBuddy(id, reason) {
    const self = this;
    return new Promise((resolve, reject) => {
      const openid = self.getOpenid();
      if (!openid || !self.globalData.token || self.globalData.token === 'local_token') {
        reject(new Error('未登录'));
        return;
      }
      wx.request({
        url: this.globalData.serverUrl + '/api/buddy/reject/' + id,
        method: 'PUT',
        data: { rejectedReason: reason || '' },
        header: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.globalData.token
        },
        success(r) {
          if (r.data && r.data.data) {
            resolve(r.data.data);
          } else { reject(new Error(r.data.error || '操作失败')); }
        },
        fail() { reject(new Error('网络请求失败')); }
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
        url: this.globalData.serverUrl + '/api/buddy/delete/' + id,
        method: 'DELETE',
        header: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.globalData.token
        },
        success() { resolve(self.deleteBuddyFromLocal(id)); },
        fail() { resolve(self.deleteBuddyFromLocal(id)); }
      });
    });
  },
});
