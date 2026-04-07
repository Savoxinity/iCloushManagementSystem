// ============================================
// 营收直录 — 管理员手动录入每月总营收
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

    app.request({
      url: '/api/v1/accounting/revenue/upsert',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: res.message || '录入成功', icon: 'success' });
          self.setData({ revenue: '', remark: '', canSubmit: false });
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
});
