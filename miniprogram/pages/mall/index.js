// ============================================
// 积分商城页面（含管理员 CRUD）
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    activeTab: 'mall', myPoints: 0, monthlyPoints: 0,
    mallItems: [], ledgerRecords: [], exchangeRecords: [],
    showItemModal: false, currentItem: {}, exchanging: false,
    // 管理员
    isAdmin: false,
    showAddModal: false, editingItem: null, submitting: false,
    formData: { name: '', icon: '🎁', category: '福利', points_cost: '', stock: '', description: '' },
  },

  onLoad: function () {
    // 判断是否管理员（role >= 5）
    var userInfo = app.globalData.userInfo || {};
    this.setData({ isAdmin: (userInfo.role || 0) >= 5 });
    this.loadData();
  },
  onShow: function () {
    var userInfo = app.globalData.userInfo || {};
    this.setData({ isAdmin: (userInfo.role || 0) >= 5 });
    this.loadPoints();
  },

  loadData: function () {
    this.loadPoints();
    this.loadMallItems();
    this.loadLedger();
    this.loadExchangeRecords();
  },

  loadPoints: function () {
    var self = this;
    app.request({
      url: '/api/v1/points/summary',
      success: function (res) {
        if (res.code === 200 && res.data) {
          self.setData({ myPoints: res.data.total_points || 0, monthlyPoints: res.data.monthly_earned || 0 });
        } else {
          self.setData({ myPoints: 320, monthlyPoints: 120 });
        }
      },
    });
  },

  loadMallItems: function () {
    var self = this;
    app.request({
      url: '/api/v1/mall/items',
      success: function (res) {
        if (res.code === 200 && res.data) {
          self.setData({ mallItems: res.data });
        } else {
          self.setData({ mallItems: [] });
        }
      },
    });
  },

  loadLedger: function () {
    var self = this;
    app.request({
      url: '/api/v1/points/ledger',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var records = [];
          var rawRecords = res.data || [];
          for (var i = 0; i < rawRecords.length; i++) {
            var r = rawRecords[i];
            records.push({
              id: r.id, user_id: r.user_id, delta: r.delta, reason: r.reason,
              created_at: r.created_at,
              timeStr: util.formatDate(new Date(r.created_at), 'MM-DD HH:mm'),
            });
          }
          self.setData({ ledgerRecords: records });
        } else {
          self.setData({ ledgerRecords: [] });
        }
      },
    });
  },

  loadExchangeRecords: function () {
    var self = this;
    app.request({
      url: '/api/v1/exchange/records',
      success: function (res) {
        if (res.code === 200 && res.data && res.data.length > 0) {
          var statusMap = { pending: '待核销', completed: '已核销', cancelled: '已取消' };
          var records = [];
          for (var i = 0; i < res.data.length; i++) {
            var r = res.data[i];
            records.push({
              id: r.id, name: r.name, icon: r.icon, points_cost: r.points_cost,
              status: r.status,
              statusLabel: statusMap[r.status] || '未知',
              timeStr: r.created_at ? util.formatDate(new Date(r.created_at), 'MM-DD HH:mm') : '',
            });
          }
          self.setData({ exchangeRecords: records });
        } else {
          self.setData({ exchangeRecords: [] });
        }
      },
    });
  },

  switchTab: function (e) { this.setData({ activeTab: e.currentTarget.dataset.tab }); },
  onItemTap: function (e) { this.setData({ showItemModal: true, currentItem: e.currentTarget.dataset.item }); },
  closeModal: function () { this.setData({ showItemModal: false, currentItem: {} }); },

  confirmExchange: function () {
    if (this.data.exchanging) { wx.showToast({ title: '正在处理，请勿重复点击', icon: 'none' }); return; }
    var item = this.data.currentItem;
    var self = this;
    if (this.data.myPoints < item.points_cost) { wx.showToast({ title: '积分不足，无法兑换', icon: 'none' }); return; }
    if (item.stock <= 0) { wx.showToast({ title: '库存不足，已售罄', icon: 'none' }); return; }
    wx.showModal({
      title: '确认兑换',
      content: '确认消耗 ' + item.points_cost + ' 积分兑换「' + item.name + '」？',
      confirmColor: '#C9A84C',
      success: function (res) {
        if (!res.confirm) return;
        self.setData({ exchanging: true });
        app.request({
          url: '/api/v1/mall/exchange',
          method: 'POST',
          data: { item_id: item.id },
          success: function (res) {
            self.setData({ exchanging: false });
            if (res.code === 200) {
              wx.showToast({ title: '兑换成功！', icon: 'success' });
              self.setData({ showItemModal: false });
              self.loadData();
            } else {
              wx.showToast({ title: res.message || '兑换失败', icon: 'none' });
            }
          },
        });
      },
    });
  },

  // ═══════════════════════════════════════════
  // 管理员：新增商品
  // ═══════════════════════════════════════════
  onAddItem: function () {
    this.setData({
      showAddModal: true,
      editingItem: null,
      formData: { name: '', icon: '🎁', category: '福利', points_cost: '', stock: '', description: '' },
    });
  },

  closeAddModal: function () {
    this.setData({ showAddModal: false, editingItem: null });
  },

  onFormInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var value = e.detail.value;
    var key = 'formData.' + field;
    this.setData({ [key]: value });
  },

  submitAddItem: function () {
    var self = this;
    var form = this.data.formData;
    // 校验
    if (!form.name || !form.name.trim()) {
      wx.showToast({ title: '请输入奖品名称', icon: 'none' }); return;
    }
    var pointsCost = parseInt(form.points_cost);
    if (!pointsCost || pointsCost <= 0) {
      wx.showToast({ title: '请输入有效积分数', icon: 'none' }); return;
    }
    var stock = parseInt(form.stock);
    if (isNaN(stock) || stock < 0) {
      wx.showToast({ title: '请输入有效库存', icon: 'none' }); return;
    }

    self.setData({ submitting: true });

    var isEdit = !!this.data.editingItem;
    var url = isEdit ? '/api/v1/mall/items/' + this.data.editingItem.id : '/api/v1/mall/items';
    var method = isEdit ? 'PUT' : 'POST';

    app.request({
      url: url,
      method: method,
      data: {
        name: form.name.trim(),
        icon: form.icon || '🎁',
        category: form.category || '福利',
        points_cost: pointsCost,
        stock: stock,
        description: form.description || '',
      },
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: isEdit ? '修改成功' : '添加成功', icon: 'success' });
          self.setData({ showAddModal: false, editingItem: null });
          self.loadMallItems();
        } else {
          wx.showToast({ title: res.detail || res.message || '操作失败', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  // ═══════════════════════════════════════════
  // 管理员：删除商品
  // ═══════════════════════════════════════════
  preventBubble: function () { /* 阻止事件冒泡到遮罩层 */ },

  onDeleteItem: function (e) {
    var item = e.currentTarget.dataset.item;
    var self = this;
    wx.showModal({
      title: '删除奖品',
      content: '确认删除「' + item.name + '」？此操作不可撤销。',
      confirmColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) return;
        app.request({
          url: '/api/v1/mall/items/' + item.id,
          method: 'DELETE',
          success: function (res) {
            if (res.code === 200) {
              wx.showToast({ title: '已删除', icon: 'success' });
              self.loadMallItems();
            } else {
              wx.showToast({ title: res.detail || '删除失败', icon: 'none' });
            }
          },
        });
      },
    });
  },
});
