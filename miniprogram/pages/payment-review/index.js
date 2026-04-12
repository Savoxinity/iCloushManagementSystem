// ============================================
// 付款审批 — 管理员 V5.4.1
// ★ 标记已付款时选择成本分类 → 自动入成本明细
// ★ Type B/C 完成后自动注入欠票倒计时追踪
// ============================================
var app = getApp();

var STATUS_LABELS = {
  pending: '待审批',
  approved: '已批准',
  completed: '已付款',
  rejected: '已驳回',
};

// 成本分类（与 management-accounting 一致）
var COST_CATEGORIES = [
  '人工成本', '材料成本', '设备折旧', '运输费用',
  '水电费', '办公费', '差旅费', '维修费',
  '外包服务', '税费', '其他',
];

Page({
  data: {
    payments: [],
    statusFilter: 'pending',
    loading: false,

    // 成本分类弹窗
    showCostPicker: false,
    costCategories: COST_CATEGORIES,
    selectedCostCategory: '',
    pendingCompleteId: null,
    pendingCompleteItem: null,
  },

  onShow: function () { this.loadPayments(); },

  filterByStatus: function (e) {
    this.setData({ statusFilter: e.currentTarget.dataset.status });
    this.loadPayments();
  },

  loadPayments: function () {
    var self = this;
    self.setData({ loading: true });
    var url = '/api/v1/payments/';
    if (self.data.statusFilter) {
      url += '?status=' + self.data.statusFilter;
    }
    app.request({
      url: url,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var list = (res.data || []).map(function (item) {
            item.statusLabel = STATUS_LABELS[item.status] || item.status;
            if (item.created_at) {
              item.created_at_display = item.created_at.slice(0, 10);
            }
            // 解析分期数据
            if (item.installments_json) {
              try { item.installments = JSON.parse(item.installments_json); } catch (e) {}
            }
            return item;
          });
          self.setData({ payments: list });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  previewImage: function (e) {
    var url = e.currentTarget.dataset.url;
    wx.previewImage({ urls: [url], current: url });
  },

  approvePayment: function (e) {
    this.updateStatus(e.currentTarget.dataset.id, 'approved');
  },

  rejectPayment: function (e) {
    var self = this;
    wx.showModal({
      title: '确认驳回',
      content: '确定要驳回此付款申请吗？',
      success: function (res) {
        if (res.confirm) {
          self.updateStatus(e.currentTarget.dataset.id, 'rejected');
        }
      },
    });
  },

  // ── 标记已付款 → 弹出成本分类选择 ──
  completePayment: function (e) {
    var id = e.currentTarget.dataset.id;
    // 找到对应的 payment item
    var item = null;
    for (var i = 0; i < this.data.payments.length; i++) {
      if (this.data.payments[i].id === id) {
        item = this.data.payments[i];
        break;
      }
    }
    this.setData({
      showCostPicker: true,
      pendingCompleteId: id,
      pendingCompleteItem: item,
      selectedCostCategory: '',
    });
  },

  // ── 选择成本分类 ──
  selectCostCategory: function (e) {
    var cat = e.currentTarget.dataset.category;
    this.setData({ selectedCostCategory: cat });
  },

  // ── 取消成本分类弹窗 ──
  cancelCostPicker: function () {
    this.setData({
      showCostPicker: false,
      pendingCompleteId: null,
      pendingCompleteItem: null,
      selectedCostCategory: '',
    });
  },

  // ── 确认已付款 + 选定成本分类 ──
  confirmComplete: function () {
    var self = this;
    if (!self.data.selectedCostCategory) {
      wx.showToast({ title: '请选择成本分类', icon: 'none' });
      return;
    }

    var id = self.data.pendingCompleteId;
    var item = self.data.pendingCompleteItem;
    var costCategory = self.data.selectedCostCategory;

    self.setData({ showCostPicker: false });

    // 发送 completed 状态 + 成本分类
    app.request({
      url: '/api/v1/payments/' + id + '/status',
      method: 'PUT',
      data: {
        status: 'completed',
        cost_category: costCategory,
      },
      success: function (res) {
        if (res.code === 200) {
          var msg = '已付款，成本已计入「' + costCategory + '」';

          // 后端应自动处理：
          // 1. 向 ManagementCostLedger 插入成本流水
          // 2. Type B/C 注入欠票倒计时追踪
          // 前端提示
          if (item && (item.payment_type === 'B' || item.payment_type === 'C')) {
            msg += '（欠票追踪已启动）';
          }

          wx.showToast({ title: msg, icon: 'success', duration: 2500 });
          self.loadPayments();
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });

    self.setData({
      pendingCompleteId: null,
      pendingCompleteItem: null,
      selectedCostCategory: '',
    });
  },

  updateStatus: function (id, status) {
    var self = this;
    app.request({
      url: '/api/v1/payments/' + id + '/status',
      method: 'PUT',
      data: { status: status },
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: '操作成功', icon: 'success' });
          self.loadPayments();
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
