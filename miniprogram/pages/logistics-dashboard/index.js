/**
 * 物流仪表盘 — 一屏总览
 * Phase 4 机动物流中台
 */
const app = getApp()
const API_BASE = app.globalData?.apiBase || 'http://192.168.1.4:8000'

Page({
  data: {
    today: '',
    dashboard: {
      fleet: { total: 0, idle: 0, delivering: 0, maintenance: 0 },
      today_dispatches: 0,
      alert_count: 0,
      trend_7d: [],
    },
  },

  onLoad() {
    const now = new Date()
    this.setData({
      today: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    })
    this.loadDashboard()
  },

  onShow() {
    this.loadDashboard()
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh())
  },

  // ── 加载仪表盘数据 ──
  async loadDashboard() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE}/api/v1/vehicles/dashboard`,
          method: 'GET',
          header: this._getHeaders(),
          success: resolve,
          fail: reject,
        })
      })

      if (res.data && res.data.code === 200) {
        const data = res.data.data
        // 处理趋势图数据
        const maxCount = Math.max(...(data.trend_7d || []).map(t => t.count), 1)
        const trend = (data.trend_7d || []).map(t => ({
          ...t,
          _height: Math.max(Math.round(t.count / maxCount * 200), 8),
          _label: t.date.slice(5), // MM-DD
        }))

        this.setData({
          dashboard: {
            fleet: data.fleet || { total: 0, idle: 0, delivering: 0, maintenance: 0 },
            today_dispatches: data.today_dispatches || 0,
            alert_count: data.alert_count || 0,
            trend_7d: trend,
          },
        })
      }
    } catch (err) {
      console.error('加载仪表盘失败:', err)
    }
  },

  // ── 快捷跳转 ──
  goVehicleManage(e) {
    const status = e.currentTarget.dataset?.status || ''
    wx.navigateTo({ url: `/pages/vehicle-manage/index${status ? '?status=' + status : ''}` })
  },

  goRouteManage() {
    wx.navigateTo({ url: '/pages/route-manage/index' })
  },

  goDispatchManage() {
    wx.navigateTo({ url: '/pages/dispatch-manage/index' })
  },

  goAlerts() {
    wx.navigateTo({ url: '/pages/vehicle-manage/index?tab=alerts' })
  },

  // ── 通用请求头 ──
  _getHeaders() {
    const token = wx.getStorageSync('token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  },
})
