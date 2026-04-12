// ============================================
// 报销记录页 V5.4.1 — 全部/付款采购/报销/被驳回 四Tab
// ★ 增加详情弹窗（同管理员报销审核样式）
// ★ 被驳回的单据支持修改重提
// ============================================
var app = getApp();

Page({
  data: {
    // 合并列表
    records: [],
    loading: true,

    // 四Tab筛选
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'payment', label: '付款/采购申请' },
      { key: 'expense', label: '报销申请' },
      { key: 'rejected', label: '被驳回' },
    ],

    // 详情弹窗
    showDetail: false,
    currentRecord: null,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '报销记录' });
  },

  onShow: function () {
    this.loadAllRecords();
  },

  // ── 切换Tab ──
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterRecords();
  },

  // ── 加载所有记录（报销 + 付款） ──
  loadAllRecords: function () {
    var self = this;
    self.setData({ loading: true });

    var expensesDone = false;
    var paymentsDone = false;
    var expenseList = [];
    var paymentList = [];

    // 加载报销记录
    app.request({
      url: '/api/v1/expenses/my',
      success: function (res) {
        if (res.code === 200) {
          expenseList = (res.data || []).map(function (item) {
            item.record_type = 'expense';
            item.record_type_label = '报销';
            item.display_amount = item.claimed_amount || item.amount || 0;
            item.display_reason = item.reason || item.purpose || '报销申请';
            item.statusLabel = {
              pending: '待审核', approved: '已通过', rejected: '已驳回',
              invoice_pass: '发票通过', receipt_pass: '小票通过', auto_approved: '自动通过',
            }[item.status] || item.status;
            item.statusClass = {
              pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected',
              invoice_pass: 'status-approved', receipt_pass: 'status-approved', auto_approved: 'status-approved',
            }[item.status] || '';
            return item;
          });
        }
        expensesDone = true;
        if (paymentsDone) self.mergeAndFilter(expenseList, paymentList);
      },
      fail: function () {
        expensesDone = true;
        if (paymentsDone) self.mergeAndFilter(expenseList, paymentList);
      },
    });

    // 加载付款记录
    app.request({
      url: '/api/v1/payments/my',
      success: function (res) {
        if (res.code === 200) {
          paymentList = (res.data || []).map(function (item) {
            item.record_type = 'payment';
            item.record_type_label = '付款';
            item.display_amount = item.total_amount || 0;
            item.display_reason = item.purpose || item.supplier_name || '付款申请';
            var typeLabels = { A: '即付即票', B: '先付后票', C: '分批付款' };
            item.payment_type_label = typeLabels[item.payment_type] || item.payment_type;
            item.statusLabel = {
              pending: '待审批', approved: '已批准', completed: '已完成',
              rejected: '已驳回',
            }[item.status] || item.status;
            item.statusClass = {
              pending: 'status-pending', approved: 'status-approved',
              completed: 'status-approved', rejected: 'status-rejected',
            }[item.status] || '';
            return item;
          });
        }
        paymentsDone = true;
        if (expensesDone) self.mergeAndFilter(expenseList, paymentList);
      },
      fail: function () {
        paymentsDone = true;
        if (expensesDone) self.mergeAndFilter(expenseList, paymentList);
      },
    });
  },

  mergeAndFilter: function (expenses, payments) {
    // 合并并按时间倒序
    var all = expenses.concat(payments);
    all.sort(function (a, b) {
      var ta = new Date(a.created_at || 0).getTime();
      var tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
    this.setData({ _allRecords: all, loading: false });
    this.filterRecords();
  },

  filterRecords: function () {
    var tab = this.data.activeTab;
    var all = this.data._allRecords || [];
    var filtered = [];

    if (tab === 'all') {
      filtered = all;
    } else if (tab === 'payment') {
      filtered = all.filter(function (r) { return r.record_type === 'payment'; });
    } else if (tab === 'expense') {
      filtered = all.filter(function (r) { return r.record_type === 'expense'; });
    } else if (tab === 'rejected') {
      filtered = all.filter(function (r) { return r.status === 'rejected'; });
    }

    this.setData({ records: filtered });
  },

  // ── 查看详情弹窗 ──
  viewDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    var record = null;
    var all = this.data._allRecords || [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { record = all[i]; break; }
    }
    if (!record) return;

    // 如果是报销单，尝试加载详情
    if (record.record_type === 'expense') {
      var self = this;
      app.request({
        url: '/api/v1/expenses/' + id,
        success: function (res) {
          if (res.code === 200 && res.data) {
            var detail = res.data;
            detail.record_type = 'expense';
            detail.record_type_label = '报销';
            detail.display_amount = detail.claimed_amount || detail.amount || 0;
            detail.display_reason = detail.reason || detail.purpose || '报销申请';
            detail.statusLabel = record.statusLabel;
            detail.statusClass = record.statusClass;
            self.setData({ currentRecord: detail, showDetail: true });
          } else {
            self.setData({ currentRecord: record, showDetail: true });
          }
        },
        fail: function () {
          self.setData({ currentRecord: record, showDetail: true });
        },
      });
    } else {
      this.setData({ currentRecord: record, showDetail: true });
    }
  },

  closeDetail: function () {
    this.setData({ showDetail: false, currentRecord: null });
  },

  stopPropagation: function () {},

  // ── 预览凭证图片 ──
  previewVoucher: function (e) {
    var url = e.currentTarget.dataset.url;
    if (url) wx.previewImage({ urls: [url] });
  },

  // ── 修改被驳回的单据 ──
  editRejected: function () {
    var record = this.data.currentRecord;
    if (!record) return;

    this.setData({ showDetail: false });

    if (record.record_type === 'expense') {
      wx.navigateTo({ url: '/pages/expense-create/index?edit_id=' + record.id });
    } else if (record.record_type === 'payment') {
      wx.navigateTo({ url: '/pages/payment-create/index?edit_id=' + record.id });
    }
  },

  // ── 快捷入口 ──
  goCreateExpense: function () {
    wx.navigateTo({ url: '/pages/expense-create/index' });
  },

  goCreatePayment: function () {
    wx.navigateTo({ url: '/pages/payment-create/index' });
  },
});
