// ============================================
// iCloush 智慧工厂 — 全局 App
// ============================================

var BASE_URL = 'https://icloush-api-245189-5-1302632520.sh.run.tcloudbase.com'; // 微信云托管域名
var WS_URL = 'wss://icloush-api-245189-5-1302632520.sh.run.tcloudbase.com/ws/iot';

// Mock 数据模块（解耦：仅在 useMock=true 时使用）
var mockData = require('./utils/mockData');

App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: BASE_URL,
    wsConnected: false,
    wsSocket: null,
    wsReconnectTimer: null,
    wsHeartbeatTimer: null,
    wsReconnectDelay: 1000, // 初始重连延迟1秒，指数退避最大30秒
    // Mock开关（开发阶段开启，后端就绪后改为 false）
    useMock: true,
  },

  onLaunch: function () {
    this.checkLogin();
  },

  // 守则九补丁：从后台切回时检查并恢复 WebSocket 连接
  onShow: function () {
    if (
      this.globalData.token &&
      !this.globalData.wsConnected &&
      !this.globalData.useMock &&
      !this.globalData.wsReconnectTimer
    ) {
      console.log('[应用] 从后台切回，检查并重连 WebSocket');
      this.connectWebSocket();
    }
  },

  // ============================================
  // 登录与鉴权
  // ============================================
  checkLogin: function () {
    var token = wx.getStorageSync('token');
    var userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      if (!this.globalData.useMock) {
        this.connectWebSocket();
      }
    } else if (this.globalData.useMock) {
      // Mock模式下自动登录
      this.login(null, null);
    }
  },

  login: function (code, callback) {
    if (this.globalData.useMock) {
      // 调试模式：Mock 登录（管理员账号）
      var mockUser = {
        id: 'u001',
        name: '张伟',
        avatar_key: 'male_admin_01',
        role: 7,
        department: '洗涤工厂',
        skills: ['洗涤龙', '单机洗', '烫平机', '物流驾驶'],
        skill_tags: ['洗涤龙', '单机洗', '烫平机', '物流驾驶'],
        is_multi_post: true,
        total_points: 3860,
        monthly_points: 420,
        points_balance: 3860,
        task_completed: 187,
        status: 'active',
      };
      this.globalData.userInfo = mockUser;
      this.globalData.token = 'mock_token_admin';
      wx.setStorageSync('token', 'mock_token_admin');
      wx.setStorageSync('userInfo', mockUser);
      if (callback) callback(null, mockUser);
      return;
    }
    var self = this;
    wx.request({
      url: BASE_URL + '/api/v1/auth/login',
      method: 'POST',
      data: { code: code },
      success: function (res) {
        if (res.data.code === 200) {
          var token = res.data.data.token;
          var user = res.data.data.user;
          self.globalData.token = token;
          self.globalData.userInfo = user;
          wx.setStorageSync('token', token);
          wx.setStorageSync('userInfo', user);
          self.connectWebSocket();
          if (callback) callback(null, user);
        } else {
          if (callback) callback(res.data.msg);
        }
      },
      fail: function (err) {
        if (callback) callback(err);
      },
    });
  },

  logout: function () {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.disconnectWebSocket();
    wx.reLaunch({ url: '/pages/index/index' });
  },

  // ============================================
  // WebSocket 心跳重连（守则九）
  // ============================================
  connectWebSocket: function () {
    if (this.globalData.useMock) return;
    if (this.globalData.wsConnected) return;

    var self = this;
    var socket = wx.connectSocket({
      url: WS_URL,
      header: { Authorization: 'Bearer ' + (self.globalData.token || '') },
    });

    self.globalData.wsSocket = socket;

    socket.onOpen(function () {
      console.log('[WebSocket] 连接成功');
      self.globalData.wsConnected = true;
      self.globalData.wsReconnectDelay = 1000;
      self.startHeartbeat();
    });

    socket.onMessage(function (res) {
      try {
        var msg = JSON.parse(res.data);
        if (msg.type === 'pong') return;
        self.broadcastWsMessage(msg);
      } catch (e) {}
    });

    socket.onClose(function () {
      console.log('[WebSocket] 连接断开，准备重连...');
      self.globalData.wsConnected = false;
      self.stopHeartbeat();
      self.scheduleReconnect();
    });

    socket.onError(function () {
      console.log('[WebSocket] 连接错误');
      self.globalData.wsConnected = false;
      self.stopHeartbeat();
      self.scheduleReconnect();
    });
  },

  startHeartbeat: function () {
    this.stopHeartbeat();
    var self = this;
    this.globalData.wsHeartbeatTimer = setInterval(function () {
      if (self.globalData.wsConnected && self.globalData.wsSocket) {
        self.globalData.wsSocket.send({ data: JSON.stringify({ type: 'ping' }) });
      }
    }, 30000);
  },

  stopHeartbeat: function () {
    if (this.globalData.wsHeartbeatTimer) {
      clearInterval(this.globalData.wsHeartbeatTimer);
      this.globalData.wsHeartbeatTimer = null;
    }
  },

  scheduleReconnect: function () {
    if (this.globalData.wsReconnectTimer) return;
    var delay = Math.min(this.globalData.wsReconnectDelay, 30000);
    var self = this;
    console.log('[WebSocket] ' + delay + '毫秒后重连...');
    this.globalData.wsReconnectTimer = setTimeout(function () {
      self.globalData.wsReconnectTimer = null;
      self.globalData.wsReconnectDelay = Math.min(delay * 2, 30000);
      self.connectWebSocket();
    }, delay);
  },

  disconnectWebSocket: function () {
    this.stopHeartbeat();
    if (this.globalData.wsReconnectTimer) {
      clearTimeout(this.globalData.wsReconnectTimer);
      this.globalData.wsReconnectTimer = null;
    }
    if (this.globalData.wsSocket) {
      this.globalData.wsSocket.close();
      this.globalData.wsSocket = null;
    }
    this.globalData.wsConnected = false;
  },

  // WebSocket 消息广播（发布-订阅模式）
  _wsListeners: {},
  subscribeWs: function (key, callback) {
    this._wsListeners[key] = callback;
  },
  unsubscribeWs: function (key) {
    delete this._wsListeners[key];
  },
  broadcastWsMessage: function (msg) {
    var listeners = this._wsListeners;
    var keys = Object.keys(listeners);
    for (var i = 0; i < keys.length; i++) {
      try { listeners[keys[i]](msg); } catch (e) {}
    }
  },

  // ============================================
  // 统一 HTTP 请求（含 Mock 拦截，支持回调和 Promise 双模式）
  // ============================================
  request: function (options) {
    var url = options.url;
    var method = options.method || 'GET';
    var data = options.data;
    var success = options.success;
    var fail = options.fail;
    var self = this;

    // ── Mock 模式 ──────────────────────────────────────────
    if (this.globalData.useMock) {
      var mockRes = mockData.getMockResponse(url, method, data);
      if (success) {
        // 回调风格
        setTimeout(function () { success(mockRes); }, 150 + Math.random() * 100);
        return undefined;
      }
      // Promise 风格
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(mockRes); }, 150 + Math.random() * 100);
      });
    }

    // ── 真实请求 ───────────────────────────────────────────
    if (success) {
      // 回调风格
      wx.request({
        url: BASE_URL + url,
        method: method,
        data: data,
        header: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (self.globalData.token || ''),
        },
        success: function (res) {
          if (res.data && res.data.code === 401) { self.logout(); return; }
          success(res.data);
        },
        fail: function (err) {
          wx.showToast({ title: '网络错误，请重试', icon: 'none' });
          if (fail) fail(err);
        },
      });
      return undefined;
    }

    // Promise 风格
    return new Promise(function (resolve, reject) {
      wx.request({
        url: BASE_URL + url,
        method: method,
        data: data,
        header: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (self.globalData.token || ''),
        },
        success: function (res) {
          if (res.data && res.data.code === 401) { self.logout(); return; }
          resolve(res.data);
        },
        fail: function (err) {
          wx.showToast({ title: '网络错误，请重试', icon: 'none' });
          reject(err);
        },
      });
    });
  },
});
