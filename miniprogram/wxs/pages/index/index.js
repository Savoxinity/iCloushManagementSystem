// ============================================
// iCloush 智慧工厂 — 总览页
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    todayStr: '',
    activeFloor: 1,
    allZones: { floor1: [], floor2: [] },
    currentFloorZones: [],
    alertCount: 0,

    // 今日数据大盘
    todayStats: [
      { key: 'total_kg', label: '今日洗涤(kg)', value: '--', color: 'gold' },
      { key: 'running', label: '设备运行', value: '--', color: 'green' },
      { key: 'tasks_done', label: '任务完成', value: '--', color: 'blue' },
      { key: 'alerts', label: '告警', value: '--', color: 'red' },
    ],

    // 排班沙盘
    allStaff: [],
    unassignedStaff: [],
    scheduleSlots: [],

    // 任务统计
    taskStats: { total: 0, pending: 0, running: 0, reviewing: 0, done: 0 },
    taskProgressPct: 0,
    urgentTasks: [],

    // 工区半屏浮窗
    showZoneSheet: false,
    selectedZone: {
      name: '', color: '#C9A84C', status: 'idle', statusLabel: '待机',
      sheetStats: [], items: [],
    },

    // 员工分配弹窗
    showAssignModal: false,
    selectedStaff: null,
    assignableZones: [],

    // Pipeline 管线数据
    pipelineLines: [],
  },

  onLoad() {
    this.setData({ todayStr: util.formatDate(new Date(), 'YYYY年MM月DD日') });
    this.loadAll();
  },

  onShow() {
    // 页面重新显示时刷新数据（如从排班页返回）
    this.loadAll();
  },

  // ============================================
  // 数据加载
  // ============================================
  loadAll() {
    this.loadZones();
    this.loadStaff();
    this.loadTaskStats();
    this.loadTodayStats();
  },

  loadZones() {
    var self = this;
    app.request({
      url: '/api/v1/zones',
      success: function (res) {
        if (res.code !== 200) return;
        var rawZones = Array.isArray(res.data) ? res.data : [];
        var floor1 = [];
        var floor2 = [];
        for (var i = 0; i < rawZones.length; i++) {
          var z = rawZones[i];
          var zone = {
            id: z.id,
            name: z.name,
            code: z.code || ('zone_' + z.id),
            floor: z.floor,
            color: z.color,
            status: z.status,
            capacity: z.capacity,
            staff_count: z.staff_count || 0,
            iot_summary: z.iot_summary || {},
            iot_summary_text: z.iot_summary_text || '',
            description: z.description || '',
            pos: z.pos || { left: '0%', top: '0%', width: '40%', height: '20%' },
            pipeline_order: z.pipeline_order || 0,
          };
          if (z.floor === 1) { floor1.push(zone); }
          else { floor2.push(zone); }
        }
        var allZones = { floor1: floor1, floor2: floor2 };
        var alertCount = rawZones.filter(function (z) { return z.status === 'alert' || z.status === 'warning'; }).length;
        self.setData({
          allZones: allZones,
          alertCount: alertCount,
          currentFloorZones: allZones.floor1,
        });
        self.updateTodayStats({ alerts: alertCount });
        self.buildPipelineLines();
      },
    });
  },

  loadStaff() {
    var self = this;
    app.request({
      url: '/api/v1/users',
      success: function (res) {
        if (res.code !== 200) return;
        var allStaff = [];
        var rawData = res.data || [];
        for (var i = 0; i < rawData.length; i++) {
          var s = rawData[i];
          allStaff.push({
            id: s.id, name: s.name, role: s.role,
            avatar_key: s.avatar_key || 'default',
            avatarColor: util.getAvatarColor(s.avatar_key || 'default'),
            nameInitial: util.getAvatarInitial(s.name),
            current_zones: s.current_zones || [],
            skill_tags: s.skills || [],
            skills: s.skills || [],
            is_multi_post: s.is_multi_post || false,
            status: s.status || 'active',
            total_points: s.total_points || 0,
          });
        }
        var unassignedStaff = allStaff.filter(function (s) { return s.status !== 'leave'; });
        var zones = (self.data.allZones.floor1 || []).concat(self.data.allZones.floor2 || []);
        var scheduleSlots = [];
        var slotZones = zones.slice(0, 6);
        for (var j = 0; j < slotZones.length; j++) {
          var z = slotZones[j];
          var assigned = allStaff.filter(function (s) {
            return (s.current_zones || []).indexOf(z.code) !== -1;
          });
          scheduleSlots.push({
            zone_id: z.id, zone_name: z.name,
            color: z.color, capacity: z.capacity || 3,
            assigned: assigned,
          });
        }
        self.setData({ allStaff: allStaff, unassignedStaff: unassignedStaff, scheduleSlots: scheduleSlots });
        var runningCount = 0;
        for (var k = 0; k < allStaff.length; k++) {
          if (allStaff[k].status === 'active') runningCount++;
        }
        self.updateTodayStats({ running: runningCount });
      },
    });
  },

  loadTaskStats() {
    var self = this;
    app.request({
      url: '/api/v1/tasks/stats',
      success: function (res) {
        if (res.code !== 200) return;
        var stats = res.data;
        var pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
        self.setData({ taskStats: stats, taskProgressPct: pct });
        self.updateTodayStats({ tasks_done: stats.done + '/' + stats.total });
      },
    });

    app.request({
      url: '/api/v1/tasks',
      success: function (res) {
        if (res.code !== 200) return;
        var urgentTasks = [];
        var tasks = res.data || [];
        for (var i = 0; i < tasks.length; i++) {
          var t = tasks[i];
          if (t.priority >= 3 && t.status < 4) {
            urgentTasks.push({
              id: t.id, title: t.title, task_type: t.task_type,
              zone_name: t.zone_name, status: t.status, priority: t.priority,
              points_reward: t.points_reward,
              statusLabel: util.getTaskStatusLabel(t.status),
              deadlineText: t.deadline ? util.getCountdown(t.deadline) : '',
              deadline: t.deadline,
            });
            if (urgentTasks.length >= 3) break;
          }
        }
        self.setData({ urgentTasks: urgentTasks });
      },
    });
  },

  loadTodayStats() {
    // 更新洗涤量（Mock）
    this.updateTodayStats({ total_kg: '2,840' });
  },

  updateTodayStats(updates) {
    var todayStats = this.data.todayStats.slice();
    for (var i = 0; i < todayStats.length; i++) {
      if (updates[todayStats[i].key] !== undefined) {
        todayStats[i] = {
          key: todayStats[i].key, label: todayStats[i].label,
          value: String(updates[todayStats[i].key]), color: todayStats[i].color,
        };
      }
    }
    this.setData({ todayStats: todayStats });
  },

  // ============================================
  // Pipeline 管线构建
  // ============================================
  buildPipelineLines() {
    var floor = this.data.activeFloor;
    var lines = [];
    if (floor === 1) {
      lines.push({ id: 'p1', x1: '25%', y1: '84%', x2: '25%', y2: '28%', label: '收货', direction: 'up' });
      lines.push({ id: 'p2', x1: '25%', y1: '28%', x2: '25%', y2: '32%', label: '', direction: 'down' });
      lines.push({ id: 'p4', x1: '48%', y1: '44%', x2: '52%', y2: '44%', label: '', direction: 'right' });
      lines.push({ id: 'p5', x1: '48%', y1: '70%', x2: '52%', y2: '70%', label: '', direction: 'right' });
      lines.push({ id: 'p6', x1: '73%', y1: '56%', x2: '73%', y2: '84%', label: '发货', direction: 'down' });
    }
    this.setData({ pipelineLines: lines });
  },

  // ============================================
  // 楼层切换
  // ============================================
  switchFloor(e) {
    var floor = e.currentTarget.dataset.floor;
    var currentFloorZones = floor === 1
      ? this.data.allZones.floor1
      : this.data.allZones.floor2;
    this.setData({ activeFloor: floor, currentFloorZones: currentFloorZones });
    this.buildPipelineLines();
  },

  // ============================================
  // 工区热区点击 → 半屏浮窗
  // ============================================
  onZoneTap(e) {
    var zone = e.currentTarget.dataset.zone;
    var statusLabelMap = {
      running: '运行中', idle: '待机', alert: '告警', warning: '告警', offline: '离线',
    };

    var sheetStats = this.buildSheetStats(zone);
    var items = this.buildSheetItems(zone);

    this.setData({
      showZoneSheet: true,
      selectedZone: {
        id: zone.id, name: zone.name, code: zone.code,
        color: zone.color, status: zone.status,
        statusLabel: statusLabelMap[zone.status] || zone.status,
        sheetStats: sheetStats,
        items: items,
      },
    });
  },

  buildSheetStats(zone) {
    var s = zone.iot_summary || {};
    if (zone.code === 'zone_f') {
      // 物流区
      return [
        { label: '出车中', value: s.out || 0, color: '#3B82F6' },
        { label: '在厂', value: s.in || 0, color: '#00FF88' },
        { label: '空闲', value: s.idle || 0, color: '#888888' },
      ];
    }
    if (zone.code === 'zone_e') {
      // 存货区
      return [
        { label: '已用库位', value: s.used || 0, color: '#F59E0B' },
        { label: '总库位', value: s.total || 0, color: '#888888' },
        { label: '告警', value: s.alert || 0, color: '#EF4444' },
      ];
    }
    if (zone.code === 'zone_i') {
      // 质检打包区
      return [
        { label: '今日完成', value: s.done || 0, color: '#00FF88' },
        { label: '今日目标', value: s.target || 0, color: '#888888' },
        { label: '完成率', value: (s.target && s.target > 0 ? Math.round((s.done / s.target) * 100) : 0) + '%', color: '#C9A84C' },
      ];
    }
    // 通用设备区
    return [
      { label: '运行中', value: s.running || 0, color: '#00FF88' },
      { label: '待机', value: s.idle || 0, color: '#888888' },
      { label: '告警', value: s.alert || 0, color: '#EF4444' },
    ];
  },

  buildSheetItems(zone) {
    var mockItems = {
      zone_a: [
        { id: 1, name: '洗涤龙 #1', sub: '化料分配器 · 85%', icon: '🏭', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '1200转/分' },
        { id: 2, name: '洗涤龙 #2', sub: '化料余量低', icon: '🏭', iconBg: 'rgba(245,158,11,0.1)', statusKey: 'running', statusLabel: '运行中', value: '化料45%' },
        { id: 3, name: '洗涤龙 #3', sub: '待机中', icon: '🏭', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待机', value: '' },
      ],
      zone_b: [
        { id: 1, name: '单机 #1~#3', sub: '3台运行中', icon: '🔄', iconBg: 'rgba(59,130,246,0.1)', statusKey: 'running', statusLabel: '运行中', value: '3台' },
        { id: 2, name: '单机 #4~#5', sub: '待机中', icon: '🔄', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待机', value: '2台' },
      ],
      zone_c: [
        { id: 1, name: '烫平机 #1', sub: '温度 185°C（阈值180°C）', icon: '🌡️', iconBg: 'rgba(239,68,68,0.1)', statusKey: 'alert', statusLabel: '告警', value: '185°C' },
        { id: 2, name: '展布机 #1', sub: '正常运行', icon: '📋', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '正常' },
        { id: 3, name: '烫平机 #2', sub: '正常运行', icon: '🌡️', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '178°C' },
      ],
      zone_d: [
        { id: 1, name: '折叠机 #1', sub: '正常运行', icon: '📦', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '正常' },
        { id: 2, name: '打包台 #1', sub: '待机中', icon: '📦', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待机', value: '' },
      ],
      zone_e: [
        { id: 1, name: '脏衣分拣台', sub: '8袋待分拣', icon: '🧺', iconBg: 'rgba(239,68,68,0.1)', statusKey: 'running', statusLabel: '使用中', value: '8袋' },
        { id: 2, name: '暂存货架', sub: '库位 8/20', icon: '🗄️', iconBg: 'rgba(245,158,11,0.1)', statusKey: 'idle', statusLabel: '正常', value: '40%' },
      ],
      zone_f: [
        { id: 1, name: '沪A·88888', sub: '司机：陈刚 · 满载', icon: '🚛', iconBg: 'rgba(59,130,246,0.1)', statusKey: 'running', statusLabel: '运输中', value: '45/80袋' },
        { id: 2, name: '沪B·66666', sub: '待分配', icon: '🚛', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'idle', statusLabel: '在厂', value: '空载' },
        { id: 3, name: '沪C·77777', sub: '维修中', icon: '🚛', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '维修', value: '' },
      ],
      zone_g: [
        { id: 1, name: '干洗机 #1', sub: '正常运行', icon: '👔', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '正常' },
        { id: 2, name: '干洗机 #2', sub: '待机中', icon: '👔', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待机', value: '' },
      ],
      zone_h: [
        { id: 1, name: '制服洗烫线 #1', sub: '正常运行', icon: '👕', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '正常' },
        { id: 2, name: '制服洗烫线 #2', sub: '正常运行', icon: '👕', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '运行中', value: '正常' },
      ],
      zone_i: [
        { id: 1, name: '成品货架A', sub: '存储 28袋', icon: '📦', iconBg: 'rgba(132,204,22,0.1)', statusKey: 'idle', statusLabel: '正常', value: '28袋' },
        { id: 2, name: '出库通道', sub: '今日出库12袋', icon: '🚪', iconBg: 'rgba(0,255,136,0.1)', statusKey: 'running', statusLabel: '使用中', value: '12袋' },
      ],
    };

    return mockItems[zone.code] || [
      { id: 1, name: '暂无设备数据', sub: '该工区设备信息待配置', icon: '⚙️', iconBg: 'rgba(107,114,128,0.1)', statusKey: 'idle', statusLabel: '待配置', value: '' },
    ];
  },

  closeZoneSheet() {
    this.setData({ showZoneSheet: false });
  },

  goZoneDetail() {
    var zone = this.data.selectedZone;
    this.setData({ showZoneSheet: false });
    wx.navigateTo({
      url: '/pages/zone-detail/index?zoneId=' + zone.id + '&zoneName=' + zone.name + '&zoneCode=' + zone.code,
    });
  },

  // ============================================
  // 员工卡片点击 → 分配弹窗
  // ============================================
  onStaffTap(e) {
    var staff = e.currentTarget.dataset.staff;
    if (staff.status === 'assigned') {
      wx.showToast({ title: '已在 ' + (staff.current_zones || []).join('、'), icon: 'none' });
      return;
    }

    var allZonesFlat = (this.data.allZones.floor1 || []).concat(this.data.allZones.floor2 || []);
    var filteredZones = [];
    for (var i = 0; i < allZonesFlat.length; i++) {
      var z = allZonesFlat[i];
      if (staff.is_multi_post) {
        filteredZones.push(z);
      } else {
        var tags = staff.skill_tags || [];
        var match = false;
        for (var j = 0; j < tags.length; j++) {
          if (z.name.indexOf(tags[j]) !== -1 || tags[j].indexOf(z.name.substring(0, 2)) !== -1) {
            match = true; break;
          }
        }
        if (match) filteredZones.push(z);
      }
    }

    var scheduleSlots = this.data.scheduleSlots;
    var assignableZones = [];
    for (var k = 0; k < filteredZones.length; k++) {
      var zone = filteredZones[k];
      var slotAssigned = [];
      for (var m = 0; m < scheduleSlots.length; m++) {
        if (scheduleSlots[m].zone_id === zone.id) {
          slotAssigned = scheduleSlots[m].assigned || [];
          break;
        }
      }
      assignableZones.push({
        id: zone.id, name: zone.name, code: zone.code,
        color: zone.color, capacity: zone.capacity,
        assigned: slotAssigned,
      });
    }

    this.setData({
      showAssignModal: true,
      selectedStaff: staff,
      assignableZones: assignableZones,
    });
  },

  onAssignZone(e) {
    var zoneId = e.currentTarget.dataset.zoneId;
    var staff = this.data.selectedStaff;
    var self = this;

    var allZonesFlat = (this.data.allZones.floor1 || []).concat(this.data.allZones.floor2 || []);
    var targetZone = null;
    for (var i = 0; i < allZonesFlat.length; i++) {
      if (allZonesFlat[i].id === zoneId) { targetZone = allZonesFlat[i]; break; }
    }

    var allStaff = [];
    for (var j = 0; j < this.data.allStaff.length; j++) {
      var s = this.data.allStaff[j];
      if (s.id === staff.id) {
        allStaff.push({
          id: s.id, name: s.name, role: s.role, avatar_key: s.avatar_key,
          avatarColor: s.avatarColor, nameInitial: s.nameInitial,
          current_zones: [targetZone ? targetZone.code : ''],
          skill_tags: s.skill_tags, skills: s.skills,
          is_multi_post: s.is_multi_post, status: 'assigned',
          total_points: s.total_points,
        });
      } else { allStaff.push(s); }
    }

    var scheduleSlots = [];
    for (var k = 0; k < this.data.scheduleSlots.length; k++) {
      var slot = this.data.scheduleSlots[k];
      if (slot.zone_id === zoneId) {
        var newAssigned = slot.assigned.slice();
        newAssigned.push({
          id: staff.id, name: staff.name, avatarColor: staff.avatarColor,
          nameInitial: staff.nameInitial, status: 'assigned',
        });
        scheduleSlots.push({
          zone_id: slot.zone_id, zone_name: slot.zone_name,
          color: slot.color, capacity: slot.capacity, assigned: newAssigned,
        });
      } else { scheduleSlots.push(slot); }
    }

    var unassignedStaff = allStaff.filter(function (s) { return s.status !== 'assigned' && s.status !== 'leave'; });

    this.setData({ allStaff: allStaff, scheduleSlots: scheduleSlots, unassignedStaff: unassignedStaff, showAssignModal: false });

    app.request({
      url: '/api/v1/schedule/assign',
      method: 'POST',
      data: { user_id: staff.id, zone_id: zoneId, date: util.today() },
      success: function (res) {
        if (res.code === 200) {
          util.showSuccess('分配成功');
        } else {
          util.showError('分配失败，请重试');
          self.loadStaff();
        }
      },
    });
  },

  closeAssignModal() {
    this.setData({ showAssignModal: false });
  },

  // ============================================
  // 告警点击
  // ============================================
  onAlertTap() {
    wx.navigateTo({ url: '/pages/iot-dashboard/index' });
  },

  // ============================================
  // 跳转
  // ============================================
  goSchedule() {
    wx.navigateTo({ url: '/pages/schedule/index' });
  },

  goTaskList() {
    wx.navigateTo({ url: '/pages/task-list/index' });
  },

  onTaskTap(e) {
    var task = e.currentTarget.dataset.task;
    wx.navigateTo({ url: '/pages/task-detail/index?taskId=' + task.id });
  },
});
