// ============================================
// 全局发票工作台 V5.5.0 — 合并发票池+打印管理+覆盖率
// ★ 合并原 invoice-manage + invoice-print 功能
// ★ 新增来源标签（报销/付款/独立上传）
// ★ 新增打印 Toggle（直接在卡片上操作）
// ★ 新增占用状态（已关联/未关联）
// ★ 新增 Tab：待打印、已打印
// ============================================
var app = getApp();

Page({
  data: {
    invoices: [],
    loading: true,
    page: 1,
    hasMore: true,
    totalCount: 0,

    // 筛选 Tab — ★ 合并核验+打印状态
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待核验' },
      { key: 'verified', label: '已核验' },
      { key: 'failed', label: '核验失败' },
      { key: 'duplicate', label: '重复' },
      { key: 'manual_review', label: '待复核' },
      { key: 'unprinted', label: '待打印' },
      { key: 'printed', label: '已打印' },
    ],

    // 日期筛选
    dateFrom: '',
    dateTo: '',
    showDateFilter: false,

    // 搜索
    keyword: '',

    // ★ 覆盖率看板数据
    coverageRate: '0',
    invoiceTotal: '0.00',
    costTotal: '0.00',
    taxGap: '0.00',
    showCoverage: false,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '发票工作台' });
    // 设置默认日期范围（近90天）
    var now = new Date();
    var from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    this.setData({
      dateTo: this._formatDate(now),
      dateFrom: this._formatDate(from),
    });
    this.loadInvoices();
    this.loadCoverage();
  },

  onShow: function () {
    // 返回时刷新
    this.setData({ page: 1, invoices: [] });
    this.loadInvoices();
    this.loadCoverage();
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

  // ── 切换覆盖率看板 ──
  toggleCoverage: function () {
    this.setData({ showCoverage: !this.data.showCoverage });
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
    var tab = self.data.activeTab;
    if (tab === 'unprinted') {
      url += '&is_printed=false';
    } else if (tab === 'printed') {
      url += '&is_printed=true';
    } else if (tab !== 'all') {
      url += '&verify_status=' + tab;
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
          var rawList = res.data || [];
          // ★ 前端筛选打印状态（Mock 模式下后端不支持 is_printed 参数）
          var filteredList = rawList;
          if (tab === 'unprinted') {
            filteredList = rawList.filter(function (item) { return !item.is_printed; });
          } else if (tab === 'printed') {
            filteredList = rawList.filter(function (item) { return item.is_printed; });
          }

          // ★ 添加来源标签文本
          filteredList = filteredList.map(function (item) {
            if (item.source === 'expense_create') {
              item.source_label = '报销';
              item.source_class = 'source-expense';
            } else if (item.source === 'payment_create') {
              item.source_label = '付款';
              item.source_class = 'source-payment';
            } else {
              item.source_label = '上传';
              item.source_class = 'source-upload';
            }
            // ★ 占用状态
            item.is_linked = !!item.linked_to;
            return item;
          });

          var list = self.data.page === 1
            ? filteredList
            : self.data.invoices.concat(filteredList);
          self.setData({
            invoices: list,
            hasMore: rawList.length >= 20,
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

  // ★ 加载覆盖率看板数据
  loadCoverage: function () {
    var self = this;
    app.request({
      url: '/api/v1/payments/invoice-coverage',
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

  // ★ 打印状态 Toggle（直接在卡片上操作）
  togglePrint: function (e) {
    var id = e.currentTarget.dataset.id;
    var currentPrinted = e.currentTarget.dataset.printed;
    var newPrinted = !currentPrinted;
    var self = this;

    app.request({
      url: '/api/v1/invoices/' + id + '/print-toggle',
      method: 'PUT',
      data: { is_printed: newPrinted },
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: newPrinted ? '已标记打印' : '已撤销打印', icon: 'success' });
          // 更新本地数据
          var invoices = self.data.invoices.map(function (item) {
            if (item.id === id) {
              item.is_printed = newPrinted;
            }
            return item;
          });
          self.setData({ invoices: invoices });
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
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
