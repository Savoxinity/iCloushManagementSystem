/**
 * 创建调度单 — Phase 4 机动物流中台
 * POST /api/v1/vehicles/dispatch/create
 * 需要：work_date, vehicle_id, driver_id, route_id(可选), remark(可选)
 */
var app = getApp();

Page({
  data: {
    workDate: '',
    vehicles: [],
    vehicleNames: [],
    vehicleIndex: -1,
    drivers: [],
    driverNames: [],
    driverIndex: -1,
    routes: [],
    routeNames: ['不指定路线'],
    routeIndex: -1,
    remark: '',
    submitting: false,
  },

  onLoad: function () {
    // 默认今天
    var now = new Date();
    var dateStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    this.setData({ workDate: dateStr });
    this.loadVehicles();
    this.loadDrivers();
    this.loadRoutes();
  },

  // ── 加载车辆列表 ──
  loadVehicles: function () {
    var self = this;
    app.request({
      url: '/api/v1/vehicles/fleet/list',
      success: function (res) {
        if (res.code === 200) {
          var list = res.data || [];
          var names = list.map(function (v) {
            return v.plate_number + ' (' + (v.vehicle_type || '') + ')';
          });
          self.setData({ vehicles: list, vehicleNames: names });
        }
      },
    });
  },

  // ── 加载司机列表（有物流驾驶标签的员工） ──
  loadDrivers: function () {
    var self = this;
    app.request({
      url: '/api/v1/users',
      success: function (res) {
        if (res.code === 200) {
          var allUsers = res.data || [];
          // 筛选有物流驾驶标签或被分配到物流工区的员工
          var drivers = allUsers.filter(function (u) {
            var tags = u.skill_tags || [];
            return tags.indexOf('物流驾驶') >= 0 || (u.current_zones || []).indexOf('zone_f') >= 0;
          });
          // 如果没有筛选到，显示所有活跃员工
          if (drivers.length === 0) drivers = allUsers;
          var names = drivers.map(function (d) { return d.name + ' (ID:' + d.id + ')'; });
          self.setData({ drivers: drivers, driverNames: names });
        }
      },
    });
  },

  // ── 加载路线列表 ──
  loadRoutes: function () {
    var self = this;
    app.request({
      url: '/api/v1/vehicles/routes/list',
      success: function (res) {
        if (res.code === 200) {
          var list = res.data || [];
          var names = ['不指定路线'];
          for (var i = 0; i < list.length; i++) {
            names.push(list[i].route_name);
          }
          self.setData({ routes: list, routeNames: names });
        }
      },
    });
  },

  // ── 表单事件 ──
  onDateChange: function (e) { this.setData({ workDate: e.detail.value }); },
  onVehicleChange: function (e) { this.setData({ vehicleIndex: parseInt(e.detail.value) }); },
  onDriverChange: function (e) { this.setData({ driverIndex: parseInt(e.detail.value) }); },
  onRouteChange: function (e) { this.setData({ routeIndex: parseInt(e.detail.value) - 1 }); },
  onRemarkInput: function (e) { this.setData({ remark: e.detail.value }); },

  // ── 提交 ──
  submitDispatch: function () {
    var self = this;
    if (self.data.submitting) return;

    if (!self.data.workDate) {
      wx.showToast({ title: '请选择出车日期', icon: 'none' }); return;
    }
    if (self.data.vehicleIndex < 0) {
      wx.showToast({ title: '请选择车辆', icon: 'none' }); return;
    }
    if (self.data.driverIndex < 0) {
      wx.showToast({ title: '请选择司机', icon: 'none' }); return;
    }

    self.setData({ submitting: true });

    var vehicle = self.data.vehicles[self.data.vehicleIndex];
    var driver = self.data.drivers[self.data.driverIndex];
    var route = self.data.routeIndex >= 0 ? self.data.routes[self.data.routeIndex] : null;

    var payload = {
      work_date: self.data.workDate,
      vehicle_id: vehicle.id,
      driver_id: driver.id,
    };
    if (route) payload.route_id = route.id;
    if (self.data.remark) payload.remark = self.data.remark;

    app.request({
      url: '/api/v1/vehicles/dispatch/create',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: '创建成功', icon: 'success' });
          setTimeout(function () { wx.navigateBack(); }, 1000);
        } else {
          wx.showToast({ title: res.message || res.detail || '创建失败', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
