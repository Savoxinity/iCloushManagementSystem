// ============================================
// 快捷报账入口页 — 横栏列表卡片（参考管理会计）
// 员工和管理员共用
// ============================================
var app = getApp();

Page({
  data: {
    menuItems: [
      { id: 'payment_create', icon: '💳', title: '付款/采购申请', desc: '即付即票 · 先付后票 · 分批付款', url: '/pages/payment-create/index' },
      { id: 'payment_list', icon: '📊', title: '付款记录', desc: '查看付款申请进度', url: '/pages/payment-list/index' },
      { id: 'expense_create', icon: '📝', title: '报销申请', desc: '提交报销单据', url: '/pages/expense-create/index' },
      { id: 'expense_list', icon: '💰', title: '报销记录', desc: '全部 · 付款/采购 · 报销 · 被驳回', url: '/pages/expense-list/index' },
    ],
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '快捷报账' });
  },

  goPage: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url: url });
    }
  },
});
