// ============================================
// 任务编辑页 — Task Edit Console
// 权限：班组长(3)及以上可编辑
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    taskId: '',
    canEdit: false,
    originalTask: null,

    // 表单字段
    title: '',
    description: '',
    taskType: 'routine',
    priority: 2,
    zoneId: '',
    zoneName: '',
    deadline: '',
    target: '',
    unit: '件',
    pointsReward: 10,

    // 选择器数据
    taskTypes: [
      { label: '日常任务', value: 'routine', desc: '每日常规工作' },
      { label: '周期任务', value: 'periodic', desc: '按周期重复执行' },
      { label: '特定任务', value: 'specific', desc: '一次性专项任务' },
    ],
    priorities: [
      { label: '低', value: 1, color: '#888888' },
      { label: '普通', value: 2, color: '#3B82F6' },
      { label: '高', value: 3, color: '#F59E0B' },
      { label: '紧急', value: 4, color: '#EF4444' },
    ],
    zones: [],
    units: ['件', 'KG', '车', '批', '套'],

    // 指派员工
    showStaffPicker: false,
    allStaff: [],
    filteredStaff: [],
    selectedStaff: [],
    staffSearchKey: '',

    // 截止时间
    minDate: '',

    // 提交状态
    submitting: false,
    // 当前任务状态（用于限制某些字段的编辑）
    taskStatus: 0,
  },

  onLoad: function (options) {
    var userInfo = app.globalData.userInfo || {};
    var role = userInfo.role || 1;
    var canEdit = role >= 3;

    var now = new Date();
    var minDate = util.formatDate(now, 'YYYY-MM-DD');

    this.setData({
      taskId: options.taskId || '',
      canEdit: canEdit,
      minDate: minDate,
    });

    if (!canEdit) {
      wx.showModal({
        title: '权限不足',
        content: '仅班组长及以上角色可编辑任务',
        showCancel: false,
        success: function () { wx.navigateBack(); },
      });
      return;
    }

    this.loadZones();
    this.loadStaff();
    this.loadTask(options.taskId);
  },

  // ── 加载工区列表 ──────────────────────────────────────────
  loadZones: function () {
    var self = this;
    app.request({
      url: '/api/v1/zones',
      success: function (res) {
        if (res.code === 200 && res.data) {
          self.setData({ zones: res.data || [] });
        }
      },
    });
  },

  // ── 加载员工列表 ──────────────────────────────────────────
  loadStaff: function () {
    var self = this;
    app.request({
      url: '/api/v1/users',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var staff = [];
          var users = res.data || [];
          for (var i = 0; i < users.length; i++) {
            var u = users[i];
            staff.push({
              id: u.id,
              name: u.name,
              role: u.role,
              roleLabel: util.getRoleLabel(u.role),
              skills: u.skill_tags || u.skills || [],
              avatarColor: util.getAvatarColor(u.name),
              initial: util.getAvatarInitial(u.name),
              selected: false,
            });
          }
          self.setData({ allStaff: staff, filteredStaff: staff });
          // 加载完员工后，如果任务已加载，标记已选员工
          if (self.data.originalTask) {
            self._markSelectedStaff(self.data.originalTask.assigned_to);
          }
        }
      },
    });
  },

  // ── 加载任务数据 ──────────────────────────────────────────
  loadTask: function (taskId) {
    var self = this;
    wx.showLoading({ title: '加载中...' });
    app.request({
      url: '/api/v1/tasks',
      success: function (res) {
        wx.hideLoading();
        if (res.code !== 200) return;
        var rawList = res.data || [];
        var raw = null;
        for (var i = 0; i < rawList.length; i++) {
          if (String(rawList[i].id) === String(taskId)) { raw = rawList[i]; break; }
        }
        if (!raw) {
          wx.showToast({ title: '任务不存在', icon: 'none' });
          setTimeout(function () { wx.navigateBack(); }, 1500);
          return;
        }

        self.setData({
          originalTask: raw,
          title: raw.title || '',
          description: raw.description || '',
          taskType: raw.task_type || 'routine',
          priority: raw.priority || 2,
          zoneId: raw.zone_id || '',
          zoneName: raw.zone_name || '',
          deadline: raw.deadline ? raw.deadline.split('T')[0] : '',
          target: raw.target ? String(raw.target) : '',
          unit: raw.unit || '件',
          pointsReward: raw.points_reward || 10,
          taskStatus: raw.status || 0,
        });

        wx.setNavigationBarTitle({ title: '编辑: ' + (raw.title || '').slice(0, 8) });

        // 标记已选员工
        if (self.data.allStaff.length > 0) {
          self._markSelectedStaff(raw.assigned_to);
        }
      },
    });
  },

  // ── 标记已选员工 ──────────────────────────────────────────
  _markSelectedStaff: function (assignedTo) {
    if (!assignedTo) return;
    var assigneeIds = [];
    if (Array.isArray(assignedTo)) {
      assigneeIds = assignedTo;
    } else {
      assigneeIds = [assignedTo];
    }

    var allStaff = this.data.allStaff;
    var selectedStaff = [];
    for (var i = 0; i < allStaff.length; i++) {
      var found = false;
      for (var j = 0; j < assigneeIds.length; j++) {
        if (String(allStaff[i].id) === String(assigneeIds[j])) {
          found = true;
          break;
        }
      }
      allStaff[i].selected = found;
      if (found) selectedStaff.push(allStaff[i]);
    }
    this.setData({ allStaff: allStaff, selectedStaff: selectedStaff, filteredStaff: allStaff });
  },

  // ── 表单输入事件（与 task-create 相同）──────────────────
  onTitleInput: function (e) { this.setData({ title: e.detail.value }); },
  onDescInput: function (e) { this.setData({ description: e.detail.value }); },
  onTypeSelect: function (e) { this.setData({ taskType: e.currentTarget.dataset.value }); },
  onPrioritySelect: function (e) { this.setData({ priority: Number(e.currentTarget.dataset.value) }); },
  onZoneSelect: function (e) {
    var idx = e.detail.value;
    var zone = this.data.zones[idx];
    if (zone) { this.setData({ zoneId: zone.id, zoneName: zone.name }); }
  },
  onDeadlineChange: function (e) { this.setData({ deadline: e.detail.value }); },
  onTargetInput: function (e) { this.setData({ target: e.detail.value }); },
  onUnitSelect: function (e) { this.setData({ unit: this.data.units[e.detail.value] }); },
  onPointsInput: function (e) { this.setData({ pointsReward: Number(e.detail.value) || 0 }); },

  // ── 员工选择器 ──────────────────────────────────────────
  openStaffPicker: function () { this.setData({ showStaffPicker: true }); },
  closeStaffPicker: function () {
    this.setData({ showStaffPicker: false, staffSearchKey: '' });
    this.filterStaff();
  },
  onStaffSearch: function (e) {
    this.setData({ staffSearchKey: e.detail.value });
    this.filterStaff();
  },
  filterStaff: function () {
    var key = this.data.staffSearchKey.trim().toLowerCase();
    var all = this.data.allStaff;
    if (!key) { this.setData({ filteredStaff: all }); return; }
    var result = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].name.toLowerCase().indexOf(key) !== -1) result.push(all[i]);
    }
    this.setData({ filteredStaff: result });
  },
  toggleStaff: function (e) {
    var staffId = e.currentTarget.dataset.id;
    var allStaff = this.data.allStaff;
    var selectedStaff = [];
    for (var i = 0; i < allStaff.length; i++) {
      if (allStaff[i].id === staffId) allStaff[i].selected = !allStaff[i].selected;
      if (allStaff[i].selected) selectedStaff.push(allStaff[i]);
    }
    this.setData({ allStaff: allStaff, selectedStaff: selectedStaff });
    this.filterStaff();
  },
  removeStaff: function (e) {
    var staffId = e.currentTarget.dataset.id;
    var allStaff = this.data.allStaff;
    var selectedStaff = [];
    for (var i = 0; i < allStaff.length; i++) {
      if (allStaff[i].id === staffId) allStaff[i].selected = false;
      if (allStaff[i].selected) selectedStaff.push(allStaff[i]);
    }
    this.setData({ allStaff: allStaff, selectedStaff: selectedStaff });
    this.filterStaff();
  },

  // ── 提交编辑 ──────────────────────────────────────────────
  onSubmit: function () {
    var self = this;
    var data = this.data;

    if (!data.title.trim()) { util.showError('请输入任务标题'); return; }
    if (!data.zoneId) { util.showError('请选择工区'); return; }
    if (!data.deadline) { util.showError('请选择截止时间'); return; }

    self.setData({ submitting: true });

    var assignedTo = [];
    for (var i = 0; i < data.selectedStaff.length; i++) {
      assignedTo.push(data.selectedStaff[i].id);
    }

    var updateData = {
      title: data.title.trim(),
      description: data.description.trim(),
      task_type: data.taskType,
      priority: data.priority,
      zone_id: data.zoneId,
      zone_name: data.zoneName,
      deadline: data.deadline + 'T23:59:59',
      target: Number(data.target) || 0,
      unit: data.unit,
      points_reward: data.pointsReward,
      assigned_to: assignedTo,
    };

    app.request({
      url: '/api/v1/tasks/' + data.taskId + '/edit',
      method: 'POST',
      data: updateData,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: '任务更新成功', icon: 'success' });
          setTimeout(function () { wx.navigateBack(); }, 1500);
        } else {
          util.showError(res.message || '更新失败');
        }
      },
    });
  },
});
