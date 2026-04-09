// ============================================
// 发票列表页（发票夹 — 照搬华通APP"我的票夹"）
// ============================================
var app = getApp();

Page({
  data: {
    invoices: [],
    loading: true,
    page: 1,
    hasMore: true,
    // 筛选 tab
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待核验' },
      { key: 'verified', label: '已核验' },
      { key: 'duplicate', label: '重复' },
      { key: 'manual_review', label: '待复核' },
      { key: 'failed', label: '失败' },
    ],
    // 统计
    totalCount: 0,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '我的发票' });
    this.loadInvoices();
  },

  onShow: function () {
    this.setData({ page: 1, invoices: [] });
    this.loadInvoices();
  },

  // 切换筛选 tab
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      page: 1,
      invoices: [],
      hasMore: true,
    });
    this.loadInvoices();
  },

  loadInvoices: function () {
    var self = this;
    self.setData({ loading: true });

    var url = '/api/v1/invoices/list?page=' + self.data.page + '&page_size=20';
    if (self.data.activeTab !== 'all') {
      url += '&verify_status=' + self.data.activeTab;
    }

    app.request({
      url: url,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var list = self.data.page === 1 ? (res.data || []) : self.data.invoices.concat(res.data || []);
          self.setData({
            invoices: list,
            hasMore: (res.data || []).length >= 20,
            totalCount: res.total || list.length,
          });
        }
      },
      fail: function () {
        self.setData({ loading: false });
      },
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadInvoices();
    }
  },

  // 跳转到发票详情页
  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/invoice-detail/index?id=' + id });
  },

  goUpload: function () {
    wx.navigateTo({ url: '/pages/invoice-upload/index' });
  },

  // 预览发票图片
  previewImage: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({ urls: [url], current: url });
    }
  },
});
