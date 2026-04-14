/**
 * mockData.js — iCloush 智慧工厂 Mock 数据
 * V4.1 — 按真实设备清单重写
 */

var USERS = [
  { id: 'u001', name: '张伟', username: 'zhangwei', role: 7, avatar_key: 'male_admin_01', skills: ['洗涤龙', '单机洗烘', '展布机平烫', '物流驾驶'], is_multi_post: true, status: 'active', total_points: 3860, monthly_points: 420, task_completed: 187, current_zones: ['zone_a'] },
  { id: 'u002', name: '李娜', username: 'lina', role: 5, avatar_key: 'female_supervisor_01', skills: ['布草分拣', '手工洗涤', '熨烫'], is_multi_post: true, status: 'active', total_points: 2140, monthly_points: 310, task_completed: 98, current_zones: ['zone_g'] },
  { id: 'u003', name: '王强', username: 'wangqiang', role: 3, avatar_key: 'male_washer_01', skills: ['洗涤龙', '单机洗烘'], is_multi_post: false, status: 'active', total_points: 1580, monthly_points: 220, task_completed: 76, current_zones: ['zone_a'] },
  { id: 'u004', name: '赵敏', username: 'zhaomin', role: 1, avatar_key: 'female_washer_01', skills: ['展布机平烫', '平烫后处理'], is_multi_post: true, status: 'active', total_points: 980, monthly_points: 145, task_completed: 52, current_zones: ['zone_c'] },
  { id: 'u005', name: '陈刚', username: 'chengang', role: 1, avatar_key: 'male_driver_01', skills: ['物流驾驶', '跟车小工'], is_multi_post: false, status: 'active', total_points: 760, monthly_points: 98, task_completed: 41, current_zones: ['zone_f'] },
  { id: 'u006', name: '刘芳', username: 'liufang', role: 1, avatar_key: 'female_ironer_01', skills: ['展布机平烫', '平烫后处理'], is_multi_post: false, status: 'inactive', total_points: 620, monthly_points: 0, task_completed: 33, current_zones: [] },
];

// ═══════════════════════════════════════════════════════════════
// F1 重工区 Pipeline 封闭循环
// 机动物流区(装卸) → 收脏分拣区 → 洗涤龙工区 or 单机洗烘区
// (5台水洗单机+2台前进后出贯通式烘干机)
// → 展布平烫A(1组8滚高速烫平机+枕套折叠机&床单折叠机)
//   or 展布平烫B(1组展布机+6滚高速烫平机+枕套折叠机&床单折叠机)
// → 毛巾折叠区(1台毛巾折叠机) → 机动物流区(装卸)
//
// F2 精洗区 Pipeline
// 分拣打标区 → 洗烘区(干洗机*3+100KG水洗*2+50KG水洗*1+25KG水洗*1
//   +Speedqueen快速水洗*1+海尔家用洗烘一体*1+25KG烘箱*2+60KG烘箱*2)
// → 手工洗涤区 → 烘房区 → 熨烫区(烫台*4) → 收发挂衣区
// ═══════════════════════════════════════════════════════════════

var ZONES = [
  // ── F1 Row1 ──
  { id: 5, name: '收脏分拣区', code: 'zone_e', floor: 1, color: '#EF4444', status: 'running', capacity: 2, staff_count: 1, iot_summary: { used: 8, total: 20, alert: 0 }, iot_summary_text: '分拣台 8/20袋', pos: { left: '4%', top: '6%', width: '44%', height: '22%' }, pipeline_order: 2 },
  { id: 10, name: '毛巾折叠区', code: 'zone_j', floor: 1, color: '#8B5CF6', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 1, idle: 0, alert: 0, done: 320, target: 500 }, iot_summary_text: '1台运行 · 320/500', pos: { left: '52%', top: '6%', width: '44%', height: '22%' }, pipeline_order: 6 },
  // ── F1 Row2 ──
  { id: 1, name: '洗涤龙工区', code: 'zone_a', floor: 1, color: '#3B82F6', status: 'running', capacity: 4, staff_count: 3, iot_summary: { running: 1, idle: 0, alert: 0, done: 480, target: 600 }, iot_summary_text: '洗涤龙运行 · 化料78%', pos: { left: '4%', top: '32%', width: '44%', height: '24%' }, pipeline_order: 3 },
  { id: 3, name: '展布平烫A(8滚)', code: 'zone_c', floor: 1, color: '#F59E0B', status: 'running', capacity: 4, staff_count: 4, iot_summary: { running: 4, idle: 0, alert: 0, done: 380, target: 500 }, iot_summary_text: '8滚烫平+枕套&床单折叠', pos: { left: '52%', top: '32%', width: '44%', height: '24%' }, pipeline_order: 5 },
  // ── F1 Row3 ──
  { id: 2, name: '单机洗烘区', code: 'zone_b', floor: 1, color: '#10B981', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 7, idle: 0, alert: 0, done: 240, target: 350 }, iot_summary_text: '5台水洗+2台烘干', pos: { left: '4%', top: '58%', width: '44%', height: '24%' }, pipeline_order: 4 },
  { id: 4, name: '展布平烫B(6滚)', code: 'zone_d', floor: 1, color: '#F97316', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 4, idle: 0, alert: 0, done: 260, target: 400 }, iot_summary_text: '展布机+6滚烫平+折叠', pos: { left: '52%', top: '58%', width: '44%', height: '24%' }, pipeline_order: 5 },
  // ── F1 Row4 物流通道 ──
  { id: 6, name: '机动物流区', code: 'zone_f', floor: 1, color: '#C9A84C', status: 'running', capacity: 3, staff_count: 2, iot_summary: { out: 2, in_factory: 4, idle: 0, done: 45, target: 80 }, iot_summary_text: '6车 · 2出勤4在厂', pos: { left: '4%', top: '84%', width: '92%', height: '14%' }, pipeline_order: 1 },

  // ── F2 Row1 ──
  { id: 7, name: '分拣打标区', code: 'zone_g', floor: 2, color: '#EC4899', status: 'running', capacity: 3, staff_count: 2, iot_summary: { done: 120, target: 200, alert: 0 }, iot_summary_text: '分拣 120/200套', pos: { left: '4%', top: '6%', width: '44%', height: '26%' }, pipeline_order: 1 },
  { id: 11, name: '烘房区', code: 'zone_k', floor: 2, color: '#F59E0B', status: 'running', capacity: 2, staff_count: 1, iot_summary: { running: 2, idle: 0, alert: 0, done: 80, target: 120 }, iot_summary_text: '2间运行 · 65°C', pos: { left: '52%', top: '6%', width: '44%', height: '26%' }, pipeline_order: 4 },
  // ── F2 Row2 ──
  { id: 8, name: '洗烘区', code: 'zone_h', floor: 2, color: '#06B6D4', status: 'running', capacity: 3, staff_count: 3, iot_summary: { running: 13, idle: 0, alert: 0, done: 90, target: 150 }, iot_summary_text: '13台设备全部运行', pos: { left: '4%', top: '36%', width: '44%', height: '26%' }, pipeline_order: 2 },
  { id: 12, name: '熨烫区', code: 'zone_l', floor: 2, color: '#EF4444', status: 'running', capacity: 3, staff_count: 2, iot_summary: { running: 4, idle: 0, alert: 0, done: 100, target: 160 }, iot_summary_text: '4台烫台运行', pos: { left: '52%', top: '36%', width: '44%', height: '26%' }, pipeline_order: 5 },
  // ── F2 Row3 ──
  { id: 9, name: '手工洗涤区', code: 'zone_i', floor: 2, color: '#8B5CF6', status: 'running', capacity: 2, staff_count: 1, iot_summary: { done: 15, target: 30, alert: 0 }, iot_summary_text: '手工台 · 运行中', pos: { left: '4%', top: '66%', width: '44%', height: '26%' }, pipeline_order: 3 },
  { id: 13, name: '收发挂衣区', code: 'zone_m', floor: 2, color: '#84CC16', status: 'running', capacity: 2, staff_count: 1, iot_summary: { done: 65, target: 100, alert: 0 }, iot_summary_text: '挂衣 65/100套', pos: { left: '52%', top: '66%', width: '44%', height: '26%' }, pipeline_order: 6 },
];

