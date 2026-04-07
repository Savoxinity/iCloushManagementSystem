/**
 * 成本分类明细账 — Phase 4.1 PRD 2.3
 * 顶部 Tab 切换成本分类，动态汇总卡片 + 底层列表
 *
 * Bug 修复：
 *   1. app.request 不支持 complete 回调 → 在 success/fail 中手动重置 loading
 *   2. 日期分类按 occur_date（发生日期）聚类，而非 trade_date（录入时间）
 */
var app = getApp()

// 成本分类 Tab 配置
var CATEGORY_TABS = [
  { code: '', name: '全部' },
  { code: 'E-1', name: '员工工资' },
  { code: 'E-0', name: '折旧摊销' },
  { code: 'E-5', name: '设备维修' },
  { code: 'E-3', name: '水电能源' },
  { code: 'E-10', name: '员工报销' },
  { code: 'E-2', name: '原辅材料' },
  { code: 'E-4', name: '包装物流' },
  { code: 'E-6', name: '质检损耗' },
  { code: 'E-7', name: '租金物业' },
  { code: 'E-8', name: '行政办公' },
  { code: 'E-9', name: '营销推广' },
]

Page({
  data: {
    tabs: CATEGORY_TABS,
    activeTab: 0,
    currentCategory: '',

    // 月份选择
    currentPeriod: '',
    periodDisplay: '',

    // 汇总
    summary: { total_amount: 0, total_count: 0 },

    // 列表
    items: [],
    loading: false,
    page: 1,
    hasMore: true,
  },

  onLoad: function () {
    // 默认当月
    var now = new Date()
    var y = now.getFullYear()
    var m = now.getMonth() + 1
    var period = y + '-' + (m < 10 ? '0' + m : m)
    this.setData({
      currentPeriod: period,
      periodDisplay: y + '年' + m + '月',
    })
    this.loadData(true)
  },

  onShow: function () {
    // 从其他页面返回时刷新
    if (this.data.currentPeriod) this.loadData(true)
  },

  // ── Tab 切换 ──
  onTabChange: function (e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var tab = CATEGORY_TABS[idx]
    this.setData({
      activeTab: idx,
      currentCategory: tab.code,
      page: 1,
      hasMore: true,
      items: [],
      loading: false,
    })
    this.loadData(true)
  },

  // ── 月份选择 ──
  onPeriodChange: function (e) {
    var val = e.detail.value // YYYY-MM
    var parts = val.split('-')
    this.setData({
      currentPeriod: val,
      periodDisplay: parts[0] + '年' + parseInt(parts[1]) + '月',
      page: 1,
      hasMore: true,
      items: [],
      loading: false,
    })
    this.loadData(true)
  },

  // ── 加载数据 ──
  loadData: function (reset) {
    if (this.data.loading) return
    var self = this
    var page = reset ? 1 : self.data.page

    self.setData({ loading: true })

    var params = {
      period: self.data.currentPeriod,
      page: page,
      page_size: 50,
    }
    if (self.data.currentCategory) {
      params.category_code = self.data.currentCategory
    }

    app.request({
      url: '/api/v1/accounting/cost-ledger',
      data: params,
      success: function (res) {
        // 关键修复：在 success 中重置 loading（app.request 不支持 complete）
        if (res.code === 200 && res.data) {
          var newItems = (res.data.items || []).map(function (item) {
            return {
              id: item.id,
              item_name: item.item_name || '未命名',
              category_name: item.category_name || '',
              post_tax_amount: item.post_tax_amount || 0,
              // 优先显示 occur_date（发生日期），回退到 trade_date
              trade_date: item.occur_date || item.trade_date || '',
              invoice_status_label: item.invoice_status_label || '无票',
              source_label: item.source_label || '手动录入',
              creator_name: item.creator_name || '',
              cost_behavior_label: item.cost_behavior_label || '',
            }
          })

          self.setData({
            loading: false,
            summary: res.data.summary || { total_amount: 0, total_count: 0 },
            items: reset ? newItems : self.data.items.concat(newItems),
            page: page + 1,
            hasMore: newItems.length >= 50,
          })
        } else {
          self.setData({ loading: false })
        }
      },
      fail: function () {
        // 关键修复：在 fail 中也重置 loading
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      },
    })
  },

  // ── 下拉加载更多 ──
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadData(false)
    }
  },

  // ── 下拉刷新 ──
  onPullDownRefresh: function () {
    this.setData({ page: 1, hasMore: true, items: [], loading: false })
    this.loadData(true)
    wx.stopPullDownRefresh()
  },
})
