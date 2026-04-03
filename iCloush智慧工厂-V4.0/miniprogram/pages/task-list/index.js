// ============================================
// 任务列表页 — V10 RBAC 工区隔离 + 接单网关
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
    isStaff: false,
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
    var userRole = userInfo.role || 1;
    this.setData({
      canCreate: userRole >= 3,
      isStaff: userRole <= 1,
    });
    this.loadTasks();
  },

  onShow: function () {
    // 从详情页返回时刷新列表（审核/接单状态可能已变）
    if (this.data.allTasks.length > 0) {
      this.loadTasks();
    }
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadTasks(function () { wx.stopPullDownRefresh(); });
  },

  loadTasks: function (callback) {
    var self = this;
    var userInfo = app.globalData.userInfo || {};
    var userRole = userInfo.role || 1;
    var myZones = userInfo.current_zones || [];

    // 先获取用户列表，再获取任务列表
    app.request({
      url: '/api/v1/users',
      success: function (usersRes) {
        var userList = (usersRes.code === 200 && usersRes.data) ? usersRes.data : [];
        app.globalData._cachedUsers = userList;

        // ★ 如果是普通员工，从最新 USERS 数据中刷新自己的 current_zones
        if (userRole <= 1 && userInfo.id) {
          for (var mu = 0; mu < userList.length; mu++) {
            if (userList[mu].id === userInfo.id) {
              myZones = userList[mu].current_zones || [];
              // 同步回 globalData
              app.globalData.userInfo.current_zones = myZones;
              break;
            }
          }
        }

        app.request({
          url: '/api/v1/tasks',
          success: function (res) {
            if (res.code !== 200) return;
            var rawTasks = res.data || [];

            // ★★★ RBAC 工区 + 员工可见性过滤 ★★★
            // 规则：
            // 1. 管理员(role>=5)：看全厂任务
            // 2. 员工(role<=1)：
            //    a. 公域任务(assigned_to=null, status=0)：只看自己工区的
            //    b. 指定任务(assigned_to有值)：只看指定给自己的
            //    c. 自己已接单的任务：始终可见
            var visibleTasks = [];
            var myUserId = userInfo.id;
            if (userRole <= 1) {
              // 构建 zone_id → zone_code 映射
              var zoneIdToCode = {};
              if (app.globalData._cachedZones) {
                var zones = app.globalData._cachedZones;
                for (var zi = 0; zi < zones.length; zi++) {
                  zoneIdToCode[zones[zi].id] = zones[zi].code;
                }
              }

              for (var vi = 0; vi < rawTasks.length; vi++) {
                var task = rawTasks[vi];
                var taskAssignee = task.assigned_to;

                // 规则 c：指定给我的任务，始终可见
                if (taskAssignee && String(taskAssignee) === String(myUserId)) {
                  visibleTasks.push(task);
                  continue;
                }

                // 规则 b：指定给其他人的任务，不可见
                if (taskAssignee && String(taskAssignee) !== String(myUserId)) {
                  continue;
                }

                // 规则 a：公域任务(assigned_to=null)，只看自己工区的
                if (!taskAssignee) {
                  if (myZones.length > 0) {
                    var taskZoneCode = zoneIdToCode[task.zone_id] || task.zone_id || '';
                    // 同时支持 zone_code 和 zone_name 匹配
                    var zoneMatch = false;
                    for (var mz = 0; mz < myZones.length; mz++) {
                      if (myZones[mz] === taskZoneCode || myZones[mz] === task.zone_name) {
                        zoneMatch = true;
                        break;
                      }
                    }
                    if (zoneMatch) {
                      visibleTasks.push(task);
                    }
                  } else {
                    // 没有工区分配的员工，可以看所有公域任务
                    visibleTasks.push(task);
                  }
                }
              }
            } else {
              // 管理员或班组长：显示全部
              visibleTasks = rawTasks;
            }

            var allTasks = [];
            for (var i = 0; i < visibleTasks.length; i++) {
              var t = visibleTasks[i];
              // 匹配负责人信息
              var assigneeName = null;
              var assigneeInitial = '?';
              var assigneeColor = '#555';
              if (t.assigned_to) {
                for (var u = 0; u < userList.length; u++) {
                  if (userList[u].id === t.assigned_to) {
                    assigneeName = userList[u].name;
                    assigneeInitial = util.getAvatarInitial(userList[u].name);
                    assigneeColor = util.getAvatarColor(userList[u].avatar_key || userList[u].id);
                    break;
                  }
                }
              }

              allTasks.push({
                id: t.id, title: t.title, task_type: t.task_type,
                zone_id: t.zone_id, zone_name: t.zone_name,
                status: t.status, priority: t.priority,
                points_reward: t.points_reward,
                progress: t.progress, target: t.target, unit: t.unit,
                requires_photo: t.requires_photo,
                description: t.description, deadline: t.deadline,
                assigned_to: t.assigned_to,
                is_rejected: t.is_rejected || false,
                typeLabel: util.getTaskTypeLabel(t.task_type),
                statusLabel: util.getTaskStatusLabel(t.status),
                deadlineText: t.deadline ? util.getCountdown(t.deadline) : '',
                progressPct: t.target ? Math.round((t.progress / t.target) * 100) : 0,
                assigneeName: assigneeName,
                assigneeInitial: assigneeInitial,
                assigneeColor: assigneeColor,
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
    });

    // ★ 缓存工区数据供 RBAC 过滤使用
    if (!app.globalData._cachedZones) {
      app.request({
        url: '/api/v1/zones',
        success: function (zRes) {
          if (zRes.code === 200) {
            app.globalData._cachedZones = zRes.data || [];
          }
        },
      });
    }
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
    wx.navigateTo({ url: '/pages/task-create/index' });
  },
});
