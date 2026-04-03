// ============================================
// 功能金刚区页面
// ============================================
const app = getApp();
const util = require('../../utils/util');

// 功能模块配置（按权限过滤）
const ALL_FEATURES = [
  {
    id: 'task',
    name: '任务发放',
    sub: '创建/分配任务',
    icon: '📋',
    iconBg: 'rgba(59, 130, 246, 0.15)',
    url: '/pages/task-list/index',
    minRole: 3, // 班组长及以上
    comingSoon: false,
  },
  {
    id: 'scan',
    name: '扫码取证',
    sub: '拍照上传水印',
    icon: '📷',
    iconBg: 'rgba(0, 255, 136, 0.15)',
    url: '/pages/task-list/index?mode=scan',
    minRole: 1, // 所有员工
    comingSoon: false,
  },
  {
    id: 'schedule',
    name: '排班考勤',
    sub: '工区人员排班',
    icon: '📅',
    iconBg: 'rgba(201, 168, 76, 0.15)',
    url: '/pages/schedule/index',
    minRole: 5, // 主管及以上
    comingSoon: false,
  },
  {
    id: 'iot',
    name: '设备物联',
    sub: 'IoT设备实时监控',
    icon: '⚙️',
    iconBg: 'rgba(139, 92, 246, 0.15)',
    url: '/pages/iot-dashboard/index',
    minRole: 5,
    comingSoon: false,
  },
  {
    id: 'staff',
    name: '员工管理',
    sub: '账号/技能/卡牌',
    icon: '👥',
    iconBg: 'rgba(236, 72, 153, 0.15)',
    url: '/pages/staff-manage/index',
    minRole: 5,
    comingSoon: false,
  },
  {
    id: 'reports',
    name: '数据报表',
    sub: '产量/效率/趋势',
    icon: '📊',
    iconBg: 'rgba(245, 158, 11, 0.15)',
    url: '/pages/reports/index',
    minRole: 5,
    comingSoon: false,
  },
  {
    id: 'mall',
    name: '积分商城',
    sub: '兑换奖励',
    icon: '🏆',
    iconBg: 'rgba(201, 168, 76, 0.15)',
    url: '/pages/mall/index',
    minRole: 1,
    comingSoon: false,
  },
  {
    id: 'permission',
    name: '权限配置',
    sub: '角色/工区权限',
    icon: '🔐',
    iconBg: 'rgba(107, 114, 128, 0.15)',
    url: '/pages/permission/index',
    minRole: 9, // 仅管理员
    comingSoon: false,
  },
];

Page({
  data: {
    features: [],
    userRoleLabel: '加载中...',
  },

  onLoad() {
    this.buildFeatureList();
  },

  onShow() {
    this.buildFeatureList();
  },

  buildFeatureList() {
    const userInfo = app.globalData.userInfo;
    const userRole = userInfo ? userInfo.role : 1;
    const userRoleLabel = util.getRoleLabel(userRole);

    // 按权限过滤，无权限的显示为 disabled
    const features = ALL_FEATURES.map(f => ({
      ...f,
      disabled: userRole < f.minRole,
      alertNum: 0, // 后续从 API 获取告警数
    }));

    // 设置 IoT 告警数
    app.request({
      url: '/api/v1/iot/dashboard',
      success: (res) => {
        if (res.code !== 200) return;
        const alertNum = res.data.alert || 0;
        const updatedFeatures = features.map(f => {
          if (f.id === 'iot') return { ...f, alertNum, hasAlert: alertNum > 0 };
          return f;
        });
        this.setData({ features: updatedFeatures });
      },
    });

    this.setData({ features, userRoleLabel });
  },

  onFeatureTap(e) {
    const feature = e.currentTarget.dataset.feature;
    const userInfo = app.globalData.userInfo;
    const userRole = userInfo ? userInfo.role : 1;

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
