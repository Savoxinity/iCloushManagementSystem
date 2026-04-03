// ============================================
// IoT 设备仪表盘
// 数据策略：WebSocket 实时推送 → HTTP 轮询降级
// ============================================
var app = getApp();
var util = require('../../utils/util');

var STATUS_LABEL = { running: '运行中', warning: '告警', offline: '离线' };
var ZONE_FILTERS = [
  { id: 'all', name: '全部工区' },
  { id: 1, name: '洗涤龙工区' },
  { id: 2, name: '单机洗烘区' },
  { id: 3, name: '展布平烫A(8滚)' },
  { id: 4, name: '展布平烫B(6滚)' },
  { id: 10, name: '毛巾折叠区' },
  { id: 6, name: '机动物流区' },
  { id: 8, name: '洗烘区(F2)' },
  { id: 12, name: '熨烫区(F2)' },
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
        if (res.code === 200 && res.data && res.data.length > 0) {
          self.processDevices(res.data);
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
      // 兼容 mockData 中的 id 字段 → 统一为 device_id
      if (!copy.device_id && copy.id) { copy.device_id = copy.id; }
      copy.statusLabel = STATUS_LABEL[d.status] || d.status;
      // 为没有sensors字段的设备生成默认sensors
      if (!copy.sensors) {
        copy.sensors = this.buildSensors(copy);
      }
      // 为没有icon字段的设备生成默认icon
      if (!copy.icon) {
        copy.icon = this.getDeviceIcon(copy.device_type || '');
      }
      processed.push(copy);
    }
    var stats = { online: 0, warning: 0, offline: 0, total: processed.length };
    for (var j = 0; j < processed.length; j++) {
      var status = processed[j].status;
      if (status === 'running') stats.online++;
      else if (status === 'warning') { stats.online++; stats.warning++; }
      else if (status === 'offline') stats.offline++;
    }
    this.setData({ allDevices: processed, deviceStats: stats });
    this.applyFilter(this.data.activeZone, processed);
  },

  buildSensors: function (device) {
    var sensors = [];
    if (device.temp !== undefined && device.temp !== null) {
      sensors.push({ key: 'temp', label: '温度', value: '' + device.temp, unit: '°C', alert: false });
    }
    if (device.speed !== undefined && device.speed !== null) {
      sensors.push({ key: 'speed', label: '速度', value: '' + device.speed, unit: 'm/min', alert: false });
    }
    if (device.chemical_pct !== undefined && device.chemical_pct !== null) {
      var chemAlert = device.chemical_pct < 20;
      sensors.push({ key: 'chem', label: '化料', value: '' + device.chemical_pct, unit: '%', alert: chemAlert });
    }
    if (device.cycle_count !== undefined && device.cycle_count !== null) {
      sensors.push({ key: 'cycle', label: '今日批次', value: '' + device.cycle_count, unit: '批', alert: false });
    }
    if (sensors.length === 0) {
      sensors.push({ key: 'status', label: '状态', value: STATUS_LABEL[device.status] || '运行中', unit: '', alert: false });
    }
    return sensors;
  },

  getDeviceIcon: function (deviceType) {
    var iconMap = {
      'washer_tunnel': '🌊',
      'washer_single': '🔄',
      'washer_100kg': '🔄',
      'washer_50kg': '🔄',
      'washer_25kg': '🔄',
      'washer_speed': '⚡',
      'washer_home': '🏠',
      'dryer_through': '🔥',
      'dryer_25kg': '🔥',
      'dryer_60kg': '🔥',
      'ironer_8roll': '♨️',
      'ironer_6roll': '♨️',
      'folder_pillow': '📐',
      'folder_sheet': '📐',
      'folder_towel': '🧻',
      'spreader': '📏',
      'dry_cleaner': '🧴',
      'ironing_table': '👔',
    };
    return iconMap[deviceType] || '⚙️';
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
      url: '/api/v1/iot/devices/' + (device.device_id || device.id) + '/alerts',
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

  // 备用 Mock 数据（当 API 完全不可用时的降级）
  getMockDevices: function () {
    return [
      // F1 洗涤龙工区
      { device_id: 'd001', name: '洗涤龙1号', zone_id: 1, zone_name: '洗涤龙工区', device_type: 'washer_tunnel', icon: '🌊', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '65', unit: '°C', alert: false }, { key: 'chem', label: '化料', value: '78', unit: '%', alert: false }, { key: 'cycle', label: '今日批次', value: '12', unit: '批', alert: false }], alert_msg: '' },
      // F1 单机洗烘区
      { device_id: 'd010', name: '水洗单机1号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '55', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd011', name: '水洗单机2号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '58', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd012', name: '水洗单机3号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '52', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd013', name: '水洗单机4号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '60', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd014', name: '水洗单机5号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '56', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd015', name: '贯通烘干机1号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'dryer_through', icon: '🔥', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '82', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd016', name: '贯通烘干机2号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'dryer_through', icon: '🔥', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '78', unit: '°C', alert: false }], alert_msg: '' },
      // F1 展布平烫A
      { device_id: 'd020', name: '8滚高速烫平机', zone_id: 3, zone_name: '展布平烫A(8滚)', device_type: 'ironer_8roll', icon: '♨️', status: 'running', sensors: [{ key: 'temp', label: '辊温', value: '185', unit: '°C', alert: false }, { key: 'speed', label: '速度', value: '3.2', unit: 'm/min', alert: false }], alert_msg: '' },
      { device_id: 'd021', name: '枕套折叠机A', zone_id: 3, zone_name: '展布平烫A(8滚)', device_type: 'folder_pillow', icon: '📐', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      { device_id: 'd022', name: '床单折叠机A', zone_id: 3, zone_name: '展布平烫A(8滚)', device_type: 'folder_sheet', icon: '📐', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      // F1 展布平烫B
      { device_id: 'd025', name: '展布机', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'spreader', icon: '📏', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      { device_id: 'd026', name: '6滚高速烫平机', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'ironer_6roll', icon: '♨️', status: 'running', sensors: [{ key: 'temp', label: '辊温', value: '178', unit: '°C', alert: false }, { key: 'speed', label: '速度', value: '2.8', unit: 'm/min', alert: false }], alert_msg: '' },
      { device_id: 'd027', name: '枕套折叠机B', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'folder_pillow', icon: '📐', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      { device_id: 'd028', name: '床单折叠机B', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'folder_sheet', icon: '📐', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      // F1 毛巾折叠区
      { device_id: 'd030', name: '毛巾折叠机', zone_id: 10, zone_name: '毛巾折叠区', device_type: 'folder_towel', icon: '🧻', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      // F2 洗烘区
      { device_id: 'd040', name: '干洗机1号', zone_id: 8, zone_name: '洗烘区', device_type: 'dry_cleaner', icon: '🧴', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      { device_id: 'd041', name: '干洗机2号', zone_id: 8, zone_name: '洗烘区', device_type: 'dry_cleaner', icon: '🧴', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      { device_id: 'd042', name: '干洗机3号', zone_id: 8, zone_name: '洗烘区', device_type: 'dry_cleaner', icon: '🧴', status: 'running', sensors: [{ key: 'status', label: '状态', value: '运行中', unit: '', alert: false }], alert_msg: '' },
      { device_id: 'd043', name: '100KG水洗机1号', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_100kg', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '60', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd044', name: '100KG水洗机2号', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_100kg', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '58', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd045', name: '50KG水洗机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_50kg', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '55', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd046', name: '25KG水洗机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_25kg', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '50', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd047', name: 'Speedqueen快速水洗机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_speed', icon: '⚡', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '45', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd048', name: '海尔家用洗烘一体机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_home', icon: '🏠', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '40', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd049', name: '25KG烘箱1号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_25kg', icon: '🔥', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '75', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd050', name: '25KG烘箱2号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_25kg', icon: '🔥', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '72', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd051', name: '60KG烘箱3号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_60kg', icon: '🔥', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '85', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd052', name: '60KG烘箱4号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_60kg', icon: '🔥', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '82', unit: '°C', alert: false }], alert_msg: '' },
      // F2 熨烫区
      { device_id: 'd060', name: '烫台1号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', icon: '👔', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '160', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd061', name: '烫台2号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', icon: '👔', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '155', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd062', name: '烫台3号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', icon: '👔', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '162', unit: '°C', alert: false }], alert_msg: '' },
      { device_id: 'd063', name: '烫台4号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', icon: '👔', status: 'running', sensors: [{ key: 'temp', label: '温度', value: '158', unit: '°C', alert: false }], alert_msg: '' },
    ];
  },
});
