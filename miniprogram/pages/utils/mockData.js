/**
 * mockData.js — iCloush 智慧工厂 Mock 数据
 */

var USERS = [
  { id: 'u001', name: '张伟', role: 7, avatar_key: 'male_admin_01', skills: ['洗涤龙', '单机洗', '烫平机', '物流驾驶'], is_multi_post: true, status: 'active', total_points: 3860, monthly_points: 420, task_completed: 187, current_zones: ['zone_a'] },
  { id: 'u002', name: '李娜', role: 5, avatar_key: 'female_supervisor_01', skills: ['分拣打标', '手工洗涤', '熨烫'], is_multi_post: true, status: 'active', total_points: 2140, monthly_points: 310, task_completed: 98, current_zones: ['zone_g'] },
  { id: 'u003', name: '王强', role: 3, avatar_key: 'male_washer_01', skills: ['洗涤龙', '单机洗'], is_multi_post: false, status: 'active', total_points: 1580, monthly_points: 220, task_completed: 76, current_zones: ['zone_a'] },
  { id: 'u004', name: '赵敏', role: 1, avatar_key: 'female_washer_01', skills: ['烫平机', '展布机', '折叠'], is_multi_post: true, status: 'active', total_points: 980, monthly_points: 145, task_completed: 52, current_zones: ['zone_c'] },
  { id: 'u005', name: '陈刚', role: 1, avatar_key: 'male_driver_01', skills: ['物流驾驶', '跟车小工'], is_multi_post: false, status: 'active', total_points: 760, monthly_points: 98, task_completed: 41, current_zones: ['zone_f'] },
  { id: 'u006', name: '刘芳', role: 1, avatar_key: 'female_ironer_01', skills: ['烫平机', '展布机'], is_multi_post: false, status: 'leave', total_points: 620, monthly_points: 0, task_completed: 33, current_zones: [] },
];

// ═══ F1 重工区 Pipeline 封闭循环 ═══
// 机动物流区(装卸) → 收脏分拣区 → 洗涤龙工区 or 单机洗烘区(5水洗+2贯通烘干)
// → 展布平烫区A(8滚) or 展布平烫区B(6滚) → 毛巾折叠区 → 机动物流区(装卸)
//
// ═══ F2 精洗区 Pipeline ═══
// 分拣打标区 → 洗烘区 → 手工洗涤区 → 烘房区 → 熨烫区 → 收发挂衣区

