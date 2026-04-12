// ============================================
// 功能金刚区页面 V5.4.2 — 纯 2×2 Grid 布局
// 快捷报账 / 我的发票 / 报账&发票审核 均为方形卡片
// 点击后跳转到独立子页面（参考管理会计模式）
// ============================================
var app = getApp();
var util = require('../../utils/util');

// ── 全部功能卡片（统一 2×2 grid） ──
var ALL_FEATURES = [
  // ★ 快捷报账（所有人可见）
  {
    id: 'quick_expense', name: '快捷报账', sub: '付款/报销/记录', icon: '💳',
    iconBg: 'rgba(251, 191, 36, 0.15)', url: '/pages/quick-reimbursement/index',
    minRole: 1, adminOnly: false,
  },
  // ★ 我的发票（所有人可见）
  {
    id: 'my_invoice', name: '我的发票', sub: '发票夹/OCR识别', icon: '🧾',
    iconBg: 'rgba(16, 185, 129, 0.15)', url: '/pages/invoice-list/index',
    minRole: 1, adminOnly: false,
  },
  // ★ 报账&发票审核（仅管理员）
  {
    id: 'finance_review', name: '报账&发票审核', sub: '审批/审核/票据/打印', icon: '✅',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/finance-review-hub/index',
    minRole: 5, adminOnly: true,
  },
  // 任务大厅（仅员工）
  {
    id: 'task_hall', name: '任务大厅', sub: '领任务/报工', icon: '🎯',
    iconBg: 'rgba(201, 168, 76, 0.2)', url: '/pages/task-list/index',
    minRole: 1, staffOnly: true,
  },
  // 任务发放（仅管理员）
  {
    id: 'task', name: '任务发放', sub: '创建/分配任务', icon: '📋',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/task-list/index',
    minRole: 3, adminOnly: true,
  },
  // 扫码取证
  {
    id: 'scan', name: '扫码取证', sub: '拍照上传水印', icon: '📷',
    iconBg: 'rgba(0, 255, 136, 0.15)', url: '/pages/task-list/index?mode=scan',
    minRole: 1,
  },
  // 排班考勤
  {
    id: 'schedule', name: '排班考勤', sub: '工区人员排班', icon: '📅',
    iconBg: 'rgba(201, 168, 76, 0.15)', url: '/pages/schedule/index',
    minRole: 5, adminOnly: true,
  },
  // 设备物联
  {
    id: 'iot', name: '设备物联', sub: 'IoT设备实时监控', icon: '⚙️',
    iconBg: 'rgba(139, 92, 246, 0.15)', url: '/pages/iot-dashboard/index',
    minRole: 5, adminOnly: true,
  },
  // 员工管理
  {
    id: 'staff', name: '员工管理', sub: '账号/技能/卡牌', icon: '👥',
    iconBg: 'rgba(236, 72, 153, 0.15)', url: '/pages/staff-manage/index',
    minRole: 5, adminOnly: true,
  },
  // 数据报表
  {
    id: 'reports', name: '数据报表', sub: '产量/效率/趋势', icon: '📊',
    iconBg: 'rgba(245, 158, 11, 0.15)', url: '/pages/reports/index',
    minRole: 5, adminOnly: true,
  },
  // 我的排班（仅员工）
  {
    id: 'my_calendar', name: '我的排班', sub: '查看排班日历', icon: '🗓',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/my-calendar/index',
    minRole: 1, staffOnly: true,
  },
  // 积分商城
  {
    id: 'mall', name: '积分商城', sub: '兑换奖励', icon: '🏆',
    iconBg: 'rgba(201, 168, 76, 0.15)', url: '/pages/mall/index',
    minRole: 1,
  },
  // 物流调度
  {
    id: 'logistics', name: '物流调度', sub: '车队/排线/出车', icon: '🚛',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/logistics-dashboard/index',
    minRole: 5, adminOnly: true,
  },
  // 管理会计
  {
    id: 'accounting', name: '管理会计', sub: '利润表/成本/欠票', icon: '📈',
    iconBg: 'rgba(239, 68, 68, 0.15)', url: '/pages/management-accounting/index',
    minRole: 5, adminOnly: true,
  },
];

Page({
  data: {
    features: [],
    userRoleLabel: '加载中...',
    isAdmin: true,
  },

  onLoad: function () { this.buildFeatureList(); },
  onShow: function () { this.buildFeatureList(); },

  buildFeatureList: function () {
    var userInfo = app.globalData.userInfo;
    var userRole = userInfo ? userInfo.role : 1;
    var userRoleLabel = util.getRoleLabel(userRole);
    var isAdmin = app.globalData.accountRole === 'admin';

    // 过滤功能卡片
    var features = [];
    for (var i = 0; i < ALL_FEATURES.length; i++) {
      var f = ALL_FEATURES[i];
      if (f.adminOnly && !isAdmin) continue;
      if (f.staffOnly && isAdmin) continue;
      if (f.logisticsOnly) {
        var tags = (userInfo && userInfo.tags) || [];
        var hasLogisticsTag = false;
        for (var t = 0; t < tags.length; t++) {
          if (tags[t] === '物流驾驶') { hasLogisticsTag = true; break; }
        }
        if (userRole < 5 && !hasLogisticsTag) continue;
      }
      features.push({
        id: f.id, name: f.name, sub: f.sub, icon: f.icon,
        iconBg: f.iconBg, url: f.url, minRole: f.minRole,
        comingSoon: f.comingSoon || false,
        disabled: userRole < f.minRole,
        alertNum: 0, hasAlert: false,
      });
    }

    var self = this;
    this.setData({
      features: features,
      userRoleLabel: userRoleLabel,
      isAdmin: isAdmin,
    });

    // 管理员版：设置 IoT 告警数
    if (isAdmin) {
      app.request({
        url: '/api/v1/iot/dashboard',
        success: function (res) {
          if (res.code !== 200) return;
          var alertNum = (res.data && res.data.alert) || 0;
          var updatedFeatures = [];
          for (var j = 0; j < self.data.features.length; j++) {
            var feat = self.data.features[j];
            if (feat.id === 'iot') {
              var copy = {};
              var keys = Object.keys(feat);
              for (var k = 0; k < keys.length; k++) { copy[keys[k]] = feat[keys[k]]; }
              copy.alertNum = alertNum;
              copy.hasAlert = alertNum > 0;
              updatedFeatures.push(copy);
            } else {
              updatedFeatures.push(feat);
            }
          }
          self.setData({ features: updatedFeatures });
        },
      });
    }
  },

  // ── 功能卡片点击 ──
  onFeatureTap: function (e) {
    var feature = e.currentTarget.dataset.feature;
    var userInfo = app.globalData.userInfo;
    var userRole = userInfo ? userInfo.role : 1;

    if (userRole < feature.minRole) {
      wx.showToast({ title: '权限不足，请联系管理员', icon: 'none' });
      return;
    }

    if (feature.comingSoon) {
      wx.showToast({ title: '功能即将上线', icon: 'none' });
      return;
    }

    wx.navigateTo({ url: feature.url });
  },
});
