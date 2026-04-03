// ============================================
// 发票列表页
// ============================================
var app = getApp();

Page({
  data: {
    invoices: [],
    loading: true,
    page: 1,
    hasMore: true,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '发票列表' });
    this.loadInvoices();
  },

  onShow: function () {
    this.setData({ page: 1, invoices: [] });
    this.loadInvoices();
  },

  loadInvoices: function () {
    var self = this;
    self.setData({ loading: true });
    app.request({
      url: '/api/v1/invoices/list?page=' + self.data.page + '&page_size=20',
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var list = self.data.page === 1 ? (res.data || []) : self.data.invoices.concat(res.data || []);
          self.setData({
            invoices: list,
            hasMore: (res.data || []).length >= 20,
          });
        }
      },
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadInvoices();
    }
  },

  goUpload: function () {
    wx.navigateTo({ url: '/pages/invoice-upload/index' });
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    // 可以跳转到发票详情页（如果有的话）
    wx.showToast({ title: '发票 #' + id, icon: 'none' });
  },

  previewImage: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url], current: url });
  },
});
