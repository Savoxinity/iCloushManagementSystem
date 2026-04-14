/**
 * 车队管理 — 车辆台账 + 四险一金预警
 * Phase 4 机动物流中台
 * 修复: 改用 app.request() 统一请求封装（自动附带 token + baseUrl）
 */
var app = getApp();

Page({
  data: {
    activeTab: 'list',
    statusFilter: '',
    vehicleList: [],
    loading: false,
    isAdmin: false,

    // 预警
    alertList: [],
    alertCount: 0,
    alertLoading: false,
    alertDaysIndex: 1,
    alertDaysOptions: [
      { label: '7天内', value: 7 },
      { label: '30天内', value: 30 },
      { label: '60天内', value: 60 },
      { label: '90天内', value: 90 },
    ],
  },

  onLoad: function (options) {
    var userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({ isAdmin: (userInfo.role || 1) >= 5 });
    // 支持从外部传入 tab 参数
    if (options && options.tab === 'alerts') {
      this.setData({ activeTab: 'alerts' });
      this.loadAlerts();
    }
    // 支持从外部传入 status 参数
    if (options && options.status) {
      this.setData({ statusFilter: options.status });
    }
    this.loadVehicleList();
    this.loadAlertCount();
  },

  onShow: function () {
    this.loadVehicleList();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadVehicleList();
    if (self.data.activeTab === 'alerts') {
      self.loadAlerts();
    } else {
      self.loadAlertCount();
    }
    wx.stopPullDownRefresh();
  },

  // ── 标签切换 ──
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'alerts') {
      this.loadAlerts();
    }
  },

  // ── 状态筛选 ──
  setStatusFilter: function (e) {
    var status = e.currentTarget.dataset.status;
    this.setData({ statusFilter: status });
    this.loadVehicleList();
  },

  // ── 加载车辆列表 ──
  loadVehicleList: function () {
    var self = this;
    self.setData({ loading: true });
    var queryStr = '';
    if (self.data.statusFilter) {
      queryStr = '?status=' + self.data.statusFilter;
    }
    app.request({
      url: '/api/v1/vehicles/fleet/list' + queryStr,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          // 计算每辆车的预警
          var today = new Date();
          var vehicles = (Array.isArray(res.data) ? res.data : (res.data && res.data.items) || []).map(function (v) {
            var alerts = [];
            var checks = [
              { key: 'inspection', label: '年检', date: v.inspection_due },
              { key: 'compulsory_insurance', label: '交强险', date: v.compulsory_ins_due },
              { key: 'commercial_insurance', label: '商业险', date: v.commercial_ins_due },
              { key: 'maintenance', label: '保养', date: v.maintenance_due },
            ];
            checks.forEach(function (c) {
              if (!c.date) return;
              var due = new Date(c.date.replace(/-/g, '/'));
              var remaining = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
              if (remaining <= 30) {
                alerts.push({
                  type: c.key,
                  label: c.label,
                  remaining_days: remaining,
                  level: remaining < 0 ? 'expired' : remaining <= 7 ? 'urgent' : 'warning',
                });
              }
            });
            v._alerts = alerts;
            return v;
          });
          self.setData({ vehicleList: vehicles });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  // ── 加载预警数量（用于 badge） ──
  loadAlertCount: function () {
    var self = this;
    app.request({
      url: '/api/v1/vehicles/fleet/alerts?days=30',
      success: function (res) {
        if (res.code === 200) {
          self.setData({ alertCount: res.total || 0 });
        }
      },
    });
  },

  // ── 加载预警列表 ──
  loadAlerts: function () {
    var self = this;
    self.setData({ alertLoading: true });
    var days = self.data.alertDaysOptions[self.data.alertDaysIndex].value;
    app.request({
      url: '/api/v1/vehicles/fleet/alerts?days=' + days,
      success: function (res) {
        self.setData({ alertLoading: false });
        if (res.code === 200) {
          self.setData({
            alertList: res.data || [],
            alertCount: res.total || 0,
          });
        }
      },
      fail: function () {
        self.setData({ alertLoading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  // ── 预警天数切换 ──
  changeAlertDays: function (e) {
    this.setData({ alertDaysIndex: parseInt(e.detail.value) });
    this.loadAlerts();
  },

  // ── 跳转详情 ──
  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/vehicle-detail/index?id=' + id });
  },

  // ── 新增车辆 ──
  goAddVehicle: function () {
    wx.navigateTo({ url: '/pages/vehicle-add/index' });
  },
});
