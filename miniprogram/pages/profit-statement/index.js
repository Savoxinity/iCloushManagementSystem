// ============================================
// 管理利润表 — 边际贡献、盈亏平衡 + ECharts 可视化
// ============================================
var app = getApp();

Page({
  data: {
    period: '',
    statement: null,
    loading: false,
    ecWaterfall: { lazyLoad: true },
    ecPie: { lazyLoad: true },
  },

  waterfallChart: null,
  pieChart: null,

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
          s.net_profit_display = self._fmt(Math.abs(s.net_profit || s.net_operating_profit));
          s.breakeven_display = self._fmt(s.breakeven_revenue);
          s.cm_ratio_display = s.cm_ratio ? (s.cm_ratio * 100).toFixed(1) + '%' : '--';
          s.isProfit = (s.net_profit || s.net_operating_profit || 0) >= 0;
          s.revenue_source_label = s.revenue_source === 'manual' ? '手动录入' : '产能估算';

          // 盈亏平衡进度
          var beRevenue = s.breakeven_revenue || 0;
          s.be_progress = beRevenue > 0 ? Math.min((s.revenue / beRevenue) * 100, 100) : 0;

          // 构建成本明细数组
          var breakdown = [];
          if (s.by_category) {
            var keys = Object.keys(s.by_category);
            for (var i = 0; i < keys.length; i++) {
              if (s.by_category[keys[i]] > 0) {
                breakdown.push({ name: keys[i], value: s.by_category[keys[i]], display: self._fmt(s.by_category[keys[i]]) });
              }
            }
          }
          s.cost_breakdown = breakdown;

          self.setData({ statement: s });

          // 延迟初始化图表
          setTimeout(function () {
            self._initWaterfallChart(s);
            self._initPieChart(breakdown);
          }, 500);
        }
      },
      fail: function () {
        self.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  _initWaterfallChart: function (s) {
    var self = this;
    var comp = this.selectComponent('#waterfallChart');
    if (!comp) return;

    comp.init(function (canvas, width, height, dpr) {
      var echarts = require('../../components/ec-canvas/echarts');
      var chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      self.waterfallChart = chart;

      var revenue = s.revenue || 0;
      var varCost = s.variable_cost || s.variable_costs || 0;
      var cm = s.contribution_margin || 0;
      var fixCost = s.fixed_cost || s.fixed_costs || 0;
      var netProfit = s.net_profit || s.net_operating_profit || 0;

      var categories = ['营收', '变动成本', '边际贡献', '固定成本', '净利润'];
      // 透明底座（瀑布效果）
      var base = [0, cm, 0, Math.max(netProfit, 0), 0];
      var values = [revenue, varCost, cm, fixCost, Math.abs(netProfit)];
      var colors = ['#10B981', '#EF4444', '#E8A945', '#EF4444', netProfit >= 0 ? '#10B981' : '#EF4444'];

      chart.setOption({
        backgroundColor: 'transparent',
        grid: { left: 10, right: 10, top: 20, bottom: 30, containLabel: true },
        xAxis: {
          type: 'category',
          data: categories,
          axisLabel: { color: '#999', fontSize: 10 },
          axisLine: { lineStyle: { color: '#333' } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: '#666',
            fontSize: 9,
            formatter: function (v) { return (v / 10000).toFixed(0) + '万'; }
          },
          splitLine: { lineStyle: { color: '#222' } },
          axisLine: { show: false },
        },
        series: [
          {
            name: '底座',
            type: 'bar',
            stack: 'waterfall',
            itemStyle: { color: 'transparent' },
            data: base,
          },
          {
            name: '数值',
            type: 'bar',
            stack: 'waterfall',
            barWidth: '50%',
            label: {
              show: true,
              position: 'top',
              color: '#ccc',
              fontSize: 9,
              formatter: function (params) {
                return (params.value / 10000).toFixed(1) + '万';
              },
            },
            data: values.map(function (v, i) {
              return { value: v, itemStyle: { color: colors[i] } };
            }),
          },
        ],
      });

      return chart;
    });
  },

  _initPieChart: function (breakdown) {
    var self = this;
    if (!breakdown || breakdown.length === 0) return;

    var comp = this.selectComponent('#pieChart');
    if (!comp) return;

    comp.init(function (canvas, width, height, dpr) {
      var echarts = require('../../components/ec-canvas/echarts');
      var chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      self.pieChart = chart;

      var pieColors = ['#E8A945', '#D4942E', '#F59E0B', '#B45309', '#92400E', '#78350F', '#C9A84C', '#A3E635', '#10B981', '#06B6D4', '#8B5CF6', '#EF4444'];

      chart.setOption({
        backgroundColor: 'transparent',
        legend: {
          bottom: 0,
          textStyle: { color: '#999', fontSize: 10 },
          itemWidth: 10,
          itemHeight: 10,
        },
        series: [{
          type: 'pie',
          radius: ['35%', '60%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          label: {
            show: true,
            color: '#ccc',
            fontSize: 9,
            formatter: '{b}\n{d}%',
          },
          labelLine: { lineStyle: { color: '#555' } },
          data: breakdown.map(function (item, i) {
            return {
              name: item.name,
              value: item.value,
              itemStyle: { color: pieColors[i % pieColors.length] },
            };
          }),
        }],
      });

      return chart;
    });
  },

  _fmt: function (val) {
    if (val === null || val === undefined) return '--';
    return parseFloat(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
});