// ─── 任务数据 ───────────────────────────────────────────────────
var TASKS = [
  { id: 't001', title: '洗涤龙日常计件', task_type: 'routine', zone_id: 1, zone_name: '洗涤龙工区', status: 2, priority: 2, points_reward: 50, progress: 68, target: 120, unit: '套', requires_photo: false, description: '按标准操作规程运行洗涤龙，每完成一批次记录件数。', deadline: null, assigned_to: 'u003' },
  { id: 't002', title: '8滚烫平机设备巡检', task_type: 'periodic', zone_id: 3, zone_name: '展布平烫A(8滚)', status: 1, priority: 3, points_reward: 80, progress: 0, target: 1, unit: '次', requires_photo: true, description: '对8滚高速烫平机进行例行巡检，检查加热管、传送带、安全装置，拍照存档。', deadline: Date.now() + 3600000, assigned_to: 'u004', is_recurring: true, interval_days: 14, next_publish_date: '2026-04-27' },
  { id: 't005', title: '烘干机清理绒毛', task_type: 'periodic', zone_id: 2, zone_name: '单机洗烘区', status: 2, priority: 3, points_reward: 60, progress: 0, target: 1, unit: '次', requires_photo: true, description: '清理贯通烘干机内部绒毛筛网，防止堵塞影响烘干效率。', deadline: Date.now() + 86400000 * 7, assigned_to: 'u003', is_recurring: true, interval_days: 7, next_publish_date: '2026-04-20' },
  { id: 't003', title: '客户专属制服交付', task_type: 'specific', zone_id: 12, zone_name: '熨烫区', status: 0, priority: 4, points_reward: 120, progress: 0, target: 1, unit: '批', requires_photo: true, description: '某酒店50套制服洗烫完成后，拍照确认质量，联系司机安排配送。', deadline: Date.now() + 7200000, assigned_to: null },
  { id: 't004', title: '单机洗烘日常计件', task_type: 'routine', zone_id: 2, zone_name: '单机洗烘区', status: 4, priority: 2, points_reward: 40, progress: 85, target: 85, unit: '套', requires_photo: false, description: '5台水洗单机+2台贯通烘干机日常计件任务。', deadline: null, assigned_to: 'u003' },
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

// ─── 车辆数据（真实车辆清单）──────────────────────────────────────
var VEHICLES = [
  { id: 'v001', plate: '沪F·A8219', type: '6米8重型厢式货车（黄牌）', status: 'out', driver_id: 'u005', driver_name: '陈刚', load_current: 45, load_max: 120, unit: '袋', last_update: Date.now() - 600000 },
  { id: 'v002', plate: '沪A·A8888', type: '5米2中型厢式货车（黄牌·暂未上牌）', status: 'in', driver_id: null, driver_name: '待分配', load_current: 0, load_max: 80, unit: '袋', last_update: Date.now() - 1800000 },
  { id: 'v003', plate: '沪ES1323', type: '4米2轻型厢式货车（黄牌）', status: 'out', driver_id: null, driver_name: '外勤中', load_current: 30, load_max: 60, unit: '袋', last_update: Date.now() - 900000 },
  { id: 'v004', plate: '沪A·BB9817', type: '4米2轻型厢式货车（新能源绿牌）', status: 'in', driver_id: null, driver_name: '待分配', load_current: 0, load_max: 60, unit: '袋', last_update: Date.now() - 3600000 },
  { id: 'v005', plate: '苏U·A820U', type: '4米2轻型厢式货车（苏蓝牌）', status: 'in', driver_id: null, driver_name: '待分配', load_current: 0, load_max: 60, unit: '袋', last_update: Date.now() - 7200000 },
  { id: 'v006', plate: '鲁B·076J7', type: '大通面包车', status: 'in', driver_id: null, driver_name: '待分配', load_current: 0, load_max: 30, unit: '袋', last_update: Date.now() - 5400000 },
];

// ─── IoT 设备数据（真实设备清单·全部运行中）──────────────────────
var IOT_DEVICES = [
  // === F1 洗涤龙工区 ===
  { id: 'd001', name: '洗涤龙1号', zone_id: 1, zone_name: '洗涤龙工区', device_type: 'washer_tunnel', status: 'running', chemical_pct: 78, temp: 65, cycle_count: 12, last_heartbeat: Date.now() - 30000, alerts: [] },
  // === F1 单机洗烘区（5台水洗+2台贯通烘干）===
  { id: 'd010', name: '水洗单机1号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', status: 'running', temp: 55, last_heartbeat: Date.now() - 20000, alerts: [] },
  { id: 'd011', name: '水洗单机2号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', status: 'running', temp: 58, last_heartbeat: Date.now() - 25000, alerts: [] },
  { id: 'd012', name: '水洗单机3号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', status: 'running', temp: 52, last_heartbeat: Date.now() - 18000, alerts: [] },
  { id: 'd013', name: '水洗单机4号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', status: 'running', temp: 60, last_heartbeat: Date.now() - 22000, alerts: [] },
  { id: 'd014', name: '水洗单机5号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'washer_single', status: 'running', temp: 56, last_heartbeat: Date.now() - 28000, alerts: [] },
  { id: 'd015', name: '贯通烘干机1号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'dryer_through', status: 'running', temp: 82, last_heartbeat: Date.now() - 20000, alerts: [] },
  { id: 'd016', name: '贯通烘干机2号', zone_id: 2, zone_name: '单机洗烘区', device_type: 'dryer_through', status: 'running', temp: 78, last_heartbeat: Date.now() - 25000, alerts: [] },
  // === F1 展布平烫A（8滚烫平+枕套折叠+床单折叠）===
  { id: 'd020', name: '8滚高速烫平机', zone_id: 3, zone_name: '展布平烫A(8滚)', device_type: 'ironer_8roll', status: 'running', temp: 185, speed: 3.2, last_heartbeat: Date.now() - 15000, alerts: [] },
  { id: 'd021', name: '枕套折叠机A', zone_id: 3, zone_name: '展布平烫A(8滚)', device_type: 'folder_pillow', status: 'running', last_heartbeat: Date.now() - 12000, alerts: [] },
  { id: 'd022', name: '床单折叠机A', zone_id: 3, zone_name: '展布平烫A(8滚)', device_type: 'folder_sheet', status: 'running', last_heartbeat: Date.now() - 10000, alerts: [] },
  // === F1 展布平烫B（展布机+6滚烫平+枕套折叠+床单折叠）===
  { id: 'd025', name: '展布机', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'spreader', status: 'running', last_heartbeat: Date.now() - 18000, alerts: [] },
  { id: 'd026', name: '6滚高速烫平机', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'ironer_6roll', status: 'running', temp: 178, speed: 2.8, last_heartbeat: Date.now() - 20000, alerts: [] },
  { id: 'd027', name: '枕套折叠机B', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'folder_pillow', status: 'running', last_heartbeat: Date.now() - 15000, alerts: [] },
  { id: 'd028', name: '床单折叠机B', zone_id: 4, zone_name: '展布平烫B(6滚)', device_type: 'folder_sheet', status: 'running', last_heartbeat: Date.now() - 14000, alerts: [] },
  // === F1 毛巾折叠区 ===
  { id: 'd030', name: '毛巾折叠机', zone_id: 10, zone_name: '毛巾折叠区', device_type: 'folder_towel', status: 'running', last_heartbeat: Date.now() - 10000, alerts: [] },

  // === F2 洗烘区（干洗机*3+100KG水洗*2+50KG水洗*1+25KG水洗*1+Speedqueen*1+海尔*1+25KG烘箱*2+60KG烘箱*2）===
  { id: 'd040', name: '干洗机1号', zone_id: 8, zone_name: '洗烘区', device_type: 'dry_cleaner', status: 'running', last_heartbeat: Date.now() - 30000, alerts: [] },
  { id: 'd041', name: '干洗机2号', zone_id: 8, zone_name: '洗烘区', device_type: 'dry_cleaner', status: 'running', last_heartbeat: Date.now() - 28000, alerts: [] },
  { id: 'd042', name: '干洗机3号', zone_id: 8, zone_name: '洗烘区', device_type: 'dry_cleaner', status: 'running', last_heartbeat: Date.now() - 25000, alerts: [] },
  { id: 'd043', name: '100KG水洗机1号', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_100kg', status: 'running', temp: 60, last_heartbeat: Date.now() - 20000, alerts: [] },
  { id: 'd044', name: '100KG水洗机2号', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_100kg', status: 'running', temp: 58, last_heartbeat: Date.now() - 22000, alerts: [] },
  { id: 'd045', name: '50KG水洗机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_50kg', status: 'running', temp: 55, last_heartbeat: Date.now() - 18000, alerts: [] },
  { id: 'd046', name: '25KG水洗机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_25kg', status: 'running', temp: 50, last_heartbeat: Date.now() - 15000, alerts: [] },
  { id: 'd047', name: 'Speedqueen快速水洗机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_speed', status: 'running', temp: 45, last_heartbeat: Date.now() - 12000, alerts: [] },
  { id: 'd048', name: '海尔家用洗烘一体机', zone_id: 8, zone_name: '洗烘区', device_type: 'washer_home', status: 'running', temp: 40, last_heartbeat: Date.now() - 10000, alerts: [] },
  { id: 'd049', name: '25KG烘箱1号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_25kg', status: 'running', temp: 75, last_heartbeat: Date.now() - 20000, alerts: [] },
  { id: 'd050', name: '25KG烘箱2号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_25kg', status: 'running', temp: 72, last_heartbeat: Date.now() - 18000, alerts: [] },
  { id: 'd051', name: '60KG烘箱3号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_60kg', status: 'running', temp: 85, last_heartbeat: Date.now() - 15000, alerts: [] },
  { id: 'd052', name: '60KG烘箱4号', zone_id: 8, zone_name: '洗烘区', device_type: 'dryer_60kg', status: 'running', temp: 82, last_heartbeat: Date.now() - 12000, alerts: [] },
  // === F2 熨烫区（烫台*4）===
  { id: 'd060', name: '烫台1号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', status: 'running', temp: 160, last_heartbeat: Date.now() - 10000, alerts: [] },
  { id: 'd061', name: '烫台2号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', status: 'running', temp: 155, last_heartbeat: Date.now() - 12000, alerts: [] },
  { id: 'd062', name: '烫台3号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', status: 'running', temp: 162, last_heartbeat: Date.now() - 8000, alerts: [] },
  { id: 'd063', name: '烫台4号', zone_id: 12, zone_name: '熨烫区', device_type: 'ironing_table', status: 'running', temp: 158, last_heartbeat: Date.now() - 15000, alerts: [] },
];

// ─── 员工账户表（用于登录验证）──────────────────────────
// 新增员工时自动写入此表
var WHITELIST = [
  { username: 'zhangwei', password: 'zw123456', phone: '13800001001', name: '张伟', bind_user_id: 'u001', role: 'admin' },
  { username: 'lina', password: 'ln123456', phone: '13800001002', name: '李娜', bind_user_id: 'u002', role: 'staff' },
  { username: 'wangqiang', password: 'wq123456', phone: '13800001003', name: '王强', bind_user_id: 'u003', role: 'staff' },
  { username: 'zhaomin', password: 'zm123456', phone: '13800001004', name: '赵敏', bind_user_id: 'u004', role: 'staff' },
  { username: 'chengang', password: 'cg123456', phone: '13800001005', name: '陈刚', bind_user_id: 'u005', role: 'staff' },
  { username: 'liufang', password: 'lf123456', phone: '13800001006', name: '刘芳', bind_user_id: 'u006', role: 'staff' },
];

// ─── 每日产能数据（BI 报表用）──────────────────────────────────────
var DAILY_PRODUCTION = [
  { date: '2026-03-21', total_sets: 2850, worker_count: 12, work_hours: 8, efficiency_kpi: 29.7 },
  { date: '2026-03-22', total_sets: 3120, worker_count: 14, work_hours: 8, efficiency_kpi: 27.9 },
  { date: '2026-03-23', total_sets: 2680, worker_count: 11, work_hours: 8, efficiency_kpi: 30.5 },
  { date: '2026-03-24', total_sets: 3350, worker_count: 15, work_hours: 8.5, efficiency_kpi: 26.3 },
  { date: '2026-03-25', total_sets: 2960, worker_count: 13, work_hours: 8, efficiency_kpi: 28.5 },
  { date: '2026-03-26', total_sets: 3480, worker_count: 14, work_hours: 9, efficiency_kpi: 27.6 },
  { date: '2026-03-27', total_sets: 3210, worker_count: 13, work_hours: 8.5, efficiency_kpi: 29.1 },
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
    completion_rate: 75, total_sets: 1240,
    zone_stats: [
      { zone_name: '洗涤龙工区', completed: 5, total: 6, sets: 480 },
      { zone_name: '单机洗烘区', completed: 4, total: 5, sets: 320 },
      { zone_name: '展布平烫A(8滚)', completed: 3, total: 4, sets: 200 },
      { zone_name: '展布平烫B(6滚)', completed: 2, total: 3, sets: 140 },
      { zone_name: '毛巾折叠区', completed: 2, total: 3, sets: 100 },
      { zone_name: '分拣打标区', completed: 2, total: 3, sets: 0 },
    ],
  },
  week: {
    total_tasks: 168, completed: 142, pending: 18, failed: 8,
    completion_rate: 85, total_sets: 8680,
    daily_sets: [1240, 1380, 1120, 1450, 1290, 980, 1220],
    daily_labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  },
  month: {
    total_tasks: 720, completed: 628, pending: 62, failed: 30,
    completion_rate: 87, total_sets: 37200,
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
    newUser.current_zones = [];
    USERS.push(newUser);

    // ★ 自动将新员工写入账户表（WHITELIST）
    if (data.username && data.password) {
      WHITELIST.push({
        username: data.username,
        password: data.password,
        phone: data.phone || '',
        name: newUser.name,
        bind_user_id: newUser.id,
        role: (newUser.role >= 5) ? 'admin' : 'staff',
      });
    }

    return { code: 200, data: newUser, message: '员工账号创建成功' };
  }
  // ★ V5.5.1：更新用户（含账号密码）
  if (url.match(/\/api\/v1\/users\/\w+$/) && method === 'PUT') {
    var userId = url.match(/\/users\/(\w+)/)[1];
    for (var ui = 0; ui < USERS.length; ui++) {
      if (USERS[ui].id === userId) {
        var updateKeys = Object.keys(data || {});
        for (var uk = 0; uk < updateKeys.length; uk++) {
          if (updateKeys[uk] !== 'password') USERS[ui][updateKeys[uk]] = data[updateKeys[uk]];
        }
        break;
      }
    }
    // 同步更新 WHITELIST 中的账号密码
    if (data.username) {
      var found = false;
      for (var wi = 0; wi < WHITELIST.length; wi++) {
        if (WHITELIST[wi].bind_user_id === userId) {
          WHITELIST[wi].username = data.username;
          if (data.password) WHITELIST[wi].password = data.password;
          WHITELIST[wi].name = data.name || WHITELIST[wi].name;
          found = true;
          break;
        }
      }
      if (!found && data.password) {
        WHITELIST.push({ username: data.username, password: data.password, phone: '', name: data.name || '', bind_user_id: userId, role: 'staff' });
      }
    }
    return { code: 200, data: {}, message: '保存成功' };
  }

  // ★ V5.5.1：停用账号（更新 USERS 中的 status）
  if (url.indexOf('/disable') !== -1 && method === 'POST') {
    var disableId = url.match(/\/users\/(\w+)/); 
    if (disableId) {
      for (var di = 0; di < USERS.length; di++) {
        if (USERS[di].id === disableId[1]) { USERS[di].status = 'inactive'; break; }
      }
    }
    return { code: 200, data: {}, message: '账号已停用' };
  }

  // ★ V5.5.1：恢复账号
  if (url.indexOf('/restore') !== -1 && method === 'POST') {
    var restoreId = url.match(/\/users\/(\w+)/);
    if (restoreId) {
      for (var ri = 0; ri < USERS.length; ri++) {
        if (USERS[ri].id === restoreId[1]) { USERS[ri].status = 'active'; break; }
      }
    }
    return { code: 200, data: {}, message: '账号已恢复' };
  }

  // ★ V5.5.1：永久删除账号（从 USERS 和 WHITELIST 中移除）
  if (url.match(/\/api\/v1\/users\/\w+$/) && method === 'DELETE') {
    var deleteId = url.match(/\/users\/(\w+)/)[1];
    for (var ddi = 0; ddi < USERS.length; ddi++) {
      if (USERS[ddi].id === deleteId) { USERS.splice(ddi, 1); break; }
    }
    for (var dwi = 0; dwi < WHITELIST.length; dwi++) {
      if (WHITELIST[dwi].bind_user_id === deleteId) { WHITELIST.splice(dwi, 1); break; }
    }
    return { code: 200, data: {}, message: '账号已永久删除' };
  }

  // 任务统计（必须在任务列表之前匹配）
  if (url.indexOf('/api/v1/tasks/stats') !== -1 && method === 'GET') {
    return { code: 200, data: getTaskStats(), message: '成功' };
  }
  // 任务列表
  if (url.indexOf('/api/v1/tasks') !== -1 && !url.match(/\/tasks\/\w+/) && method === 'GET') {
    return { code: 200, data: TASKS, message: '成功' };
  }
  // ★ 接单路由 — 状态 0→2，绑定 assignee
  if (url.indexOf('/accept') !== -1 && method === 'POST') {
    var acceptMatch = url.match(/tasks\/(\w+)\/accept/);
    if (acceptMatch) {
      for (var ai = 0; ai < TASKS.length; ai++) {
        if (String(TASKS[ai].id) === String(acceptMatch[1])) {
          TASKS[ai].status = 2;
          TASKS[ai].assigned_to = (data && data.user_id) || TASKS[ai].assigned_to;
          TASKS[ai].accepted_at = Date.now();
          TASKS[ai].is_rejected = false;
          break;
        }
      }
    }
    return { code: 200, data: {}, message: '接单成功' };
  }
  // ★ 计件路由 — 真实修改 TASKS 进度
  if (url.indexOf('/count') !== -1 && method === 'POST') {
    var countMatch = url.match(/tasks\/(\w+)\/count/);
    var countDelta = (data && data.count) || 0;
    var newProgress = 0;
    if (countMatch) {
      for (var ci = 0; ci < TASKS.length; ci++) {
        if (String(TASKS[ci].id) === String(countMatch[1])) {
          TASKS[ci].progress = (TASKS[ci].progress || 0) + countDelta;
          newProgress = TASKS[ci].progress;
          break;
        }
      }
    }
    return { code: 200, data: { new_progress: newProgress }, message: '计件已记录' };
  }
  if (url.indexOf('/submit') !== -1 && method === 'POST') {
    // ★ 提交后状态变为 3(待审核)，不是直接完成
    var submitTaskId = url.match(/tasks\/(\w+)\/submit/);
    if (submitTaskId) {
      for (var si = 0; si < TASKS.length; si++) {
        if (String(TASKS[si].id) === String(submitTaskId[1])) {
          TASKS[si].status = 3;
          TASKS[si].submitted_at = Date.now();
          break;
        }
      }
    }
    return { code: 200, data: {}, message: '已提交，等待审核' };
  }
  if (url.indexOf('/review') !== -1 && method === 'POST') {
    // ★ 审核路由：通过→4，驳回→2 + is_rejected
    var reviewTaskId = url.match(/tasks\/(\w+)\/review/);
    var reviewResult = (data && data.result) || 'pass';
    if (reviewTaskId) {
      for (var ri = 0; ri < TASKS.length; ri++) {
        if (String(TASKS[ri].id) === String(reviewTaskId[1])) {
          if (reviewResult === 'pass') {
            TASKS[ri].status = 4;
            TASKS[ri].is_rejected = false;
            TASKS[ri].reviewed_at = Date.now();
          } else {
            TASKS[ri].status = 2;
            TASKS[ri].is_rejected = true;
            TASKS[ri].reject_reason = (data && data.reason) || '审核未通过，请重新提交';
            TASKS[ri].rejected_at = Date.now();
          }
          break;
        }
      }
    }
    return { code: 200, data: { result: reviewResult }, message: reviewResult === 'pass' ? '审核通过' : '已驳回' };
  }

  // 工区列表
  if (url.indexOf('/api/v1/zones') !== -1 && method === 'GET') {
    return { code: 200, data: ZONES, message: '成功' };
  }

  // ★ 排班分配 — 真实修改内存中 USERS.current_zones
  if (url.indexOf('/api/v1/schedule/assign') !== -1 && method === 'POST') {
    var assignUserId = data && data.user_id;
    var assignZoneId = data && data.zone_id;
    if (assignUserId && assignZoneId) {
      // 根据 zone_id 找到 zone_code
      var assignZoneCode = null;
      for (var az = 0; az < ZONES.length; az++) {
        if (ZONES[az].id === assignZoneId) { assignZoneCode = ZONES[az].code; break; }
      }
      if (assignZoneCode) {
        for (var au = 0; au < USERS.length; au++) {
          if (USERS[au].id === assignUserId) {
            if (!USERS[au].current_zones) USERS[au].current_zones = [];
            if (USERS[au].current_zones.indexOf(assignZoneCode) === -1) {
              USERS[au].current_zones.push(assignZoneCode);
            }
            USERS[au].status = 'active';
            break;
          }
        }
      }
    }
    return { code: 200, data: {}, message: '分配成功' };
  }
  if (url.indexOf('/api/v1/schedule/remove') !== -1 && method === 'POST') {
    var removeUserId = data && data.user_id;
    var removeZoneId = data && data.zone_id;
    if (removeUserId && removeZoneId) {
      var removeZoneCode = null;
      for (var rz = 0; rz < ZONES.length; rz++) {
        if (ZONES[rz].id === removeZoneId) { removeZoneCode = ZONES[rz].code; break; }
      }
      if (removeZoneCode) {
        for (var ru = 0; ru < USERS.length; ru++) {
          if (USERS[ru].id === removeUserId) {
            var idx = (USERS[ru].current_zones || []).indexOf(removeZoneCode);
            if (idx !== -1) USERS[ru].current_zones.splice(idx, 1);
            break;
          }
        }
      }
    }
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

  // IoT 仪表盘摘要
  if (url.indexOf('/api/v1/iot/dashboard') !== -1 && method === 'GET') {
    return { code: 200, data: { total: IOT_DEVICES.length, running: IOT_DEVICES.length, alert: 0, offline: 0 }, message: '成功' };
  }

  // IoT 设备列表
  if (url.indexOf('/api/v1/iot/devices') !== -1 && !url.match(/\/devices\/\w+/) && method === 'GET') {
    return { code: 200, data: IOT_DEVICES, message: '成功' };
  }

  // IoT 设备告警历史
  if (url.match(/\/api\/v1\/iot\/devices\/\w+\/alerts/) && method === 'GET') {
    return { code: 200, data: [], message: '成功' };
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

  // ★ V5.6.1: 图片上传（后端水印方案）
  if (url.indexOf('/api/v1/upload/task-photo') !== -1) {
    return { code: 200, data: { url: 'https://mock.icloush.com/photo/watermarked_' + Date.now() + '.jpg' }, message: '拍照上传成功（已添加防伪水印）' };
  }
  // 通用图片上传
  if (url.indexOf('/api/v1/upload') !== -1) {
    return { code: 200, data: { url: 'https://mock.icloush.com/photo/mock.jpg' }, message: '上传成功' };
  }

  // 账号密码登录验证
  if (url.indexOf('/api/v1/auth/verify') !== -1 && method === 'POST') {
    var loginUsername = (data && data.username) || '';
    var loginPassword = (data && data.password) || '';
    for (var wi = 0; wi < WHITELIST.length; wi++) {
      if (WHITELIST[wi].username === loginUsername && WHITELIST[wi].password === loginPassword) {
        var bindId = WHITELIST[wi].bind_user_id;
        var matchedUser = null;
        for (var uj = 0; uj < USERS.length; uj++) {
          if (USERS[uj].id === bindId) { matchedUser = USERS[uj]; break; }
        }
        if (matchedUser) {
          // 将账户角色信息附加到用户数据中
          matchedUser.account_role = WHITELIST[wi].role;
          return { code: 200, data: { user: matchedUser, token: 'token_' + Date.now(), account_role: WHITELIST[wi].role }, message: '登录成功' };
        }
      }
    }
    return { code: 403, data: null, message: '账号或密码错误，请重试' };
  }

  // ★ 任务编辑
  if (url.indexOf('/edit') !== -1 && method === 'POST') {
    var editMatch = url.match(/\/tasks\/([^/]+)\/edit/);
    if (editMatch) {
      var editId = editMatch[1];
      var editTask = null;
      for (var ei = 0; ei < TASKS.length; ei++) {
        if (String(TASKS[ei].id) === String(editId)) { editTask = TASKS[ei]; break; }
      }
      if (!editTask) return { code: 404, data: null, message: '任务不存在' };
      // 更新可编辑字段
      var editFields = ['title', 'description', 'task_type', 'priority', 'zone_id', 'zone_name', 'deadline', 'target', 'unit', 'points_reward', 'requires_photo'];
      for (var ef = 0; ef < editFields.length; ef++) {
        var fk = editFields[ef];
        if (data[fk] !== undefined) editTask[fk] = data[fk];
      }
      // 处理指派变更
      if (data.assigned_to !== undefined) {
        var newAssignees = data.assigned_to;
        if (newAssignees && ((typeof newAssignees === 'string' && newAssignees.length > 0) || (Array.isArray(newAssignees) && newAssignees.length > 0))) {
          var newAssignee = Array.isArray(newAssignees) ? newAssignees[0] : newAssignees;
          // 如果指派人变了，重置状态
          if (String(editTask.assigned_to) !== String(newAssignee)) {
            editTask.assigned_to = newAssignee;
            editTask.status = 1;  // 重新指派 → 已接单
            editTask.accepted_at = Date.now();
          }
        } else {
          // 清除指派 → 变为公域任务
          if (editTask.assigned_to) {
            editTask.assigned_to = null;
            editTask.status = 0;  // 回到待认领
          }
        }
      }
      return { code: 200, data: editTask, message: '任务更新成功' };
    }
  }

  // 任务创建
  if (url.indexOf('/api/v1/tasks') !== -1 && method === 'POST') {
    var newTask = {};
    var tkeys = Object.keys(data || {});
    for (var tk = 0; tk < tkeys.length; tk++) { newTask[tkeys[tk]] = data[tkeys[tk]]; }
    newTask.id = 't' + Date.now();
    newTask.progress = 0;
    newTask.requires_photo = data.requires_photo || false;
    // ★ 核心逻辑：指定了员工 → status=1(已接单)；未指定 → status=0(待认领)
    var assignees = newTask.assigned_to;
    if (assignees && ((typeof assignees === 'string' && assignees.length > 0) || (Array.isArray(assignees) && assignees.length > 0))) {
      // 如果 assigned_to 是数组，取第一个作为主负责人
      if (Array.isArray(assignees)) {
        newTask.assigned_to = assignees[0];
      }
      newTask.status = 1;  // 已接单（指定员工自动接单）
      newTask.accepted_at = Date.now();
    } else {
      newTask.assigned_to = null;
      newTask.status = 0;  // 待认领（公域任务）
    }
    // 周期任务字段默认值
    if (!newTask.is_recurring) newTask.is_recurring = false;
    if (!newTask.interval_days) newTask.interval_days = 0;
    if (!newTask.next_publish_date) newTask.next_publish_date = '';
    TASKS.push(newTask);
    return { code: 200, data: newTask, message: '任务发布成功' };
  }

  // 每日产能数据
  if (url.indexOf('/api/v1/production/daily') !== -1 && method === 'GET') {
    return { code: 200, data: DAILY_PRODUCTION, message: '成功' };
  }
  // 录入每日产能
  if (url.indexOf('/api/v1/production/daily') !== -1 && method === 'POST') {
    var entry = data || {};
    entry.efficiency_kpi = entry.total_sets && entry.worker_count && entry.work_hours
      ? Math.round((entry.total_sets / (entry.worker_count * entry.work_hours)) * 10) / 10
      : 0;
    DAILY_PRODUCTION.push(entry);
    return { code: 200, data: entry, message: '产能数据录入成功' };
  }

  // ═══ 付款申请 Mock ═══
  if (url.indexOf('/api/v1/payments/') !== -1 && method === 'POST') {
    var paymentId = 'pay_' + Date.now();
    return {
      code: 200,
      data: {
        id: paymentId,
        payment_type: (data && data.payment_type) || 'A',
        supplier_name: (data && data.supplier_name) || '',
        purpose: (data && data.purpose) || '',
        total_amount: (data && data.total_amount) || 0,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      message: '付款申请提交成功',
    };
  }

  // 付款记录列表
  if (url.indexOf('/api/v1/payments/my') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        { id: 'pay_001', payment_type: 'A', supplier_name: '海尔', purpose: '家用小洗衣机采购', total_amount: 900, status: 'pending', created_at: '2026-04-12T08:00:00Z', statusLabel: '待审批', invoice_image_url: 'https://mock.icloush.com/photo/invoice_haier.jpg' },
        { id: 'pay_002', payment_type: 'B', supplier_name: '格力', purpose: '空调采购', total_amount: 5600, status: 'completed', created_at: '2026-04-10T10:00:00Z', statusLabel: '已完成' },
      ],
      message: '成功',
    };
  }

  // 付款审批列表
  if (url.indexOf('/api/v1/payments/pending') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        { id: 'pay_001', payment_type: 'A', supplier_name: '海尔', purpose: '家用小洗衣机采购', total_amount: 900, status: 'pending', applicant_name: '程建平', created_at: '2026-04-12T08:00:00Z' },
      ],
      message: '成功',
    };
  }

  // 付款审批操作
  if (url.match(/\/api\/v1\/payments\/[^/]+\/review/) && method === 'POST') {
    return { code: 200, data: { status: 'approved' }, message: '审批成功' };
  }

  // 发票 OCR 识别（★ V5.6.2 字段归一化引擎升级）
  // 返回完整的归一化字段 + match_stats 调试信息
  if (url.indexOf('/api/v1/invoices/ocr') !== -1 && method === 'POST') {
    return {
      code: 200,
      data: {
        ocr_available: true,
        invoice_id: 'inv_ocr_' + Date.now(),
        parsed: {
          invoice_type: 'special_vat',
          invoice_type_label: '电子发票(增值税专用发票)',
          invoice_code: '',
          invoice_number: '26327000006804323071',
          invoice_date: '2026-04-13',
          total_amount: 10070.97,
          pre_tax_amount: 9777.64,
          tax_amount: 293.33,
          total_amount_cn: '壹万零柒拾元九角七分',
          check_code: '',
          check_code_last6: '',
          machine_number: '',
          // 购方信息
          buyer_name: '富朵朵实业(太仓)有限公司',
          buyer_tax_id: '91320585MA1N5CYG7X',
          buyer_address_phone: '',
          buyer_bank_account: '',
          // 销方信息
          seller_name: '太仓市自来水有限公司',
          seller_tax_id: '9132058513808760401',
          seller_address_phone: '',
          seller_bank_account: '',
          // 人员信息
          drawer: '盛恩恩',
          payee: '',
          reviewer: '',
          // 其他
          goods_name_summary: '水冰雪*水费',
          remark: '户号:0519424852,读数:99841-104398,用水量:4557',
          has_company_seal: true,
          province: '',
          city: '',
        },
        items: [
          { name: '*水冰雪*水费', spec: '工业、商业、服务业', unit: '吨', quantity: '4557', unit_price: '2.1456310679612', amount_without_tax: '9777.64', tax_rate: '3%', tax_amount: '293.33' },
        ],
        match_stats: {
          total_alias_fields: 32,
          matched_fields: 14,
          ocr_returned_fields: 22,
          unmatched_ocr_keys: [],
        },
      },
      message: '成功',
    };
  }

  // 发票上传（入发票/票据池）
  if (url.indexOf('/api/v1/invoices/upload') !== -1 && method === 'POST') {
    return {
      code: 200,
      data: {
        id: 'inv_' + Date.now(),
        is_duplicate: false,
        auto_resolved: [],
      },
      message: '发票上传成功',
    };
  }

  // 发票列表（我的发票）
  if (url.indexOf('/api/v1/invoices/my') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        { id: 'inv_001', seller_name: '上海康智电子商务有限公司', total_amount: 6628.88, invoice_date: '2026-02-25', status: 'pending', uploader_name: '程建平' },
      ],
      message: '成功',
    };
  }

  // 发票管理（全员票据池 — ★ 合并打印状态+关联来源+占用状态）
  if (url.indexOf('/api/v1/invoices/admin-list') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        { id: 'inv_001', invoice_type_code: '普', seller_name: '上海康智电子商务有限公司', total_amount: 6628.88, invoice_date: '2026-02-25', invoice_number: '08965432', verify_status: 'verified', is_duplicate: false, is_printed: false, source: 'invoice_upload', linked_to: null, linked_type: null, user_name: '程建平', goods_name_summary: '洗涤设备维保服务' },
        { id: 'inv_002', invoice_type_code: '专', seller_name: '上海海尔电器有限公司', total_amount: 900.00, invoice_date: '2026-04-12', invoice_number: '09876543', verify_status: 'verified', is_duplicate: false, is_printed: true, source: 'payment_create', linked_to: 'pay_001', linked_type: 'payment', user_name: '程建平', goods_name_summary: '家用洗衣机' },
        { id: 'inv_003', invoice_type_code: '普', seller_name: '美团外卖', total_amount: 99.20, invoice_date: '2026-04-11', invoice_number: '11223344', verify_status: 'pending', is_duplicate: false, is_printed: false, source: 'expense_create', linked_to: 'exp_001', linked_type: 'expense', user_name: '程建平', goods_name_summary: '餐费' },
        { id: 'inv_004', invoice_type_code: '普', seller_name: '上海康智电子商务有限公司', total_amount: 6628.88, invoice_date: '2026-03-15', invoice_number: '08965432', verify_status: 'duplicate', is_duplicate: true, is_printed: false, source: 'invoice_upload', linked_to: null, linked_type: null, user_name: '张三', goods_name_summary: '洗涤设备维保服务' },
        { id: 'inv_005', invoice_type_code: '普', seller_name: '格力电器', total_amount: 5600.00, invoice_date: '2026-04-08', invoice_number: '55667788', verify_status: 'verified', is_duplicate: false, is_printed: false, source: 'invoice_upload', linked_to: null, linked_type: null, user_name: '李娜', goods_name_summary: '空调采购' },
      ],
      total: 5,
      message: '成功',
    };
  }

  // 发票管理（全员票据池 — 旧接口兼容）
  if (url.indexOf('/api/v1/invoices/all') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: {
        total: 5,
        invoices: [
          { id: 'inv_001', seller_name: '上海康智电子商务有限公司', total_amount: 6628.88, invoice_date: '2026-02-25', status: 'pending', uploader_name: '程建平', source: 'invoice_upload' },
        ],
      },
      message: '成功',
    };
  }

  // 发票打印状态列表（★ 已合并到 admin-list，保留兼容）
  if (url.indexOf('/api/v1/payments/invoices/print-status') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        { id: 'inv_001', invoice_code: '3100224130', invoice_number: '08965432', seller_name: '上海康智电子商务有限公司', total_amount: 6628.88, is_printed: false, created_at: '2026-02-25T10:00:00Z' },
        { id: 'inv_002', invoice_code: '3100224131', invoice_number: '09876543', seller_name: '上海海尔电器有限公司', total_amount: 900.00, is_printed: true, created_at: '2026-04-12T10:00:00Z' },
      ],
      message: '成功',
    };
  }

  // 发票打印标记（★ 统一路由，同时支持 /invoices/:id/print-toggle）
  if (url.match(/\/api\/v1\/payments\/invoices\/[^/]+\/print/) && method === 'PUT') {
    return { code: 200, data: {}, message: '操作成功' };
  }
  if (url.match(/\/api\/v1\/invoices\/[^/]+\/print-toggle/) && method === 'PUT') {
    return { code: 200, data: {}, message: '打印状态已更新' };
  }

  // 开票覆盖率
  if (url.indexOf('/api/v1/payments/dashboard/invoice-coverage') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: {
        coverage_rate: 72.5,
        invoice_total: 48650.00,
        cost_total: 67100.00,
        tax_gap: 18450.00,
      },
      message: '成功',
    };
  }

  // ★ 欠票看板 — Dashboard
  if (url.indexOf('/api/v1/missing-invoices/dashboard') !== -1 && method === 'GET') {
    var today = new Date();
    return {
      code: 200,
      data: {
        summary: { total_missing: 3, total_amount: 12800.00, overdue_count: 1 },
        ranking: [
          { employee_id: 'u003', employee_name: '王强', missing_count: 2, total_amount: 7200.00 },
          { employee_id: 'u005', employee_name: '陈刚', missing_count: 1, total_amount: 5600.00 },
        ],
      },
      message: '成功',
    };
  }

  // ★ 欠票看板 — 明细列表（状态机：Pending/Warning/Overdue）
  if (url.indexOf('/api/v1/missing-invoices/list') !== -1 && method === 'GET') {
    var now = new Date();
    var in5days = new Date(now.getTime() + 5 * 86400000).toISOString().slice(0, 10);
    var in2days = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    var past3days = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
    return {
      code: 200,
      data: [
        { id: 'mi_001', source_type: 'payment', source_id: 'pay_002', purpose: '空调采购（格力）', amount: 5600.00, employee_id: 'u005', employee_name: '陈刚', expected_invoice_date: in5days, status: 'pending', invoice_id: null },
        { id: 'mi_002', source_type: 'payment', source_id: 'pay_003', purpose: '洗涤龙备件采购', amount: 3200.00, employee_id: 'u003', employee_name: '王强', expected_invoice_date: in2days, status: 'warning', invoice_id: null },
        { id: 'mi_003', source_type: 'expense', source_id: 'exp_002', purpose: '快递费报销（无票）', amount: 4000.00, employee_id: 'u003', employee_name: '王强', expected_invoice_date: past3days, status: 'overdue', invoice_id: null },
      ],
      message: '成功',
    };
  }

  // ★ 欠票核销（Match）
  if (url.match(/\/api\/v1\/missing-invoices\/[^/]+\/match/) && method === 'POST') {
    return { code: 200, data: { status: 'resolved' }, message: '核销成功，欠票记录已关闭' };
  }

  // ★ 欠票催票
  if (url.match(/\/api\/v1\/missing-invoices\/[^/]+\/remind/) && method === 'POST') {
    return { code: 200, data: {}, message: '催票已发送' };
  }

  // ★ 批量催票
  if (url.indexOf('/api/v1/missing-invoices/batch-remind') !== -1 && method === 'POST') {
    return { code: 200, data: { sent_count: 1 }, message: '批量催票已发送' };
  }

  // ★ V5.5.2 Hotfix: 发票单条详情（含 image_url）
  if (url.match(/\/api\/v1\/invoices\/[^/]+$/) && method === 'GET' && url.indexOf('admin-list') === -1 && url.indexOf('unlinked') === -1 && url.indexOf('/my') === -1 && url.indexOf('/all') === -1) {
    return {
      code: 200,
      data: {
        id: 'inv_003',
        invoice_type: 'vat_special',
        invoice_type_label: '增值税专用发票',
        invoice_type_code: '专',
        invoice_code: '',
        invoice_number: '26327000006804323071',
        invoice_date: '2026-04-13',
        total_amount: 10070.97,
        pre_tax_amount: 9777.64,
        tax_amount: 293.33,
        seller_name: '太仓市自来水有限公司',
        seller_tax_id: '9132058513808760401',
        seller_address_phone: '',
        seller_bank_account: '',
        buyer_name: '富朵朵实业(太仓)有限公司',
        buyer_tax_id: '91320585MA1N5CYG7X',
        buyer_address_phone: '',
        buyer_bank_account: '',
        check_code: '',
        check_code_last6: '',
        machine_number: '',
        drawer: '盛恩恩',
        payee: '',
        reviewer: '',
        goods_name_summary: '水冰雪*水费',
        remark: '户号:0519424852,读数:99841-104398,用水量:4557',
        image_url: 'https://mock.icloush.com/invoices/vat_special_water.jpg',
        verify_status: 'verified',
        verify_status_label: '已核验',
        is_duplicate: false,
        is_printed: false,
        has_company_seal: true,
        created_at: '2026-04-13T22:45:00Z',
        items: [{ name: '*水冰雪*水费', spec: '工业、商业、服务业', unit: '吨', quantity: 4557, unit_price: 2.1456310679612, amount: 9777.64, tax_rate: '3%', tax: 293.33 }],
        hasItems: true,
      },
      message: '成功',
    };
  }

  // ★ V5.5.2 Hotfix: 自动核验（发票号码查重 → 自动打标签）
  if (url.match(/\/api\/v1\/invoices\/[^/]+\/verify/) && method === 'POST') {
    // 模拟查重逻辑：检查 data.auto_verify 时进行号码查重
    var isAutoVerify = data && data.auto_verify;
    if (isAutoVerify) {
      // 模拟：inv_004 的号码 08965432 与 inv_001 重复
      var invoiceId = url.split('/invoices/')[1].split('/')[0];
      var isDuplicate = (invoiceId === 'inv_004');
      return {
        code: 200,
        data: {
          verify_status: isDuplicate ? 'duplicate' : 'verified',
          verify_status_label: isDuplicate ? '重复发票' : '已核验',
          is_duplicate: isDuplicate,
          duplicate_of: isDuplicate ? 'inv_001' : null,
          verified_at: new Date().toISOString(),
        },
        message: isDuplicate ? '检测到重复发票（与 inv_001 号码相同）' : '核验通过，未发现重复',
      };
    }
    // 手动标记
    var manualStatus = (data && data.verify_result) || 'verified';
    var statusLabels = { verified: '已核验', failed: '核验失败', duplicate: '重复发票', manual_review: '待人工复核' };
    return {
      code: 200,
      data: {
        verify_status: manualStatus,
        verify_status_label: statusLabels[manualStatus] || manualStatus,
        is_duplicate: manualStatus === 'duplicate',
        verified_at: new Date().toISOString(),
      },
      message: '标记成功',
    };
  }

  // ★ 获取未关联发票列表（用于核销选择）
  if (url.indexOf('/api/v1/invoices/unlinked') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        { id: 'inv_005', seller_name: '格力电器', total_amount: 5600.00, invoice_date: '2026-04-08', invoice_number: '55667788', goods_name_summary: '空调采购' },
      ],
      message: '成功',
    };
  }

  // 报销相关
  if (url.indexOf('/api/v1/expenses/my') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        {
          id: 'exp_001', purpose: '餐费', claimed_amount: 767, voucher_type: 'invoice',
          status: 'pending', created_at: '2026-04-13T14:53:59.510789+00:00',
          employee_name: 'Savox',
          invoice_id: 'inv_003',
          invoice_image_url: 'https://mock.icloush.com/invoices/vat_special_water.jpg',
          invoice_info: {
            id: 'inv_003',
            invoice_type_code: '专',
            seller_name: '太仓市自来水有限公司',
            total_amount: 10070.97,
            image_url: 'https://mock.icloush.com/invoices/vat_special_water.jpg',
          },
        },
      ],
      message: '成功',
    };
  }

  // ★ V5.5.2 Hotfix: 报销列表补充 invoice_info（含 image_url），财务审核时可看到发票图片
  if (url.indexOf('/api/v1/expenses/pending') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        {
          id: 'exp_001', purpose: '餐费', claimed_amount: 767, voucher_type: 'invoice',
          status: 'pending', user_name: 'Savox', user_id: 'u001',
          applicant_name: 'Savox',
          created_at: '2026-04-13T14:53:59.510789+00:00',
          points_delta: 0,
          invoice_id: 'inv_003',
          invoice_image_url: 'https://mock.icloush.com/invoices/vat_special_water.jpg',
          invoice_info: {
            id: 'inv_003',
            invoice_type_code: '专',
            seller_name: '太仓市自来水有限公司',
            total_amount: 10070.97,
            invoice_number: '26327000006804323071',
            image_url: 'https://mock.icloush.com/invoices/vat_special_water.jpg',
          },
        },
      ],
      message: '成功',
    };
  }

  if (url.match(/\/api\/v1\/expenses\/[^/]+\/review/) && method === 'POST') {
    return { code: 200, data: { status: 'approved' }, message: '审核成功' };
  }

  // ★ V5.5.2 Hotfix: 报销单详情补充 invoice_info + voucher_type_label
  if (url.match(/\/api\/v1\/expenses\/[^/]+$/) && method === 'GET') {
    return {
      code: 200,
      data: {
        id: 'exp_001', purpose: '餐费', claimed_amount: 767, voucher_type: 'invoice',
        voucher_type_label: '发票',
        status: 'pending', status_label: '待审核',
        user_name: 'Savox', user_id: 'u001',
        applicant_name: 'Savox', employee_name: 'Savox',
        created_at: '2026-04-13T14:53:59.510789+00:00',
        invoice_id: 'inv_003',
        invoice_image_url: 'https://mock.icloush.com/invoices/vat_special_water.jpg',
        invoice_info: {
          id: 'inv_003',
          invoice_type_code: '专',
          seller_name: '太仓市自来水有限公司',
          total_amount: 10070.97,
          invoice_number: '26327000006804323071',
          image_url: 'https://mock.icloush.com/invoices/vat_special_water.jpg',
        },
        receipt_image_url: null,
        ocr_data: {
          seller_name: '太仓市自来水有限公司',
          seller_tax_id: '91320585138087604',
          buyer_name: '富尔朵实业(太仓)有限公司',
          buyer_tax_id: '91320585MA1N5CYG7X',
          total_amount: '10070.97',
          pre_tax_amount: '9777.64',
          tax_amount: '293.33',
          invoice_date: '2026-04-13',
          invoice_number: '26327000006804323071',
          invoice_code: '',
          invoice_type_label: '电子发票(增值税专用发票)',
          check_code: '',
          goods_name_summary: '*水冰雪*水费 工业、商业、服务业',
          drawer: '盛恩恩',
          remark: '户号:0519424852,读数:99841-104398,用水量:4557',
        },
      },
      message: '成功',
    };
  }

  if (url.indexOf('/api/v1/expenses') !== -1 && method === 'POST') {
    return {
      code: 200,
      data: { id: 'exp_' + Date.now(), status: 'pending' },
      message: '报销提交成功',
    };
  }

  // 付款状态更新（审批 + 已付款自动入成本）
  if (url.match(/\/api\/v1\/payments\/[^/]+\/status/) && method === 'PUT') {
    return { code: 200, data: { status: (data && data.status) || 'approved', cost_category: (data && data.cost_category) || '' }, message: '操作成功' };
  }

  // 付款列表（管理员全部）
  if (url.indexOf('/api/v1/payments/') !== -1 && method === 'GET' && url.indexOf('dashboard/invoice-coverage') === -1 && url.indexOf('invoices') === -1 && url.indexOf('/my') === -1 && url.indexOf('/pending') === -1) {
    return {
      code: 200,
      data: [
        { id: 'pay_001', payment_type: 'A', supplier_name: '海尔', purpose: '家用小洗衣机采购', total_amount: 900, status: 'pending', applicant_name: '程建平', created_at: '2026-04-12T08:00:00Z' },
        { id: 'pay_002', payment_type: 'B', supplier_name: '格力', purpose: '空调采购', total_amount: 5600, status: 'completed', applicant_name: '张三', created_at: '2026-04-10T10:00:00Z', cost_category: '设备折旧' },
      ],
      message: '成功',
    };
  }

  // 成本分类
  if (url.indexOf('/api/v1/accounting/categories') !== -1 && method === 'GET') {
    return {
      code: 200,
      data: [
        { code: 'raw_material', name: '原材料' },
        { code: 'equipment', name: '设备维修' },
        { code: 'logistics', name: '物流运输' },
        { code: 'utilities', name: '水电气' },
        { code: 'labor', name: '人工成本' },
        { code: 'office', name: '办公行政' },
        { code: 'other', name: '其他' },
      ],
      message: '成功',
    };
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
  WHITELIST: WHITELIST,
  DAILY_PRODUCTION: DAILY_PRODUCTION,
};
