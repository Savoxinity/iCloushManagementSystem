// ============================================
// 排班管理页 JS
// WXS 拖拽回调：onWxsDragStart / onWxsDragEnd
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    selectedDate: '',
    selectedDateStr: '',
    selectedWeekday: '',
    summary: { total: 0, assigned: 0, unassigned: 0, leave: 0 },
    allStaff: [],
    unassignedStaff: [],
    leaveStaff: [],
    scheduleSlots: [],
    draggingStaffId: null,
    ghostName: '',
    ghostNameInitial: '',
    ghostAvatarColor: '#C9A84C',
    zoneRectsJson: '[]',
    hoverZoneId: null,
    showLeaveModal: false,
    selectedLeaveStaffId: null,
    selectedLeaveType: 'personal',
    leaveRemark: '',
    leaveTypes: [
      { label: '事假', value: 'personal' },
      { label: '病假', value: 'sick' },
      { label: '年假', value: 'annual' },
      { label: '调休', value: 'compensatory' },
    ],
  },

  onLoad: function () {
    var today = new Date();
    this.setSelectedDate(today);
    this.loadData();
  },

  setSelectedDate: function (date) {
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    this.setData({
      selectedDate: util.formatDate(date, 'YYYY-MM-DD'),
      selectedDateStr: util.formatDate(date, 'YYYY年MM月DD日'),
      selectedWeekday: weekdays[date.getDay()],
    });
  },

  prevDay: function () {
    var d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() - 1);
    this.setSelectedDate(d);
    this.loadData();
  },

  nextDay: function () {
    var d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() + 1);
    this.setSelectedDate(d);
    this.loadData();
  },

  goToday: function () {
    this.setSelectedDate(new Date());
    this.loadData();
  },

  showDatePicker: function () {
    wx.showToast({ title: '日期选择器功能即将上线', icon: 'none' });
  },

  loadData: function () {
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
            roleLabel: util.getRoleLabel(s.role),
            current_zones: s.current_zones || [],
            skills: s.skills || [],
            skill_tags: s.skills || [],
            is_multi_post: s.is_multi_post || false,
            status: s.status || 'active',
            total_points: s.total_points || 0,
          });
        }

        app.request({
          url: '/api/v1/zones',
          success: function (zRes) {
            if (zRes.code !== 200) return;
            // ★ 关键修复：Mock返回扁平数组，不是{floor1,floor2}对象
            var rawZones = Array.isArray(zRes.data) ? zRes.data : [];
            // 如果后端返回的是{floor1,floor2}对象，也兼容
            if (!Array.isArray(zRes.data) && zRes.data && zRes.data.floor1) {
              rawZones = (zRes.data.floor1 || []).concat(zRes.data.floor2 || []);
            }

            var scheduleSlots = [];
            for (var j = 0; j < rawZones.length; j++) {
              var z = rawZones[j];
              var assigned = [];
              for (var k = 0; k < allStaff.length; k++) {
                var zones = allStaff[k].current_zones || [];
                if (zones.indexOf(z.code) !== -1) {
                  assigned.push(allStaff[k]);
                }
              }
              scheduleSlots.push({
                zone_id: z.id,
                zone_name: z.name,
                color: z.color,
                capacity: z.capacity,
                assigned: assigned,
              });
            }

            // 收集已分配的员工ID
            var assignedIdMap = {};
            for (var m = 0; m < scheduleSlots.length; m++) {
              var slotAssigned = scheduleSlots[m].assigned;
              for (var n = 0; n < slotAssigned.length; n++) {
                assignedIdMap[slotAssigned[n].id] = true;
              }
            }

            var leaveStaff = [];
            var unassignedStaff = [];
            for (var p = 0; p < allStaff.length; p++) {
              if (allStaff[p].status === 'leave') {
                leaveStaff.push(allStaff[p]);
              } else if (!assignedIdMap[allStaff[p].id]) {
                unassignedStaff.push(allStaff[p]);
              }
            }

            var assignedCount = 0;
            var keys = Object.keys(assignedIdMap);
            assignedCount = keys.length;

            self.setData({
              allStaff: allStaff,
              scheduleSlots: scheduleSlots,
              unassignedStaff: unassignedStaff,
              leaveStaff: leaveStaff,
              summary: {
                total: allStaff.length,
                assigned: assignedCount,
                unassigned: unassignedStaff.length,
                leave: leaveStaff.length,
              },
            });
          },
        });
      },
    });
  },

  // WXS 拖拽回调
  onWxsDragStart: function (params) {
    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === params.staffId) {
        staff = this.data.allStaff[i]; break;
      }
    }
    if (!staff) return;
    this.setData({
      draggingStaffId: params.staffId,
      ghostName: staff.name,
      ghostNameInitial: staff.nameInitial,
      ghostAvatarColor: staff.avatarColor,
    });
    // 计算所有工区 slot 的屏幕位置，传递给 WXS
    this.updateZoneRects();
  },

  updateZoneRects: function () {
    var self = this;
    var slots = this.data.scheduleSlots;
    var selectors = [];
    for (var i = 0; i < slots.length; i++) {
      selectors.push('#slot-' + slots[i].zone_id);
    }
    var query = wx.createSelectorQuery().in(this);
    for (var j = 0; j < selectors.length; j++) {
      query.select(selectors[j]).boundingClientRect();
    }
    query.exec(function (results) {
      var rects = [];
      for (var k = 0; k < results.length; k++) {
        var r = results[k];
        if (!r) continue;
        rects.push({
          zoneId: slots[k].zone_id,
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom
        });
      }
      self.setData({ zoneRectsJson: JSON.stringify(rects) });
    });
  },

  onWxsDragHover: function (params) {
    // 高亮命中的工区
    var rects = [];
    try { rects = JSON.parse(this.data.zoneRectsJson); } catch (e) { rects = []; }
    var hitId = null;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (params.x >= r.left && params.x <= r.right && params.y >= r.top && params.y <= r.bottom) {
        hitId = r.zoneId;
        break;
      }
    }
    if (hitId !== this.data.hoverZoneId) {
      this.setData({ hoverZoneId: hitId });
    }
  },

  onWxsDragEnd: function (params) {
    var staffId = params.staffId;
    var sourceZoneId = params.sourceZoneId;
    var targetZoneId = params.targetZoneId;
    this.setData({ draggingStaffId: null, hoverZoneId: null });
    if (!targetZoneId || targetZoneId === sourceZoneId) return;

    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === staffId) { staff = this.data.allStaff[i]; break; }
    }
    if (!staff) return;

    var targetSlot = null;
    for (var j = 0; j < this.data.scheduleSlots.length; j++) {
      if (this.data.scheduleSlots[j].zone_id === targetZoneId) {
        targetSlot = this.data.scheduleSlots[j]; break;
      }
    }
    if (!targetSlot) return;

    if (targetSlot.assigned.length >= targetSlot.capacity) {
      wx.showToast({ title: targetSlot.zone_name + ' 已满员', icon: 'none' });
      return;
    }

    var self = this;
    if (!staff.is_multi_post && sourceZoneId) {
      wx.showModal({
        title: '确认调换工区',
        content: '将 ' + staff.name + ' 调至 ' + targetSlot.zone_name + '？',
        confirmColor: '#C9A84C',
        success: function (res) { if (res.confirm) self.doAssign(staffId, sourceZoneId, targetZoneId); },
      });
      return;
    }
    this.doAssign(staffId, sourceZoneId, targetZoneId);
  },

  doAssign: function (staffId, sourceZoneId, targetZoneId) {
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
        scheduleSlots.push({ zone_id: slot.zone_id, zone_name: slot.zone_name, color: slot.color, capacity: slot.capacity, assigned: filtered });
      } else if (slot.zone_id === targetZoneId) {
        var newAssigned = slot.assigned.slice();
        var staffCopy = {};
        var sKeys = Object.keys(staff);
        for (var m = 0; m < sKeys.length; m++) { staffCopy[sKeys[m]] = staff[sKeys[m]]; }
        staffCopy.status = 'assigned';
        newAssigned.push(staffCopy);
        scheduleSlots.push({ zone_id: slot.zone_id, zone_name: slot.zone_name, color: slot.color, capacity: slot.capacity, assigned: newAssigned });
      } else {
        scheduleSlots.push(slot);
      }
    }

    // 收集已分配ID
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

    this.setData({
      scheduleSlots: scheduleSlots,
      unassignedStaff: unassignedStaff,
      'summary.assigned': Object.keys(assignedIdMap).length,
      'summary.unassigned': unassignedStaff.length,
    });

    app.request({
      url: '/api/v1/schedule/assign',
      method: 'POST',
      data: { user_id: staffId, zone_id: targetZoneId, date: this.data.selectedDate },
    });
  },

  onRemoveStaff: function (e) {
    var staffId = e.currentTarget.dataset.staffId;
    var zoneId = e.currentTarget.dataset.zoneId;
    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === staffId) { staff = this.data.allStaff[i]; break; }
    }
    if (!staff) return;
    var self = this;
    wx.showModal({
      title: '移除排班',
      content: '确认将 ' + staff.name + ' 从该工区移除？',
      confirmColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) return;
        var scheduleSlots = [];
        for (var j = 0; j < self.data.scheduleSlots.length; j++) {
          var slot = self.data.scheduleSlots[j];
          if (slot.zone_id === zoneId) {
            var filtered = [];
            for (var k = 0; k < slot.assigned.length; k++) {
              if (slot.assigned[k].id !== staffId) filtered.push(slot.assigned[k]);
            }
            scheduleSlots.push({ zone_id: slot.zone_id, zone_name: slot.zone_name, color: slot.color, capacity: slot.capacity, assigned: filtered });
          } else {
            scheduleSlots.push(slot);
          }
        }
        var staffCopy = {};
        var sKeys = Object.keys(staff);
        for (var m = 0; m < sKeys.length; m++) { staffCopy[sKeys[m]] = staff[sKeys[m]]; }
        staffCopy.status = 'unassigned';
        staffCopy.current_zones = [];
        var unassignedStaff = self.data.unassignedStaff.slice();
        unassignedStaff.push(staffCopy);
        self.setData({ scheduleSlots: scheduleSlots, unassignedStaff: unassignedStaff });
        app.request({ url: '/api/v1/schedule/remove', method: 'POST', data: { user_id: staffId, zone_id: zoneId, date: self.data.selectedDate } });
      },
    });
  },

  saveSchedule: function () {
    var assignments = [];
    for (var i = 0; i < this.data.scheduleSlots.length; i++) {
      var slot = this.data.scheduleSlots[i];
      for (var j = 0; j < slot.assigned.length; j++) {
        assignments.push({ user_id: slot.assigned[j].id, zone_id: slot.zone_id });
      }
    }
    app.request({
      url: '/api/v1/schedule/save',
      method: 'POST',
      data: { date: this.data.selectedDate, assignments: assignments },
      success: function (res) {
        wx.showToast({ title: res.code === 200 ? '排班已保存' : '保存失败', icon: res.code === 200 ? 'success' : 'none' });
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
        if (!res.confirm) return;
        app.request({
          url: '/api/v1/schedule/copy',
          method: 'POST',
          data: { from_date: util.getYesterday(), to_date: self.data.selectedDate },
          success: function () {
            wx.showToast({ title: '复制成功', icon: 'success' });
            self.loadData();
          },
        });
      },
    });
  },

  showLeaveModal: function () { this.setData({ showLeaveModal: true, selectedLeaveStaffId: null, leaveRemark: '' }); },
  closeLeaveModal: function () { this.setData({ showLeaveModal: false }); },
  selectLeaveStaff: function (e) { this.setData({ selectedLeaveStaffId: e.currentTarget.dataset.id }); },
  selectLeaveType: function (e) { this.setData({ selectedLeaveType: e.currentTarget.dataset.value }); },
  onLeaveRemarkInput: function (e) { this.setData({ leaveRemark: e.detail.value }); },

  submitLeave: function () {
    var selectedLeaveStaffId = this.data.selectedLeaveStaffId;
    var selectedLeaveType = this.data.selectedLeaveType;
    var leaveRemark = this.data.leaveRemark;
    var selectedDate = this.data.selectedDate;
    var self = this;
    if (!selectedLeaveStaffId) { wx.showToast({ title: '请选择员工', icon: 'none' }); return; }
    app.request({
      url: '/api/v1/leave/apply',
      method: 'POST',
      data: { user_id: selectedLeaveStaffId, leave_type: selectedLeaveType, date: selectedDate, remark: leaveRemark },
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: '请假申请已提交', icon: 'success' });
          self.setData({ showLeaveModal: false });
          self.loadData();
        } else {
          wx.showToast({ title: '提交失败', icon: 'none' });
        }
      },
    });
  },

  stopPropagation: function () {},
});
