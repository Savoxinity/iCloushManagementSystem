// ============================================
// 成本直录台 — 财务直接录入成本条目
// 修复: /cost-entries → /cost/list, /cost-entry → /cost/create
// ============================================
var app = getApp();

Page({
  data: {
    categories: [],
    categoryNames: [],
    categoryIndex: 0,
    amount: '',
    description: '',
    occurDate: '',
    tradeDate: '',
    submitting: false,
    canSubmit: false,
    recentEntries: [],
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '成本直录' });
    this.loadCategories();
    this.loadRecent();
    // 记账日期自动取当天（不显示在表单中，提交时自动附带）
    var today = new Date();
    var tradeDateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    // 发生日期默认当月最后一天
    var lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    var occurDateStr = lastDay.getFullYear() + '-' +
      String(lastDay.getMonth() + 1).padStart(2, '0') + '-' +
      String(lastDay.getDate()).padStart(2, '0');
    this.setData({ occurDate: occurDateStr, tradeDate: tradeDateStr });
  },

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

  // 修复: /accounting/cost-entries → /accounting/cost/list
  loadRecent: function () {
    var self = this;
    app.request({
      url: '/api/v1/accounting/cost/list?page=1&page_size=5',
      success: function (res) {
        if (res.code === 200) {
          self.setData({ recentEntries: res.data || [] });
        }
      },
    });
  },

  onCategoryChange: function (e) {
    this.setData({ categoryIndex: parseInt(e.detail.value) });
    this._checkCanSubmit();
  },

  onAmountInput: function (e) {
    this.setData({ amount: e.detail.value });
    this._checkCanSubmit();
  },

  onDescInput: function (e) {
    this.setData({ description: e.detail.value });
  },

  onDateChange: function (e) {
    this.setData({ occurDate: e.detail.value });
  },

  _checkCanSubmit: function () {
    var d = this.data;
    var hasCategory = d.categories.length > 0;
    var hasAmount = d.amount && parseFloat(d.amount) > 0;
    this.setData({ canSubmit: hasCategory && hasAmount });
  },

  // 修复: /accounting/cost-entry → /accounting/cost/create
  submitEntry: function () {
    var self = this;
    if (!self.data.canSubmit || self.data.submitting) return;
    self.setData({ submitting: true });

    var category = self.data.categories[self.data.categoryIndex];
    var payload = {
      category_code: category ? category.code : '',
      amount: parseFloat(self.data.amount),
      description: self.data.description || '',
      occur_date: self.data.occurDate || null,
      trade_date: self.data.tradeDate || null,
    };

    app.request({
      url: '/api/v1/accounting/cost/create',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: '录入成功', icon: 'success' });
          self.setData({ amount: '', description: '', canSubmit: false });
          self.loadRecent();
        } else {
          wx.showToast({ title: res.message || '录入失败', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
