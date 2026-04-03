// ============================================
// 欠票看板页 — Phase 3C
// ============================================
var app = getApp();

Page({
  data: {
    summary: { total_missing: 0, total_amount: 0, overdue_count: 0 },
    ranking: [],
    ledger: [],
    loading: true,
    activeTab: 'overview', // overview / list
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '欠票看板' });
    this.loadDashboard();
  },

  onShow: function () {
    this.loadDashboard();
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'list') this.loadLedger();
  },

  // ── 加载看板数据 ──
  loadDashboard: function () {
    var self = this;
    self.setData({ loading: true });
    app.request({
      url: '/api/v1/missing-invoices/dashboard',
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200 && res.data) {
          self.setData({
            summary: res.data.summary || self.data.summary,
            ranking: res.data.ranking || [],
          });
        }
      },
    });
  },

  // ── 加载欠票明细 ──
  loadLedger: function () {
    var self = this;
    app.request({
      url: '/api/v1/missing-invoices/list?status=open',
      success: function (res) {
        if (res.code === 200) {
          var list = (res.data || []).map(function (item) {
            // 计算逾期天数
            if (item.deadline) {
              var deadline = new Date(item.deadline);
              var now = new Date();
              var diff = Math.floor((now - deadline) / (1000 * 60 * 60 * 24));
              item.overdueDays = diff > 0 ? diff : 0;
              item.isOverdue = diff > 0;
            }
            return item;
          });
          self.setData({ ledger: list });
        }
      },
    });
  },

  // ── 一键催票 ──
  sendReminder: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认催票',
      content: '将向该员工发送催票提醒（生成红色紧急任务）',
      success: function (res) {
        if (res.confirm) {
          app.request({
            url: '/api/v1/missing-invoices/' + id + '/remind',
            method: 'POST',
            success: function (res) {
              if (res.code === 200) {
                wx.showToast({ title: '催票已发送', icon: 'success' });
              } else {
                wx.showToast({ title: res.message || '催票失败', icon: 'none' });
              }
            },
          });
        }
      },
    });
  },

  // ── 批量催票 ──
  batchRemind: function () {
    var self = this;
    wx.showModal({
      title: '批量催票',
      content: '将向所有逾期未补票员工发送催票提醒',
      success: function (res) {
        if (res.confirm) {
          app.request({
            url: '/api/v1/missing-invoices/batch-remind',
            method: 'POST',
            success: function (res) {
              if (res.code === 200) {
                wx.showToast({ title: '已发送 ' + (res.data.sent_count || 0) + ' 条催票', icon: 'success' });
              }
            },
          });
        }
      },
    });
  },
});
