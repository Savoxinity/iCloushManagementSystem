const app = getApp();
const util = require('../../utils/util');
Page({
  data: {
    activeDim: 'day',
    kpiCards: [], zoneRanking: [], staffRanking: [],
    taskStats: { done: 0, running: 0, rejected: 0, pending: 0 },
    completionRate: 0,
  },
  onLoad() { this.loadReport('day'); },
  switchDim(e) { const dim = e.currentTarget.dataset.dim; this.setData({ activeDim: dim }); this.loadReport(dim); },
  loadReport(dim) {
    app.request({ url: `/api/v1/reports/summary?dim=${dim}`, method: 'GET' })
      .then(res => { this.processData(res.data); })
      .catch(() => { this.processData(this.getMockData(dim)); });
  },
  getMockData(dim) {
    const multiplier = dim === 'day' ? 1 : dim === 'week' ? 7 : 30;
    return {
      total_tasks: 28 * multiplier, done_tasks: 22 * multiplier, running_tasks: 4,
      rejected_tasks: 2, pending_tasks: 0,
      total_output: 1240 * multiplier, avg_efficiency: 88,
      zone_ranking: [
        { zone_id: 1, zone_name: '隧道洗涤龙工区', count: 480 * multiplier, color: '#3B82F6' },
        { zone_id: 2, zone_name: '单机洗涤区', count: 320 * multiplier, color: '#00FF88' },
        { zone_id: 3, zone_name: '烫平展布工区', count: 280 * multiplier, color: '#C9A84C' },
        { zone_id: 4, zone_name: '后处理折叠区', count: 160 * multiplier, color: '#8B5CF6' },
      ],
      staff_ranking: [
        { staff_id: 1, name: '王建国', zone_name: '隧道洗涤龙工区', done_count: 8 * multiplier, points_earned: 80 * multiplier, avatarColor: '#3B82F6', initial: '王' },
        { staff_id: 2, name: '李秀英', zone_name: '烫平展布工区', done_count: 7 * multiplier, points_earned: 70 * multiplier, avatarColor: '#EC4899', initial: '李' },
        { staff_id: 3, name: '张伟', zone_name: '单机洗涤区', done_count: 6 * multiplier, points_earned: 60 * multiplier, avatarColor: '#F59E0B', initial: '张' },
        { staff_id: 4, name: '刘芳', zone_name: '后处理折叠区', done_count: 5 * multiplier, points_earned: 50 * multiplier, avatarColor: '#10B981', initial: '刘' },
        { staff_id: 5, name: '陈强', zone_name: '机动物流区', done_count: 4 * multiplier, points_earned: 40 * multiplier, avatarColor: '#8B5CF6', initial: '陈' },
      ],
    };
  },
  processData(data) {
    const total = data.done_tasks + data.running_tasks + data.rejected_tasks + data.pending_tasks;
    const rate = total > 0 ? Math.round((data.done_tasks / total) * 100) : 0;
    const maxCount = data.zone_ranking[0]?.count || 1;
    const zoneRanking = data.zone_ranking.map(z => ({ ...z, percent: Math.round((z.count / maxCount) * 100) }));
    this.setData({
      kpiCards: [
        { id: 1, icon: '📦', label: '总产量（件）', value: data.total_output.toLocaleString(), color: '#00FF88', trend: 1, trendText: '较昨日+8%' },
        { id: 2, icon: '✅', label: '完成任务数', value: data.done_tasks, color: '#C9A84C', trend: 1, trendText: '较昨日+3' },
        { id: 3, icon: '⚡', label: '平均效率', value: `${data.avg_efficiency}%`, color: '#3B82F6', trend: 0, trendText: '持平' },
        { id: 4, icon: '🔄', label: '进行中任务', value: data.running_tasks, color: '#F59E0B', trend: -1, trendText: '较昨日-1' },
      ],
      zoneRanking,
      staffRanking: data.staff_ranking,
      taskStats: { done: data.done_tasks, running: data.running_tasks, rejected: data.rejected_tasks, pending: data.pending_tasks },
      completionRate: rate,
    });
  },
});
