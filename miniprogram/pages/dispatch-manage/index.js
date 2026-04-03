/**
 * 出车调度 — 车-线-人 三位一体
 * Phase 4 机动物流中台
 */
const app = getApp()
const API_BASE = app.globalData?.apiBase || 'http://192.168.1.4:8000'

Page({
  data: {
    selectedDate: '',
    statusFilter: '',
    dispatchList: [],
    loading: false,
    isAdmin: false,
    stats: { total: 0, pending: 0, delivering: 0, completed: 0 },
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({
      isAdmin: (userInfo.role || 1) >= 5,
      selectedDate: this._formatDate(new Date()),
    })
    this.loadDispatches()
  },

  onShow() {
    this.loadDispatches()
  },

  onPullDownRefresh() {
    this.loadDispatches().finally(() => wx.stopPullDownRefresh())
  },

  // ── 日期操作 ──
  changeDate(e) {
    this.setData({ selectedDate: e.detail.value })
    this.loadDispatches()
  },

  prevDay() {
    const d = new Date(this.data.selectedDate)
    d.setDate(d.getDate() - 1)
    this.setData({ selectedDate: this._formatDate(d) })
    this.loadDispatches()
  },

  nextDay() {
    const d = new Date(this.data.selectedDate)
    d.setDate(d.getDate() + 1)
    this.setData({ selectedDate: this._formatDate(d) })
    this.loadDispatches()
  },

  goToday() {
    this.setData({ selectedDate: this._formatDate(new Date()) })
    this.loadDispatches()
  },

  filterByStatus(e) {
    this.setData({ statusFilter: e.currentTarget.dataset.status || '' })
    this.loadDispatches()
  },

  // ── 加载调度单列表 ──
  async loadDispatches() {
    this.setData({ loading: true })
    try {
      const params = [`work_date=${this.data.selectedDate}`]
      if (this.data.statusFilter) {
        params.push(`status=${this.data.statusFilter}`)
      }
      const url = `${API_BASE}/api/v1/vehicles/dispatch/list?${params.join('&')}`

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
        const list = (res.data.data || []).map(d => {
          // 计算打卡进度
          const checkins = d.stop_checkins || []
          const checkedCount = checkins.filter(s => s.checked_in_at).length
          const checkinPct = checkins.length > 0 ? Math.round(checkedCount / checkins.length * 100) : 0

          return {
            ...d,
            _checkedCount: checkedCount,
            _checkinPct: checkinPct,
            _departedTime: d.departed_at ? this._formatTime(d.departed_at.replace(/-/g, '/')) : '',
            _returnedTime: d.returned_at ? this._formatTime(d.returned_at.replace(/-/g, '/')) : '',
            _driverName: d.driver_name || ('员工#' + d.driver_id),
          }
        })

        // 计算统计
        const stats = {
          total: list.length,
          pending: list.filter(d => d.status === 'pending').length,
          delivering: list.filter(d => d.status === 'delivering').length,
          completed: list.filter(d => d.status === 'completed').length,
        }

        this.setData({ dispatchList: list, stats })
      }
    } catch (err) {
      console.error('加载调度单失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // ── 出发打卡 ──
  async doDepart(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认出发',
      content: '确认开始出车吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const resp = await new Promise((resolve, reject) => {
            wx.request({
              url: `${API_BASE}/api/v1/vehicles/dispatch/${id}/depart`,
              method: 'PUT',
              header: this._getHeaders(),
              success: resolve,
              fail: reject,
            })
          })
          if (resp.data && resp.data.code === 200) {
            wx.showToast({ title: '已出发', icon: 'success' })
            this.loadDispatches()
          } else {
            wx.showToast({ title: resp.data?.detail || '操作失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '网络错误', icon: 'none' })
        }
      },
    })
  },

  // ── 返回打卡 ──
  async doReturn(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认返回',
      content: '确认完成出车返回吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const resp = await new Promise((resolve, reject) => {
            wx.request({
              url: `${API_BASE}/api/v1/vehicles/dispatch/${id}/return`,
              method: 'PUT',
              header: this._getHeaders(),
              success: resolve,
              fail: reject,
            })
          })
          if (resp.data && resp.data.code === 200) {
            wx.showToast({ title: '出车完成', icon: 'success' })
            this.loadDispatches()
          } else {
            wx.showToast({ title: resp.data?.detail || '操作失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '网络错误', icon: 'none' })
        }
      },
    })
  },

  // ── 跳转详情 ──
  goDispatchDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/dispatch-detail/index?id=${id}` })
  },

  // ── 创建调度单 ──
  goCreateDispatch() {
    wx.navigateTo({ url: '/pages/dispatch-create/index' })
  },

  // ── 工具函数 ──
  _formatDate(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  _formatTime(isoStr) {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },

  _getHeaders() {
    const token = wx.getStorageSync('token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  },
})