var ZONES = [
  // ── F1 Row1 ──
  { id: 5, name: '收脏分拣区', code: 'zone_e', floor: 1, color: '#EF4444', status: 'running', capacity: 2, staff_count: 1, iot_summary: { used: 8, total: 20, alert: 0, done: 8, target: 20 }, iot_summary_text: '分拣台 8/20袋', pos: { left: '4%', top: '6%', width: '44%', height: '22%' }, pipeline_order: 2 },
  { id: 10, name: '毛巾折叠区', code: 'zone_j', floor: 1, color: '#8B5CF6', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 1, idle: 1, alert: 0, done: 320, target: 500 }, iot_summary_text: '1台运行 · 320/500', pos: { left: '52%', top: '6%', width: '44%', height: '22%' }, pipeline_order: 6 },
  // ── F1 Row2 ──
  { id: 1, name: '洗涤龙工区', code: 'zone_a', floor: 1, color: '#3B82F6', status: 'running', capacity: 4, staff_count: 3, iot_summary: { running: 2, idle: 1, alert: 0, done: 480, target: 600 }, iot_summary_text: '2台运行 · 化料78%', pos: { left: '4%', top: '32%', width: '44%', height: '24%' }, pipeline_order: 3 },
  { id: 3, name: '展布平烫A(8滚)', code: 'zone_c', floor: 1, color: '#F59E0B', status: 'warning', capacity: 4, staff_count: 4, iot_summary: { running: 2, idle: 1, alert: 1, done: 380, target: 500 }, iot_summary_text: '8滚烫平 · 1台告警', pos: { left: '52%', top: '32%', width: '44%', height: '24%' }, pipeline_order: 5 },
  // ── F1 Row3 ──
  { id: 2, name: '单机洗烘区', code: 'zone_b', floor: 1, color: '#10B981', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 5, idle: 2, alert: 0, done: 240, target: 350 }, iot_summary_text: '5台水洗+2台烘干', pos: { left: '4%', top: '58%', width: '44%', height: '24%' }, pipeline_order: 4 },
  { id: 4, name: '展布平烫B(6滚)', code: 'zone_d', floor: 1, color: '#F97316', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 1, idle: 1, alert: 0, done: 260, target: 400 }, iot_summary_text: '6滚烫平 · 正常', pos: { left: '52%', top: '58%', width: '44%', height: '24%' }, pipeline_order: 5 },
  // ── F1 Row4 物流通道 ──
  { id: 6, name: '机动物流区', code: 'zone_f', floor: 1, color: '#C9A84C', status: 'running', capacity: 3, staff_count: 2, iot_summary: { out: 2, in_factory: 1, idle: 0, done: 45, target: 80 }, iot_summary_text: '2车出勤 · 1车在厂', pos: { left: '4%', top: '84%', width: '92%', height: '14%' }, pipeline_order: 1 },

  // ── F2 Row1 ──
  { id: 7, name: '分拣打标区', code: 'zone_g', floor: 2, color: '#EC4899', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 1, idle: 0, alert: 0, done: 120, target: 200 }, iot_summary_text: '打标机运行中', pos: { left: '4%', top: '6%', width: '44%', height: '26%' }, pipeline_order: 1 },
  { id: 11, name: '烘房区', code: 'zone_k', floor: 2, color: '#F59E0B', status: 'running', capacity: 2, staff_count: 1, iot_summary: { running: 2, idle: 0, alert: 0, done: 80, target: 120 }, iot_summary_text: '2间运行 · 65°C', pos: { left: '52%', top: '6%', width: '44%', height: '26%' }, pipeline_order: 4 },
  // ── F2 Row2 ──
  { id: 8, name: '洗烘区', code: 'zone_h', floor: 2, color: '#06B6D4', status: 'running', capacity: 3, staff_count: 3, iot_summary: { running: 2, idle: 1, alert: 0, done: 90, target: 150 }, iot_summary_text: '2台洗烘运行', pos: { left: '4%', top: '36%', width: '44%', height: '26%' }, pipeline_order: 2 },
  { id: 12, name: '熨烫区', code: 'zone_l', floor: 2, color: '#EF4444', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 2, idle: 1, alert: 0, done: 100, target: 160 }, iot_summary_text: '2台熨烫运行', pos: { left: '52%', top: '36%', width: '44%', height: '26%' }, pipeline_order: 5 },
  // ── F2 Row3 ──
  { id: 9, name: '手工洗涤区', code: 'zone_i', floor: 2, color: '#8B5CF6', status: 'idle', capacity: 2, staff_count: 1, iot_summary: { running: 0, idle: 2, alert: 0, done: 15, target: 30 }, iot_summary_text: '手工台 · 待机中', pos: { left: '4%', top: '66%', width: '44%', height: '26%' }, pipeline_order: 3 },
  { id: 13, name: '收发挂衣区', code: 'zone_m', floor: 2, color: '#84CC16', status: 'running', capacity: 2, staff_count: 1, iot_summary: { done: 65, target: 100, alert: 0 }, iot_summary_text: '挂衣 65/100件', pos: { left: '52%', top: '66%', width: '44%', height: '26%' }, pipeline_order: 6 },
];

// ─── 任务数据 ───────────────────────────────────────────────────
var TASKS = [
  { id: 't001', title: '洗涤龙日常计件', task_type: 'routine', zone_id: 1, zone_name: '洗涤龙工区', status: 2, priority: 2, points_reward: 50, progress: 68, target: 120, unit: '件', requires_photo: false, description: '按标准操作规程运行洗涤龙，每完成一批次记录件数。', deadline: null, assigned_to: 'u003' },
  { id: 't002', title: '8滚烫平机设备巡检', task_type: 'periodic', zone_id: 3, zone_name: '展布平烫A(8滚)', status: 1, priority: 3, points_reward: 80, progress: 0, target: 1, unit: '次', requires_photo: true, description: '对8滚高速烫平机进行例行巡检，检查加热管、传送带、安全装置，拍照存档。', deadline: Date.now() + 3600000, assigned_to: 'u004' },
  { id: 't003', title: '客户专属制服交付', task_type: 'specific', zone_id: 12, zone_name: '熨烫区', status: 0, priority: 4, points_reward: 120, progress: 0, target: 1, unit: '批', requires_photo: true, description: '某酒店50套制服洗烫完成后，拍照确认质量，联系司机安排配送。', deadline: Date.now() + 7200000, assigned_to: null },
  { id: 't004', title: '单机洗烘日常计件', task_type: 'routine', zone_id: 2, zone_name: '单机洗烘区', status: 4, priority: 2, points_reward: 40, progress: 85, target: 85, unit: '件', requires_photo: false, description: '5台水洗单机+2台贯通烘干机日常计件任务。', deadline: null, assigned_to: 'u003' },
];

