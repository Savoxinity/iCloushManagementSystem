// ============================================
// 终端接入登录页 V6 — 账号 + 密码登录
// 兼容 Mock 模式和真实后端 API
// ============================================
var app = getApp();

Page({
  data: {
    bootDone: false,
    scanActive: false,
    showForm: false,
    showResult: false,
    resultSuccess: false,

    // 表单
    username: '',
    password: '',
    showPassword: false,
    formError: '',

    // 终端日志
    terminalLines: [],

    version: 'V6.0.0',
  },

  onLoad: function () {
    var token = wx.getStorageSync('token');
    var userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    this.startBootSequence();
  },

  // ── 开机动画序列 ──────────────────────────────────────────
  startBootSequence: function () {
    var self = this;
    var mode = app.globalData.useMock ? 'MOCK' : 'LIVE';
    var lines = [
      { text: '> SYSTEM BOOT SEQUENCE INITIATED...', delay: 0 },
      { text: '> LOADING iCloush FACTORY OS v6.0.0', delay: 400 },
      { text: '> CONNECTING TO CENTRAL NODE...', delay: 800 },
      { text: '> NETWORK STATUS: ONLINE [' + mode + ']', delay: 1200 },
      { text: '> IoT DEVICE MESH: 33 NODES ACTIVE', delay: 1600 },
      { text: '> SECURITY PROTOCOL: ACCOUNT AUTH', delay: 2000 },
      { text: '> AWAITING OPERATOR CREDENTIALS...', delay: 2400 },
    ];

    var currentLines = [];
    for (var i = 0; i < lines.length; i++) {
      (function (line, index) {
        setTimeout(function () {
          currentLines.push(line.text);
          self.setData({ terminalLines: currentLines.slice() });
          if (index === lines.length - 1) {
            setTimeout(function () {
              self.setData({ bootDone: true, scanActive: true });
              setTimeout(function () {
                self.setData({ showForm: true });
              }, 600);
            }, 400);
          }
        }, line.delay);
      })(lines[i], i);
    }
  },

  // ── 表单输入 ──────────────────────────────────────────────
  onUsernameInput: function (e) {
    this.setData({ username: e.detail.value, formError: '' });
  },

  onPasswordInput: function (e) {
    this.setData({ password: e.detail.value, formError: '' });
  },

  toggleShowPassword: function () {
    this.setData({ showPassword: !this.data.showPassword });
  },

  // ── 提交验证 ──────────────────────────────────────────────
  onSubmit: function () {
    var username = this.data.username.trim();
    var password = this.data.password.trim();

    if (!username) {
      this.setData({ formError: '请输入登录账号' });
      return;
    }
    if (!password) {
      this.setData({ formError: '请输入登录密码' });
      return;
    }

    var self = this;
    self.setData({ scanActive: true, formError: '' });

    var lines = self.data.terminalLines.slice();
    lines.push('> VERIFYING CREDENTIALS: ' + username + ' / ****');
    self.setData({ terminalLines: lines });

    // ── Mock 模式 ──
    if (app.globalData.useMock) {
      app.request({
        url: '/api/v1/auth/verify',
        method: 'POST',
        data: { username: username, password: password },
        success: function (res) {
          self._handleMockLoginResponse(res, lines);
        },
      });
      return;
    }

    // ── 真实后端模式 ──
    // 后端 /api/v1/auth/verify 返回: { token, user_id, name, role }
    app.loginWithPassword(username, password, function (err, user) {
      if (!err && user) {
        var accountRole = user.role >= 5 ? 'admin' : 'staff';
        var successLines = lines.slice();
        successLines.push('> ACCESS GRANTED ✓');
        successLines.push('> WELCOME, OPERATOR ' + user.name);
        successLines.push('> ROLE: ' + (accountRole === 'admin' ? 'ADMINISTRATOR' : 'STAFF'));
        successLines.push('> REDIRECTING TO COMMAND CENTER...');
        self.setData({
          terminalLines: successLines,
          showResult: true,
          resultSuccess: true,
          scanActive: false,
        });

        setTimeout(function () {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      } else {
        var failLines = lines.slice();
        failLines.push('> ACCESS DENIED ✗');
        failLines.push('> ERROR: ' + (err || 'INVALID CREDENTIALS'));
        self.setData({
          terminalLines: failLines,
          showResult: true,
          resultSuccess: false,
          scanActive: false,
          formError: (typeof err === 'string') ? err : '账号或密码错误',
        });

        setTimeout(function () {
          self.setData({ showResult: false });
        }, 3000);
      }
    });
  },

  // ── Mock 登录响应处理（保持原有逻辑） ──
  _handleMockLoginResponse: function (res, lines) {
    var self = this;
    if (res.code === 200 && res.data && res.data.user) {
      var user = res.data.user;
      var token = res.data.token || 'token_' + Date.now();

      // 保存登录状态
      app.globalData.token = token;
      app.globalData.userInfo = user;
      app.globalData.accountRole = res.data.account_role || 'staff';
      wx.setStorageSync('token', token);
      wx.setStorageSync('userInfo', user);
      wx.setStorageSync('accountRole', res.data.account_role || 'staff');

      var successLines = lines.slice();
      successLines.push('> ACCESS GRANTED ✓');
      successLines.push('> WELCOME, OPERATOR ' + user.name);
      successLines.push('> ROLE: ' + (res.data.account_role === 'admin' ? 'ADMINISTRATOR' : 'STAFF'));
      successLines.push('> REDIRECTING TO COMMAND CENTER...');
      self.setData({
        terminalLines: successLines,
        showResult: true,
        resultSuccess: true,
        scanActive: false,
      });

      setTimeout(function () {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);
    } else {
      var failLines = lines.slice();
      failLines.push('> ACCESS DENIED ✗');
      failLines.push('> ERROR: ' + (res.message || 'INVALID CREDENTIALS'));
      self.setData({
        terminalLines: failLines,
        showResult: true,
        resultSuccess: false,
        scanActive: false,
        formError: res.message || '账号或密码错误',
      });

      setTimeout(function () {
        self.setData({ showResult: false });
      }, 3000);
    }
  },
});
