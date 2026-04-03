// ============================================
// 我的页面 V7 — 基于 accountRole 过滤菜单
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    userInfo: {},
    roleLabel: '',
    avatarColor: '#C9A84C',
    nameInitial: '?',
    isAdmin: true,
    todayStats: [
      { label: '今日完成', value: '--', color: '#00FF88' },
      { label: '今日积分', value: '--', color: '#C9A84C' },
      { label: '本月排名', value: '--', color: '#3B82F6' },
    ],
    menuGroups: [],
  },

  onLoad: function () {
    var isAdmin = app.globalData.accountRole === 'admin';
    this.setData({ isAdmin: isAdmin });
    this.loadUserInfo();
    this.buildMenuGroups();
  },

  onShow: function () {
    this.loadUserInfo();
  },

  loadUserInfo: function () {
    var userInfo = app.globalData.userInfo || {};
    var roleLabel = util.getRoleLabel(userInfo.role || 1);
    var avatarColor = util.getAvatarColor(userInfo.avatar_key || 'default');
    var nameInitial = util.getAvatarInitial(userInfo.name || '?');

    this.setData({
      userInfo: userInfo,
      roleLabel: roleLabel,
      avatarColor: avatarColor,
      nameInitial: nameInitial,
    });

    // 加载今日个人数据
    var self = this;
    app.request({
      url: '/api/v1/tasks/stats',
      success: function (res) {
        if (res.code !== 200) return;
        var done = res.data.done || 0;
        var todayStats = [
          { label: '今日完成', value: String(done), color: '#00FF88' },
          { label: '今日积分', value: '+' + (done * 10), color: '#C9A84C' },
          { label: '本月排名', value: '#3', color: '#3B82F6' },
        ];
        self.setData({ todayStats: todayStats });
      },
    });
  },

  buildMenuGroups: function () {
    var isAdmin = this.data.isAdmin;
    var userInfo = app.globalData.userInfo || {};
    var role = userInfo.role || 1;

    var menuGroups = [
      {
        title: '个人中心',
        items: [
          { id: 'my_tasks', name: '我的任务', icon: '📋', iconBg: 'rgba(59,130,246,0.15)', url: '/pages/task-list/index?mode=mine' },
          { id: 'my_points', name: '积分记录', icon: '🏆', iconBg: 'rgba(201,168,76,0.15)', url: '/pages/mall/index' },
          // 员工版：排班改为个人排班日历；管理员版：保留排班管理入口
          isAdmin
            ? { id: 'my_schedule', name: '我的排班', icon: '📅', iconBg: 'rgba(0,255,136,0.15)', url: '/pages/schedule/index?mode=mine' }
            : { id: 'my_calendar', name: '排班日历', icon: '🗓', iconBg: 'rgba(59,130,246,0.15)', url: '/pages/my-calendar/index' },
        ],
      },
    ];

    // 管理工具仅管理员可见
    if (isAdmin && role >= 5) {
      menuGroups.push({
        title: '管理工具',
        items: [
          { id: 'staff_manage', name: '员工管理', icon: '👥', iconBg: 'rgba(236,72,153,0.15)', url: '/pages/staff-manage/index' },
          { id: 'reports', name: '数据报表', icon: '📊', iconBg: 'rgba(245,158,11,0.15)', url: '/pages/reports/index' },
          { id: 'iot', name: 'IoT 设备', icon: '⚙️', iconBg: 'rgba(139,92,246,0.15)', url: '/pages/iot-dashboard/index' },
        ],
      });
    }

    // 系统设置仅管理员可见
    if (isAdmin && role >= 9) {
      menuGroups.push({
        title: '系统设置',
        items: [
          { id: 'permission', name: '权限配置', icon: '🔐', iconBg: 'rgba(107,114,128,0.15)', url: '/pages/permission/index' },
        ],
      });
    }

    this.setData({ menuGroups: menuGroups });
  },

  onMenuTap: function (e) {
    var menu = e.currentTarget.dataset.menu;
    wx.navigateTo({ url: menu.url });
  },

  onLogout: function () {
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前账号？',
      confirmColor: '#EF4444',
      success: function (res) {
        if (res.confirm) {
          app.logout();
        }
      },
    });
  },
});
