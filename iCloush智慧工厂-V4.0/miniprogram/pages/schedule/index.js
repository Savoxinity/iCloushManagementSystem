// ============================================
// 排班管理页 V6
// 交互：长按员工卡 → 弹出工区选择器 → 点击目标工区完成移动
// 数据同步：通过 app.globalData.scheduleData 全局共享
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    selectedDate: null,
    selectedDateStr: '',
    selectedWeekday: '',

    summary: { total: 0, assigned: 0, unassigned: 0, leave: 0 },

    allStaff: [],
    unassignedStaff: [],
    leaveStaff: [],
    scheduleSlots: [],

    // ★ 移动弹窗状态
    showMoveModal: false,
    moveStaffId: null,
    moveStaffName: '',
    moveSourceZone: '',
    moveSourceZoneId: null,

    // 请假弹窗
    showLeaveModal: false,
    selectedLeaveStaffId: null,
    selectedLeaveType: 'sick',
    leaveRemark: '',
    leaveTypes: [
      { label: '病假', value: 'sick' },
      { label: '事假', value: 'personal' },
      { label: '年假', value: 'annual' },
      { label: '调休', value: 'compensatory' },
    ],
  },

  onLoad: function () {
    var today = new Date();
    this.setData({
      selectedDate: today,
      selectedDateStr: util.formatDate(today, 'YYYY年MM月DD日'),
      selectedWeekday: util.getWeekdayName(today),
    });
    this.loadScheduleData();
  },

  onShow: function () {
    this.syncFromGlobal();
  },

  // ============================================
  // 数据加载
  // ============================================
  loadScheduleData: function () {
    var self = this;
    app.request({
      url: '/api/v1/zones',
      success: function (zoneRes) {
        if (zoneRes.code !== 200) return;
        var zones = zoneRes.data || [];

        app.request({
          url: '/api/v1/users',
          success: function (userRes) {
            if (userRes.code !== 200) return;
            var rawUsers = userRes.data || [];

            var allStaff = [];
            for (var i = 0; i < rawUsers.length; i++) {
              var s = rawUsers[i];
              allStaff.push({
                id: s.id,
                name: s.name,
                role: s.role,
                roleLabel: util.getRoleLabel ? util.getRoleLabel(s.role) : '',
                avatarColor: util.getAvatarColor(s.name),
                nameInitial: util.getAvatarInitial(s.name),
                current_zones: s.current_zones || [],
                skills: s.skills || [],
                skill_tags: s.skills || [],
                is_multi_post: s.is_multi_post || false,
                status: s.status || 'active',
                total_points: s.total_points || 0,
              });
            }

            var scheduleSlots = [];
            for (var j = 0; j < zones.length; j++) {
              var z = zones[j];
              var assigned = allStaff.filter(function (staff) {
                return staff.status !== 'leave' && (staff.current_zones || []).indexOf(z.code) !== -1;
              });
              scheduleSlots.push({
                zone_id: z.id,
                zone_name: z.name,
                zone_code: z.code,
                color: z.color,
                capacity: z.capacity || 3,
                assigned: assigned,
              });
            }

            var assignedIdMap = {};
            for (var m = 0; m < scheduleSlots.length; m++) {
              for (var n = 0; n < scheduleSlots[m].assigned.length; n++) {
                assignedIdMap[scheduleSlots[m].assigned[n].id] = true;
              }
            }

            var unassignedStaff = [];
            var leaveStaff = [];
            for (var q = 0; q < allStaff.length; q++) {
              var staff = allStaff[q];
              if (staff.status === 'leave') {
                leaveStaff.push(staff);
              } else if (!assignedIdMap[staff.id]) {
                unassignedStaff.push(staff);
              }
            }

            self.setData({
              allStaff: allStaff,
              unassignedStaff: unassignedStaff,
              leaveStaff: leaveStaff,
              scheduleSlots: scheduleSlots,
            });
            self.updateSummary();
            self.saveToGlobal();
          },
        });
      },
    });
  },

  // ============================================
  // ★ 全局数据同步
  // ============================================
  saveToGlobal: function () {
    app.globalData.scheduleData = {
      scheduleSlots: this.data.scheduleSlots,
      unassignedStaff: this.data.unassignedStaff,
      leaveStaff: this.data.leaveStaff,
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
        leaveStaff: gd.leaveStaff || [],
        allStaff: gd.allStaff || [],
      });
      this.updateSummary();
    }
  },

  updateSummary: function () {
    var total = this.data.allStaff.length;
    var leave = this.data.leaveStaff.length;
    var unassigned = this.data.unassignedStaff.length;
    var assigned = total - leave - unassigned;
    this.setData({
      summary: { total: total, assigned: assigned, unassigned: unassigned, leave: leave },
    });
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

  // ★ 移动到指定工区
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
    if (!targetSlot || targetSlot.assigned.length >= targetSlot.capacity) {
      wx.showToast({ title: '该工区已满员', icon: 'none' });
      return;
    }

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

  // ★ 快捷移除按钮（×）
  onRemoveStaff: function (e) {
    var staffId = e.currentTarget.dataset.staffId;
    var zoneId = parseInt(e.currentTarget.dataset.zoneId, 10);
    if (!staffId || isNaN(zoneId)) return;

    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === staffId) { staff = this.data.allStaff[i]; break; }
    }
    if (!staff) return;

    var self = this;
    wx.showModal({
      title: '确认移除',
      content: '将 ' + staff.name + ' 移回待分配池？',
      confirmColor: '#C9A84C',
      success: function (res) {
        if (res.confirm) {
          self.doUnassign(staffId, zoneId);
        }
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
    this.updateSummary();
    this.saveToGlobal();
  },

  // ============================================
  // 日期导航
  // ============================================
  prevDay: function () {
    var d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() - 1);
    this.setData({
      selectedDate: d,
      selectedDateStr: util.formatDate(d, 'YYYY年MM月DD日'),
      selectedWeekday: util.getWeekdayName(d),
    });
  },

  nextDay: function () {
    var d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() + 1);
    this.setData({
      selectedDate: d,
      selectedDateStr: util.formatDate(d, 'YYYY年MM月DD日'),
      selectedWeekday: util.getWeekdayName(d),
    });
  },

  goToday: function () {
    var today = new Date();
    this.setData({
      selectedDate: today,
      selectedDateStr: util.formatDate(today, 'YYYY年MM月DD日'),
      selectedWeekday: util.getWeekdayName(today),
    });
  },

  showDatePicker: function () {
    wx.showToast({ title: '日期选择器开发中', icon: 'none' });
  },

  // ============================================
  // 底部操作
  // ============================================
  saveSchedule: function () {
    var self = this;
    app.request({
      url: '/api/v1/schedule/save',
      method: 'POST',
      data: { date: util.today(), slots: self.data.scheduleSlots },
      success: function () {
        wx.showToast({ title: '排班已保存', icon: 'success' });
      },
    });
  },

  copyYesterday: function () {
    var self = this;
    wx.showModal({
      title: '复制昨日排班',
      content: '将昨日排班方案复制到今天？',
      confirmColor: '#C9A84C',
      success: function (res) {
        if (res.confirm) {
          app.request({
            url: '/api/v1/schedule/copy',
            method: 'POST',
            data: { from_date: util.yesterday(), to_date: util.today() },
            success: function () {
              wx.showToast({ title: '复制成功', icon: 'success' });
              self.loadScheduleData();
            },
          });
        }
      },
    });
  },

  // ============================================
  // 请假弹窗
  // ============================================
  showLeaveModal: function () { this.setData({ showLeaveModal: true }); },
  closeLeaveModal: function () { this.setData({ showLeaveModal: false, selectedLeaveStaffId: null, leaveRemark: '' }); },

  selectLeaveStaff: function (e) {
    this.setData({ selectedLeaveStaffId: e.currentTarget.dataset.id });
  },

  selectLeaveType: function (e) {
    this.setData({ selectedLeaveType: e.currentTarget.dataset.value });
  },

  onLeaveRemarkInput: function (e) {
    this.setData({ leaveRemark: e.detail.value });
  },

  submitLeave: function () {
    if (!this.data.selectedLeaveStaffId) {
      wx.showToast({ title: '请选择员工', icon: 'none' });
      return;
    }
    var self = this;
    app.request({
      url: '/api/v1/leave',
      method: 'POST',
      data: {
        user_id: self.data.selectedLeaveStaffId,
        type: self.data.selectedLeaveType,
        remark: self.data.leaveRemark,
        date: util.today(),
      },
      success: function () {
        wx.showToast({ title: '请假申请已提交', icon: 'success' });
        self.closeLeaveModal();
      },
    });
  },

  stopPropagation: function () {},
});
