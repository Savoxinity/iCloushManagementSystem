// ============================================
// 积分商城页面
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    activeTab: 'mall', myPoints: 0, monthlyPoints: 0,
    mallItems: [], ledgerRecords: [], exchangeRecords: [],
    showItemModal: false, currentItem: {}, exchanging: false,
  },

  onLoad: function () { this.loadData(); },
  onShow: function () { this.loadPoints(); },

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
          self.setData({ mallItems: [
            { id: 1, name: '下午茶券', description: '可兑换一份下午茶或饮品', icon: '☕', points_cost: 50, stock: 20 },
            { id: 2, name: '外卖补贴', description: '满30减15外卖补贴券', icon: '🍱', points_cost: 80, stock: 15 },
            { id: 3, name: '半天调休', description: '申请半天带薪调休', icon: '🌙', points_cost: 200, stock: 5 },
            { id: 4, name: '全天调休', description: '申请一天带薪调休', icon: '🏖️', points_cost: 350, stock: 3 },
            { id: 5, name: '超市购物卡', description: '50元超市购物卡', icon: '🛒', points_cost: 150, stock: 10 },
            { id: 6, name: '月度之星', description: '获得月度之星荣誉证书', icon: '⭐', points_cost: 500, stock: 1 },
          ]});
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
          self.setData({ ledgerRecords: [
            { id: 1, reason: '完成日常任务x3', delta: 30, timeStr: '今天 09:30' },
            { id: 2, reason: '任务质量优秀奖励', delta: 20, timeStr: '今天 08:15' },
            { id: 3, reason: '兑换下午茶券', delta: -50, timeStr: '昨天 15:00' },
            { id: 4, reason: '完成周期任务', delta: 50, timeStr: '前天 10:20' },
          ]});
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
          self.setData({ exchangeRecords: [
            { id: 1, name: '下午茶券', icon: '☕', points_cost: 50, status: 'completed', statusLabel: '已核销', timeStr: '昨天 15:00' },
          ]});
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
});
