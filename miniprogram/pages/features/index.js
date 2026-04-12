// ============================================
// 功能金刚区页面 V5.4.1 — 折叠集成卡片入口
// ============================================
var app = getApp();
var util = require('../../utils/util');

// ── 一级功能卡片（非折叠） ──
var STANDALONE_FEATURES = [
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
    id: 'logistics', name: '物流调度', sub: '车队/排线/出车', icon: '🚛',
    iconBg: 'rgba(59, 130, 246, 0.15)', url: '/pages/logistics-dashboard/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
  // 管理会计入口
  {
    id: 'accounting', name: '管理会计', sub: '利润表/成本/欠票', icon: '📈',
    iconBg: 'rgba(239, 68, 68, 0.15)', url: '/pages/management-accounting/index',
    minRole: 5, comingSoon: false, adminOnly: true,
  },
];

// ── 折叠集成卡片配置 ──

// 「快捷报账」— 员工和管理员共用
var QUICK_EXPENSE_CARD = {
  id: 'quick_expense',
  name: '快捷报账',
  sub: '付款/报销/记录',
  icon: '💳',
  iconBg: 'rgba(251, 191, 36, 0.15)',
  isGroup: true,
  children: [
    { id: 'payment_create', name: '付款/采购申请', sub: '即付即票/先付后票/分批付款', icon: '💳', url: '/pages/payment-create/index' },
    { id: 'payment_list', name: '付款记录', sub: '查看付款进度', icon: '📊', url: '/pages/payment-list/index' },
    { id: 'expense_create', name: '报销申请', sub: '提交报销单', icon: '📝', url: '/pages/expense-create/index' },
    { id: 'expense_list', name: '报销记录', sub: '全部/付款/报销/驳回', icon: '💰', url: '/pages/expense-list/index' },
  ],
};

// 「我的发票」— 员工和管理员共用（一级直达）
var MY_INVOICE_CARD = {
  id: 'invoice_manage',
  name: '我的发票',
  sub: '发票夹/OCR识别',
  icon: '🧾',
  iconBg: 'rgba(16, 185, 129, 0.15)',
  isGroup: false,
  url: '/pages/invoice-list/index',
};

// 「报账&发票审核」— 仅管理员
var ADMIN_REVIEW_CARD = {
  id: 'admin_review',
  name: '报账&发票审核',
  sub: '审批/审核/票据/打印',
  icon: '✅',
  iconBg: 'rgba(59, 130, 246, 0.15)',
  isGroup: true,
  adminOnly: true,
  children: [
    { id: 'payment_review', name: '付款审批', sub: '审批付款申请单', icon: '✅', url: '/pages/payment-review/index' },
    { id: 'expense_review', name: '报销审核', sub: '驳回/小票/发票通过', icon: '📋', url: '/pages/expense-review/index' },
    { id: 'invoice_admin', name: '发票/票据池', sub: '全员工票据仓库', icon: '🧾', url: '/pages/invoice-manage/index' },
    { id: 'invoice_print', name: '发票打印', sub: '标记已打印/未打印', icon: '🖨️', url: '/pages/invoice-print/index' },
  ],
};

Page({
  data: {
    standaloneFeatures: [],
    groupCards: [],
    userRoleLabel: '加载中...',
    isAdmin: true,
    expandedGroups: {},
  },

  onLoad: function () { this.buildFeatureList(); },
  onShow: function () {
    this.buildFeatureList();
    this.loadCoverageData();
  },

  // ── 加载开票覆盖率 BI 数据 ──
  loadCoverageData: function () {
    var self = this;
    var isAdmin = app.globalData.accountRole === 'admin';
    if (!isAdmin) return;

    app.request({
      url: '/api/v1/payments/invoice-coverage',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var d = res.data;
          self.setData({
            coverageData: {
              rate: (d.coverage_rate || 0).toFixed(1),
              invoiceTotal: (d.invoice_total || 0).toFixed(2),
              costTotal: (d.cost_total || 0).toFixed(2),
              taxGap: (d.tax_gap || 0).toFixed(2),
            },
          });
        }
      },
    });
  },

  buildFeatureList: function () {
    var userInfo = app.globalData.userInfo;
    var userRole = userInfo ? userInfo.role : 1;
    var userRoleLabel = util.getRoleLabel(userRole);
    var isAdmin = app.globalData.accountRole === 'admin';

    // 过滤独立功能卡片
    var standaloneFeatures = [];
    for (var i = 0; i < STANDALONE_FEATURES.length; i++) {
      var f = STANDALONE_FEATURES[i];
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
      standaloneFeatures.push({
        id: f.id, name: f.name, sub: f.sub, icon: f.icon,
        iconBg: f.iconBg, url: f.url, minRole: f.minRole,
        comingSoon: f.comingSoon,
        disabled: userRole < f.minRole,
        alertNum: 0, hasAlert: false,
      });
    }

    // 构建折叠集成卡片列表
    var groupCards = [];

    // 1. 快捷报账（所有人可见）
    groupCards.push(QUICK_EXPENSE_CARD);

    // 2. 我的发票（所有人可见）
    groupCards.push(MY_INVOICE_CARD);

    // 3. 报账&发票审核（仅管理员）
    if (isAdmin) {
      groupCards.push(ADMIN_REVIEW_CARD);
    }

    var self = this;
    this.setData({
      standaloneFeatures: standaloneFeatures,
      groupCards: groupCards,
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
          for (var j = 0; j < self.data.standaloneFeatures.length; j++) {
            var feat = self.data.standaloneFeatures[j];
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
          self.setData({ standaloneFeatures: updatedFeatures });
        },
      });
    }
  },

  // ── 折叠卡片展开/收起 ──
  toggleGroup: function (e) {
    var groupId = e.currentTarget.dataset.groupId;
    var key = 'expandedGroups.' + groupId;
    var current = this.data.expandedGroups[groupId] || false;
    this.setData({ [key]: !current });
  },

  // ── 子功能点击 ──
  onChildTap: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url: url });
    }
  },

  // ── 独立功能卡片点击 ──
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

  // ── 非折叠集成卡片直接跳转 ──
  onGroupCardTap: function (e) {
    var card = e.currentTarget.dataset.card;
    if (card && !card.isGroup && card.url) {
      wx.navigateTo({ url: card.url });
    }
  },
});
