// ============================================
// IoT 设备仪表盘
// 数据策略：WebSocket 实时推送 → HTTP 轮询降级
// ============================================
const app = getApp();
const util = require('../../utils/util');

const STATUS_LABEL = { running: '运行中', idle: '待机', warning: '告警', offline: '离线' };
const ZONE_FILTERS = [
  { id: 'all', name: '全部工区' },
  { id: 1, name: '隧道洗涤龙' },
  { id: 2, name: '单机洗涤区' },
  { id: 3, name: '烫平展布区' },
  { id: 4, name: '折叠工区' },
  { id: 5, name: '机动物流区' },
  { id: 6, name: '客衣制服区' },
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

  onLoad() { this.loadDevices(); this.startPolling(); },
  onShow() {
    // 页面重新可见时检查 WebSocket 状态
    const ws = app.globalData.ws;
    if (!ws || app.globalData.wsConnected === false) {
      this.setData({ wsConnected: false });
    }
    // 监听全局 WebSocket 推送的 IoT 消息
    app.onIoTMessage = (msg) => { this.handleWsMessage(msg); };
  },
  onHide() { app.onIoTMessage = null; },
  onUnload() { this.stopPolling(); app.onIoTMessage = null; },

  startPolling() {
    // 每 30 秒轮询一次（WebSocket 断线时的降级方案）
    this._pollTimer = setInterval(() => {
      if (!app.globalData.wsConnected) { this.loadDevices(); }
    }, 30000);
  },
  stopPolling() { if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; } },

  loadDevices() {
    app.request({ url: '/api/v1/iot/devices', method: 'GET' })
      .then(res => { this.processDevices(res.data || []); this.setData({ wsConnected: app.globalData.wsConnected || false, lastUpdateTime: util.formatDate(new Date(), 'HH:mm:ss') }); })
      .catch(() => { this.processDevices(this.getMockDevices()); });
  },

  handleWsMessage(msg) {
    // 处理 WebSocket 推送的设备状态更新
    if (msg.type !== 'iot_update') return;
    const allDevices = this.data.allDevices.map(d => {
      if (d.device_id === msg.device_id) {
        return { ...d, status: msg.status, statusLabel: STATUS_LABEL[msg.status] || msg.status, sensors: msg.sensors || d.sensors, alert_msg: msg.alert_msg || '' };
      }
      return d;
    });
    this.processDevices(allDevices);
    this.setData({ wsConnected: true, lastUpdateTime: util.formatDate(new Date(), 'HH:mm:ss') });
  },

  processDevices(devices) {
    const processed = devices.map(d => ({ ...d, statusLabel: STATUS_LABEL[d.status] || d.status }));
    const stats = { online: 0, warning: 0, offline: 0, total: processed.length };
    processed.forEach(d => {
      if (d.status === 'running' || d.status === 'idle') stats.online++;
      else if (d.status === 'warning') { stats.online++; stats.warning++; }
      else if (d.status === 'offline') stats.offline++;
    });
    this.setData({ allDevices: processed, deviceStats: stats });
    this.applyFilter(this.data.activeZone, processed);
  },

  filterByZone(e) {
    const zone = e.currentTarget.dataset.zone;
    this.setData({ activeZone: zone });
    this.applyFilter(zone, this.data.allDevices);
  },

  applyFilter(zone, devices) {
    const filtered = zone === 'all' ? devices : devices.filter(d => d.zone_id === zone);
    this.setData({ filteredDevices: filtered });
  },

  onDeviceTap(e) {
    const device = e.currentTarget.dataset.device;
    // 加载历史告警
    app.request({ url: `/api/v1/iot/devices/${device.device_id}/alerts`, method: 'GET' })
      .then(res => {
        const history = (res.data || []).map(h => ({ ...h, timeStr: util.formatDate(new Date(h.created_at), 'MM-DD HH:mm') }));
        this.setData({ showDeviceModal: true, currentDevice: { ...device, history } });
      })
      .catch(() => {
        this.setData({ showDeviceModal: true, currentDevice: { ...device, history: [] } });
      });
  },
  closeModal() { this.setData({ showDeviceModal: false, currentDevice: {} }); },

  getMockDevices() {
    return [
      { device_id: 'd001', name: '隧道洗涤龙 #1', zone_id: 1, zone_name: '隧道洗涤龙工区', icon: '🌊', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '62', unit: '°C', alert: false }, { key: 'speed', label: '转速', value: '45', unit: 'rpm', alert: false }, { key: 'load', label: '负载', value: '87', unit: '%', alert: false }], alert_msg: '' },
      { device_id: 'd002', name: '化料投放器 #1', zone_id: 1, zone_name: '隧道洗涤龙工区', icon: '🧪', status: 'warning', sensors: [{ key: 'level', label: '余量', value: '12', unit: '%', alert: true }, { key: 'flow', label: '流量', value: '2.3', unit: 'L/h', alert: false }], alert_msg: '化料余量不足12%，请及时补充' },
      { device_id: 'd003', name: '单机洗涤机 #1', zone_id: 2, zone_name: '单机洗涤区', icon: '🔄', status: 'running', sensors: [{ key: 'temp', label: '水温', value: '55', unit: '°C', alert: false }, { key: 'cycle', label: '当前程序', value: '3', unit: '号', alert: false }], alert_msg: '' },
      { device_id: 'd004', name: '烫平机 #1', zone_id: 3, zone_name: '烫平展布工区', icon: '♨️', status: 'running', sensors: [{ key: 'temp', label: '辊温', value: '168', unit: '°C', alert: false }, { key: 'speed', label: '速度', value: '12', unit: 'm/min', alert: false }], alert_msg: '' },
      { device_id: 'd005', name: '展布机 #1', zone_id: 3, zone_name: '烫平展布工区', icon: '📐', status: 'idle', sensors: [{ key: 'status', label: '状态', value: '待机', unit: '', alert: false }], alert_msg: '' },
      { device_id: 'd006', name: '配送车辆 沪A·12345', zone_id: 5, zone_name: '机动物流区', icon: '🚐', status: 'running', sensors: [{ key: 'location', label: '状态', value: '出车中', unit: '', alert: false }, { key: 'load', label: '装载率', value: '80', unit: '%', alert: false }], alert_msg: '' },
    ];
  },
});
