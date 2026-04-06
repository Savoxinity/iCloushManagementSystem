/**
 * 物流仪表盘 — 一屏总览
 * Phase 4 机动物流中台
 * 修复: 改用 app.request() 统一请求封装（自动附带 token + baseUrl）
 */
var app = getApp();

Page({
  data: {
    today: '',
    dashboard: {
      fleet: { total: 0, idle: 0, delivering: 0, maintenance: 0 },
      today_dispatches: 0,
      alert_count: 0,
      trend_7d: [],
    },
  },

  onLoad: function () {
    var now = new Date();
    this.setData({
      today: now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0'),
    });
    this.loadDashboard();
  },

  onShow: function () {
    this.loadDashboard();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadDashboard();
    wx.stopPullDownRefresh();
  },

  // ── 加载仪表盘数据 ──
  loadDashboard: function () {
    var self = this;
    app.request({
      url: '/api/v1/vehicles/dashboard',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var data = res.data;
          // 处理趋势图数据
          var trend7d = data.trend_7d || [];
          var maxCount = 1;
          for (var i = 0; i < trend7d.length; i++) {
            if (trend7d[i].count > maxCount) maxCount = trend7d[i].count;
          }
          var trend = [];
          for (var j = 0; j < trend7d.length; j++) {
            var t = trend7d[j];
            trend.push({
              date: t.date,
              count: t.count,
              _height: Math.max(Math.round(t.count / maxCount * 200), 8),
              _label: t.date.slice(5), // MM-DD
            });
          }

          self.setData({
            dashboard: {
              fleet: data.fleet || { total: 0, idle: 0, delivering: 0, maintenance: 0 },
              today_dispatches: data.today_dispatches || 0,
              alert_count: data.alert_count || 0,
              trend_7d: trend,
            },
          });
        }
      },
      fail: function () {
        console.error('加载仪表盘失败');
      },
    });
  },

  // ── 快捷跳转 ──
  goVehicleManage: function (e) {
    var status = (e.currentTarget.dataset && e.currentTarget.dataset.status) || '';
    wx.navigateTo({ url: '/pages/vehicle-manage/index' + (status ? '?status=' + status : '') });
  },

  goRouteManage: function () {
    wx.navigateTo({ url: '/pages/route-manage/index' });
  },

  goDispatchManage: function () {
    wx.navigateTo({ url: '/pages/dispatch-manage/index' });
  },

  goAlerts: function () {
    wx.navigateTo({ url: '/pages/vehicle-manage/index?tab=alerts' });
  },
});
