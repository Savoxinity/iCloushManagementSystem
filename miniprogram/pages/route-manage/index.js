/**
 * 排线管理 — 送货排线 CRUD
 * Phase 4 机动物流中台
 * 修复: 改用 app.request() 统一请求封装（自动附带 token + baseUrl）
 */
var app = getApp();

Page({
  data: {
    routeList: [],
    loading: false,
    isAdmin: false,
  },

  onLoad: function () {
    var userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ isAdmin: (userInfo.role || 1) >= 5 });
    this.loadRoutes();
  },

  onShow: function () {
    this.loadRoutes();
  },

  onPullDownRefresh: function () {
    this.loadRoutes();
    wx.stopPullDownRefresh();
  },

  // ── 加载排线列表 ──
  loadRoutes: function () {
    var self = this;
    self.setData({ loading: true });
    app.request({
      url: '/api/v1/vehicles/routes/list',
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          self.setData({ routeList: res.data || [] });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  // ── 跳转详情 ──
  goRouteDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/route-detail/index?id=' + id });
  },

  // ── 新增排线 ──
  goCreateRoute: function () {
    wx.navigateTo({ url: '/pages/route-create/index' });
  },
});
