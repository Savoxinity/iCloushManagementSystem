// ============================================
// iCloush 智慧工厂 — 总览页 V7 (Phase 4 补丁)
// 排班交互：长按员工卡 → 弹出工区选择器
// ★ 新增：拖拽到机动物流区(zone_f) → 弹出车辆+路线指派框 → 复合提交
// 数据同步：通过 app.globalData.scheduleData 全局共享
// ============================================
var app = getApp();
var util = require('../../utils/util');
var mockData = require('../../utils/mockData');

Page({
  data: {
    isAdmin: true,
    todayStr: '',
    activeFloor: 1,
    allZones: { floor1: [], floor2: [] },
    currentFloorZones: [],
    alertCount: 0,
    showPinchHint: true,
    canvasWidth: 1200,
    canvasHeight: 700,
    tappedZoneId: null,

    todayStats: [
      { key: 'total_sets', label: '今日洗涤(套)', value: '--', color: 'gold' },
      { key: 'running', label: '设备运行', value: '--', color: 'green' },
      { key: 'tasks_done', label: '任务完成', value: '--', color: 'blue' },
      { key: 'alerts', label: '告警', value: '--', color: 'red' },
    ],

    // 员工版：个人今日排班信息
    myScheduleZone: '',
    myScheduleColor: '#888',
    myScheduleCoworkers: [],

    // 排班沙盘
    allStaff: [],
    unassignedStaff: [],
    scheduleSlots: [],

    // ★ 移动弹窗状态
    showMoveModal: false,
    moveStaffId: null,
    moveStaffName: '',
    moveSourceZone: '',
    moveSourceZoneId: null,

    // ★ Phase 4: 物流派车弹窗状态
    showDispatchModal: false,
    dispatchStaffId: null,
    dispatchStaffName: '',
    dispatchTargetZoneId: null,
    dispatchSourceZoneId: null,
    fleetList: [],          // 可用车辆列表
    routeList: [],          // 可用路线列表
    selectedVehicleIdx: -1, // picker 选中的车辆索引
    selectedRouteIdx: -1,   // picker 选中的路线索引
    dispatchSubmitting: false,

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

    // Pipeline 管线数据
    pipelineLines: [],
  },

  onLoad: function () {
    this._loaded = true;
    this._lastLoadTime = Date.now();
    var isAdmin = app.globalData.accountRole === 'admin';
    var todayStats = isAdmin
      ? [
          { key: 'total_sets', label: '今日洗涤(套)', value: '--', color: 'gold' },
          { key: 'running', label: '设备运行', value: '--', color: 'green' },
          { key: 'tasks_done', label: '任务完成', value: '--', color: 'blue' },
          { key: 'alerts', label: '告警', value: '--', color: 'red' },
        ]
      : [
          { key: 'my_tasks', label: '我的任务', value: '--', color: 'blue' },
          { key: 'my_done', label: '已完成', value: '--', color: 'green' },
          { key: 'my_points', label: '今日积分', value: '--', color: 'gold' },
        ];
    this.setData({
      todayStr: util.formatDate(new Date(), 'YYYY年MM月DD日'),
      isAdmin: isAdmin,
      todayStats: todayStats,
    });
    this.loadAll();

    // 3秒后隐藏缩放提示
    var self = this;
    setTimeout(function () {
      self.setData({ showPinchHint: false });
    }, 3000);
  },

  onShow: function () {
    // 从全局同步排班数据（排班页可能已修改）
    this.syncFromGlobal();

    if (this._lastLoadTime && (Date.now() - this._lastLoadTime) < 2000) return;
    this._lastLoadTime = Date.now();
    this.loadAll();
  },

  // ============================================
  // 数据加载
  // ============================================
  loadAll: function () {
    var self = this;
    if (this.data.isAdmin) {
      this.loadZones(function () {
        self.loadStaff();
        self.loadTaskStats();
        self.loadTodayStats();
      });
    } else {
      // 员工版：加载个人排班 + 任务
      self.loadMySchedule();
      self.loadTaskStats();
    }
  },

  // ★ 员工版：加载个人今日排班
  loadMySchedule: function () {
    var self = this;
    var myId = (app.globalData.userInfo || {}).id;
    app.request({
      url: '/api/v1/users',
      success: function (res) {
        if (res.code !== 200) return;
        var allStaff = res.data || [];
        var me = null;
        for (var i = 0; i < allStaff.length; i++) {
          if (allStaff[i].id === myId) { me = allStaff[i]; break; }
        }
        if (!me || !me.current_zones || me.current_zones.length === 0) {
          self.setData({ myScheduleZone: '今日未分配工区', myScheduleColor: '#666', myScheduleCoworkers: [] });
          return;
        }

        app.request({
          url: '/api/v1/zones',
          success: function (zRes) {
            if (zRes.code !== 200) return;
            var zones = zRes.data || [];
            var myZoneCode = me.current_zones[0];
            var myZone = null;
            for (var j = 0; j < zones.length; j++) {
              if (zones[j].code === myZoneCode) { myZone = zones[j]; break; }
            }
            if (!myZone) {
              self.setData({ myScheduleZone: myZoneCode, myScheduleColor: '#888', myScheduleCoworkers: [] });
              return;
            }

            // 找同工区同事
            var coworkers = [];
            for (var k = 0; k < allStaff.length; k++) {
              var s = allStaff[k];
              if (s.id !== myId && s.current_zones && s.current_zones.indexOf(myZoneCode) !== -1) {
                coworkers.push({
                  id: s.id, name: s.name,
                  avatarColor: util.getAvatarColor(s.name),
                  nameInitial: util.getAvatarInitial(s.name),
                });
              }
            }
            self.setData({
              myScheduleZone: myZone.name,
              myScheduleColor: myZone.color || '#C9A84C',
              myScheduleCoworkers: coworkers,
            });
          },
        });
      },
    });
  },

  loadZones: function (callback) {
    var self = this;
    app.request({
      url: '/api/v1/zones',
      success: function (res) {
        if (res.code !== 200) { if (callback) callback(); return; }
        var rawZones = Array.isArray(res.data) ? res.data : [];
        var floor1 = [];
        var floor2 = [];
        var posMap = self._get25dPosMap();
        for (var i = 0; i < rawZones.length; i++) {
          var z = rawZones[i];
          var posKey = z.code || ('zone_' + z.id);
          var zone = {
            id: z.id, name: z.name, code: z.code || ('zone_' + z.id),
            floor: z.floor, color: z.color, status: z.status,
            capacity: z.capacity, staff_count: z.staff_count || 0,
            iot_summary: z.iot_summary || {}, iot_summary_text: z.iot_summary_text || '',
            description: z.description || '',
            pos: posMap[posKey] || z.pos || { left: '0%', top: '0%', width: '40%', height: '20%' },
            pipeline_order: z.pipeline_order || 0,
          };
          if (z.floor === 1) { floor1.push(zone); }
          else { floor2.push(zone); }
        }
        var allZones = { floor1: floor1, floor2: floor2 };
        var alertCount = rawZones.filter(function (z) { return z.status === 'alert' || z.status === 'warning'; }).length;
        self.setData({
          allZones: allZones, alertCount: alertCount,
          currentFloorZones: allZones.floor1,
        });
        self.updateTodayStats({ alerts: alertCount });
        self.buildPipelineLines();
        if (callback) callback();
      },
    });
  },

  loadStaff: function () {
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
            avatarColor: util.getAvatarColor(s.name),
            nameInitial: util.getAvatarInitial(s.name),
            current_zones: s.current_zones || [],
            skill_tags: s.skills || [],
            skills: s.skills || [],
            is_multi_post: s.is_multi_post || false,
            status: s.status || 'active',
            total_points: s.total_points || 0,
          });
        }

        var zones = (self.data.allZones.floor1 || []).concat(self.data.allZones.floor2 || []);
        var scheduleSlots = [];
        for (var j = 0; j < zones.length; j++) {
          var z = zones[j];
          var assigned = allStaff.filter(function (s) {
            return s.status !== 'leave' && (s.current_zones || []).indexOf(z.code) !== -1;
          });
          scheduleSlots.push({
            zone_id: z.id, zone_name: z.name, zone_code: z.code,
            color: z.color, capacity: z.capacity || 999,
            assigned: assigned,
          });
        }

        var assignedIdMap = {};
        for (var m = 0; m < scheduleSlots.length; m++) {
          for (var n = 0; n < scheduleSlots[m].assigned.length; n++) {
            assignedIdMap[scheduleSlots[m].assigned[n].id] = true;
          }
        }

        var unassignedStaff = allStaff.filter(function (s) {
          return !assignedIdMap[s.id] && s.status !== 'leave';
        });

        self.setData({ allStaff: allStaff, unassignedStaff: unassignedStaff, scheduleSlots: scheduleSlots });
        self.saveToGlobal();

        var runningCount = 0;
        for (var k = 0; k < allStaff.length; k++) {
          if (allStaff[k].status === 'active') runningCount++;
        }
        self.updateTodayStats({ running: runningCount });
      },
    });
  },

  loadTaskStats: function () {
    var self = this;
    app.request({
      url: '/api/v1/tasks/stats',
      success: function (res) {
        if (res.code !== 200) return;
        var stats = res.data;
        var pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
        self.setData({ taskStats: stats, taskProgressPct: pct });
        if (self.data.isAdmin) {
          self.updateTodayStats({ tasks_done: stats.done + '/' + stats.total });
        } else {
          // 员工版更新个人统计
          self.updateTodayStats({
            my_tasks: String(stats.total || 0),
            my_done: String(stats.done || 0),
            my_points: '+' + ((stats.done || 0) * 10),
          });
        }
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

  loadTodayStats: function () {
    this.updateTodayStats({ total_sets: '2,840' });
  },

  updateTodayStats: function (updates) {
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
  // ★ 全局数据同步
  // ============================================
  saveToGlobal: function () {
    app.globalData.scheduleData = {
      scheduleSlots: this.data.scheduleSlots,
      unassignedStaff: this.data.unassignedStaff,
      allStaff: this.data.allStaff,
      timestamp: Date.now(),
    };
  },

  syncFromGlobal: function () {
    var gd = app.globalData.scheduleData;
    if (!gd || !gd.timestamp) return;
    if (!this._lastSyncTime || gd.timestamp > this._lastSyncTime) {
      this._lastSyncTime = gd.timestamp;
      this.setData({
        scheduleSlots: gd.scheduleSlots || [],
        unassignedStaff: gd.unassignedStaff || [],
        allStaff: gd.allStaff || [],
      });
    }
  },

  // ============================================
  // ★ 长按员工卡 → 弹出工区选择器
  // ============================================
  onStaffLongPress: function (e) {
    var staffId = e.currentTarget.dataset.staffId;
    var sourceZone = e.currentTarget.dataset.sourceZone;

    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === staffId) {
        staff = this.data.allStaff[i];
        break;
      }
    }
    if (!staff) return;

    wx.vibrateShort({ type: 'medium' });

    var sourceZoneId = sourceZone ? parseInt(sourceZone, 10) : null;
    if (isNaN(sourceZoneId)) sourceZoneId = null;

    this.setData({
      showMoveModal: true,
      moveStaffId: staffId,
      moveStaffName: staff.name,
      moveSourceZone: sourceZone || '',
      moveSourceZoneId: sourceZoneId,
    });
  },

  closeMoveModal: function () {
    this.setData({ showMoveModal: false, moveStaffId: null });
  },

  // ★ 移动到指定工区 — 增加 zone_f 拦截逻辑
  onMoveToZone: function (e) {
    var targetZoneId = parseInt(e.currentTarget.dataset.zoneId, 10);
    if (isNaN(targetZoneId)) return;

    var staffId = this.data.moveStaffId;
    var sourceZoneId = this.data.moveSourceZoneId;

    if (targetZoneId === sourceZoneId) return;

    var targetSlot = null;
    for (var i = 0; i < this.data.scheduleSlots.length; i++) {
      if (this.data.scheduleSlots[i].zone_id === targetZoneId) {
        targetSlot = this.data.scheduleSlots[i];
        break;
      }
    }
    if (!targetSlot) {
      wx.showToast({ title: '工区不存在', icon: 'none' });
      return;
    }

    // ★★★ Phase 4 核心拦截：如果目标是机动物流区(zone_f)，弹出派车弹窗 ★★★
    if (targetSlot.zone_code === 'zone_f') {
      this.setData({ showMoveModal: false }); // 先关闭工区选择弹窗
      this._openDispatchModal(staffId, sourceZoneId, targetZoneId);
      return;
    }

    // 非物流区：走常规排班逻辑
    this.doAssign(staffId, sourceZoneId, targetZoneId);
    this.setData({ showMoveModal: false, moveStaffId: null });
  },

  // ★ 移回待分配池
  onMoveToUnassigned: function () {
    var staffId = this.data.moveStaffId;
    var sourceZoneId = this.data.moveSourceZoneId;
    if (!sourceZoneId) return;

    this.doUnassign(staffId, sourceZoneId);
    this.setData({ showMoveModal: false, moveStaffId: null });
  },

  // ============================================
  // ★★★ Phase 4: 物流派车弹窗逻辑 ★★★
  // ============================================

  /**
   * 打开派车弹窗 — 同时加载可用车辆和路线列表
   */
  _openDispatchModal: function (staffId, sourceZoneId, targetZoneId) {
    var self = this;
    var staffName = '';
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === staffId) {
        staffName = this.data.allStaff[i].name;
        break;
      }
    }

    // 先设置弹窗状态（显示 loading）
    this.setData({
      showDispatchModal: true,
      dispatchStaffId: staffId,
      dispatchStaffName: staffName,
      dispatchTargetZoneId: targetZoneId,
      dispatchSourceZoneId: sourceZoneId,
      selectedVehicleIdx: -1,
      selectedRouteIdx: -1,
      fleetList: [],
      routeList: [],
      dispatchSubmitting: false,
    });

    // 并行加载车辆和路线
    var loadCount = 0;
    var checkDone = function () {
      loadCount++;
      // 两个请求都完成后，如果没有可用车辆则提示
      if (loadCount >= 2 && self.data.fleetList.length === 0) {
        wx.showToast({ title: '暂无可用车辆', icon: 'none' });
      }
    };

    // 加载可用车辆（只取 idle 状态的）
    app.request({
      url: '/api/v1/vehicles/fleet/list?status=idle',
      success: function (res) {
        if (res.code === 200) {
          var list = (res.data || []).map(function (v) {
            return {
              id: v.id,
              label: v.plate_number + ' (' + (v.vehicle_type || '未知') + ')',
              plate_number: v.plate_number,
            };
          });
          self.setData({ fleetList: list });
        }
        checkDone();
      },
      fail: function () { checkDone(); },
    });

    // 加载所有路线
    app.request({
      url: '/api/v1/vehicles/routes/list',
      success: function (res) {
        if (res.code === 200) {
          var list = (res.data || []).map(function (r) {
            return {
              id: r.id,
              label: r.route_name + ' (' + (r.stops || []).length + '站)',
              route_name: r.route_name,
            };
          });
          self.setData({ routeList: list });
        }
        checkDone();
      },
      fail: function () { checkDone(); },
    });
  },

  /** 关闭派车弹窗 */
  closeDispatchModal: function () {
    this.setData({
      showDispatchModal: false,
      dispatchStaffId: null,
      dispatchStaffName: '',
      selectedVehicleIdx: -1,
      selectedRouteIdx: -1,
    });
  },

  /** Picker: 选择车辆 */
  onVehiclePickerChange: function (e) {
    this.setData({ selectedVehicleIdx: parseInt(e.detail.value, 10) });
  },

  /** Picker: 选择路线 */
  onRoutePickerChange: function (e) {
    this.setData({ selectedRouteIdx: parseInt(e.detail.value, 10) });
  },

  /**
   * ★ 确认派车 — 复合提交：
   *   1) POST /api/v1/schedule/assign  → 完成沙盘排班
   *   2) POST /api/v1/vehicles/dispatch/create → 生成出车调度单
   */
  onConfirmDispatch: function () {
    var self = this;
    var vIdx = this.data.selectedVehicleIdx;
    var rIdx = this.data.selectedRouteIdx;

    // 校验：车辆必选
    if (vIdx < 0 || vIdx >= this.data.fleetList.length) {
      wx.showToast({ title: '请选择车辆', icon: 'none' });
      return;
    }

    var vehicle = this.data.fleetList[vIdx];
    var route = rIdx >= 0 && rIdx < this.data.routeList.length ? this.data.routeList[rIdx] : null;
    var staffId = this.data.dispatchStaffId;
    var targetZoneId = this.data.dispatchTargetZoneId;
    var sourceZoneId = this.data.dispatchSourceZoneId;

    this.setData({ dispatchSubmitting: true });

    // Step 1: 先执行沙盘排班（乐观更新 UI）
    this.doAssign(staffId, sourceZoneId, targetZoneId);

    // Step 2: 创建出车调度单
    var dispatchData = {
      vehicle_id: vehicle.id,
      driver_id: staffId,
      work_date: util.today(),
    };
    if (route) {
      dispatchData.route_id = route.id;
    }

    app.request({
      url: '/api/v1/vehicles/dispatch/create',
      method: 'POST',
      data: dispatchData,
      success: function (res) {
        self.setData({ dispatchSubmitting: false });
        if (res.code === 200) {
          var staffName = self.data.dispatchStaffName;
          wx.showModal({
            title: '派车成功 🚛',
            content: staffName + ' → ' + vehicle.plate_number + (route ? '\n路线：' + route.route_name : '\n（无固定路线）'),
            showCancel: false,
            confirmText: '知道了',
          });
          self.closeDispatchModal();
        } else {
          wx.showToast({ title: res.message || '创建调度单失败', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ dispatchSubmitting: false });
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      },
    });
  },

  // ============================================
  // 核心操作：分配 / 取消分配
  // ============================================
  doAssign: function (staffId, sourceZoneId, targetZoneId) {
    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === staffId) { staff = this.data.allStaff[i]; break; }
    }
    if (!staff) return;

    var scheduleSlots = [];
    for (var j = 0; j < this.data.scheduleSlots.length; j++) {
      var slot = this.data.scheduleSlots[j];

      if (sourceZoneId && slot.zone_id === sourceZoneId) {
        var filtered = [];
        for (var k = 0; k < slot.assigned.length; k++) {
          if (slot.assigned[k].id !== staffId) filtered.push(slot.assigned[k]);
        }
        scheduleSlots.push({
          zone_id: slot.zone_id, zone_name: slot.zone_name, zone_code: slot.zone_code,
          color: slot.color, capacity: slot.capacity, assigned: filtered,
        });
      } else if (slot.zone_id === targetZoneId) {
        var newAssigned = slot.assigned.slice();
        var staffCopy = {};
        var sKeys = Object.keys(staff);
        for (var m = 0; m < sKeys.length; m++) { staffCopy[sKeys[m]] = staff[sKeys[m]]; }
        staffCopy.status = 'assigned';
        newAssigned.push(staffCopy);
        scheduleSlots.push({
          zone_id: slot.zone_id, zone_name: slot.zone_name, zone_code: slot.zone_code,
          color: slot.color, capacity: slot.capacity, assigned: newAssigned,
        });
      } else {
        scheduleSlots.push(slot);
      }
    }

    this._rebuildUnassigned(scheduleSlots);

    var targetSlot = null;
    for (var t = 0; t < scheduleSlots.length; t++) {
      if (scheduleSlots[t].zone_id === targetZoneId) { targetSlot = scheduleSlots[t]; break; }
    }
    wx.showToast({ title: staff.name + ' → ' + (targetSlot ? targetSlot.zone_name : '工区'), icon: 'success' });

    app.request({ url: '/api/v1/schedule/assign', method: 'POST', data: { user_id: staffId, zone_id: targetZoneId, date: util.today() } });
  },

  doUnassign: function (staffId, sourceZoneId) {
    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === staffId) { staff = this.data.allStaff[i]; break; }
    }
    if (!staff) return;

    var scheduleSlots = [];
    for (var j = 0; j < this.data.scheduleSlots.length; j++) {
      var slot = this.data.scheduleSlots[j];
      if (slot.zone_id === sourceZoneId) {
        var filtered = [];
        for (var k = 0; k < slot.assigned.length; k++) {
          if (slot.assigned[k].id !== staffId) filtered.push(slot.assigned[k]);
        }
        scheduleSlots.push({
          zone_id: slot.zone_id, zone_name: slot.zone_name, zone_code: slot.zone_code,
          color: slot.color, capacity: slot.capacity, assigned: filtered,
        });
      } else {
        scheduleSlots.push(slot);
      }
    }

    this._rebuildUnassigned(scheduleSlots);
    wx.showToast({ title: staff.name + ' 已移回待分配', icon: 'success' });

    app.request({ url: '/api/v1/schedule/remove', method: 'POST', data: { user_id: staffId, zone_id: sourceZoneId, date: util.today() } });
  },

  _rebuildUnassigned: function (scheduleSlots) {
    var assignedIdMap = {};
    for (var n = 0; n < scheduleSlots.length; n++) {
      for (var p = 0; p < scheduleSlots[n].assigned.length; p++) {
        assignedIdMap[scheduleSlots[n].assigned[p].id] = true;
      }
    }
    var unassignedStaff = [];
    for (var q = 0; q < this.data.allStaff.length; q++) {
      var s = this.data.allStaff[q];
      if (!assignedIdMap[s.id] && s.status !== 'leave') {
        unassignedStaff.push(s);
      }
    }
    this.setData({ scheduleSlots: scheduleSlots, unassignedStaff: unassignedStaff });
    this.saveToGlobal();
  },

  // ============================================
  // 2.5D 底图热区坐标映射
  // ============================================
  _get25dPosMap: function () {
    return {
      // F1 重工区（基于等轴测工厂图精确定位）
      zone_a: { left: '3%', top: '28%', width: '28%', height: '30%' },
      zone_b: { left: '3%', top: '60%', width: '28%', height: '22%' },
      zone_c: { left: '33%', top: '2%', width: '35%', height: '28%' },
      zone_d: { left: '33%', top: '32%', width: '35%', height: '28%' },
      zone_e: { left: '70%', top: '2%', width: '27%', height: '28%' },
      zone_f: { left: '60%', top: '62%', width: '37%', height: '35%' },
      zone_j: { left: '70%', top: '32%', width: '27%', height: '28%' },
      // F2 精洗区
      zone_g: { left: '25%', top: '2%', width: '30%', height: '28%' },
      zone_h: { left: '3%', top: '32%', width: '30%', height: '30%' },
      zone_i: { left: '20%', top: '64%', width: '35%', height: '32%' },
      zone_k: { left: '58%', top: '2%', width: '30%', height: '28%' },
      zone_l: { left: '58%', top: '32%', width: '38%', height: '30%' },
      zone_m: { left: '58%', top: '64%', width: '38%', height: '32%' },
    };
  },

  // Pipeline 已弃用（底图自带管线）
  buildPipelineLines: function () {
    this.setData({ pipelineLines: [] });
  },

  // ============================================
  // 楼层切换
  // ============================================
  switchFloor: function (e) {
    var floor = parseInt(e.currentTarget.dataset.floor, 10);
    if (floor === this.data.activeFloor) return;
    var zones = floor === 1 ? this.data.allZones.floor1 : this.data.allZones.floor2;
    // F1: 2048x1191 → 1200x698  F2: 2048x1143 → 1200x670
    var h = floor === 1 ? 700 : 670;
    this.setData({ activeFloor: floor, currentFloorZones: zones, canvasHeight: h, tappedZoneId: null });
  },

  // ============================================
  // 工区点击：高亮反馈 + 弹出详情
  // ============================================
  onZoneTap: function (e) {
    var zone = e.currentTarget.dataset.zone;
    if (!zone) return;

    // 点击高亮反馈
    var self = this;
    this.setData({ tappedZoneId: zone.id });
    setTimeout(function () {
      self.setData({ tappedZoneId: null });
    }, 600);

    // ★ 物流区(zone_f)：直接跳转到物流调度中台
    if (zone.code === 'zone_f') {
      wx.navigateTo({ url: '/pages/logistics-dashboard/index' });
      return;
    }

    var statusMap = { running: '运行中', idle: '待机', alert: '告警', maintenance: '维护中' };
    var sheetStats = [];
    var iot = zone.iot_summary || {};
    if (iot.running !== undefined) sheetStats.push({ label: '运行设备', value: iot.running, color: '#00FF88' });
    if (iot.idle !== undefined) sheetStats.push({ label: '空闲设备', value: iot.idle, color: '#888888' });
    if (iot.alert !== undefined) sheetStats.push({ label: '告警', value: iot.alert, color: '#EF4444' });
    if (iot.done !== undefined) sheetStats.push({ label: '已完成', value: iot.done, color: '#C9A84C' });
    if (iot.target !== undefined) sheetStats.push({ label: '目标', value: iot.target, color: '#3B82F6' });

    var items = [];
    var allDevices = mockData.IOT_DEVICES || [];
    for (var i = 0; i < allDevices.length; i++) {
      var d = allDevices[i];
      if (d.zone_id === zone.id) {
        items.push({
          id: d.id, name: d.name,
          icon: d.status === 'running' ? '⚡' : (d.status === 'alert' ? '⚠' : '⏸'),
          iconBg: d.status === 'running' ? 'rgba(0,255,136,0.1)' : (d.status === 'alert' ? 'rgba(239,68,68,0.1)' : 'rgba(136,136,136,0.1)'),
          sub: d.device_type,
          statusKey: d.status,
          statusLabel: d.status === 'running' ? '运行' : (d.status === 'alert' ? '告警' : '待机'),
          value: d.temp ? d.temp + '°C' : '',
        });
      }
    }

    this.setData({
      showZoneSheet: true,
      selectedZone: {
        id: zone.id, name: zone.name, code: zone.code,
        color: zone.color, status: zone.status,
        statusLabel: statusMap[zone.status] || zone.status,
        sheetStats: sheetStats, items: items,
      },
    });
  },

  closeZoneSheet: function () {
    this.setData({ showZoneSheet: false });
  },

  goZoneDetail: function () {
    var zone = this.data.selectedZone;
    this.setData({ showZoneSheet: false });
    wx.navigateTo({
      url: '/pages/zone-detail/index?zoneId=' + zone.id + '&zoneName=' + zone.name + '&zoneCode=' + zone.code,
    });
  },

  // ============================================
  // 告警 / 跳转
  // ============================================
  onAlertTap: function () {
    if (this.data.isAdmin) {
      wx.navigateTo({ url: '/pages/iot-dashboard/index' });
    } else {
      wx.showToast({ title: '员工版无此功能', icon: 'none' });
    }
  },

  // 员工版：跳转个人排班日历
  goMyCalendar: function () {
    wx.navigateTo({ url: '/pages/my-calendar/index' });
  },

  goSchedule: function () {
    wx.navigateTo({ url: '/pages/schedule/index' });
  },

  goTaskList: function () {
    wx.navigateTo({ url: '/pages/task-list/index' });
  },

  onTaskTap: function (e) {
    var task = e.currentTarget.dataset.task;
    wx.navigateTo({ url: '/pages/task-detail/index?taskId=' + task.id });
  },

  stopPropagation: function () {},
});
