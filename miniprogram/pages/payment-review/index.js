// ============================================
// 付款审批 — 管理员
// ============================================
var app = getApp();

var STATUS_LABELS = {
  pending: '待审批',
  approved: '已批准',
  completed: '已付款',
  rejected: '已驳回',
};

Page({
  data: {
    payments: [],
    statusFilter: 'pending',
    loading: false,
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

  completePayment: function (e) {
    var self = this;
    wx.showModal({
      title: '确认已付款',
      content: '标记为已付款后，系统将自动生成成本流水。',
      success: function (res) {
        if (res.confirm) {
          self.updateStatus(e.currentTarget.dataset.id, 'completed');
        }
      },
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
