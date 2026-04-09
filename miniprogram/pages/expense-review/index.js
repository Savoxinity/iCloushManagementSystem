// ============================================
// 报销审核页 — 管理员/财务专用
// ★ 五Tab分类：全部 / 待审核 / 发票通过 / 小票通过 / 已驳回
// ★ 三按钮审核：驳回 / 小票通过 / 发票通过
// ★ 积分后置：审核时才产生积分奖惩
// ============================================
var app = getApp();

Page({
  data: {
    expenses: [],
    loading: true,
    categories: [],
    categoryIndex: 0,
    categoryNames: [],
    currentExpense: null,
    showReviewPanel: false,
    showDetailPanel: false,
    reviewNote: '',

    // ═══ 五Tab筛选 ═══
    activeTab: 'pending',
    currentTabLabel: '待审核',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待审核' },
      { key: 'invoice_pass', label: '发票通过' },
      { key: 'receipt_pass', label: '小票通过' },
      { key: 'rejected', label: '已驳回' },
    ],
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '报销审核' });
    this.loadExpenses();
    this.loadCategories();
  },

  onShow: function () {
    this.loadExpenses();
  },

  // ── 切换Tab ──
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    var tabLabels = {
      all: '全部',
      pending: '待审核',
      invoice_pass: '发票通过',
      receipt_pass: '小票通过',
      rejected: '已驳回',
    };
    this.setData({
      activeTab: tab,
      currentTabLabel: tabLabels[tab] || '',
      expenses: [],
    });
    this.loadExpenses();
  },

  // ── 加载报销单（支持Tab状态筛选） ──
  loadExpenses: function () {
    var self = this;
    self.setData({ loading: true });

    var url = '/api/v1/expenses/pending?status=' + self.data.activeTab;

    app.request({
      url: url,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          self.setData({ expenses: res.data || [] });
        }
      },
      fail: function () {
        self.setData({ loading: false });
      },
    });
  },

  // ── 加载成本分类 ──
  loadCategories: function () {
    var self = this;
    app.request({
      url: '/api/v1/accounting/categories',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var names = (res.data || []).map(function (c) { return c.name; });
          self.setData({ categories: res.data, categoryNames: names });
        }
      },
    });
  },

  // ── 查看报销单详情 ──
  viewDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    var expense = this.data.expenses.find(function (item) { return item.id === id; });
    if (!expense) return;

    // 加载详情（含发票信息）
    var self = this;
    app.request({
      url: '/api/v1/expenses/' + id,
      success: function (res) {
        if (res.code === 200 && res.data) {
          self.setData({
            currentExpense: res.data,
            showDetailPanel: true,
          });
        }
      },
    });
  },

  // ── 关闭详情面板 ──
  closeDetail: function () {
    this.setData({ showDetailPanel: false });
  },

  // ── 从详情进入审核 ──
  openReviewFromDetail: function () {
    this.setData({
      showDetailPanel: false,
      showReviewPanel: true,
      reviewNote: '',
      categoryIndex: 0,
    });
  },

  // ── 打开审核面板 ──
  openReview: function (e) {
    var id = e.currentTarget.dataset.id;
    var expense = this.data.expenses.find(function (item) { return item.id === id; });
    if (!expense) return;
    this.setData({
      currentExpense: expense,
      showReviewPanel: true,
      reviewNote: '',
      categoryIndex: 0,
    });
  },

  // ── 关闭审核面板 ──
  closeReview: function () {
    this.setData({ showReviewPanel: false, currentExpense: null });
  },

  // ── 成本分类选择 ──
  onCategoryChange: function (e) {
    this.setData({ categoryIndex: parseInt(e.detail.value) });
  },

  // ── 审核备注 ──
  onNoteInput: function (e) {
    this.setData({ reviewNote: e.detail.value });
  },

  // ── 预览凭证图片 ──
  previewVoucher: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  // ── 查看关联发票详情 ──
  viewInvoiceDetail: function () {
    var expense = this.data.currentExpense;
    if (expense && expense.invoice_id) {
      wx.navigateTo({ url: '/pages/invoice-detail/index?id=' + expense.invoice_id });
    }
  },

  // ═══ 三按钮审核 ═══

  // 驳回（不产生积分）
  rejectExpense: function () {
    var self = this;
    wx.showModal({
      title: '确认驳回',
      content: '驳回后不产生积分变动',
      confirmText: '确认驳回',
      confirmColor: '#EF4444',
      success: function (res) {
        if (res.confirm) {
          self._doReview('reject');
        }
      },
    });
  },

  // 小票通过（-5 积分）
  receiptPassExpense: function () {
    var self = this;
    var category = self.data.categories[self.data.categoryIndex];
    if (!category || !category.code) {
      wx.showToast({ title: '请先选择成本分类', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '小票通过',
      content: '小票通过将扣除员工 5 积分',
      confirmText: '确认',
      confirmColor: '#F97316',
      success: function (res) {
        if (res.confirm) {
          self._doReview('receipt_pass');
        }
      },
    });
  },

  // 发票通过（+10 积分）
  invoicePassExpense: function () {
    var self = this;
    var category = self.data.categories[self.data.categoryIndex];
    if (!category || !category.code) {
      wx.showToast({ title: '请先选择成本分类', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '发票通过',
      content: '发票通过将奖励员工 10 积分',
      confirmText: '确认',
      confirmColor: '#10B981',
      success: function (res) {
        if (res.confirm) {
          self._doReview('invoice_pass');
        }
      },
    });
  },

  // ── 执行审核 ──
  _doReview: function (action) {
    var self = this;
    var expense = self.data.currentExpense;
    if (!expense) return;

    var category = self.data.categories[self.data.categoryIndex];

    // 通过时必须选择成本分类
    if (action !== 'reject' && (!category || !category.code)) {
      wx.showToast({ title: '请选择成本分类', icon: 'none' });
      return;
    }

    var payload = {
      action: action,
      review_note: self.data.reviewNote || '',
    };
    if (action !== 'reject' && category) {
      payload.category_code = category.code;
    }

    var loadingText = {
      reject: '驳回中...',
      receipt_pass: '小票通过中...',
      invoice_pass: '发票通过中...',
    };

    wx.showLoading({ title: loadingText[action] || '处理中...' });

    app.request({
      url: '/api/v1/expenses/' + expense.id + '/review',
      method: 'POST',
      data: payload,
      success: function (res) {
        wx.hideLoading();
        if (res.code === 200) {
          var successText = {
            reject: '已驳回',
            receipt_pass: '小票通过（-5分）',
            invoice_pass: '发票通过（+10分）',
          };
          wx.showToast({
            title: successText[action] || '操作成功',
            icon: 'success',
          });
          self.setData({ showReviewPanel: false, currentExpense: null });
          self.loadExpenses();
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  // ── 阻止事件冒泡 ──
  stopPropagation: function () {},
});
