// ============================================
// 个人排班日历页面
// 日历视图显示该员工每天的排班工区
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    // 日历状态
    currentYear: 2026,
    currentMonth: 3,
    monthLabel: '',
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],

    // 选中日期
    selectedDate: '',
    selectedDateLabel: '',
    selectedSchedule: null,

    // 当月排班数据 { '2026-03-29': { zone_name: '洗涤龙工区', zone_color: '#00FF88', shift: '白班' } }
    monthScheduleMap: {},

    // 统计
    monthStats: {
      totalDays: 0,
      restDays: 0,
      mostZone: '--',
    },

    userName: '',
  },

  onLoad: function () {
    var now = new Date();
    var userInfo = app.globalData.userInfo || {};
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: this._formatDate(now),
      userName: userInfo.name || '员工',
    });
    this.buildCalendar();
    this.loadMonthSchedule();
  },

  // ============================================
  // 日历构建
  // ============================================
  buildCalendar: function () {
    var year = this.data.currentYear;
    var month = this.data.currentMonth;
    var monthLabel = year + '年' + (month < 10 ? '0' + month : month) + '月';

    // 本月第一天是周几
    var firstDay = new Date(year, month - 1, 1).getDay();
    // 本月天数
    var daysInMonth = new Date(year, month, 0).getDate();

    var today = this._formatDate(new Date());
    var selected = this.data.selectedDate;
    var scheduleMap = this.data.monthScheduleMap;

    var calendarDays = [];

    // 填充前面的空白
    for (var i = 0; i < firstDay; i++) {
      calendarDays.push({ day: '', dateStr: '', isEmpty: true });
    }

    // 填充日期
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + (month < 10 ? '0' + month : month) + '-' + (d < 10 ? '0' + d : d);
      var schedule = scheduleMap[dateStr] || null;
      calendarDays.push({
        day: d,
        dateStr: dateStr,
        isEmpty: false,
        isToday: dateStr === today,
        isSelected: dateStr === selected,
        hasSchedule: !!schedule,
        zoneColor: schedule ? schedule.zone_color : '',
        zoneName: schedule ? schedule.zone_name : '',
      });
    }

    this.setData({
      monthLabel: monthLabel,
      calendarDays: calendarDays,
    });

    // 更新选中日期详情
    this._updateSelectedDetail();
  },

  // ============================================
  // 加载当月排班数据（Mock）
  // ============================================
  loadMonthSchedule: function () {
    var self = this;
    var year = this.data.currentYear;
    var month = this.data.currentMonth;
    var myId = (app.globalData.userInfo || {}).id;

    // 先获取工区列表
    app.request({
      url: '/api/v1/zones',
      success: function (zRes) {
        if (zRes.code !== 200) return;
        var zones = zRes.data || [];
        var zoneMap = {};
        for (var i = 0; i < zones.length; i++) {
          zoneMap[zones[i].code] = zones[i];
        }

        // 获取员工信息
        app.request({
          url: '/api/v1/users',
          success: function (uRes) {
            if (uRes.code !== 200) return;
            var allStaff = uRes.data || [];
            var me = null;
            for (var j = 0; j < allStaff.length; j++) {
              if (allStaff[j].id === myId) { me = allStaff[j]; break; }
            }
            if (!me) return;

            // 生成当月排班数据（Mock：基于 current_zones 生成整月排班）
            var daysInMonth = new Date(year, month, 0).getDate();
            var scheduleMap = {};
            var myZones = me.current_zones || [];
            var totalDays = 0;
            var restDays = 0;
            var zoneCount = {};

            // 模拟排班：工作日有排班，周末休息
            for (var d = 1; d <= daysInMonth; d++) {
              var dateStr = year + '-' + (month < 10 ? '0' + month : month) + '-' + (d < 10 ? '0' + d : d);
              var dayOfWeek = new Date(year, month - 1, d).getDay();

              if (dayOfWeek === 0 || dayOfWeek === 6) {
                // 周末休息（但随机安排加班）
                if (Math.random() > 0.7 && myZones.length > 0) {
                  var zCode = myZones[Math.floor(Math.random() * myZones.length)];
                  var zone = zoneMap[zCode];
                  if (zone) {
                    scheduleMap[dateStr] = {
                      zone_name: zone.name,
                      zone_color: zone.color || '#C9A84C',
                      shift: '加班',
                      zone_code: zCode,
                    };
                    totalDays++;
                    zoneCount[zone.name] = (zoneCount[zone.name] || 0) + 1;
                  }
                } else {
                  restDays++;
                }
              } else {
                // 工作日排班
                if (myZones.length > 0) {
                  var zIdx = d % myZones.length;
                  var zoneCode = myZones[zIdx];
                  var z = zoneMap[zoneCode];
                  if (z) {
                    scheduleMap[dateStr] = {
                      zone_name: z.name,
                      zone_color: z.color || '#C9A84C',
                      shift: '白班',
                      zone_code: zoneCode,
                    };
                    totalDays++;
                    zoneCount[z.name] = (zoneCount[z.name] || 0) + 1;
                  }
                } else {
                  restDays++;
                }
              }
            }

            // 找最常去的工区
            var mostZone = '--';
            var maxCount = 0;
            var zNames = Object.keys(zoneCount);
            for (var k = 0; k < zNames.length; k++) {
              if (zoneCount[zNames[k]] > maxCount) {
                maxCount = zoneCount[zNames[k]];
                mostZone = zNames[k];
              }
            }

            self.setData({
              monthScheduleMap: scheduleMap,
              monthStats: {
                totalDays: totalDays,
                restDays: restDays,
                mostZone: mostZone,
              },
            });
            self.buildCalendar();
          },
        });
      },
    });
  },

  // ============================================
  // 交互
  // ============================================
  onDayTap: function (e) {
    var dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return;
    this.setData({ selectedDate: dateStr });
    this.buildCalendar();
  },

  prevMonth: function () {
    var year = this.data.currentYear;
    var month = this.data.currentMonth - 1;
    if (month < 1) { month = 12; year--; }
    this.setData({ currentYear: year, currentMonth: month, monthScheduleMap: {} });
    this.buildCalendar();
    this.loadMonthSchedule();
  },

  nextMonth: function () {
    var year = this.data.currentYear;
    var month = this.data.currentMonth + 1;
    if (month > 12) { month = 1; year++; }
    this.setData({ currentYear: year, currentMonth: month, monthScheduleMap: {} });
    this.buildCalendar();
    this.loadMonthSchedule();
  },

  goToday: function () {
    var now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: this._formatDate(now),
      monthScheduleMap: {},
    });
    this.buildCalendar();
    this.loadMonthSchedule();
  },

  // ============================================
  // 工具方法
  // ============================================
  _formatDate: function (date) {
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
  },

  _updateSelectedDetail: function () {
    var selected = this.data.selectedDate;
    if (!selected) return;

    var parts = selected.split('-');
    var selectedDateLabel = parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
    var dayOfWeek = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getDay();
    var weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    selectedDateLabel += ' ' + weekNames[dayOfWeek];

    var schedule = this.data.monthScheduleMap[selected] || null;

    this.setData({
      selectedDateLabel: selectedDateLabel,
      selectedSchedule: schedule,
    });
  },
});
