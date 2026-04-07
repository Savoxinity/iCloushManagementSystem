/**
 * 新增排线 — Phase 4 机动物流中台
 * POST /api/v1/vehicles/routes/create
 */
var app = getApp();

Page({
  data: {
    routeName: '',
    description: '',
    durationMin: '',
    distanceKm: '',
    stops: [],
    submitting: false,
  },

  // ── 基本信息输入 ──
  onNameInput: function (e) { this.setData({ routeName: e.detail.value }); },
  onDescInput: function (e) { this.setData({ description: e.detail.value }); },
  onDurationInput: function (e) { this.setData({ durationMin: e.detail.value }); },
  onDistanceInput: function (e) { this.setData({ distanceKm: e.detail.value }); },

  // ── 站点操作 ──
  addStop: function () {
    var stops = this.data.stops.slice();
    stops.push({
      seq: stops.length + 1,
      client_name: '',
      address: '',
      expected_eta: '',
      contact_phone: '',
    });
    this.setData({ stops: stops });
  },

  removeStop: function (e) {
    var idx = e.currentTarget.dataset.index;
    var stops = this.data.stops.slice();
    stops.splice(idx, 1);
    // 重新编号
    for (var i = 0; i < stops.length; i++) {
      stops[i].seq = i + 1;
    }
    this.setData({ stops: stops });
  },

  onStopFieldInput: function (e) {
    var idx = e.currentTarget.dataset.index;
    var field = e.currentTarget.dataset.field;
    var key = 'stops[' + idx + '].' + field;
    this.setData({ [key]: e.detail.value });
  },

  // ── 提交 ──
  submitRoute: function () {
    var self = this;
    if (self.data.submitting) return;

    // 校验
    if (!self.data.routeName.trim()) {
      wx.showToast({ title: '请输入排线名称', icon: 'none' });
      return;
    }

    // 校验站点
    var validStops = [];
    for (var i = 0; i < self.data.stops.length; i++) {
      var s = self.data.stops[i];
      if (!s.client_name || !s.client_name.trim()) {
        wx.showToast({ title: '站点 ' + (i + 1) + ' 缺少客户名称', icon: 'none' });
        return;
      }
      validStops.push({
        seq: i + 1,
        client_name: s.client_name.trim(),
        address: s.address || null,
        expected_eta: s.expected_eta || null,
        contact_phone: s.contact_phone || null,
      });
    }

    self.setData({ submitting: true });

    var payload = {
      route_name: self.data.routeName.trim(),
      description: self.data.description || null,
      stops: validStops,
    };
    if (self.data.durationMin) payload.estimated_duration_min = parseInt(self.data.durationMin);
    if (self.data.distanceKm) payload.estimated_distance_km = parseFloat(self.data.distanceKm);

    app.request({
      url: '/api/v1/vehicles/routes/create',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: '创建成功', icon: 'success' });
          setTimeout(function () { wx.navigateBack(); }, 1000);
        } else {
          wx.showToast({ title: res.message || '创建失败', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