function getTaskStats() {
  var total = TASKS.length;
  var pending = 0, running = 0, reviewing = 0, done = 0;
  for (var i = 0; i < TASKS.length; i++) {
    var s = TASKS[i].status;
    if (s === 0 || s === 1) pending++;
    else if (s === 2) running++;
    else if (s === 3) reviewing++;
    else if (s === 4) done++;
  }
  return { total: total, pending: pending, running: running, reviewing: reviewing, done: done };
}

// ─── 车辆数据 ───────────────────────────────────────────────────
var VEHICLES = [
  { id: 'v001', plate: '沪A·88888', type: '厢式货车', status: 'out', driver_id: 'u005', driver_name: '陈刚', load_current: 45, load_max: 80, unit: '袋', last_update: Date.now() - 600000 },
  { id: 'v002', plate: '沪B·66666', type: '小型面包车', status: 'in', driver_id: null, driver_name: '待分配', load_current: 0, load_max: 30, unit: '袋', last_update: Date.now() - 1800000 },
  { id: 'v003', plate: '沪C·77777', type: '厢式货车', status: 'repair', driver_id: null, driver_name: '维修中', load_current: 0, load_max: 80, unit: '袋', last_update: Date.now() - 86400000 },
];

// ─── IoT 设备数据 ────────────────────────────────────────────────
var IOT_DEVICES = [
  { id: 'd001', name: '洗涤龙1号', zone_id: 1, device_type: 'washer_tunnel', status: 'running', chemical_pct: 78, temp: 65, cycle_count: 12, last_heartbeat: Date.now() - 30000, alerts: [] },
  { id: 'd002', name: '洗涤龙2号', zone_id: 1, device_type: 'washer_tunnel', status: 'running', chemical_pct: 45, temp: 62, cycle_count: 8, last_heartbeat: Date.now() - 45000, alerts: [{ level: 'warning', msg: '化料余量低于50%，请及时补充' }] },
  { id: 'd003', name: '8滚烫平机A', zone_id: 3, device_type: 'ironer', status: 'warning', temp: 185, speed: 3.2, last_heartbeat: Date.now() - 120000, alerts: [{ level: 'error', msg: '传送带张力异常，建议停机检查' }] },
  { id: 'd004', name: '化料配送泵', zone_id: 1, device_type: 'chemical_pump', status: 'running', flow_rate: 2.4, pressure: 1.8, last_heartbeat: Date.now() - 15000, alerts: [] },
  { id: 'd005', name: '贯通烘干机1号', zone_id: 2, device_type: 'dryer', status: 'running', temp: 82, last_heartbeat: Date.now() - 20000, alerts: [] },
  { id: 'd006', name: '贯通烘干机2号', zone_id: 2, device_type: 'dryer', status: 'running', temp: 78, last_heartbeat: Date.now() - 25000, alerts: [] },
  { id: 'd007', name: '展布机1号', zone_id: 3, device_type: 'spreader', status: 'maintenance', temp: 0, last_heartbeat: Date.now() - 3600000, alerts: [{ level: 'info', msg: '定期保养中，预计明日恢复' }] },
  { id: 'd008', name: '毛巾折叠机1号', zone_id: 10, device_type: 'folder', status: 'running', last_heartbeat: Date.now() - 10000, alerts: [] },
  { id: 'd009', name: '毛巾折叠机2号', zone_id: 10, device_type: 'folder', status: 'offline', last_heartbeat: Date.now() - 86400000, alerts: [{ level: 'error', msg: '设备已离线超24小时，请检查网络连接' }] },
];

