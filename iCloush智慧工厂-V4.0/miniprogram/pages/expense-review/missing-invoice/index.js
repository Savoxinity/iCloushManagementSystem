// ============================================
// 欠票看板页 — Phase 3C
// 修复: /dashboard → /stats, status=open → status=pending
//       适配后端返回的 stats 数据格式
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
  // 修复: /missing-invoices/dashboard → /missing-invoices/stats
  // 适配后端返回格式: outstanding_count, outstanding_amount, user_ranking
  loadDashboard: function () {
    var self = this;
    self.setData({ loading: true });
    app.request({
      url: '/api/v1/missing-invoices/stats',
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200 && res.data) {
          var d = res.data;
          // 适配后端返回格式到前端 summary 结构
          var pendingCount = 0;
          if (d.by_status && d.by_status.reminded) {
            pendingCount = d.by_status.reminded.count || 0;
          }
          self.setData({
            summary: {
              total_missing: d.outstanding_count || 0,
              total_amount: d.outstanding_amount || 0,
              overdue_count: pendingCount,  // 已催票数作为逾期参考
            },
            ranking: d.user_ranking || [],
          });
        }
      },
      fail: function () {
        self.setData({ loading: false });
      },
    });
  },

  // ── 加载欠票明细 ──
  // 修复: status=open → status=pending
  loadLedger: function () {
    var self = this;
    app.request({
      url: '/api/v1/missing-invoices/list?status=pending',
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
  // 注意: 后端没有 batch-remind 路由，改为逐个催票
  batchRemind: function () {
    var self = this;
    var ledger = self.data.ledger;
    if (!ledger || ledger.length === 0) {
      wx.showToast({ title: '暂无待催票记录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量催票',
      content: '将向所有逾期未补票员工发送催票提醒',
      success: function (res) {
        if (res.confirm) {
          var sentCount = 0;
          var total = ledger.length;
          ledger.forEach(function (item) {
            app.request({
              url: '/api/v1/missing-invoices/' + item.id + '/remind',
              method: 'POST',
              success: function (res) {
                if (res.code === 200) sentCount++;
                total--;
                if (total <= 0) {
                  wx.showToast({ title: '已发送 ' + sentCount + ' 条催票', icon: 'success' });
                }
              },
              fail: function () {
                total--;
                if (total <= 0) {
                  wx.showToast({ title: '已发送 ' + sentCount + ' 条催票', icon: 'success' });
                }
              },
            });
          });
        }
      },
    });
  },
});
