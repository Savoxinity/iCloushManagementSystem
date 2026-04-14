// ============================================
// 报销审核页 — 管理员/财务专用
// ★ 审核时选择成本分类（category_code）
// ============================================
var app = getApp();

Page({
  data: {
    expenses: [],
    loading: true,
    categories: [],       // 成本分类列表
    categoryIndex: 0,     // picker 选中索引
    categoryNames: [],    // picker 显示名称
    currentExpense: null,  // 当前操作的报销单
    showReviewPanel: false,
    reviewNote: '',
    reviewAction: '',     // approve / reject
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '报销审核' });
    this.loadPendingExpenses();
    this.loadCategories();
  },

  onShow: function () {
    this.loadPendingExpenses();
  },

  // ── 加载待审核报销单 ──
  // 修复: /expenses/pending → /expenses/list?tab=pending
  loadPendingExpenses: function () {
    var self = this;
    self.setData({ loading: true });
    app.request({
      url: '/api/v1/expenses/list?tab=pending',
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
          var names = (Array.isArray(res.data) ? res.data : (res.data && res.data.items) || []).map(function (c) { return c.name; });
          self.setData({ categories: res.data, categoryNames: names });
        }
      },
    });
  },

  // ── 打开审核面板 ──
  openReview: function (e) {
    var id = e.currentTarget.dataset.id;
    var expenses = this.data.expenses;
    var expense = null;
    for (var i = 0; i < expenses.length; i++) {
      if (expenses[i].id === id) {
        expense = expenses[i];
        break;
      }
    }
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

  // ── 预览凭证 ──
  previewVoucher: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  // ── 通过 ──
  approveExpense: function () {
    this._doReview('approve');
  },

  // ── 驳回 ──
  rejectExpense: function () {
    this._doReview('reject');
  },

  // 修复: POST → PUT, 路径 /expenses/{id}/review → /expenses/review/{id}
  _doReview: function (action) {
    var self = this;
    var expense = self.data.currentExpense;
    if (!expense) return;

    // 通过时必须选择成本分类
    var category = self.data.categories[self.data.categoryIndex];
    if (action === 'approve' && (!category || !category.code)) {
      wx.showToast({ title: '请选择成本分类', icon: 'none' });
      return;
    }

    var payload = {
      action: action,
      review_note: self.data.reviewNote || '',
    };
    if (action === 'approve' && category) {
      payload.category_code = category.code;
    }

    wx.showLoading({ title: action === 'approve' ? '审核通过中...' : '驳回中...' });

    app.request({
      url: '/api/v1/expenses/review/' + expense.id,
      method: 'PUT',
      data: payload,
      success: function (res) {
        wx.hideLoading();
        if (res.code === 200) {
          wx.showToast({
            title: action === 'approve' ? '已通过' : '已驳回',
            icon: 'success',
          });
          self.setData({ showReviewPanel: false, currentExpense: null });
          self.loadPendingExpenses();
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
});
