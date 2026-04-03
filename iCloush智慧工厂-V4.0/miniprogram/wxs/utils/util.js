// ============================================
// iCloush 智慧工厂 — 通用工具函数
// ============================================

/**
 * 格式化日期时间
 */
function formatDate(date, fmt = 'YYYY-MM-DD') {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const map = {
    'YYYY': d.getFullYear(),
    'MM': String(d.getMonth() + 1).padStart(2, '0'),
    'DD': String(d.getDate()).padStart(2, '0'),
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0'),
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, m => map[m]);
}

/**
 * 获取今日日期字符串
 */
function today() {
  return formatDate(new Date(), 'YYYY-MM-DD');
}

/**
 * 获取任务类型标签
 */
function getTaskTypeLabel(type) {
  const map = { routine: '日常', periodic: '周期', specific: '特定' };
  return map[type] || type;
}

/**
 * 获取任务状态标签
 */
function getTaskStatusLabel(status) {
  const map = { 0: '待接单', 1: '已接单', 2: '进行中', 3: '待审核', 4: '已完成', 5: '已驳回' };
  return map[status] || '未知';
}

/**
 * 获取任务优先级标签
 */
function getPriorityLabel(priority) {
  const map = { 1: '低', 2: '普通', 3: '高', 4: '紧急' };
  return map[priority] || '普通';
}

/**
 * 获取角色标签
 */
function getRoleLabel(role) {
  const map = { 1: '员工', 3: '班组长', 5: '主管', 9: '管理员' };
  return map[role] || '员工';
}

/**
 * 获取工区状态颜色
 */
function getZoneStatusColor(status) {
  const map = {
    running: '#00FF88',
    idle: '#888888',
    alert: '#EF4444',
    offline: '#555555',
  };
  return map[status] || '#888888';
}

/**
 * 获取员工头像路径（系统内置头像库）
 */
function getAvatarPath(avatarKey) {
  // 返回本地图片路径（实际开发中可替换为 CDN URL）
  return `/images/avatars/${avatarKey}.png`;
}

/**
 * 获取头像颜色（当图片不存在时用颜色占位）
 */
function getAvatarColor(avatarKey) {
  const colors = ['#C9A84C', '#3B82F6', '#00FF88', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];
  let hash = 0;
  for (let i = 0; i < avatarKey.length; i++) {
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
 * 计算倒计时文字
 */
function getCountdown(deadline) {
  if (!deadline) return '';
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return '已过期';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}天后`;
  if (hours > 0) return `${hours}小时后`;
  return `${minutes}分钟后`;
}

/**
 * 防抖函数
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 显示 Toast（统一封装）
 */
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({ title, icon, duration });
}

/**
 * 显示成功 Toast
 */
function showSuccess(title) {
  wx.showToast({ title, icon: 'success', duration: 1500 });
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
  formatDate,
  today,
  getTaskTypeLabel,
  getTaskStatusLabel,
  getPriorityLabel,
  getRoleLabel,
  getZoneStatusColor,
  getAvatarPath,
  getAvatarColor,
  getAvatarInitial,
  getCountdown,
  debounce,
  showToast,
  showSuccess,
  showError,
  hasPermission,
};
