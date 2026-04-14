// ============================================
// 付款记录列表
// ============================================
var app = getApp();

var STATUS_LABELS = {
  pending: '待审批',
  approved: '已批准',
  completed: '已付款',
  rejected: '已驳回',
};

Page({
  data: {
    payments: [],
    statusFilter: '',
    loading: false,
  },

  onShow: function () { this.loadPayments(); },

  filterByStatus: function (e) {
    this.setData({ statusFilter: e.currentTarget.dataset.status });
    this.loadPayments();
  },

  loadPayments: function () {
    var self = this;
    self.setData({ loading: true });
    var url = '/api/v1/payments/my';
    if (self.data.statusFilter) {
      url += '?status=' + self.data.statusFilter;
    }
    app.request({
      url: url,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var today = new Date().toISOString().slice(0, 10);
          var list = (Array.isArray(res.data) ? res.data : (res.data && res.data.items) || []).map(function (item) {
            item.statusLabel = STATUS_LABELS[item.status] || item.status;
            if (item.created_at) {
              item.created_at_display = item.created_at.slice(0, 10);
            }
            if (item.expected_invoice_date && !item.invoice_received) {
              item.invoice_overdue = item.expected_invoice_date < today;
            }
            return item;
          });
          self.setData({ payments: list });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },
});
