// ============================================
// 发票打印管理 + 开票覆盖率看板
// Phase 5.3
// ============================================
var app = getApp();

Page({
  data: {
    invoices: [],
    printFilter: '',
    loading: false,
    // 覆盖率看板
    coverageRate: '0',
    invoiceTotal: '0.00',
    costTotal: '0.00',
    taxGap: '0.00',
  },

  onShow: function () {
    this.loadInvoices();
    this.loadCoverage();
  },

  filterByPrint: function (e) {
    this.setData({ printFilter: e.currentTarget.dataset.filter });
    this.loadInvoices();
  },

  loadInvoices: function () {
    var self = this;
    self.setData({ loading: true });
    var url = '/api/v1/payments/invoices/print-status';
    if (self.data.printFilter) {
      url += '?filter=' + self.data.printFilter;
    }
    app.request({
      url: url,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var list = (res.data || []).map(function (item) {
            if (item.created_at) {
              item.created_at_display = item.created_at.slice(0, 10);
            }
            return item;
          });
          self.setData({ invoices: list });
        }
      },
      fail: function () {
        self.setData({ loading: false });
      },
    });
  },

  loadCoverage: function () {
    var self = this;
    app.request({
      url: '/api/v1/payments/dashboard/invoice-coverage',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var d = res.data;
          self.setData({
            coverageRate: (d.coverage_rate || 0).toFixed(1),
            invoiceTotal: (d.invoice_total || 0).toFixed(2),
            costTotal: (d.cost_total || 0).toFixed(2),
            taxGap: (d.tax_gap || 0).toFixed(2),
          });
        }
      },
    });
  },

  markPrinted: function (e) {
    this.togglePrint(e.currentTarget.dataset.id, true);
  },

  markUnprinted: function (e) {
    this.togglePrint(e.currentTarget.dataset.id, false);
  },

  togglePrint: function (id, isPrinted) {
    var self = this;
    app.request({
      url: '/api/v1/payments/invoices/' + id + '/print',
      method: 'PUT',
      data: { is_printed: isPrinted },
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: isPrinted ? '已标记打印' : '已撤销标记', icon: 'success' });
          self.loadInvoices();
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
