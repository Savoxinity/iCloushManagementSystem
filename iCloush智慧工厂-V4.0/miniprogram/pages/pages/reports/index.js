// ============================================
// 数据报表页面
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    activeDim: 'day',
    kpiCards: [],
    zoneRanking: [],
    staffRanking: [],
    taskStats: { done: 0, running: 0, rejected: 0, pending: 0 },
    completionRate: 0,
  },

  onLoad: function () { this.loadReport('day'); },

  switchDim: function (e) {
    var dim = e.currentTarget.dataset.dim;
    this.setData({ activeDim: dim });
    this.loadReport(dim);
  },

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
        { id: 1, icon: '📦', label: '总产量（件）', value: outputStr, color: '#00FF88', trend: 1, trendText: '较昨日+8%' },
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
});
