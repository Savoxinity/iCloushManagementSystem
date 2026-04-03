const app = getApp();
const util = require('../../utils/util');

Page({
  data: {
    zoneId: null, zoneName: '', zoneCode: '',
    zoneColor: '#C9A84C', zoneStatus: 'running', zoneStatusLabel: '运行中',
    iotSummary: '',
    activeTab: 'devices',
    tabs: [
      { key: 'devices', label: '设备状态' },
      { key: 'schedule', label: '今日排班' },
      { key: 'tasks', label: '今日任务' },
    ],
    devices: [], todaySchedule: [], zoneTasks: [],
    todayStr: '',
  },

  onLoad(options) {
    this.setData({
      zoneId: options.zoneId,
      zoneName: options.zoneName || '工区详情',
      zoneCode: options.zoneCode || '',
      todayStr: util.formatDate(new Date(), 'YYYY年MM月DD日'),
    });
    wx.setNavigationBarTitle({ title: options.zoneName || '工区详情' });
    this.loadZoneData();
  },

  loadZoneData() {
    // 从总览页 Mock 数据中获取工区信息
    app.request({
      url: '/api/v1/zones',
      success: (res) => {
        if (res.code !== 200) return;
        const allZones = [...res.data.floor1, ...res.data.floor2];
        const zone = allZones.find(z => String(z.id) === String(this.data.zoneId));
        if (!zone) return;
        const statusLabelMap = { running: '运行中', idle: '待机', alert: '告警', offline: '离线' };
        this.setData({
          zoneColor: zone.color,
          zoneStatus: zone.status,
          zoneStatusLabel: statusLabelMap[zone.status] || zone.status,
          iotSummary: zone.iot_summary,
        });
      },
    });

    this.loadDevices();
    this.loadSchedule();
    this.loadTasks();
  },

  loadDevices() {
    // Mock 设备数据（后期接 IoT API）
    const mockDevices = {
      zone_a: [
        { id: 1, name: '洗涤龙 #1', sub: '化料分配器', icon: '🏭', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '1200rpm' },
        { id: 2, name: '洗涤龙 #2', sub: '化料分配器', icon: '🏭', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '1200rpm' },
        { id: 3, name: '洗涤龙 #3', sub: '化料分配器', icon: '🏭', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '1200rpm' },
      ],
      zone_f: [
        { id: 1, name: '沪A·12345', sub: '司机：刘伟 · 小工：张明', icon: '🚛', iconBg: 'rgba(59,130,246,0.1)', statusKey: 'running', statusLabel: '运输中', value: '满载' },
        { id: 2, name: '沪A·67890', sub: '司机：赵磊 · 小工：陈强', icon: '🚛', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'idle', statusLabel: '在厂', value: '装卸中' },
      ],
    };
    const devices = mockDevices[this.data.zoneCode] || [];
    this.setData({ devices });
  },

  loadSchedule() {
    app.request({
      url: '/api/v1/users',
      success: (res) => {
        if (res.code !== 200) return;
        const todaySchedule = res.data
          .filter(s => s.current_zones.includes(this.data.zoneCode))
          .map(s => ({
            ...s,
            avatarColor: util.getAvatarColor(s.avatar_key),
            nameInitial: util.getAvatarInitial(s.name),
            shift_type: 'full',
            checked_in: Math.random() > 0.3,
          }));
        this.setData({ todaySchedule });
      },
    });
  },

  loadTasks() {
    app.request({
      url: '/api/v1/tasks',
      success: (res) => {
        if (res.code !== 200) return;
        const zoneTasks = res.data
          .filter(t => String(t.zone_id) === String(this.data.zoneId))
          .map(t => ({
            ...t,
            typeLabel: util.getTaskTypeLabel(t.task_type),
            statusLabel: util.getTaskStatusLabel(t.status),
          }));
        this.setData({ zoneTasks });
      },
    });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key });
  },

  onTaskTap(e) {
    const task = e.currentTarget.dataset.task;
    wx.navigateTo({ url: `/pages/task-detail/index?taskId=${task.id}` });
  },
});
