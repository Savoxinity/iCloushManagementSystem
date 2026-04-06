/**
 * 出车调度 — 车-线-人 三位一体
 * Phase 4 机动物流中台
 * 修复: 改用 app.request() 统一请求封装（自动附带 token + baseUrl）
 */
var app = getApp();

Page({
  data: {
    selectedDate: '',
    statusFilter: '',
    dispatchList: [],
    loading: false,
    isAdmin: false,
    stats: { total: 0, pending: 0, delivering: 0, completed: 0 },
  },

  onLoad: function () {
    var userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      isAdmin: (userInfo.role || 1) >= 5,
      selectedDate: this._formatDate(new Date()),
    });
    this.loadDispatches();
  },

  onShow: function () {
    this.loadDispatches();
  },

  onPullDownRefresh: function () {
    this.loadDispatches();
    wx.stopPullDownRefresh();
  },

  // ── 日期操作 ──
  changeDate: function (e) {
    this.setData({ selectedDate: e.detail.value });
    this.loadDispatches();
  },

  prevDay: function () {
    var d = new Date(this.data.selectedDate.replace(/-/g, '/'));
    d.setDate(d.getDate() - 1);
    this.setData({ selectedDate: this._formatDate(d) });
    this.loadDispatches();
  },

  nextDay: function () {
    var d = new Date(this.data.selectedDate.replace(/-/g, '/'));
    d.setDate(d.getDate() + 1);
    this.setData({ selectedDate: this._formatDate(d) });
    this.loadDispatches();
  },

  goToday: function () {
    this.setData({ selectedDate: this._formatDate(new Date()) });
    this.loadDispatches();
  },

  filterByStatus: function (e) {
    this.setData({ statusFilter: (e.currentTarget.dataset && e.currentTarget.dataset.status) || '' });
    this.loadDispatches();
  },

  // ── 加载调度单列表 ──
  loadDispatches: function () {
    var self = this;
    self.setData({ loading: true });

    var params = ['work_date=' + self.data.selectedDate];
    if (self.data.statusFilter) {
      params.push('status=' + self.data.statusFilter);
    }
    var queryStr = params.join('&');

    app.request({
      url: '/api/v1/vehicles/dispatch/list?' + queryStr,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200) {
          var list = (res.data || []).map(function (d) {
            // 计算打卡进度
            var checkins = d.stop_checkins || [];
            var checkedCount = 0;
            for (var i = 0; i < checkins.length; i++) {
              if (checkins[i].checked_in_at) checkedCount++;
            }
            var checkinPct = checkins.length > 0 ? Math.round(checkedCount / checkins.length * 100) : 0;

            d._checkedCount = checkedCount;
            d._checkinPct = checkinPct;
            d._departedTime = d.departed_at ? self._formatTime(d.departed_at) : '';
            d._returnedTime = d.returned_at ? self._formatTime(d.returned_at) : '';
            d._driverName = d.driver_name || ('员工#' + d.driver_id);
            return d;
          });

          // 计算统计
          var stats = {
            total: list.length,
            pending: 0,
            delivering: 0,
            completed: 0,
          };
          for (var i = 0; i < list.length; i++) {
            if (list[i].status === 'pending') stats.pending++;
            else if (list[i].status === 'delivering') stats.delivering++;
            else if (list[i].status === 'completed') stats.completed++;
          }

          self.setData({ dispatchList: list, stats: stats });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  // ── 出发打卡 ──
  doDepart: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认出发',
      content: '确认开始出车吗？',
      success: function (modalRes) {
        if (!modalRes.confirm) return;
        app.request({
          url: '/api/v1/vehicles/dispatch/' + id + '/depart',
          method: 'PUT',
          success: function (res) {
            if (res.code === 200) {
              wx.showToast({ title: '已出发', icon: 'success' });
              self.loadDispatches();
            } else {
              wx.showToast({ title: res.detail || res.message || '操作失败', icon: 'none' });
            }
          },
          fail: function () {
            wx.showToast({ title: '网络错误', icon: 'none' });
          },
        });
      },
    });
  },

  // ── 返回打卡 ──
  doReturn: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认返回',
      content: '确认完成出车返回吗？',
      success: function (modalRes) {
        if (!modalRes.confirm) return;
        app.request({
          url: '/api/v1/vehicles/dispatch/' + id + '/return',
          method: 'PUT',
          success: function (res) {
            if (res.code === 200) {
              wx.showToast({ title: '出车完成', icon: 'success' });
              self.loadDispatches();
            } else {
              wx.showToast({ title: res.detail || res.message || '操作失败', icon: 'none' });
            }
          },
          fail: function () {
            wx.showToast({ title: '网络错误', icon: 'none' });
          },
        });
      },
    });
  },

  // ── 跳转详情 ──
  goDispatchDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/dispatch-detail/index?id=' + id });
  },

  // ── 创建调度单 ──
  goCreateDispatch: function () {
    wx.navigateTo({ url: '/pages/dispatch-create/index' });
  },

  // ── 工具函数 ──
  _formatDate: function (d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  },

  _formatTime: function (isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr.replace(/-/g, '/'));
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },
});
