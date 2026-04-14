// ============================================
// 报账&发票审核入口页 — BI看板 + 横栏列表卡片
// 仅管理员可见
// ============================================
var app = getApp();

Page({
  data: {
    menuItems: [
      { id: 'payment_review', icon: '✅', title: '付款审批', desc: '审批付款申请单', url: '/pages/payment-review/index' },
      { id: 'expense_review', icon: '📋', title: '报销审核', desc: '驳回/小票/发票通过', url: '/pages/expense-review/index' },
      { id: 'invoice_pool', icon: '🧾', title: '发票/票据池', desc: '全员工票据仓库', url: '/pages/invoice-manage/index' },
      { id: 'invoice_print', icon: '🖨️', title: '发票打印', desc: '标记已打印/未打印', url: '/pages/invoice-print/index' },
    ],
    coverageData: null,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '报账&发票审核' });
  },

  onShow: function () {
    this.loadCoverageData();
  },

  // ── 加载开票覆盖率 BI 数据 ──
  loadCoverageData: function () {
    var self = this;
    app.request({
      url: '/api/v1/payments/dashboard/invoice-coverage',
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
      fail: function () {
        // API 不可用时静默处理
        console.warn('[finance-review-hub] invoice-coverage API failed');
      },
    });
  },

  goPage: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url: url });
    }
  },
});
