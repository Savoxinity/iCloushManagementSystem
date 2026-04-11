// ============================================
// 功能金刚区页面 V9 — 权限修复 + 入口整理
// ============================================
var app = getApp();
var util = require('../../utils/util');

// 功能模块配置
// adminOnly: true 的功能仅管理员可见
// staffOnly: true 的功能仅员工可见（管理员不显示）
// 无 adminOnly/staffOnly 的功能所有人可见
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
  // 权限配置已移除（功能与员工管理标签重叠）
  // ── 机动物流中台（Phase 4）──
  {
    id: 'logistics', name: '物流调度', sub: '车队/排线/出车', icon: '🚛',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/logistics-dashboard/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },

  // ═══ 业财一体化模块 — 入口整理 ═══

  // ★ 付款/报销申请聚合入口（Phase 5.3）
  {
    id: 'payment_create', name: '付款申请', sub: '即付即票/先付后票/分期', icon: '💳',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/payment-create/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: false,
  },
  {
    id: 'payment_list', name: '付款记录', sub: '查看付款进度', icon: '📊',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/payment-list/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: false,
  },
  // ★ 创建报销：所有权限账号均可使用（包括老板/管理员）
  {
    id: 'expense_create', name: '创建报销', sub: '提交报销单', icon: '📝',
    iconBg: 'rgba(251, 191, 36, 0.15)', url: '/pages/expense-create/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: false,
  },
  // 报销记录：所有人可查看自己的报销
  {
    id: 'expense_list', name: '报销记录', sub: '查看报销进度', icon: '💰',
    iconBg: 'rgba(251, 191, 36, 0.15)', url: '/pages/expense-list/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: false,
  },
  // ★ 发票夹（我的发票）：所有人可查看和上传自己的发票
  {
    id: 'invoice_manage', name: '我的发票', sub: '发票夹/OCR识别', icon: '🧾',
    iconBg: 'rgba(16, 185, 129, 0.15)', url: '/pages/invoice-list/index',
    minRole: 1, comingSoon: false, adminOnly: false, staffOnly: false,
  },
  // 管理员：报销审核（三按钮审核）
  {
    id: 'expense_review', name: '报销审核', sub: '驳回/小票/发票通过', icon: '✅',
    iconBg: 'rgba(251, 191, 36, 0.15)', url: '/pages/expense-review/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // 管理员：发票管理（全员工发票仓库）
  {
    id: 'invoice_admin', name: '发票管理', sub: '全员工发票仓库', icon: '📋',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/invoice-manage/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // 管理员：发票打印管理（Phase 5.3）
  {
    id: 'invoice_print', name: '发票打印', sub: '标记已打印/未打印', icon: '🖨️',
    iconBg: 'rgba(107, 114, 128, 0.15)', url: '/pages/invoice-print/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // 管理员：付款审批（Phase 5.3）
  {
    id: 'payment_review', name: '付款审批', sub: '审批付款申请单', icon: '✅',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/payment-review/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // 管理员：管理会计入口（欠票看板、成本直录、利润表）
  {
    id: 'accounting', name: '管理会计', sub: '利润表/成本/欠票', icon: '📈',
    iconBg: 'rgba(239, 68, 68, 0.15)', url: '/pages/management-accounting/index',
    minRole: 5, comingSoon: false, adminOnly: true,
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
      // 物流驾驶员专属功能
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
