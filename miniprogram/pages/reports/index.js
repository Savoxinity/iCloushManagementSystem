// ============================================
// BI 报表引擎 — Reports & KPI Dashboard
// V5 修复：度量衡统一为"套"，KPI 改为"套/人·时"
// ============================================
var app = getApp();
var util = require('../../utils/util');

// ★ KPI 达标线基准（套/人·时）
var KPI_BENCHMARK = 25;

Page({
  data: {
    activeDim: 'day',
    kpiCards: [],
    zoneRanking: [],
    staffRanking: [],
    taskStats: { done: 0, running: 0, rejected: 0, pending: 0 },
    completionRate: 0,
    kpiBenchmark: KPI_BENCHMARK,

    // ── 产能录入弹窗 ──
    isAdmin: false,
    showProductionModal: false,
    productionForm: {
      total_sets: '',
      worker_count: '',
      work_hours: '8',
    },
    calculatedKPI: '--',
    submittingProduction: false,

    // ── 7天趋势数据 ──
    dailyProduction: [],
    trendChartData: {
      labels: [],
      sets: [],
      kpis: [],
      maxSets: 4000,
      maxKPI: 40,
    },
  },

  onLoad: function () {
    var userInfo = app.globalData.userInfo || {};
    this.setData({ isAdmin: (userInfo.role || 1) >= 5 });
    this.loadReport('day');
    this.loadDailyProduction();
  },

  onShow: function () {
    this.loadDailyProduction();
  },

  // ── 维度切换 ──────────────────────────────────────────
  switchDim: function (e) {
    var dim = e.currentTarget.dataset.dim;
    this.setData({ activeDim: dim });
    this.loadReport(dim);
  },

  // ── 加载报表数据 ──────────────────────────────────────────
  loadReport: function (dim) {
    var self = this;
    app.request({
      url: '/api/v1/reports/summary?dim=' + dim,
      success: function (res) {
        if (res.code === 200 && res.data) {
          self.processData(res.data);
        } else {
          self.processData(self.getMockData(dim));
        }
      },
    });
  },

  getMockData: function (dim) {
    var multiplier = dim === 'day' ? 1 : dim === 'week' ? 7 : 30;
    return {
      total_tasks: 28 * multiplier, done_tasks: 22 * multiplier, running_tasks: 4,
      rejected_tasks: 2, pending_tasks: 0,
      total_output: 1240 * multiplier, avg_efficiency: 88,
      zone_ranking: [
        { zone_id: 1, zone_name: '洗涤龙工区', count: 480 * multiplier, color: '#3B82F6' },
        { zone_id: 2, zone_name: '单机洗烘区', count: 320 * multiplier, color: '#00FF88' },
        { zone_id: 3, zone_name: '展布平烫A(8滚)', count: 280 * multiplier, color: '#C9A84C' },
        { zone_id: 4, zone_name: '展布平烫B(6滚)', count: 160 * multiplier, color: '#8B5CF6' },
      ],
      staff_ranking: [
        { staff_id: 1, name: '王强', zone_name: '洗涤龙工区', done_count: 8 * multiplier, points_earned: 80 * multiplier, avatarColor: '#3B82F6', initial: '王' },
        { staff_id: 2, name: '赵敏', zone_name: '展布平烫A(8滚)', done_count: 7 * multiplier, points_earned: 70 * multiplier, avatarColor: '#EC4899', initial: '赵' },
        { staff_id: 3, name: '张伟', zone_name: '单机洗烘区', done_count: 6 * multiplier, points_earned: 60 * multiplier, avatarColor: '#F59E0B', initial: '张' },
        { staff_id: 4, name: '刘芳', zone_name: '毛巾折叠区', done_count: 5 * multiplier, points_earned: 50 * multiplier, avatarColor: '#10B981', initial: '刘' },
        { staff_id: 5, name: '陈刚', zone_name: '机动物流区', done_count: 4 * multiplier, points_earned: 40 * multiplier, avatarColor: '#8B5CF6', initial: '陈' },
      ],
    };
  },

  processData: function (data) {
    var total = (data.done_tasks || 0) + (data.running_tasks || 0) + (data.rejected_tasks || 0) + (data.pending_tasks || 0);
    var rate = total > 0 ? Math.round((data.done_tasks / total) * 100) : 0;

    var zoneRanking = data.zone_ranking || [];
    var maxCount = zoneRanking.length > 0 ? zoneRanking[0].count : 1;
    var processedZones = [];
    for (var i = 0; i < zoneRanking.length; i++) {
      var z = zoneRanking[i];
      var copy = {};
      var keys = Object.keys(z);
      for (var k = 0; k < keys.length; k++) { copy[keys[k]] = z[keys[k]]; }
      copy.percent = Math.round((z.count / maxCount) * 100);
      processedZones.push(copy);
    }

    var totalOutput = data.total_output || 0;
    var outputStr = totalOutput >= 1000 ? Math.floor(totalOutput / 1000) + ',' + String(totalOutput % 1000).padStart(3, '0') : String(totalOutput);

    this.setData({
      kpiCards: [
        { id: 1, icon: '📦', label: '总产量（套）', value: outputStr, color: '#00FF88', trend: 1, trendText: '较昨日+8%' },
        { id: 2, icon: '✅', label: '完成任务数', value: String(data.done_tasks || 0), color: '#C9A84C', trend: 1, trendText: '较昨日+3' },
        { id: 3, icon: '⚡', label: '平均效率', value: (data.avg_efficiency || 0) + '%', color: '#3B82F6', trend: 0, trendText: '持平' },
        { id: 4, icon: '🔄', label: '进行中任务', value: String(data.running_tasks || 0), color: '#F59E0B', trend: -1, trendText: '较昨日-1' },
      ],
      zoneRanking: processedZones,
      staffRanking: data.staff_ranking || [],
      taskStats: { done: data.done_tasks || 0, running: data.running_tasks || 0, rejected: data.rejected_tasks || 0, pending: data.pending_tasks || 0 },
      completionRate: rate,
    });
  },

  // ── 加载7天产能数据 ──────────────────────────────────────────
  loadDailyProduction: function () {
    var self = this;
    app.request({
      url: '/api/v1/production/daily',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var data = res.data || [];
          var recent = data.slice(-7);
          self.setData({ dailyProduction: recent });
          self.buildTrendChart(recent);
        }
      },
    });
  },

  buildTrendChart: function (data) {
    if (!data || data.length === 0) return;

    var labels = [];
    var sets = [];
    var kpis = [];
    var maxSets = 0;
    var maxKPI = 0;

    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var dateParts = (d.date || '').split('-');
      labels.push(dateParts.length >= 3 ? dateParts[1] + '/' + dateParts[2] : d.date);
      sets.push(d.total_sets || 0);
      kpis.push(d.efficiency_kpi || 0);
      if (d.total_sets > maxSets) maxSets = d.total_sets;
      if (d.efficiency_kpi > maxKPI) maxKPI = d.efficiency_kpi;
    }

    maxSets = Math.ceil(maxSets / 500) * 500;
    maxKPI = Math.ceil(maxKPI / 5) * 5;

    var setPcts = [];
    var kpiPcts = [];
    for (var j = 0; j < sets.length; j++) {
      setPcts.push(maxSets > 0 ? Math.round((sets[j] / maxSets) * 100) : 0);
      kpiPcts.push(maxKPI > 0 ? Math.round((kpis[j] / maxKPI) * 100) : 0);
    }

    // ★ 达标线百分比
    var benchmarkPct = maxKPI > 0 ? Math.round((KPI_BENCHMARK / maxKPI) * 100) : 0;

    this.setData({
      'trendChartData.labels': labels,
      'trendChartData.sets': sets,
      'trendChartData.kpis': kpis,
      'trendChartData.setPcts': setPcts,
      'trendChartData.kpiPcts': kpiPcts,
      'trendChartData.maxSets': maxSets,
      'trendChartData.maxKPI': maxKPI,
      'trendChartData.benchmarkPct': benchmarkPct,
    });
  },

  // ── 产能录入弹窗 ──────────────────────────────────────────
  openProductionModal: function () {
    this.setData({
      showProductionModal: true,
      productionForm: { total_sets: '', worker_count: '', work_hours: '8' },
      calculatedKPI: '--',
    });
  },

  closeProductionModal: function () {
    this.setData({ showProductionModal: false });
  },

  onSetsInput: function (e) {
    this.setData({ 'productionForm.total_sets': e.detail.value });
    this.recalcKPI();
  },

  onWorkerInput: function (e) {
    this.setData({ 'productionForm.worker_count': e.detail.value });
    this.recalcKPI();
  },

  onHoursInput: function (e) {
    this.setData({ 'productionForm.work_hours': e.detail.value });
    this.recalcKPI();
  },

  recalcKPI: function () {
    var form = this.data.productionForm;
    var s = Number(form.total_sets) || 0;
    var n = Number(form.worker_count) || 0;
    var h = Number(form.work_hours) || 0;
    if (s > 0 && n > 0 && h > 0) {
      var kpi = Math.round((s / (n * h)) * 10) / 10;
      var status = kpi >= KPI_BENCHMARK ? '✓ 达标' : '✗ 未达标';
      this.setData({ calculatedKPI: kpi + ' 套/人·时 ' + status });
    } else {
      this.setData({ calculatedKPI: '--' });
    }
  },

  submitProduction: function () {
    var self = this;
    var form = this.data.productionForm;
    var s = Number(form.total_sets) || 0;
    var n = Number(form.worker_count) || 0;
    var h = Number(form.work_hours) || 0;

    if (s <= 0) { util.showError('请输入洗涤套数'); return; }
    if (n <= 0) { util.showError('请输入出勤人数'); return; }
    if (h <= 0) { util.showError('请输入工时'); return; }

    self.setData({ submittingProduction: true });

    app.request({
      url: '/api/v1/production/daily',
      method: 'POST',
      data: {
        date: util.today(),
        total_sets: s,
        worker_count: n,
        work_hours: h,
      },
      success: function (res) {
        self.setData({ submittingProduction: false });
        if (res.code === 200) {
          util.showSuccess('录入成功');
          self.closeProductionModal();
          self.loadDailyProduction();
        } else {
          util.showError(res.message || '录入失败');
        }
      },
    });
  },
});
