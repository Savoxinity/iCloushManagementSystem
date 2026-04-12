// ============================================
// 管理员发票/票据池 — 全员工票据统一管理
// ★ 管理员专属：查看所有员工的发票
// ★ 支持日期筛选、核验状态筛选、关键词搜索
// ★ 默认近90天，20条/页
// ============================================
var app = getApp();

Page({
  data: {
    invoices: [],
    loading: true,
    page: 1,
    hasMore: true,
    totalCount: 0,

    // 筛选 Tab
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待核验' },
      { key: 'verified', label: '已核验' },
      { key: 'failed', label: '核验失败' },
      { key: 'duplicate', label: '重复' },
      { key: 'manual_review', label: '待复核' },
    ],

    // 日期筛选
    dateFrom: '',
    dateTo: '',
    showDateFilter: false,

    // 搜索
    keyword: '',
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '发票/票据池' });
    // 设置默认日期范围（近90天）
    var now = new Date();
    var from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    this.setData({
      dateTo: this._formatDate(now),
      dateFrom: this._formatDate(from),
    });
    this.loadInvoices();
  },

  onShow: function () {
    // 返回时刷新
    this.setData({ page: 1, invoices: [] });
    this.loadInvoices();
  },

  // ── 格式化日期 ──
  _formatDate: function (d) {
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  },

  // ── 切换筛选 Tab ──
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

  // ── 切换日期筛选面板 ──
  toggleDateFilter: function () {
    this.setData({ showDateFilter: !this.data.showDateFilter });
  },

  // ── 日期选择 ──
  onDateFromChange: function (e) {
    this.setData({ dateFrom: e.detail.value });
  },
  onDateToChange: function (e) {
    this.setData({ dateTo: e.detail.value });
  },

  // ── 应用日期筛选 ──
  applyDateFilter: function () {
    this.setData({
      page: 1,
      invoices: [],
      hasMore: true,
      showDateFilter: false,
    });
    this.loadInvoices();
  },

  // ── 搜索 ──
  onSearchInput: function (e) {
    this.setData({ keyword: e.detail.value });
  },
  doSearch: function () {
    this.setData({
      page: 1,
      invoices: [],
      hasMore: true,
    });
    this.loadInvoices();
  },

  // ── 加载发票列表 ──
  loadInvoices: function () {
    var self = this;
    self.setData({ loading: true });

    var url = '/api/v1/invoices/admin-list?page=' + self.data.page + '&page_size=20';

    // 核验状态筛选
    if (self.data.activeTab !== 'all') {
      url += '&verify_status=' + self.data.activeTab;
    }

    // 日期筛选
    if (self.data.dateFrom) {
      url += '&date_from=' + self.data.dateFrom;
    }
    if (self.data.dateTo) {
      url += '&date_to=' + self.data.dateTo;
    }

    // 关键词搜索
    if (self.data.keyword) {
      url += '&keyword=' + encodeURIComponent(self.data.keyword);
    }

    app.request({
      url: url,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var list = self.data.page === 1
            ? (res.data || [])
            : self.data.invoices.concat(res.data || []);
          self.setData({
            invoices: list,
            hasMore: (res.data || []).length >= 20,
            totalCount: res.total || list.length,
          });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  // ── 触底加载更多 ──
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadInvoices();
    }
  },

  // ── 跳转发票详情 ──
  goDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/invoice-detail/index?id=' + id });
  },

  // ── 预览发票图片 ──
  previewImage: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({ urls: [url], current: url });
    }
  },
});
