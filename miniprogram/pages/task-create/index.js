// ============================================
// 任务发布控制台 — Task Command Console
// 权限：班组长(3)及以上可发布
// ============================================
var app = getApp();
var util = require('../../utils/util');
var mockData = require('../../utils/mockData');

Page({
  data: {
    // 权限
    canCreate: false,
    userRole: 1,

    // 表单字段
    title: '',
    description: '',
    taskType: 'routine',      // routine | periodic | specific
    priority: 2,              // 1低 2普通 3高 4紧急
    zoneId: '',
    zoneName: '',
    deadline: '',
    target: '',
    unit: '件',
    pointsReward: 10,
    intervalDays: '',          // 周期任务间隔天数

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
  },

  onLoad: function () {
    var userInfo = app.globalData.userInfo || {};
    var role = userInfo.role || 1;
    var canCreate = role >= 3;

    // 设置最小日期为今天
    var now = new Date();
    var minDate = util.formatDate(now, 'YYYY-MM-DD');

    this.setData({
      canCreate: canCreate,
      userRole: role,
      minDate: minDate,
      deadline: minDate,
    });

    if (!canCreate) {
      wx.showModal({
        title: '权限不足',
        content: '仅班组长及以上角色可发布任务',
        showCancel: false,
        success: function () { wx.navigateBack(); },
      });
      return;
    }

    this.loadZones();
    this.loadStaff();
  },

  // ── 加载工区列表 ──────────────────────────────────────────
  loadZones: function () {
    var self = this;
    app.request({
      url: '/api/v1/zones',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var zones = res.data || [];
          self.setData({ zones: zones });
          // 默认选中第一个
          if (zones.length > 0) {
            self.setData({ zoneId: zones[0].id, zoneName: zones[0].name });
          }
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
        }
      },
    });
  },

  // ── 表单输入事件 ──────────────────────────────────────────
  onTitleInput: function (e) {
    this.setData({ title: e.detail.value });
  },

  onDescInput: function (e) {
    this.setData({ description: e.detail.value });
  },

  onTypeSelect: function (e) {
    this.setData({ taskType: e.currentTarget.dataset.value });
  },

  onPrioritySelect: function (e) {
    this.setData({ priority: Number(e.currentTarget.dataset.value) });
  },

  onZoneSelect: function (e) {
    var idx = e.detail.value;
    var zone = this.data.zones[idx];
    if (zone) {
      this.setData({ zoneId: zone.id, zoneName: zone.name });
    }
  },

  onDeadlineChange: function (e) {
    this.setData({ deadline: e.detail.value });
  },

  onTargetInput: function (e) {
    this.setData({ target: e.detail.value });
  },

  onUnitSelect: function (e) {
    var idx = e.detail.value;
    this.setData({ unit: this.data.units[idx] });
  },

  onPointsInput: function (e) {
    this.setData({ pointsReward: Number(e.detail.value) || 0 });
  },

  onIntervalInput: function (e) {
    var val = Number(e.detail.value) || '';
    this.setData({ intervalDays: val });
  },

  onPresetInterval: function (e) {
    var days = Number(e.currentTarget.dataset.days);
    this.setData({ intervalDays: days });
  },

  // ── 员工选择器 ──────────────────────────────────────────
  openStaffPicker: function () {
    this.setData({ showStaffPicker: true });
  },

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
    if (!key) {
      this.setData({ filteredStaff: all });
      return;
    }
    var result = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].name.toLowerCase().indexOf(key) !== -1) {
        result.push(all[i]);
      }
    }
    this.setData({ filteredStaff: result });
  },

  toggleStaff: function (e) {
    var staffId = e.currentTarget.dataset.id;
    var allStaff = this.data.allStaff;
    var selectedStaff = [];
    for (var i = 0; i < allStaff.length; i++) {
      if (allStaff[i].id === staffId) {
        allStaff[i].selected = !allStaff[i].selected;
      }
      if (allStaff[i].selected) {
        selectedStaff.push(allStaff[i]);
      }
    }
    this.setData({ allStaff: allStaff, selectedStaff: selectedStaff });
    this.filterStaff();
  },

  removeStaff: function (e) {
    var staffId = e.currentTarget.dataset.id;
    var allStaff = this.data.allStaff;
    var selectedStaff = [];
    for (var i = 0; i < allStaff.length; i++) {
      if (allStaff[i].id === staffId) {
        allStaff[i].selected = false;
      }
      if (allStaff[i].selected) {
        selectedStaff.push(allStaff[i]);
      }
    }
    this.setData({ allStaff: allStaff, selectedStaff: selectedStaff });
    this.filterStaff();
  },

  // ── 提交任务 ──────────────────────────────────────────────
  onSubmit: function () {
    var self = this;
    var data = this.data;

    // 校验
    if (!data.title.trim()) {
      util.showError('请输入任务标题');
      return;
    }
    if (!data.zoneId) {
      util.showError('请选择工区');
      return;
    }
    if (!data.deadline) {
      util.showError('请选择截止时间');
      return;
    }
    if (data.taskType === 'periodic' && (!data.intervalDays || data.intervalDays < 1)) {
      util.showError('周期任务请设置间隔天数（至少1天）');
      return;
    }

    self.setData({ submitting: true });

    var assignedTo = [];
    for (var i = 0; i < data.selectedStaff.length; i++) {
      assignedTo.push(data.selectedStaff[i].id);
    }

    var taskData = {
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
      interval_days: data.taskType === 'periodic' ? (Number(data.intervalDays) || 0) : 0,
      is_recurring: data.taskType === 'periodic',
      next_publish_date: data.taskType === 'periodic' ? this._calcNextPublishDate(data.deadline, data.intervalDays) : '',
    };

    app.request({
      url: '/api/v1/tasks',
      method: 'POST',
      data: taskData,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          var msg = '任务发布成功';
          if (data.taskType === 'periodic') {
            msg = '周期任务已发布，每' + data.intervalDays + '天自动重复';
          }
          wx.showToast({ title: msg, icon: 'success', duration: 2000 });
          setTimeout(function () {
            wx.navigateBack();
          }, 1500);
        } else {
          util.showError(res.message || '发布失败');
        }
      },
    });
  },

  // 计算下次自动发布日期
  _calcNextPublishDate: function (deadline, intervalDays) {
    if (!deadline || !intervalDays) return '';
    var d = new Date(deadline);
    d.setDate(d.getDate() + Number(intervalDays));
    var y = d.getFullYear();
    var m = (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
    var day = (d.getDate() < 10 ? '0' : '') + d.getDate();
    return y + '-' + m + '-' + day;
  },
});
