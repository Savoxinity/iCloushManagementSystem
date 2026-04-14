// ============================================
// 报销列表页 — 员工查看自己的报销单
// ============================================
var app = getApp();

Page({
  data: {
    expenses: [],
    loading: true,
    statusFilter: 'all', // all / pending / approved / rejected
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待审核' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已驳回' },
    ],
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '报销记录' });
    this.loadExpenses();
  },

  onShow: function () {
    this.loadExpenses();
  },

  switchFilter: function (e) {
    var status = e.currentTarget.dataset.status;
    this.setData({ statusFilter: status });
    this.loadExpenses();
  },

  // 修复: /expenses/my → /expenses/list?tab=my
  loadExpenses: function () {
    var self = this;
    self.setData({ loading: true });
    var url = '/api/v1/expenses/list?tab=my';
    if (self.data.statusFilter !== 'all') {
      url += '&status=' + self.data.statusFilter;
    }
    app.request({
      url: url,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var list = (Array.isArray(res.data) ? res.data : (res.data && res.data.items) || []).map(function (item) {
            item.statusLabel = { pending: '待审核', approved: '已通过', rejected: '已驳回', auto_approved: '自动通过' }[item.status] || item.status;
            item.statusClass = { pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected', auto_approved: 'status-approved' }[item.status] || '';
            return item;
          });
          self.setData({ expenses: list });
        }
      },
      fail: function () {
        self.setData({ loading: false });
      },
    });
  },

  goCreate: function () {
    wx.navigateTo({ url: '/pages/expense-create/index' });
  },
});
