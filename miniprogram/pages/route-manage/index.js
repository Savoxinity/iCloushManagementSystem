/**
 * 排线管理 — 送货排线 CRUD
 * Phase 4 机动物流中台
 */
const app = getApp()
const API_BASE = app.globalData?.apiBase || 'http://192.168.1.4:8000'

Page({
  data: {
    routeList: [],
    loading: false,
    isAdmin: false,
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({ isAdmin: (userInfo.role || 1) >= 5 })
    this.loadRoutes()
  },

  onShow() {
    this.loadRoutes()
  },

  onPullDownRefresh() {
    this.loadRoutes().finally(() => wx.stopPullDownRefresh())
  },

  // ── 加载排线列表 ──
  async loadRoutes() {
    this.setData({ loading: true })
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE}/api/v1/vehicles/routes/list`,
          method: 'GET',
          header: this._getHeaders(),
          success: resolve,
          fail: reject,
        })
      })

      if (res.data && res.data.code === 200) {
        this.setData({ routeList: res.data.data || [] })
      }
    } catch (err) {
      console.error('加载排线列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // ── 跳转详情 ──
  goRouteDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/route-detail/index?id=${id}` })
  },

  // ── 新增排线 ──
  goCreateRoute() {
    wx.navigateTo({ url: '/pages/route-create/index' })
  },

  // ── 通用请求头 ──
  _getHeaders() {
    const token = wx.getStorageSync('token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  },
})
