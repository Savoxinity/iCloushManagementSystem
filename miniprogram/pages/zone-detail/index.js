// ============================================
// 工区详情页 JS
// ============================================
var app = getApp();
var util = require('../../utils/util');
var mockData = require('../../utils/mockData');

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
    var zoneCode = this.data.zoneCode;
    var zoneId = parseInt(this.data.zoneId, 10);

    // ── 机动物流区：显示车辆 ──
    if (zoneCode === 'zone_f') {
      var vehicles = mockData.VEHICLES || [];
      var vItems = [];
      for (var vi = 0; vi < vehicles.length; vi++) {
        var v = vehicles[vi];
        var vStatus = v.status === 'out' ? '出勤中' : '在厂';
        var vKey = v.status === 'out' ? 'running' : 'idle';
        var loadStr = v.load_current > 0 ? (v.load_current + '/' + v.load_max + v.unit) : '空载';
        var vSub = v.type;
        if (v.driver_name && v.driver_name !== '待分配') vSub = '司机：' + v.driver_name + ' · ' + v.type;
        vItems.push({ id: v.id, name: v.plate, sub: vSub, icon: '🚛', iconBg: v.status === 'out' ? 'rgba(59,130,246,0.1)' : 'rgba(0,255,136,0.1)', statusKey: vKey, statusLabel: vStatus, value: loadStr });
      }
      this.setData({ devices: vItems });
      return;
    }

    // ── 无IoT设备工区 ──
    var noDeviceZones = {
      zone_e: [{ id: 1, name: '人工分拣台', sub: '8袋待分拣', icon: '🧺', iconBg: 'rgba(239,68,68,0.1)', statusKey: 'running', statusLabel: '使用中', value: '8袋' }],
      zone_g: [{ id: 1, name: '人工分拣打标台', sub: '120件已分拣', icon: '🏷️', iconBg: 'rgba(236,72,153,0.1)', statusKey: 'running', statusLabel: '使用中', value: '120件' }],
      zone_i: [{ id: 1, name: '手工洗涤台', sub: '精洗处理中', icon: '🧤', iconBg: 'rgba(139,92,246,0.1)', statusKey: 'running', statusLabel: '使用中', value: '15件' }],
      zone_k: [{ id: 1, name: '烘房空间', sub: '温度65°C', icon: '🔥', iconBg: 'rgba(245,158,11,0.1)', statusKey: 'running', statusLabel: '运行中', value: '65°C' }],
      zone_m: [{ id: 1, name: '挂衣架区', sub: '65件已挂', icon: '👔', iconBg: 'rgba(132,204,22,0.1)', statusKey: 'running', statusLabel: '使用中', value: '65/100' }],
    };
    if (noDeviceZones[zoneCode]) {
      this.setData({ devices: noDeviceZones[zoneCode] });
      return;
    }

    // ── 有IoT设备的工区：从IOT_DEVICES动态匹配 ──
    var allDevices = mockData.IOT_DEVICES || [];
    var iconMap = {
      washer_tunnel: '🏭', washer_single: '🔄', dryer_through: '🔥',
      ironer_8roll: '🌡️', ironer_6roll: '🌡️', spreader: '📋',
      folder_pillow: '📦', folder_sheet: '📦', folder_towel: '📦',
      dry_cleaner: '👔', washer_100kg: '🔄', washer_50kg: '🔄',
      washer_25kg: '🔄', washer_speed: '🔄', washer_home: '🔄',
      dryer_25kg: '🔥', dryer_60kg: '🔥', ironing_table: '♨️'
    };
    var iconBgMap = {
      washer_tunnel: 'rgba(59,130,246,0.1)', washer_single: 'rgba(59,130,246,0.1)',
      dryer_through: 'rgba(239,68,68,0.1)', dryer_25kg: 'rgba(239,68,68,0.1)', dryer_60kg: 'rgba(239,68,68,0.1)',
      ironer_8roll: 'rgba(245,158,11,0.1)', ironer_6roll: 'rgba(245,158,11,0.1)',
      spreader: 'rgba(0,255,136,0.1)', folder_pillow: 'rgba(132,204,22,0.1)',
      folder_sheet: 'rgba(132,204,22,0.1)', folder_towel: 'rgba(132,204,22,0.1)',
      dry_cleaner: 'rgba(139,92,246,0.1)', washer_100kg: 'rgba(6,182,212,0.1)',
      washer_50kg: 'rgba(6,182,212,0.1)', washer_25kg: 'rgba(6,182,212,0.1)',
      washer_speed: 'rgba(6,182,212,0.1)', washer_home: 'rgba(6,182,212,0.1)',
      ironing_table: 'rgba(239,68,68,0.1)'
    };

    var items = [];
    for (var d = 0; d < allDevices.length; d++) {
      var dev = allDevices[d];
      if (dev.zone_id !== zoneId) continue;
      var statusLabel = dev.status === 'running' ? '运行中' : (dev.status === 'warning' ? '告警' : '离线');
      var sub = '正常运行';
      var value = '';
      if (dev.temp) { sub = '温度 ' + dev.temp + '°C'; value = dev.temp + '°C'; }
      if (dev.chemical_pct) { sub = '化料 ' + dev.chemical_pct + '%'; value = '化料' + dev.chemical_pct + '%'; }
      if (dev.speed) { sub = '温度 ' + (dev.temp || '') + '°C · 速度 ' + dev.speed + 'm/min'; }
      if (!dev.temp && !dev.chemical_pct && !dev.speed) { sub = '正常运行'; value = '正常'; }
      items.push({
        id: dev.id, name: dev.name, sub: sub,
        icon: iconMap[dev.device_type] || '⚙️',
        iconBg: iconBgMap[dev.device_type] || 'rgba(107,114,128,0.1)',
        statusKey: dev.status || 'running', statusLabel: statusLabel, value: value
      });
    }
    if (items.length === 0) {
      items = [{ id: 1, name: '暂无设备数据', sub: '该工区设备信息待配置', icon: '⚙️', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待配置', value: '' }];
    }
    this.setData({ devices: items });
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
