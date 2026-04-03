// ============================================
// 排班管理页 JS
// WXS 拖拽回调：onWxsDragStart / onWxsDragEnd
// ============================================
const app = getApp();
const util = require('../../utils/util');

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

  onLoad() {
    const today = new Date();
    this.setSelectedDate(today);
    this.loadData();
  },

  setSelectedDate(date) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    this.setData({
      selectedDate: util.formatDate(date, 'YYYY-MM-DD'),
      selectedDateStr: util.formatDate(date, 'YYYY年MM月DD日'),
      selectedWeekday: weekdays[date.getDay()],
    });
  },

  prevDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() - 1);
    this.setSelectedDate(d);
    this.loadData();
  },

  nextDay() {
    const d = new Date(this.data.selectedDate);
    d.setDate(d.getDate() + 1);
    this.setSelectedDate(d);
    this.loadData();
  },

  goToday() {
    this.setSelectedDate(new Date());
    this.loadData();
  },

  showDatePicker() {
    wx.showToast({ title: '日期选择器功能即将上线', icon: 'none' });
  },

  loadData() {
    app.request({
      url: '/api/v1/users',
      success: (res) => {
        if (res.code !== 200) return;
        const allStaff = res.data.map(s => ({
          ...s,
          avatarColor: util.getAvatarColor(s.avatar_key),
          nameInitial: util.getAvatarInitial(s.name),
          roleLabel: util.getRoleLabel(s.role),
        }));

        app.request({
          url: '/api/v1/zones',
          success: (zRes) => {
            if (zRes.code !== 200) return;
            const allZones = [...zRes.data.floor1, ...zRes.data.floor2];
            const scheduleSlots = allZones.map(z => ({
              zone_id: z.id,
              zone_name: z.name,
              color: z.color,
              capacity: z.capacity,
              assigned: allStaff.filter(s => s.current_zones && s.current_zones.includes(z.code)),
            }));
            const assignedIds = new Set(scheduleSlots.flatMap(s => s.assigned.map(a => a.id)));
            const leaveStaff = allStaff.filter(s => s.status === 'leave');
            const leaveIds = new Set(leaveStaff.map(s => s.id));
            const unassignedStaff = allStaff.filter(s => !assignedIds.has(s.id) && !leaveIds.has(s.id));
            this.setData({
              allStaff, scheduleSlots, unassignedStaff, leaveStaff,
              summary: {
                total: allStaff.length,
                assigned: assignedIds.size,
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
  onWxsDragStart(params) {
    const staff = this.data.allStaff.find(s => s.id === params.staffId);
    if (!staff) return;
    this.setData({
      draggingStaffId: params.staffId,
      ghostName: staff.name,
      ghostNameInitial: staff.nameInitial,
      ghostAvatarColor: staff.avatarColor,
    });
  },

  onWxsDragEnd(params) {
    const { staffId, sourceZoneId, targetZoneId } = params;
    this.setData({ draggingStaffId: null });
    if (!targetZoneId || targetZoneId === sourceZoneId) return;

    const staff = this.data.allStaff.find(s => s.id === staffId);
    if (!staff) return;
    const targetSlot = this.data.scheduleSlots.find(s => s.zone_id === targetZoneId);
    if (!targetSlot) return;

    if (targetSlot.assigned.length >= targetSlot.capacity) {
      wx.showToast({ title: targetSlot.zone_name + ' 已满员', icon: 'none' });
      return;
    }

    if (!staff.is_multi_post && sourceZoneId) {
      wx.showModal({
        title: '确认调换工区',
        content: '将 ' + staff.name + ' 调至 ' + targetSlot.zone_name + '？',
        confirmColor: '#C9A84C',
        success: (res) => { if (res.confirm) this.doAssign(staffId, sourceZoneId, targetZoneId); },
      });
      return;
    }
    this.doAssign(staffId, sourceZoneId, targetZoneId);
  },

  doAssign(staffId, sourceZoneId, targetZoneId) {
    const staff = this.data.allStaff.find(s => s.id === staffId);
    if (!staff) return;
    const scheduleSlots = this.data.scheduleSlots.map(slot => {
      if (slot.zone_id === sourceZoneId) return { ...slot, assigned: slot.assigned.filter(s => s.id !== staffId) };
      if (slot.zone_id === targetZoneId) return { ...slot, assigned: [...slot.assigned, { ...staff, status: 'assigned' }] };
      return slot;
    });
    const assignedIds = new Set(scheduleSlots.flatMap(s => s.assigned.map(a => a.id)));
    const unassignedStaff = this.data.allStaff.filter(s => !assignedIds.has(s.id) && s.status !== 'leave');
    this.setData({ scheduleSlots, unassignedStaff, 'summary.assigned': assignedIds.size, 'summary.unassigned': unassignedStaff.length });
    app.request({ url: '/api/v1/schedule/assign', method: 'POST', data: { user_id: staffId, zone_id: targetZoneId, date: this.data.selectedDate } });
  },

  onRemoveStaff(e) {
    const { staffId, zoneId } = e.currentTarget.dataset;
    const staff = this.data.allStaff.find(s => s.id === staffId);
    if (!staff) return;
    wx.showModal({
      title: '移除排班', content: '确认将 ' + staff.name + ' 从该工区移除？', confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) return;
        const scheduleSlots = this.data.scheduleSlots.map(slot => {
          if (slot.zone_id === zoneId) return { ...slot, assigned: slot.assigned.filter(s => s.id !== staffId) };
          return slot;
        });
        const unassignedStaff = [...this.data.unassignedStaff, { ...staff, status: 'unassigned', current_zones: [] }];
        this.setData({ scheduleSlots, unassignedStaff });
        app.request({ url: '/api/v1/schedule/remove', method: 'POST', data: { user_id: staffId, zone_id: zoneId, date: this.data.selectedDate } });
      },
    });
  },

  saveSchedule() {
    const assignments = this.data.scheduleSlots.flatMap(slot => slot.assigned.map(s => ({ user_id: s.id, zone_id: slot.zone_id })));
    app.request({
      url: '/api/v1/schedule/save', method: 'POST',
      data: { date: this.data.selectedDate, assignments },
      success: (res) => { wx.showToast({ title: res.code === 200 ? '排班已保存' : '保存失败', icon: res.code === 200 ? 'success' : 'none' }); },
    });
  },

  copyYesterday() {
    wx.showModal({
      title: '复制昨日排班', content: '将昨日排班方案复制到今天？', confirmColor: '#C9A84C',
      success: (res) => {
        if (!res.confirm) return;
        app.request({
          url: '/api/v1/schedule/copy', method: 'POST',
          data: { from_date: util.getYesterday(), to_date: this.data.selectedDate },
          success: () => { wx.showToast({ title: '复制成功', icon: 'success' }); this.loadData(); },
        });
      },
    });
  },

  showLeaveModal() { this.setData({ showLeaveModal: true, selectedLeaveStaffId: null, leaveRemark: '' }); },
  closeLeaveModal() { this.setData({ showLeaveModal: false }); },
  selectLeaveStaff(e) { this.setData({ selectedLeaveStaffId: e.currentTarget.dataset.id }); },
  selectLeaveType(e) { this.setData({ selectedLeaveType: e.currentTarget.dataset.value }); },
  onLeaveRemarkInput(e) { this.setData({ leaveRemark: e.detail.value }); },

  submitLeave() {
    const { selectedLeaveStaffId, selectedLeaveType, leaveRemark, selectedDate } = this.data;
    if (!selectedLeaveStaffId) { wx.showToast({ title: '请选择员工', icon: 'none' }); return; }
    app.request({
      url: '/api/v1/leave/apply', method: 'POST',
      data: { user_id: selectedLeaveStaffId, leave_type: selectedLeaveType, date: selectedDate, remark: leaveRemark },
      success: (res) => {
        if (res.code === 200) { wx.showToast({ title: '请假申请已提交', icon: 'success' }); this.setData({ showLeaveModal: false }); this.loadData(); }
        else { wx.showToast({ title: '提交失败', icon: 'none' }); }
      },
    });
  },

  stopPropagation() {},
});
