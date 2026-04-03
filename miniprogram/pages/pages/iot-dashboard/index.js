// ============================================
// IoT 设备仪表盘
// 数据策略：WebSocket 实时推送 → HTTP 轮询降级
// ============================================
var app = getApp();
var util = require('../../utils/util');

var STATUS_LABEL = { running: '运行中', maintenance: '维修中', warning: '告警', offline: '离线' };
var ZONE_FILTERS = [
  { id: 'all', name: '全部工区' },
  { id: 1, name: '洗涤龙工区' },
  { id: 2, name: '单机洗烘区' },
  { id: 3, name: '展布平烫A(8滚)' },
  { id: 4, name: '展布平烫B(6滚)' },
  { id: 5, name: '毛巾折叠区' },
  { id: 6, name: '机动物流区' },
  { id: 7, name: '分拣打标区' },
  { id: 8, name: '洗烘区' },
];

Page({
  data: {
    wsConnected: false,
    lastUpdateTime: '--',
    activeZone: 'all',
    zoneFilters: ZONE_FILTERS,
    allDevices: [],
    filteredDevices: [],
    deviceStats: { online: 0, warning: 0, offline: 0, total: 0 },
    showDeviceModal: false,
    currentDevice: {},
  },
  _pollTimer: null,

  onLoad: function () {
    this.loadDevices();
    this.startPolling();
  },
  onShow: function () {
    var ws = app.globalData.ws;
    if (!ws || app.globalData.wsConnected === false) {
      this.setData({ wsConnected: false });
    }
    var self = this;
    app.onIoTMessage = function (msg) { self.handleWsMessage(msg); };
  },
  onHide: function () { app.onIoTMessage = null; },
  onUnload: function () { this.stopPolling(); app.onIoTMessage = null; },

  startPolling: function () {
    var self = this;
    this._pollTimer = setInterval(function () {
      if (!app.globalData.wsConnected) { self.loadDevices(); }
    }, 30000);
  },
  stopPolling: function () {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  loadDevices: function () {
    var self = this;
    app.request({
      url: '/api/v1/iot/devices',
      success: function (res) {
        if (res.code === 200) {
          self.processDevices(res.data || []);
        } else {
          self.processDevices(self.getMockDevices());
        }
        self.setData({
          wsConnected: app.globalData.wsConnected || false,
          lastUpdateTime: util.formatDate(new Date(), 'HH:mm:ss'),
        });
      },
    });
  },

  handleWsMessage: function (msg) {
    if (msg.type !== 'iot_update') return;
    var allDevices = [];
    for (var i = 0; i < this.data.allDevices.length; i++) {
      var d = this.data.allDevices[i];
      if (d.device_id === msg.device_id) {
        var updated = {};
        var keys = Object.keys(d);
        for (var k = 0; k < keys.length; k++) { updated[keys[k]] = d[keys[k]]; }
        updated.status = msg.status;
        updated.statusLabel = STATUS_LABEL[msg.status] || msg.status;
        updated.sensors = msg.sensors || d.sensors;
        updated.alert_msg = msg.alert_msg || '';
        allDevices.push(updated);
      } else {
        allDevices.push(d);
      }
    }
    this.processDevices(allDevices);
    this.setData({ wsConnected: true, lastUpdateTime: util.formatDate(new Date(), 'HH:mm:ss') });
  },

  processDevices: function (devices) {
    var processed = [];
    for (var i = 0; i < devices.length; i++) {
      var d = devices[i];
      var copy = {};
      var keys = Object.keys(d);
      for (var k = 0; k < keys.length; k++) { copy[keys[k]] = d[keys[k]]; }
      copy.statusLabel = STATUS_LABEL[d.status] || d.status;
      processed.push(copy);
    }
    var stats = { online: 0, warning: 0, offline: 0, maintenance: 0, total: processed.length };
    for (var j = 0; j < processed.length; j++) {
      var status = processed[j].status;
      if (status === 'running') stats.online++;
      else if (status === 'warning') { stats.online++; stats.warning++; }
      else if (status === 'maintenance') stats.maintenance++;
      else if (status === 'offline') stats.offline++;
    }
    this.setData({ allDevices: processed, deviceStats: stats });
    this.applyFilter(this.data.activeZone, processed);
  },

  filterByZone: function (e) {
    var zone = e.currentTarget.dataset.zone;
    this.setData({ activeZone: zone });
    this.applyFilter(zone, this.data.allDevices);
  },

  applyFilter: function (zone, devices) {
    var filtered = [];
    if (zone === 'all') {
      filtered = devices;
    } else {
      for (var i = 0; i < devices.length; i++) {
        if (devices[i].zone_id === zone) filtered.push(devices[i]);
      }
    }
    this.setData({ filteredDevices: filtered });
  },

  onDeviceTap: function (e) {
    var device = e.currentTarget.dataset.device;
    var self = this;
    app.request({
      url: '/api/v1/iot/devices/' + device.device_id + '/alerts',
      success: function (res) {
        var history = [];
        var rawHistory = res.data || [];
        for (var i = 0; i < rawHistory.length; i++) {
          var h = rawHistory[i];
          var copy = {};
          var keys = Object.keys(h);
          for (var k = 0; k < keys.length; k++) { copy[keys[k]] = h[keys[k]]; }
          copy.timeStr = util.formatDate(new Date(h.created_at), 'MM-DD HH:mm');
          history.push(copy);
        }
        var deviceCopy = {};
        var dKeys = Object.keys(device);
        for (var j = 0; j < dKeys.length; j++) { deviceCopy[dKeys[j]] = device[dKeys[j]]; }
        deviceCopy.history = history;
        self.setData({ showDeviceModal: true, currentDevice: deviceCopy });
      },
    });
  },

  closeModal: function () { this.setData({ showDeviceModal: false, currentDevice: {} }); },

  getMockDevices: function () {
    return [
      { device_id: 'd001', name: '隧道洗涤龙 #1', zone_id: 1, zone_name: '洗涤龙工区', icon: '🌊', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '62', unit: '°C', alert: false }, { key: 'speed', label: '转速', value: '45', unit: 'rpm', alert: false }, { key: 'load', label: '负载', value: '87', unit: '%', alert: false }], alert_msg: '' },
      { device_id: 'd002', name: '化料投放器 #1', zone_id: 1, zone_name: '洗涤龙工区', icon: '🧪', status: 'warning', sensors: [{ key: 'level', label: '余量', value: '12', unit: '%', alert: true }, { key: 'flow', label: '流量', value: '2.3', unit: 'L/h', alert: false }], alert_msg: '化料余量不足12%，请及时补充' },
      { device_id: 'd003', name: '单机洗涤机 #1', zone_id: 2, zone_name: '单机洗烘区', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '55', unit: '°C', alert: false }, { key: 'cycle', label: '当前程序', value: '3', unit: '号', alert: false }], alert_msg: '' },
      { device_id: 'd004', name: '8滚烫平机 #1', zone_id: 3, zone_name: '展布平烫A(8滚)', icon: '♨️', status: 'running', sensors: [{ key: 'temp', label: '辊温', value: '168', unit: '°C', alert: false }, { key: 'speed', label: '速度', value: '12', unit: 'm/min', alert: false }], alert_msg: '' },
      { device_id: 'd005', name: '展布机 #1', zone_id: 3, zone_name: '展布平炫A(8滚)', icon: '📐', status: 'maintenance', sensors: [{ key: 'status', label: '状态', value: '维修中', unit: '', alert: false }], alert_msg: '定期保养中，预计明日恢复' },
      { device_id: 'd006', name: '配送车辆 沪A·88888', zone_id: 6, zone_name: '机动物流区', icon: '🚐', status: 'running', sensors: [{ key: 'location', label: '状态', value: '出车中', unit: '', alert: false }, { key: 'load', label: '装载率', value: '80', unit: '%', alert: false }], alert_msg: '' },
    ];
  },
});