// ─── 积分商城商品 ────────────────────────────────────────────────
var MALL_ITEMS = [
  { id: 'm001', name: '额外休假半天', category: 'leave', points_cost: 500, stock: 10, description: '兑换后可在排班时申请半天带薪休假', icon: '🏖️' },
  { id: 'm002', name: '餐厅优惠券×5', category: 'coupon', points_cost: 200, stock: 50, description: '附近合作餐厅9折优惠券', icon: '🍜' },
  { id: 'm003', name: '超市购物卡50元', category: 'gift_card', points_cost: 800, stock: 20, description: '面值50元超市购物卡', icon: '🛒' },
  { id: 'm004', name: '工作手套（防烫型）', category: 'equipment', points_cost: 150, stock: 30, description: '高温防护工作手套', icon: '🧤' },
  { id: 'm005', name: '月度优秀员工证书', category: 'honor', points_cost: 300, stock: 5, description: '精美证书+公告栏展示', icon: '🏆' },
  { id: 'm006', name: '高铁票报销（单程）', category: 'reimbursement', points_cost: 1200, stock: 3, description: '兑换后提交票据，财务3个工作日内打款', icon: '🚄' },
];

// ─── 积分账本记录 ────────────────────────────────────────────────
var POINT_LEDGER = [
  { id: 'pl001', user_id: 'u003', delta: 50, reason: '完成洗涤龙日常计件', created_at: Date.now() - 3600000 },
  { id: 'pl002', user_id: 'u003', delta: 80, reason: '完成烫平机巡检任务', created_at: Date.now() - 7200000 },
  { id: 'pl003', user_id: 'u003', delta: -200, reason: '兑换餐厅优惠券×5', created_at: Date.now() - 86400000 },
  { id: 'pl004', user_id: 'u003', delta: 120, reason: '完成客户专属制服交付', created_at: Date.now() - 172800000 },
];

