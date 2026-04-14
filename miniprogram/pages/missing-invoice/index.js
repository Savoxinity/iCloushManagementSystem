// ============================================
// 欠票看板页 V5.5.0 — 状态机 + 核销能力
// ★ 状态机：Pending(>3天) / Warning(<=3天) / Overdue(已过期)
// ★ 核销（Match）：从发票池选择未关联发票绑定
// ★ 催票：单条催票 + 批量催票
// ============================================
var app = getApp();

Page({
  data: {
    summary: { total_missing: 0, total_amount: 0, overdue_count: 0 },
    ranking: [],
    ledger: [],
    loading: true,
    activeTab: 'overview', // overview / list

    // ★ 核销弹窗
    showMatchModal: false,
    matchTargetId: null,
    matchTargetPurpose: '',
    unlinkedInvoices: [],
    loadingUnlinked: false,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '欠票看板' });
    this.loadDashboard();
  },

  onShow: function () {
    this.loadDashboard();
    if (this.data.activeTab === 'list') {
      this.loadLedger();
    }
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
      fail: function () {
        self.setData({ loading: false });
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
          var now = new Date();
          var list = (Array.isArray(res.data) ? res.data : (res.data && res.data.items) || []).map(function (item) {
            // ★ 状态机计算
            if (item.expected_invoice_date) {
              var deadline = new Date(item.expected_invoice_date);
              var diffMs = deadline.getTime() - now.getTime();
              var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

              if (diffDays < 0) {
                item.statusLevel = 'overdue';
                item.statusLabel = '逾期 ' + Math.abs(diffDays) + ' 天';
                item.overdueDays = Math.abs(diffDays);
                item.isOverdue = true;
              } else if (diffDays <= 3) {
                item.statusLevel = 'warning';
                item.statusLabel = '剩余 ' + diffDays + ' 天';
                item.overdueDays = 0;
                item.isOverdue = false;
              } else {
                item.statusLevel = 'pending';
                item.statusLabel = '剩余 ' + diffDays + ' 天';
                item.overdueDays = 0;
                item.isOverdue = false;
              }
            } else {
              item.statusLevel = 'pending';
              item.statusLabel = '无截止日期';
              item.overdueDays = 0;
              item.isOverdue = false;
            }

            // ★ 来源标签
            if (item.source_type === 'payment') {
              item.sourceLabel = '付款';
            } else if (item.source_type === 'expense') {
              item.sourceLabel = '报销';
            } else {
              item.sourceLabel = '其他';
            }

            return item;
          });

          // ★ 按状态排序：overdue > warning > pending
          var order = { overdue: 0, warning: 1, pending: 2 };
          list.sort(function (a, b) {
            return (order[a.statusLevel] || 2) - (order[b.statusLevel] || 2);
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

  // ★ 打开核销弹窗
  openMatchModal: function (e) {
    var id = e.currentTarget.dataset.id;
    var purpose = e.currentTarget.dataset.purpose || '';
    var self = this;

    self.setData({
      showMatchModal: true,
      matchTargetId: id,
      matchTargetPurpose: purpose,
      loadingUnlinked: true,
      unlinkedInvoices: [],
    });

    // 加载未关联发票列表
    app.request({
      url: '/api/v1/invoices/unlinked',
      success: function (res) {
        self.setData({ loadingUnlinked: false });
        if (res.code === 200) {
          self.setData({ unlinkedInvoices: res.data || [] });
        }
      },
      fail: function () {
        self.setData({ loadingUnlinked: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  // ★ 关闭核销弹窗
  closeMatchModal: function () {
    this.setData({
      showMatchModal: false,
      matchTargetId: null,
      matchTargetPurpose: '',
      unlinkedInvoices: [],
    });
  },

  // ★ 执行核销（选择发票绑定）
  doMatch: function (e) {
    var invoiceId = e.currentTarget.dataset.invoiceid;
    var missingId = this.data.matchTargetId;
    var self = this;

    if (!missingId || !invoiceId) return;

    wx.showModal({
      title: '确认核销',
      content: '将此发票关联到欠票记录，核销后欠票记录将关闭。',
      success: function (res) {
        if (res.confirm) {
          app.request({
            url: '/api/v1/missing-invoices/' + missingId + '/match',
            method: 'POST',
            data: { invoice_id: invoiceId },
            success: function (res) {
              if (res.code === 200) {
                wx.showToast({ title: '核销成功', icon: 'success' });
                self.closeMatchModal();
                // 刷新数据
                self.loadDashboard();
                self.loadLedger();
              } else {
                wx.showToast({ title: res.message || '核销失败', icon: 'none' });
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

  // 阻止弹窗穿透
  preventTap: function () {},
});
