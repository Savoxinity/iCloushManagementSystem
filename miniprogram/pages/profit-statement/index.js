// ============================================
// 管理利润表 — 边际贡献、盈亏平衡 + 纯WXML可视化
// 移除 ECharts 依赖，使用纯 CSS 柱状图/条形图
// ============================================
var app = getApp();

// 成本分类颜色
var PIE_COLORS = ['#E8A945', '#D4942E', '#F59E0B', '#B45309', '#92400E', '#78350F', '#C9A84C', '#A3E635', '#10B981', '#06B6D4', '#8B5CF6'];

Page({
  data: {
    period: '',
    statement: null,
    loading: false,
    waterfallBars: [],
  },

  onLoad: function () {
    var now = new Date();
    var period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    this.setData({ period: period });
    this.loadStatement(period);
  },

  onDateChange: function (e) {
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
          s.revenue_display = self._fmt(s.revenue);
          s.variable_cost_display = self._fmt(s.variable_cost || s.variable_costs);
          s.fixed_cost_display = self._fmt(s.fixed_cost || s.fixed_costs);
          s.contribution_margin_display = self._fmt(s.contribution_margin);
          var netProfit = s.net_profit || s.net_operating_profit || 0;
          s.net_profit_display = self._fmt(Math.abs(netProfit));
          s.breakeven_display = self._fmt(s.breakeven_revenue);
          s.cm_ratio_display = s.cm_ratio ? (s.cm_ratio * 100).toFixed(1) + '%' : '--';
          s.isProfit = netProfit >= 0;
          s.revenue_source_label = s.revenue_source === 'manual' ? '手动录入' : '产能估算';

          // 盈亏平衡进度
          var beRevenue = s.breakeven_revenue || 0;
          s.be_progress = beRevenue > 0 ? Math.min((s.revenue / beRevenue) * 100, 100).toFixed(1) : 0;

          // 构建成本明细数组 + 百分比 + 颜色
          var breakdown = [];
          var totalCost = (s.variable_cost || s.variable_costs || 0) + (s.fixed_cost || s.fixed_costs || 0);
          if (s.by_category) {
            var keys = Object.keys(s.by_category);
            for (var i = 0; i < keys.length; i++) {
              if (s.by_category[keys[i]] > 0) {
                var val = s.by_category[keys[i]];
                breakdown.push({
                  name: keys[i],
                  value: val,
                  display: self._fmt(val),
                  pct: totalCost > 0 ? (val / totalCost * 100).toFixed(1) : '0',
                  color: PIE_COLORS[i % PIE_COLORS.length],
                });
              }
            }
          }
          s.cost_breakdown = breakdown;

          // 构建瀑布图数据
          var revenue = s.revenue || 0;
          var varCost = s.variable_cost || s.variable_costs || 0;
          var cm = s.contribution_margin || 0;
          var fixCost = s.fixed_cost || s.fixed_costs || 0;
          var absNetProfit = Math.abs(netProfit);

          var values = [revenue, varCost, cm, fixCost, absNetProfit];
          var labels = ['营收', '变动成本', '边际贡献', '固定成本', '净利润'];
          // 瀑布底座高度（从底部开始的偏移）
          var bases = [0, cm, 0, Math.max(netProfit, 0), 0];
          var maxVal = Math.max(revenue, varCost + cm, cm, fixCost + Math.max(netProfit, 0), absNetProfit, 1);
          var barColors = ['bar-green', 'bar-red', 'bar-gold', 'bar-red', netProfit >= 0 ? 'bar-green' : 'bar-red'];

          var waterfallBars = [];
          for (var j = 0; j < values.length; j++) {
            var barPct = (values[j] / maxVal * 70).toFixed(1);
            var spacerPct = (bases[j] / maxVal * 70).toFixed(1);
            waterfallBars.push({
              label: labels[j],
              value: values[j],
              displayVal: self._fmtShort(values[j]),
              barPct: barPct,
              spacerPct: spacerPct,
              colorClass: barColors[j],
            });
          }

          self.setData({ statement: s, waterfallBars: waterfallBars });
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  _fmt: function (val) {
    if (val === null || val === undefined) return '--';
    return parseFloat(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  _fmtShort: function (val) {
    if (!val) return '0';
    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
    return parseFloat(val).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  },
});
