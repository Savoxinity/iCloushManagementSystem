// ============================================
// 功能金刚区页面
// ============================================
var app = getApp();
var util = require('../../utils/util');

// 功能模块配置（按权限过滤）
var ALL_FEATURES = [
  {
    id: 'task', name: '任务发放', sub: '创建/分配任务', icon: '📋',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/task-list/index',
    minRole: 3, comingSoon: false,
  },
  {
    id: 'scan', name: '扫码取证', sub: '拍照上传水印', icon: '📷',
    iconBg: 'rgba(0, 255, 136, 0.15)', url: '/pages/task-list/index?mode=scan',
    minRole: 1, comingSoon: false,
  },
  {
    id: 'schedule', name: '排班考勤', sub: '工区人员排班', icon: '📅',
    iconBg: 'rgba(201, 168, 76, 0.15)', url: '/pages/schedule/index',
    minRole: 5, comingSoon: false,
  },
  {
    id: 'iot', name: '设备物联', sub: 'IoT设备实时监控', icon: '⚙️',
    iconBg: 'rgba(139, 92, 246, 0.15)', url: '/pages/iot-dashboard/index',
    minRole: 5, comingSoon: false,
  },
  {
    id: 'staff', name: '员工管理', sub: '账号/技能/卡牌', icon: '👥',
    iconBg: 'rgba(236, 72, 153, 0.15)', url: '/pages/staff-manage/index',
    minRole: 5, comingSoon: false,
  },
  {
    id: 'reports', name: '数据报表', sub: '产量/效率/趋势', icon: '📊',
    iconBg: 'rgba(245, 158, 11, 0.15)', url: '/pages/reports/index',
    minRole: 5, comingSoon: false,
  },
  {
    id: 'mall', name: '积分商城', sub: '兑换奖励', icon: '🏆',
    iconBg: 'rgba(201, 168, 76, 0.15)', url: '/pages/mall/index',
    minRole: 1, comingSoon: false,
  },
  {
    id: 'permission', name: '权限配置', sub: '角色/工区权限', icon: '🔐',
    iconBg: 'rgba(107, 114, 128, 0.15)', url: '/pages/permission/index',
    minRole: 9, comingSoon: false,
  },
];

Page({
  data: {
    features: [],
    userRoleLabel: '加载中...',
  },

  onLoad: function () { this.buildFeatureList(); },
  onShow: function () { this.buildFeatureList(); },

  buildFeatureList: function () {
    var userInfo = app.globalData.userInfo;
    var userRole = userInfo ? userInfo.role : 1;
    var userRoleLabel = util.getRoleLabel(userRole);

    // 按权限过滤，无权限的显示为 disabled
    var features = [];
    for (var i = 0; i < ALL_FEATURES.length; i++) {
      var f = ALL_FEATURES[i];
      features.push({
        id: f.id, name: f.name, sub: f.sub, icon: f.icon,
        iconBg: f.iconBg, url: f.url, minRole: f.minRole,
        comingSoon: f.comingSoon,
        disabled: userRole < f.minRole,
        alertNum: 0, hasAlert: false,
      });
    }

    var self = this;
    this.setData({ features: features, userRoleLabel: userRoleLabel });

    // 设置 IoT 告警数
    app.request({
      url: '/api/v1/iot/dashboard',
      success: function (res) {
        if (res.code !== 200) return;
        var alertNum = (res.data && res.data.alert) || 0;
        var updatedFeatures = [];
        for (var j = 0; j < features.length; j++) {
          var feat = features[j];
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
  },

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