// ─── 数据报表摘要 ────────────────────────────────────────────────
var REPORT_SUMMARY = {
  today: {
    total_tasks: 24, completed: 18, pending: 4, failed: 2,
    completion_rate: 75, total_pieces: 1240,
    zone_stats: [
      { zone_name: '洗涤龙工区', completed: 5, total: 6, pieces: 480 },
      { zone_name: '单机洗烘区', completed: 4, total: 5, pieces: 320 },
      { zone_name: '展布平烫A(8滚)', completed: 3, total: 4, pieces: 200 },
      { zone_name: '展布平烫B(6滚)', completed: 2, total: 3, pieces: 140 },
      { zone_name: '毛巾折叠区', completed: 2, total: 3, pieces: 100 },
      { zone_name: '分拣打标区', completed: 2, total: 3, pieces: 0 },
    ],
  },
  week: {
    total_tasks: 168, completed: 142, pending: 18, failed: 8,
    completion_rate: 85, total_pieces: 8680,
    daily_pieces: [1240, 1380, 1120, 1450, 1290, 980, 1220],
    daily_labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  month: {
    total_tasks: 720, completed: 628, pending: 62, failed: 30
,
    completion_rate: 87, total_pieces: 37200,
    top_staff: [
      { name: '王强', completed: 76, points: 1580 },
      { name: '赵敏', completed: 52, points: 980 },
      { name: '陈刚', completed: 41, points: 760 },
    ],
  },
};

// ─── Mock 路由映射 ───────────────────────────────────────────────
function getMockResponse(url, method, data) {
  method = (method || 'GET').toUpperCase();

  // 用户列表
  if (url.indexOf('/api/v1/users') !== -1 && !url.match(/\/users\/\w+/) && method === 'GET') {
    return { code: 200, data: USERS, message: '成功' };
  }
  if (url.indexOf('/api/v1/users') !== -1 && method === 'POST') {
    var newUser = {};
    var keys = Object.keys(data || {});
    for (var k = 0; k < keys.length; k++) { newUser[keys[k]] = data[keys[k]]; }
    newUser.id = 'u' + Date.now();
    newUser.total_points = 0;
    newUser.monthly_points = 0;
    newUser.task_completed = 0;
    newUser.status = 'active';
    USERS.push(newUser);
    return { code: 200, data: newUser, message: '员工账号已创建' };
  }
  if (url.match(/\/api\/v1\/users\/\w+$/) && method === 'PUT') {
    return { code: 200, data: {}, message: '保存成功' };
  }
  if (url.indexOf('/disable') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '账号已停用' };
  }

  // ★ 任务统计（必须在任务列表之前匹配）
  if (url.indexOf('/api/v1/tasks/stats') !== -1 && method === 'GET') {
    return { code: 200, data: getTaskStats(), message: '成功' };
  }
  // 任务列表
  if (url.indexOf('/api/v1/tasks') !== -1 && !url.match(/\/tasks\/\w+/) && method === 'GET') {
    return { code: 200, data: TASKS, message: '成功' };
  }
  if (url.indexOf('/count') !== -1 && method === 'POST') {
    return { code: 200, data: { new_progress: (data.count || 0) }, message: '计件已记录' };
  }
  if (url.indexOf('/submit') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '已提交，等待AI审核' };
  }
  if (url.indexOf('/review') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '审核完成' };
  }

  // 工区列表
  if (url.indexOf('/api/v1/zones') !== -1 && method === 'GET') {
    return { code: 200, data: ZONES, message: '成功' };
  }

  // 排班分配
  if (url.indexOf('/api/v1/schedule/assign') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '分配成功' };
  }
  if (url.indexOf('/api/v1/schedule/remove') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '移除成功' };
  }
  if (url.indexOf('/api/v1/schedule/save') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '排班已保存' };
  }
  if (url.indexOf('/api/v1/schedule/copy') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '复制成功' };
  }

  // 排班
  if (url.indexOf('/api/v1/schedules') !== -1 && method === 'GET') {
    return { code: 200, data: [], message: '成功' };
  }
  if (url.indexOf('/api/v1/schedules') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '排班已保存' };
  }

  // 请假
  if (url.indexOf('/api/v1/leave') !== -1 && method === 'POST') {
    return { code: 200, data: {}, message: '请假申请已提交' };
  }

  // 车辆
  if (url.indexOf('/api/v1/vehicles') !== -1 && method === 'GET') {
    return { code: 200, data: VEHICLES, message: '成功' };
  }

  // ★ IoT 仪表盘摘要（功能中心页面需要）
  if (url.indexOf('/api/v1/iot/dashboard') !== -1 && method === 'GET') {
    var alertCount = 0;
    for (var d = 0; d < IOT_DEVICES.length; d++) {
      if (IOT_DEVICES[d].alerts && IOT_DEVICES[d].alerts.length > 0) alertCount++;
    }
    return { code: 200, data: { total: IOT_DEVICES.length, running: 4, alert: alertCount, offline: 0 }, message: '成功' };
  }

  // IoT 设备列表
  if (url.indexOf('/api/v1/iot/devices') !== -1 && method === 'GET') {
    return { code: 200, data: IOT_DEVICES, message: '成功' };
  }

  // 积分摘要
  if (url.indexOf('/api/v1/points/summary') !== -1 && method === 'GET') {
    return { code: 200, data: { total_points: 3860, monthly_earned: 420 }, message: '成功' };
  }

  // 积分商城
  if (url.indexOf('/api/v1/mall/items') !== -1 && method === 'GET') {
    return { code: 200, data: MALL_ITEMS, message: '成功' };
  }
  if (url.indexOf('/api/v1/mall/exchange') !== -1 && method === 'POST') {
    return { code: 200, data: { exchange_id: 'ex' + Date.now() }, message: '兑换成功' };
  }

  // 积分账本
  if (url.indexOf('/api/v1/points/ledger') !== -1 && method === 'GET') {
    return { code: 200, data: POINT_LEDGER, message: '成功' };
  }

  // 兑换记录
  if (url.indexOf('/api/v1/exchange/records') !== -1 && method === 'GET') {
    return { code: 200, data: [], message: '成功' };
  }

  // 数据报表
  if (url.indexOf('/api/v1/reports') !== -1 && method === 'GET') {
    var period = 'today';
    if (url.indexOf('week') !== -1) period = 'week';
    else if (url.indexOf('month') !== -1) period = 'month';
    return { code: 200, data: REPORT_SUMMARY[period] || REPORT_SUMMARY.today, message: '成功' };
  }

  // 图片上传
  if (url.indexOf('/api/v1/upload') !== -1) {
    return { code: 200, data: { url: 'https://mock.icloush.com/photo/mock.jpg' }, message: '上传成功' };
  }

  // 默认
  return { code: 200, data: {}, message: '成功' };
}

module.exports = {
  getMockResponse: getMockResponse,
  USERS: USERS,
  ZONES: ZONES,
  TASKS: TASKS,
  VEHICLES: VEHICLES,
  IOT_DEVICES: IOT_DEVICES,
  MALL_ITEMS: MALL_ITEMS,
  POINT_LEDGER: POINT_LEDGER,
  REPORT_SUMMARY: REPORT_SUMMARY,
};
