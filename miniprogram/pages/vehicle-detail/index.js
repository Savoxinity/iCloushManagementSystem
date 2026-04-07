/**
 * 车辆详情 — 查看 + 编辑 + 删除 + 历史日历
 * Phase 4.2 修复: complete 回调不被 app.request 支持，改用 success/fail 中设置 loading
 */
const app = getApp()

Page({
  data: {
    vehicleId: null,
    vehicle: null,
    loading: true,
    isAdmin: false,
    alerts: [],

    // 历史日历
    calendarYear: 0,
    calendarMonth: 0,
    calendarDays: [],
    selectedDate: '',
    dayDetail: null,
    dayDetailLoading: false,
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 1000)
      return
    }
    var userInfo = wx.getStorageSync('userInfo') || {}
    var now = new Date()
    this.setData({
      vehicleId: parseInt(options.id),
      isAdmin: (userInfo.role || 1) >= 5,
      calendarYear: now.getFullYear(),
      calendarMonth: now.getMonth() + 1,
    })
    this.loadDetail()
  },

  onShow() {
    if (this.data.vehicleId) this.loadDetail()
  },

  loadDetail() {
    var self = this
    this.setData({ loading: true })
    app.request({
      url: '/api/v1/vehicles/fleet/' + this.data.vehicleId,
      success(res) {
        if (res.code === 200 && res.data) {
          var v = res.data
          var today = new Date()
          var alerts = []
          var checks = [
            { key: 'inspection', label: '年检', date: v.inspection_due },
            { key: 'compulsory_insurance', label: '交强险', date: v.compulsory_ins_due },
            { key: 'commercial_insurance', label: '商业险', date: v.commercial_ins_due },
            { key: 'maintenance', label: '保养', date: v.maintenance_due },
          ]
          checks.forEach(function (c) {
            if (!c.date) return
            var due = new Date(c.date.replace(/-/g, '/'))
            var remaining = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
            alerts.push({
              type: c.key,
              label: c.label,
              due_date: c.date,
              remaining_days: remaining,
              level: remaining < 0 ? 'expired' : remaining <= 7 ? 'urgent' : remaining <= 30 ? 'warning' : 'safe',
            })
          })
          self.setData({ vehicle: v, alerts: alerts, loading: false })
          self.buildCalendar()
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' })
          self.setData({ loading: false })
        }
      },
      fail() {
        wx.showToast({ title: '网络异常', icon: 'none' })
        self.setData({ loading: false })
      },
    })
  },

  // ── 日历构建 ──
  buildCalendar() {
    var year = this.data.calendarYear
    var month = this.data.calendarMonth
    var firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
    var daysInMonth = new Date(year, month, 0).getDate()
    var days = []
    // 填充前面的空白
    for (var i = 0; i < firstDay; i++) {
      days.push({ day: '', dateStr: '', empty: true })
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var mm = month < 10 ? '0' + month : '' + month
      var dd = d < 10 ? '0' + d : '' + d
      days.push({
        day: d,
        dateStr: year + '-' + mm + '-' + dd,
        empty: false,
      })
    }
    this.setData({ calendarDays: days })
  },

  prevMonth() {
    var y = this.data.calendarYear
    var m = this.data.calendarMonth - 1
    if (m < 1) { m = 12; y-- }
    this.setData({ calendarYear: y, calendarMonth: m, selectedDate: '', dayDetail: null })
    this.buildCalendar()
  },

  nextMonth() {
    var y = this.data.calendarYear
    var m = this.data.calendarMonth + 1
    if (m > 12) { m = 1; y++ }
    this.setData({ calendarYear: y, calendarMonth: m, selectedDate: '', dayDetail: null })
    this.buildCalendar()
  },

  selectDay(e) {
    var dateStr = e.currentTarget.dataset.date
    if (!dateStr) return
    this.setData({ selectedDate: dateStr })
    this.loadDayDetail(dateStr)
  },

  loadDayDetail(dateStr) {
    var self = this
    self.setData({ dayDetailLoading: true, dayDetail: null })
    // 查询该车辆在指定日期的调度记录
    app.request({
      url: '/api/v1/vehicles/dispatch/list?vehicle_id=' + self.data.vehicleId + '&work_date=' + dateStr,
      success(res) {
        if (res.code === 200) {
          var dispatches = res.data || []
          self.setData({
            dayDetail: {
              date: dateStr,
              dispatches: dispatches,
              hasData: dispatches.length > 0,
            },
            dayDetailLoading: false,
          })
        } else {
          self.setData({ dayDetail: { date: dateStr, dispatches: [], hasData: false }, dayDetailLoading: false })
        }
      },
      fail() {
        self.setData({ dayDetail: { date: dateStr, dispatches: [], hasData: false }, dayDetailLoading: false })
      },
    })
  },

  // ── 编辑 ──
  goEdit() {
    wx.navigateTo({ url: '/pages/vehicle-add/index?id=' + this.data.vehicleId })
  },

  // ── 删除 ──
  onDelete() {
    var self = this
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除该车辆吗？',
      confirmColor: '#dc2626',
      success(res) {
        if (res.confirm) {
          app.request({
            url: '/api/v1/vehicles/fleet/' + self.data.vehicleId,
            method: 'DELETE',
            success(res) {
              if (res.code === 200) {
                wx.showToast({ title: '已删除', icon: 'success' })
                setTimeout(function () { wx.navigateBack() }, 1200)
              } else {
                wx.showToast({ title: res.message || '删除失败', icon: 'none' })
              }
            },
          })
        }
      },
    })
  },

  // ── 更改状态 ──
  changeStatus() {
    var self = this
    var statusLabels = ['空闲', '运送中', '维修中', '已报废']
    var statusValues = ['idle', 'delivering', 'maintenance', 'retired']
    wx.showActionSheet({
      itemList: statusLabels,
      success(res) {
        var newStatus = statusValues[res.tapIndex]
        app.request({
          url: '/api/v1/vehicles/fleet/' + self.data.vehicleId,
          method: 'PUT',
          data: { status: newStatus },
          success(r) {
            if (r.code === 200) {
              wx.showToast({ title: '状态已更新', icon: 'success' })
              self.loadDetail()
            }
          },
        })
      },
    })
  },
})
