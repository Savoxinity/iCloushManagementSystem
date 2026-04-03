// ============================================
// 工区详情页 JS
// ============================================
var app = getApp();
var util = require('../../utils/util');

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

  onLoad: function (options) {
    this.setData({
      zoneId: options.zoneId,
      zoneName: options.zoneName || '工区详情',
      zoneCode: options.zoneCode || '',
      todayStr: util.formatDate(new Date(), 'YYYY年MM月DD日'),
    });
    wx.setNavigationBarTitle({ title: options.zoneName || '工区详情' });
    this.loadZoneData();
  },

  loadZoneData: function () {
    var self = this;
    app.request({
      url: '/api/v1/zones',
      success: function (res) {
        if (res.code !== 200) return;
        // ★ 关键修复：Mock返回扁平数组，不是{floor1,floor2}对象
        var allZones = Array.isArray(res.data) ? res.data : [];
        if (!Array.isArray(res.data) && res.data && res.data.floor1) {
          allZones = (res.data.floor1 || []).concat(res.data.floor2 || []);
        }
        var zone = null;
        for (var i = 0; i < allZones.length; i++) {
          if (String(allZones[i].id) === String(self.data.zoneId)) {
            zone = allZones[i]; break;
          }
        }
        if (!zone) return;
        var statusLabelMap = { running: '运行中', idle: '待机', warning: '告警', alert: '告警', offline: '离线' };
        self.setData({
          zoneColor: zone.color,
          zoneStatus: zone.status,
          zoneStatusLabel: statusLabelMap[zone.status] || zone.status,
          iotSummary: zone.iot_summary_text || '',
        });
      },
    });

    this.loadDevices();
    this.loadSchedule();
    this.loadTasks();
  },

  loadDevices: function () {
    var mockDevices = {
      zone_a: [
        { id: 1, name: '洗涤龙 #1', sub: '化料分配器', icon: '🏭', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '1200rpm' },
        { id: 2, name: '洗涤龙 #2', sub: '化料分配器', icon: '🏭', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '1200rpm' },
        { id: 3, name: '洗涤龙 #3', sub: '化料分配器', icon: '🏭', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '1200rpm' },
      ],
      zone_b: [
        { id: 1, name: '水洗单机 #1', sub: '正常运行', icon: '🔄', iconBg: 'rgba(16,185,129,0.1)', statusKey: 'running', statusLabel: '运行中', value: '800rpm' },
        { id: 2, name: '水洗单机 #2', sub: '正常运行', icon: '🔄', iconBg: 'rgba(16,185,129,0.1)', statusKey: 'running', statusLabel: '运行中', value: '800rpm' },
        { id: 3, name: '水洗单机 #3', sub: '正常运行', icon: '🔄', iconBg: 'rgba(16,185,129,0.1)', statusKey: 'running', statusLabel: '运行中', value: '800rpm' },
        { id: 4, name: '水洗单机 #4', sub: '待机中', icon: '🔄', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待机', value: '' },
        { id: 5, name: '水洗单机 #5', sub: '待机中', icon: '🔄', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待机', value: '' },
        { id: 6, name: '贯通烘干机 #1', sub: '前进后出', icon: '🔥', iconBg: 'rgba(239,68,68,0.1)', statusKey: 'running', statusLabel: '运行中', value: '82°C' },
        { id: 7, name: '贯通烘干机 #2', sub: '前进后出', icon: '🔥', iconBg: 'rgba(239,68,68,0.1)', statusKey: 'running', statusLabel: '运行中', value: '78°C' },
      ],
      zone_c: [
        { id: 1, name: '8滚烫平机', sub: '高速烫平', icon: '🔥', iconBg: 'rgba(245,158,11,0.1)', statusKey: 'warning', statusLabel: '告警', value: '185°C' },
        { id: 2, name: '展布机 #1', sub: '正常运行', icon: '📐', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '' },
      ],
      zone_d: [
        { id: 1, name: '6滚烫平机', sub: '高速烫平', icon: '🔥', iconBg: 'rgba(249,115,22,0.1)', statusKey: 'running', statusLabel: '运行中', value: '178°C' },
        { id: 2, name: '展布机 #2', sub: '正常运行', icon: '📐', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '' },
      ],
      zone_f: [
        { id: 1, name: '沪A·88888', sub: '司机：陈刚', icon: '🚛', iconBg: 'rgba(59,130,246,0.1)', statusKey: 'running', statusLabel: '出勤中', value: '45/80袋' },
        { id: 2, name: '沪B·66666', sub: '待分配', icon: '🚛', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'idle', statusLabel: '在厂', value: '' },
        { id: 3, name: '沪C·77777', sub: '维修中', icon: '🚛', iconBg: 'rgba(239,68,68,0.1)', statusKey: 'repair', statusLabel: '维修', value: '' },
      ],
    };
    var devices = mockDevices[this.data.zoneCode] || [];
    this.setData({ devices: devices });
  },

  loadSchedule: function () {
    var self = this;
    app.request({
      url: '/api/v1/users',
      success: function (res) {
        if (res.code !== 200) return;
        var todaySchedule = [];
        var rawData = res.data || [];
        for (var i = 0; i < rawData.length; i++) {
          var s = rawData[i];
          var zones = s.current_zones || [];
          if (zones.indexOf(self.data.zoneCode) !== -1) {
            todaySchedule.push({
              id: s.id, name: s.name,
              avatar_key: s.avatar_key || 'default',
              avatarColor: util.getAvatarColor(s.avatar_key || 'default'),
              nameInitial: util.getAvatarInitial(s.name),
              skills: s.skills || [],
              shift_type: 'full',
              checked_in: Math.random() > 0.3,
            });
          }
        }
        self.setData({ todaySchedule: todaySchedule });
      },
    });
  },

  loadTasks: function () {
    var self = this;
    app.request({
      url: '/api/v1/tasks',
      success: function (res) {
        if (res.code !== 200) return;
        var zoneTasks = [];
        var rawData = res.data || [];
        for (var i = 0; i < rawData.length; i++) {
          var t = rawData[i];
          if (String(t.zone_id) === String(self.data.zoneId)) {
            zoneTasks.push({
              id: t.id, title: t.title, task_type: t.task_type,
              zone_id: t.zone_id, zone_name: t.zone_name,
              status: t.status, priority: t.priority,
              points_reward: t.points_reward,
              progress: t.progress, target: t.target, unit: t.unit,
              typeLabel: util.getTaskTypeLabel(t.task_type),
              statusLabel: util.getTaskStatusLabel(t.status),
            });
          }
        }
        self.setData({ zoneTasks: zoneTasks });
      },
    });
  },

  switchTab: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.key });
  },

  onTaskTap: function (e) {
    var task = e.currentTarget.dataset.task;
    wx.navigateTo({ url: '/pages/task-detail/index?taskId=' + task.id });
  },
});
