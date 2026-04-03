// ============================================
// iCloush 智慧工厂 — 通用工具函数
// 修复：BUG-15 新增 yesterday() 函数
// ============================================

/**
 * 格式化日期时间
 */
function formatDate(date, fmt) {
  if (!fmt) fmt = 'YYYY-MM-DD';
  if (!date) return '';
  var d = date instanceof Date ? date : new Date(date);
  var map = {
    'YYYY': d.getFullYear(),
    'MM': padZero(d.getMonth() + 1),
    'DD': padZero(d.getDate()),
    'HH': padZero(d.getHours()),
    'mm': padZero(d.getMinutes()),
    'ss': padZero(d.getSeconds()),
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, function (m) { return map[m]; });
}

function padZero(n) {
  return n < 10 ? '0' + n : '' + n;
}

/**
 * 获取今日日期字符串
 */
function today() {
  return formatDate(new Date(), 'YYYY-MM-DD');
}

/**
 * 获取昨日日期字符串
 */
function yesterday() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d, 'YYYY-MM-DD');
}

/**
 * 获取任务类型标签
 */
function getTaskTypeLabel(type) {
  var map = { routine: '日常', periodic: '周期', specific: '特定' };
  return map[type] || type;
}

/**
 * 获取任务状态标签
 */
function getTaskStatusLabel(status) {
  var map = { 0: '待接单', 1: '已接单', 2: '进行中', 3: '待审核', 4: '已完成', 5: '已驳回' };
  return map[status] || '未知';
}

/**
 * 获取任务优先级标签
 */
function getPriorityLabel(priority) {
  var map = { 1: '低', 2: '普通', 3: '高', 4: '紧急' };
  return map[priority] || '普通';
}

/**
 * 获取角色标签
 */
function getRoleLabel(role) {
  var map = { 1: '员工', 3: '班组长', 5: '主管', 7: '管理员', 9: '管理员' };
  return map[role] || '员工';
}

/**
 * 获取工区状态颜色
 */
function getZoneStatusColor(status) {
  var map = {
    running: '#00FF88',
    idle: '#888888',
    warning: '#F59E0B',
    alert: '#EF4444',
    offline: '#555555',
  };
  return map[status] || '#888888';
}

/**
 * 获取员工头像路径（系统内置头像库）
 */
function getAvatarPath(avatarKey) {
  return '/images/avatars/' + avatarKey + '.png';
}

/**
 * 获取头像颜色（当图片不存在时用颜色占位）
 */
function getAvatarColor(avatarKey) {
  var colors = ['#C9A84C', '#3B82F6', '#00FF88', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];
  var hash = 0;
  for (var i = 0; i < avatarKey.length; i++) {
    hash = avatarKey.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * 获取头像首字母（占位文字）
 */
function getAvatarInitial(name) {
  return name ? name.charAt(0) : '?';
}

/**
 * 获取星期名称
 */
function getWeekdayName(date) {
  if (!date) return '';
  var d = date instanceof Date ? date : new Date(date);
  var names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()] || '';
}

/**
 * 计算倒计时文字
 */
function getCountdown(deadline) {
  if (!deadline) return '';
  var diff = new Date(deadline) - new Date();
  if (diff <= 0) return '已过期';
  var hours = Math.floor(diff / 3600000);
  var minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return Math.floor(hours / 24) + '天后';
  if (hours > 0) return hours + '小时后';
  return minutes + '分钟后';
}

/**
 * 防抖函数
 */
function debounce(fn, delay) {
  if (!delay) delay = 300;
  var timer = null;
  return function () {
    var self = this;
    var args = arguments;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(self, args); }, delay);
  };
}

/**
 * 显示 Toast（统一封装）
 */
function showToast(title, icon, duration) {
  wx.showToast({ title: title, icon: icon || 'none', duration: duration || 2000 });
}

/**
 * 显示成功 Toast
 */
function showSuccess(title) {
  wx.showToast({ title: title, icon: 'success', duration: 1500 });
}

/**
 * 显示错误 Toast
 */
function showError(title) {
  wx.showToast({ title: title || '操作失败', icon: 'none', duration: 2000 });
}

/**
 * 检查用户权限
 */
function hasPermission(userRole, requiredRole) {
  return userRole >= requiredRole;
}

module.exports = {
  formatDate: formatDate,
  today: today,
  yesterday: yesterday,
  getTaskTypeLabel: getTaskTypeLabel,
  getTaskStatusLabel: getTaskStatusLabel,
  getPriorityLabel: getPriorityLabel,
  getRoleLabel: getRoleLabel,
  getZoneStatusColor: getZoneStatusColor,
  getAvatarPath: getAvatarPath,
  getAvatarColor: getAvatarColor,
  getAvatarInitial: getAvatarInitial,
  getCountdown: getCountdown,
  debounce: debounce,
  showToast: showToast,
  showSuccess: showSuccess,
  showError: showError,
  hasPermission: hasPermission,
  getWeekdayName: getWeekdayName,
};
