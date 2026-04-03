/**
 * 车队管理 — 车辆台账 + 四险一金预警
 * Phase 4 机动物流中台
 */
const app = getApp()
const API_BASE = app.globalData?.apiBase || 'http://192.168.1.4:8000'

Page({
  data: {
    activeTab: 'list',
    statusFilter: '',
    vehicleList: [],
    loading: false,
    isAdmin: false,

    // 预警
    alertList: [],
    alertCount: 0,
    alertLoading: false,
    alertDaysIndex: 1,
    alertDaysOptions: [
      { label: '7天内', value: 7 },
      { label: '30天内', value: 30 },
      { label: '60天内', value: 60 },
      { label: '90天内', value: 90 },
    ],
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({ isAdmin: (userInfo.role || 1) >= 5 })
    this.loadVehicleList()
    this.loadAlertCount()
  },

  onShow() {
    this.loadVehicleList()
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadVehicleList(),
      this.data.activeTab === 'alerts' ? this.loadAlerts() : this.loadAlertCount(),
    ]).finally(() => wx.stopPullDownRefresh())
  },

  // ── 标签切换 ──
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'alerts') {
      this.loadAlerts()
    }
  },

  // ── 状态筛选 ──
  setStatusFilter(e) {
    const status = e.currentTarget.dataset.status
    this.setData({ statusFilter: status })
    this.loadVehicleList()
  },

  // ── 加载车辆列表 ──
  async loadVehicleList() {
    this.setData({ loading: true })
    try {
      const params = {}
      if (this.data.statusFilter) {
        params.status = this.data.statusFilter
      }
      const queryStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
      const url = `${API_BASE}/api/v1/vehicles/fleet/list${queryStr ? '?' + queryStr : ''}`

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'GET',
          header: this._getHeaders(),
          success: resolve,
          fail: reject,
        })
      })

      if (res.data && res.data.code === 200) {
        // 计算每辆车的预警
        const today = new Date()
        const vehicles = (res.data.data || []).map(v => {
          const alerts = []
          const checks = [
            { key: 'inspection', label: '年检', date: v.inspection_due },
            { key: 'compulsory_insurance', label: '交强险', date: v.compulsory_ins_due },
            { key: 'commercial_insurance', label: '商业险', date: v.commercial_ins_due },
            { key: 'maintenance', label: '保养', date: v.maintenance_due },
          ]
          checks.forEach(c => {
            if (!c.date) return
            const due = new Date(c.date.replace(/-/g, '/'))
            const remaining = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
            if (remaining <= 30) {
              alerts.push({
                type: c.key,
                label: c.label,
                remaining_days: remaining,
                level: remaining < 0 ? 'expired' : remaining <= 7 ? 'urgent' : 'warning',
              })
            }
          })
          return { ...v, _alerts: alerts }
        })
        this.setData({ vehicleList: vehicles })
      }
    } catch (err) {
      console.error('加载车辆列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // ── 加载预警数量（用于 badge） ──
  async loadAlertCount() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE}/api/v1/vehicles/fleet/alerts?days=30`,
          method: 'GET',
          header: this._getHeaders(),
          success: resolve,
          fail: reject,
        })
      })
      if (res.data && res.data.code === 200) {
        this.setData({ alertCount: res.data.total || 0 })
      }
    } catch (err) {
      console.error('加载预警数量失败:', err)
    }
  },

  // ── 加载预警列表 ──
  async loadAlerts() {
    this.setData({ alertLoading: true })
    const days = this.data.alertDaysOptions[this.data.alertDaysIndex].value
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE}/api/v1/vehicles/fleet/alerts?days=${days}`,
          method: 'GET',
          header: this._getHeaders(),
          success: resolve,
          fail: reject,
        })
      })
      if (res.data && res.data.code === 200) {
        this.setData({
          alertList: res.data.data || [],
          alertCount: res.data.total || 0,
        })
      }
    } catch (err) {
      console.error('加载预警列表失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ alertLoading: false })
    }
  },

  // ── 预警天数切换 ──
  changeAlertDays(e) {
    this.setData({ alertDaysIndex: parseInt(e.detail.value) })
    this.loadAlerts()
  },

  // ── 跳转详情 ──
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/vehicle-detail/index?id=${id}` })
  },

  // ── 新增车辆 ──
  goAddVehicle() {
    wx.navigateTo({ url: '/pages/vehicle-add/index' })
  },

  // ── 通用请求头 ──
  _getHeaders() {
    const token = wx.getStorageSync('token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  },
})
