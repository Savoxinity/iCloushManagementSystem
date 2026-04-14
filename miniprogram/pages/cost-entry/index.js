// ============================================
// 成本直录台 — 财务直接录入成本条目 + 编辑/删除
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
    // 编辑模式
    editingId: null,
    isEditing: false,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '成本直录' });
    this.loadCategories();
    this.loadRecent();
    var today = new Date();
    var tradeDateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    var lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    var occurDateStr = lastDay.getFullYear() + '-' +
      String(lastDay.getMonth() + 1).padStart(2, '0') + '-' +
      String(lastDay.getDate()).padStart(2, '0');
    this.setData({ occurDate: occurDateStr, tradeDate: tradeDateStr });
  },

  onShow: function () {
    this.loadRecent();
  },

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

  loadRecent: function () {
    var self = this;
    app.request({
      url: '/api/v1/accounting/cost/list?page=1&page_size=20',
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

  // 提交（新建或编辑）
  submitEntry: function () {
    var self = this;
    if (!self.data.canSubmit || self.data.submitting) return;
    self.setData({ submitting: true });

    var category = self.data.categories[self.data.categoryIndex];

    if (self.data.isEditing && self.data.editingId) {
      // 编辑模式 — PUT
      var payload = {
        category_code: category ? category.code : '',
        amount: parseFloat(self.data.amount),
        description: self.data.description || '',
        occur_date: self.data.occurDate || null,
      };
      app.request({
        url: '/api/v1/accounting/cost/' + self.data.editingId,
        method: 'PUT',
        data: payload,
        success: function (res) {
          self.setData({ submitting: false });
          if (res.code === 200) {
            wx.showToast({ title: '修改成功', icon: 'success' });
            self._resetForm();
            self.loadRecent();
          } else {
            wx.showToast({ title: res.message || '修改失败', icon: 'none' });
          }
        },
        fail: function () {
          self.setData({ submitting: false });
          wx.showToast({ title: '网络错误', icon: 'none' });
        },
      });
    } else {
      // 新建模式 — POST
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
            self._resetForm();
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
    }
  },

  // 点击编辑按钮
  onEditEntry: function (e) {
    var entry = e.currentTarget.dataset.entry;
    if (!entry) return;

    // 找到对应的分类索引
    var catIdx = 0;
    for (var i = 0; i < this.data.categories.length; i++) {
      if (this.data.categories[i].code === entry.category_code) {
        catIdx = i;
        break;
      }
    }

    this.setData({
      isEditing: true,
      editingId: entry.id,
      categoryIndex: catIdx,
      amount: String(entry.amount || entry.pre_tax_amount || ''),
      description: entry.description || entry.item_name || '',
      occurDate: entry.occur_date || entry.trade_date || '',
      canSubmit: true,
    });

    // 滚动到顶部
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
    wx.showToast({ title: '已进入编辑模式', icon: 'none', duration: 1500 });
  },

  // 取消编辑
  cancelEdit: function () {
    this._resetForm();
    wx.showToast({ title: '已取消编辑', icon: 'none', duration: 1000 });
  },

  // 删除成本条目
  onDeleteEntry: function (e) {
    var entry = e.currentTarget.dataset.entry;
    if (!entry) return;
    var self = this;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条成本记录吗？\n' + (entry.category_name || '') + ' ¥' + (entry.amount || entry.pre_tax_amount),
      confirmColor: '#EF4444',
      success: function (res) {
        if (res.confirm) {
          app.request({
            url: '/api/v1/accounting/cost/' + entry.id,
            method: 'DELETE',
            success: function (res) {
              if (res.code === 200) {
                wx.showToast({ title: '已删除', icon: 'success' });
                self.loadRecent();
              } else {
                wx.showToast({ title: res.message || '删除失败', icon: 'none' });
              }
            },
            fail: function () {
              wx.showToast({ title: '网络错误', icon: 'none' });
            },
          });
        }
      },
    });
  },

  _resetForm: function () {
    var today = new Date();
    var tradeDateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    var lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    var occurDateStr = lastDay.getFullYear() + '-' +
      String(lastDay.getMonth() + 1).padStart(2, '0') + '-' +
      String(lastDay.getDate()).padStart(2, '0');
    this.setData({
      amount: '',
      description: '',
      occurDate: occurDateStr,
      tradeDate: tradeDateStr,
      canSubmit: false,
      isEditing: false,
      editingId: null,
      categoryIndex: 0,
    });
  },
});
