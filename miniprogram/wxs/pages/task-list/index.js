// ============================================
// 任务列表页
// ============================================
const app = getApp();
const util = require('../../utils/util');

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

  onLoad(options) {
    const userInfo = app.globalData.userInfo || {};
    this.setData({ canCreate: (userInfo.role || 1) >= 3 });
    this.loadTasks();
  },

  onPullDownRefresh() {
    this.loadTasks(() => wx.stopPullDownRefresh());
  },

  loadTasks(callback) {
    app.request({
      url: '/api/v1/tasks',
      success: (res) => {
        if (res.code !== 200) return;
        const allTasks = res.data.map(t => ({
          ...t,
          typeLabel: util.getTaskTypeLabel(t.task_type),
          statusLabel: util.getTaskStatusLabel(t.status),
          deadlineText: t.deadline ? util.getCountdown(t.deadline) : '',
          progressPct: t.target ? Math.round((t.progress / t.target) * 100) : 0,
          assigneeName: null, // 后续从排班数据关联
          assigneeColor: '#C9A84C',
        }));

        // 更新筛选器计数
        const statusFilters = this.data.statusFilters.map(f => ({
          ...f,
          count: f.value === 'all'
            ? allTasks.length
            : allTasks.filter(t => String(t.status) === f.value).length,
        }));

        this.setData({ allTasks, statusFilters });
        this.applyFilter();
        if (callback) callback();
      },
    });
  },

  onStatusFilter(e) {
    this.setData({ activeStatus: e.currentTarget.dataset.value });
    this.applyFilter();
  },

  onTypeFilter(e) {
    this.setData({ activeType: e.currentTarget.dataset.value });
    this.applyFilter();
  },

  applyFilter() {
    const { allTasks, activeStatus, activeType } = this.data;
    let result = allTasks;
    if (activeStatus !== 'all') {
      result = result.filter(t => String(t.status) === activeStatus);
    }
    if (activeType !== 'all') {
      result = result.filter(t => t.task_type === activeType);
    }
    this.setData({ filteredTasks: result });
  },

  onTaskTap(e) {
    const task = e.currentTarget.dataset.task;
    wx.navigateTo({ url: `/pages/task-detail/index?taskId=${task.id}` });
  },

  onCreateTask() {
    wx.showToast({ title: '任务创建功能即将上线', icon: 'none' });
  },
});
