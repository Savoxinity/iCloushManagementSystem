// ============================================
// 营收直录 — 管理员手动录入每月总营收 + 编辑/删除
// ============================================
var app = getApp();

Page({
  data: {
    yearOptions: [],
    monthOptions: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    yearIndex: 0,
    monthIndex: 0,
    revenue: '',
    remark: '',
    submitting: false,
    canSubmit: false,
    records: [],
    currentYear: 0,
    // 编辑模式
    isEditing: false,
    editingId: null,
  },

  onLoad: function () {
    var now = new Date();
    var currentYear = now.getFullYear();
    var years = [];
    for (var y = currentYear; y >= currentYear - 3; y--) {
      years.push(String(y));
    }
    this.setData({
      yearOptions: years,
      yearIndex: 0,
      monthIndex: now.getMonth(),
      currentYear: currentYear,
    });
    this.loadRecords();
  },

  onShow: function () {
    this.loadRecords();
  },

  loadRecords: function () {
    var self = this;
    var year = self.data.yearOptions[self.data.yearIndex];
    app.request({
      url: '/api/v1/accounting/revenue/list?year=' + year,
      success: function (res) {
        if (res.code === 200) {
          self.setData({
            records: res.data || [],
            currentYear: parseInt(year),
          });
        }
      },
    });
  },

  onYearChange: function (e) {
    this.setData({ yearIndex: parseInt(e.detail.value) });
    this.loadRecords();
  },

  onMonthChange: function (e) {
    this.setData({ monthIndex: parseInt(e.detail.value) });
  },

  onRevenueInput: function (e) {
    this.setData({ revenue: e.detail.value });
    this._checkCanSubmit();
  },

  onRemarkInput: function (e) {
    this.setData({ remark: e.detail.value });
  },

  _checkCanSubmit: function () {
    var hasRevenue = this.data.revenue && parseFloat(this.data.revenue) > 0;
    this.setData({ canSubmit: hasRevenue });
  },

  submitRevenue: function () {
    var self = this;
    if (!self.data.canSubmit || self.data.submitting) return;
    self.setData({ submitting: true });

    var year = parseInt(self.data.yearOptions[self.data.yearIndex]);
    var month = self.data.monthIndex + 1;

    var payload = {
      year: year,
      month: month,
      revenue: parseFloat(self.data.revenue),
      remark: self.data.remark || null,
    };

    // 营收使用 upsert，同一年月自动覆盖
    app.request({
      url: '/api/v1/accounting/revenue/upsert',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: res.message || '录入成功', icon: 'success' });
          self._resetForm();
          self.loadRecords();
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

  // 点击编辑 — 将记录填入表单
  onEditRecord: function (e) {
    var record = e.currentTarget.dataset.record;
    if (!record) return;

    // 找到年份索引
    var yearIdx = 0;
    for (var i = 0; i < this.data.yearOptions.length; i++) {
      if (parseInt(this.data.yearOptions[i]) === record.year) {
        yearIdx = i;
        break;
      }
    }

    this.setData({
      isEditing: true,
      editingId: record.id,
      yearIndex: yearIdx,
      monthIndex: record.month - 1,
      revenue: String(record.revenue),
      remark: record.remark || '',
      canSubmit: true,
    });

    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
    wx.showToast({ title: '已进入编辑模式', icon: 'none', duration: 1500 });
  },

  // 取消编辑
  cancelEdit: function () {
    this._resetForm();
    wx.showToast({ title: '已取消编辑', icon: 'none', duration: 1000 });
  },

  // 删除营收记录
  onDeleteRecord: function (e) {
    var record = e.currentTarget.dataset.record;
    if (!record) return;
    var self = this;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除 ' + record.period + ' 的营收记录吗？\n¥' + record.revenue,
      confirmColor: '#EF4444',
      success: function (res) {
        if (res.confirm) {
          app.request({
            url: '/api/v1/accounting/revenue/' + record.id,
            method: 'DELETE',
            success: function (res) {
              if (res.code === 200) {
                wx.showToast({ title: '已删除', icon: 'success' });
                self.loadRecords();
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
    this.setData({
      revenue: '',
      remark: '',
      canSubmit: false,
      isEditing: false,
      editingId: null,
    });
  },
});
