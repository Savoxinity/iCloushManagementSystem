// ============================================
// 任务列表页
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    allTasks: [],
    filteredTasks: [],
    activeStatus: 'all',
    activeType: 'all',
    canCreate: false,
    statusFilters: [
      { label: '全部', value: 'all', count: 0 },
      { label: '待接单', value: '0', count: 0 },
      { label: '进行中', value: '2', count: 0 },
      { label: '待审核', value: '3', count: 0 },
      { label: '已完成', value: '4', count: 0 },
    ],
    typeFilters: [
      { label: '全部类型', value: 'all' },
      { label: '日常', value: 'routine' },
      { label: '周期', value: 'periodic' },
      { label: '特定', value: 'specific' },
    ],
  },

  onLoad: function (options) {
    var userInfo = app.globalData.userInfo || {};
    this.setData({ canCreate: (userInfo.role || 1) >= 3 });
    this.loadTasks();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadTasks(function () { wx.stopPullDownRefresh(); });
  },

  loadTasks: function (callback) {
    var self = this;
    app.request({
      url: '/api/v1/tasks',
      success: function (res) {
        if (res.code !== 200) return;
        var rawTasks = res.data || [];
        var allTasks = [];
        for (var i = 0; i < rawTasks.length; i++) {
          var t = rawTasks[i];
          allTasks.push({
            id: t.id, title: t.title, task_type: t.task_type,
            zone_id: t.zone_id, zone_name: t.zone_name,
            status: t.status, priority: t.priority,
            points_reward: t.points_reward,
            progress: t.progress, target: t.target, unit: t.unit,
            requires_photo: t.requires_photo,
            description: t.description, deadline: t.deadline,
            assigned_to: t.assigned_to,
            typeLabel: util.getTaskTypeLabel(t.task_type),
            statusLabel: util.getTaskStatusLabel(t.status),
            deadlineText: t.deadline ? util.getCountdown(t.deadline) : '',
            progressPct: t.target ? Math.round((t.progress / t.target) * 100) : 0,
            assigneeName: null,
            assigneeColor: '#C9A84C',
          });
        }

        // 更新筛选器计数
        var statusFilters = [];
        for (var j = 0; j < self.data.statusFilters.length; j++) {
          var f = self.data.statusFilters[j];
          var count = 0;
          if (f.value === 'all') {
            count = allTasks.length;
          } else {
            for (var k = 0; k < allTasks.length; k++) {
              if (String(allTasks[k].status) === f.value) count++;
            }
          }
          statusFilters.push({ label: f.label, value: f.value, count: count });
        }

        self.setData({ allTasks: allTasks, statusFilters: statusFilters });
        self.applyFilter();
        if (callback) callback();
      },
    });
  },

  onStatusFilter: function (e) {
    this.setData({ activeStatus: e.currentTarget.dataset.value });
    this.applyFilter();
  },

  onTypeFilter: function (e) {
    this.setData({ activeType: e.currentTarget.dataset.value });
    this.applyFilter();
  },

  applyFilter: function () {
    var allTasks = this.data.allTasks;
    var activeStatus = this.data.activeStatus;
    var activeType = this.data.activeType;
    var result = [];
    for (var i = 0; i < allTasks.length; i++) {
      var t = allTasks[i];
      if (activeStatus !== 'all' && String(t.status) !== activeStatus) continue;
      if (activeType !== 'all' && t.task_type !== activeType) continue;
      result.push(t);
    }
    this.setData({ filteredTasks: result });
  },

  onTaskTap: function (e) {
    var task = e.currentTarget.dataset.task;
    wx.navigateTo({ url: '/pages/task-detail/index?taskId=' + task.id });
  },

  onCreateTask: function () {
    wx.showToast({ title: '任务创建功能即将上线', icon: 'none' });
  },
});
