// ============================================
// 管理利润表 — 边际贡献、盈亏平衡分析
// ============================================
var app = getApp();

Page({
  data: {
    period: '',       // YYYY-MM
    statement: null,
    loading: false,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '管理利润表' });
    // 默认当前月
    var now = new Date();
    var period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    this.setData({ period: period });
    this.loadStatement(period);
  },

  onDateChange: function (e) {
    // picker 返回 YYYY-MM
    var period = e.detail.value;
    this.setData({ period: period });
    this.loadStatement(period);
  },

  loadStatement: function (period) {
    var self = this;
    self.setData({ loading: true });
    app.request({
      url: '/api/v1/accounting/profit-statement?period=' + period,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200 && res.data) {
          var s = res.data;
          // 格式化数字
          s.revenue_display = self._formatMoney(s.revenue);
          s.variable_cost_display = self._formatMoney(s.variable_cost);
          s.fixed_cost_display = self._formatMoney(s.fixed_cost);
          s.contribution_margin_display = self._formatMoney(s.contribution_margin);
          s.net_profit_display = self._formatMoney(s.net_profit);
          s.breakeven_display = self._formatMoney(s.breakeven_revenue);
          s.cm_ratio_display = s.cm_ratio ? (s.cm_ratio * 100).toFixed(1) + '%' : '--';
          s.isProfit = s.net_profit >= 0;
          self.setData({ statement: s });
        }
      },
    });
  },

  _formatMoney: function (val) {
    if (val === null || val === undefined) return '--';
    return parseFloat(val).toFixed(2);
  },
});
