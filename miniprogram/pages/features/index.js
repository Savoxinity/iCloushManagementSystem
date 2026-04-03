// ============================================
// 功能金刚区页面 V8 — Phase 3B/3C 业财分流
// ============================================
var app = getApp();
var util = require('../../utils/util');

// 功能模块配置
// adminOnly: true 的功能仅管理员可见
var ALL_FEATURES = [
  {
    id: 'task_hall', name: '任务大厅', sub: '领任务 / 报工', icon: '🎯',
    iconBg: 'rgba(201, 168, 76, 0.2)', url: '/pages/task-list/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: true,
  },
  {
    id: 'task', name: '任务发放', sub: '创建/分配任务', icon: '📋',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/task-list/index',
    minRole: 3, comingSoon: false, adminOnly: true,
  },
  {
    id: 'scan', name: '扫码取证', sub: '拍照上传水印', icon: '📷',
    iconBg: 'rgba(0, 255, 136, 0.15)', url: '/pages/task-list/index?mode=scan',
    minRole: 1, comingSoon: false, adminOnly: false,
  },
  {
    id: 'schedule', name: '排班考勤', sub: '工区人员排班', icon: '📅',
    iconBg: 'rgba(201, 168, 76, 0.15)', url: '/pages/schedule/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  {
    id: 'iot', name: '设备物联', sub: 'IoT设备实时监控', icon: '⚙️',
    iconBg: 'rgba(139, 92, 246, 0.15)', url: '/pages/iot-dashboard/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  {
    id: 'staff', name: '员工管理', sub: '账号/技能/卡牌', icon: '👥',
    iconBg: 'rgba(236, 72, 153, 0.15)', url: '/pages/staff-manage/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  {
    id: 'reports', name: '数据报表', sub: '产量/效率/趋势', icon: '📊',
    iconBg: 'rgba(245, 158, 11, 0.15)', url: '/pages/reports/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  {
    id: 'my_calendar', name: '我的排班', sub: '查看排班日历', icon: '🗓',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/my-calendar/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: true,
  },
  {
    id: 'mall', name: '积分商城', sub: '兑换奖励', icon: '🏆',
    iconBg: 'rgba(201, 168, 76, 0.15)', url: '/pages/mall/index',
    minRole: 1, comingSoon: false, adminOnly: false,
  },
  {
    id: 'permission', name: '权限配置', sub: '角色/工区权限', icon: '🔐',
    iconBg: 'rgba(107, 114, 128, 0.15)', url: '/pages/permission/index',
    minRole: 9, comingSoon: false, adminOnly: true,
  },
  // ── 机动物流中台（Phase 4）──
  {
    id: 'logistics', name: '物流调度', sub: '车队/排线/出车', icon: '🚛',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/logistics-dashboard/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  {
    id: 'vehicle_manage', name: '车队管理', sub: '车辆台账/预警', icon: '🚗',
    iconBg: 'rgba(16, 185, 129, 0.15)', url: '/pages/vehicle-manage/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // ── 业财一体化模块（Phase 3B/3C）──
  // 员工：创建报销单（极简三项，无成本分类）
  {
    id: 'expense_create', name: '创建报销', sub: '提交报销单', icon: '📝',
    iconBg: 'rgba(251, 191, 36, 0.15)', url: '/pages/expense-create/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: true,
  },
  // 员工：查看自己的报销记录
  {
    id: 'expense_list', name: '报销记录', sub: '查看报销进度', icon: '💰',
    iconBg: 'rgba(251, 191, 36, 0.15)', url: '/pages/expense-list/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: true,
  },
  // 员工：上传发票（补票用）
  {
    id: 'invoice_upload', name: '上传发票', sub: '发票OCR识别', icon: '🧾',
    iconBg: 'rgba(16, 185, 129, 0.15)', url: '/pages/invoice-upload/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: true,
  },
  // 管理员：报销审核（含成本分类选择）
  {
    id: 'expense_review', name: '报销审核', sub: '审核+成本分类', icon: '✅',
    iconBg: 'rgba(251, 191, 36, 0.15)', url: '/pages/expense-review/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // 管理员：发票管理
  {
    id: 'invoice_manage', name: '发票管理', sub: 'OCR识别/票夹', icon: '🧾',
    iconBg: 'rgba(16, 185, 129, 0.15)', url: '/pages/invoice-list/index',
    minRole: 3, comingSoon: false, adminOnly: true,
  },
  // 管理员：管理会计入口（欠票看板、成本直录、利润表）
  {
    id: 'accounting', name: '管理会计', sub: '利润表/成本/欠票', icon: '📈',
    iconBg: 'rgba(239, 68, 68, 0.15)', url: '/pages/management-accounting/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // ── Phase 4.1 新增 ──
  // 成本分类明细账
  {
    id: 'cost_ledger', name: '成本明细账', sub: '分类汇总/明细', icon: '📒',
    iconBg: 'rgba(245, 158, 11, 0.15)', url: '/pages/cost-ledger-detail/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // 物流驾驶员专属入口（role >= 5 或有物流驾驶标签）
  {
    id: 'logistics_dispatch', name: '物流出车', sub: '接单/出车/回场', icon: '🚚',
    iconBg: 'rgba(34, 197, 94, 0.15)', url: '/pages/logistics-dashboard/index',
    minRole: 1, comingSoon: false, adminOnly: false, logisticsOnly: true,
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

    // 按角色过滤功能列表
    var features = [];
    for (var i = 0; i < ALL_FEATURES.length; i++) {
      var f = ALL_FEATURES[i];

      // 管理员专属功能：员工版不显示
      if (f.adminOnly && !isAdmin) continue;
      // 员工专属功能：管理员版不显示
      if (f.staffOnly && isAdmin) continue;
      // 物流驾驶员专属功能：需 role>=5 或有"物流驾驶"标签
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
        comingSoon: f.comingSoon,
        disabled: userRole < f.minRole,
        alertNum: 0, hasAlert: false,
      });
    }

    var self = this;
    this.setData({ features: features, userRoleLabel: userRoleLabel, isAdmin: isAdmin });

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
