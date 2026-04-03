// ============================================
// 权限配置页面
// ============================================
var app = getApp();

var ROLES = [
  { key: 'admin', label: '管理员', color: '#C9A84C', desc: '全部权限，可管理账号和系统配置' },
  { key: 'supervisor', label: '主管', color: '#3B82F6', desc: '可查看报表、审核任务、调整排班' },
  { key: 'team_lead', label: '班组长', color: '#10B981', desc: '可发布任务、管理本工区员工' },
  { key: 'worker', label: '员工', color: '#6B7280', desc: '仅可查看和执行分配给自己的任务' },
];

var ROLE_MAP = {};
for (var r = 0; r < ROLES.length; r++) {
  ROLE_MAP[ROLES[r].key] = ROLES[r];
}

var PERM_MATRIX = [
  { module: 'schedule', icon: '📅', name: '排班管理', perms: { admin: true, supervisor: true, team_lead: true, worker: false } },
  { module: 'task_create', icon: '📋', name: '发布任务', perms: { admin: true, supervisor: true, team_lead: true, worker: false } },
  { module: 'task_audit', icon: '🔍', name: '审核任务', perms: { admin: true, supervisor: true, team_lead: false, worker: false } },
  { module: 'staff_manage', icon: '👥', name: '员工管理', perms: { admin: true, supervisor: false, team_lead: false, worker: false } },
  { module: 'reports', icon: '📊', name: '数据报表', perms: { admin: true, supervisor: true, team_lead: false, worker: false } },
  { module: 'iot', icon: '📡', name: 'IoT监控', perms: { admin: true, supervisor: true, team_lead: false, worker: false } },
  { module: 'mall_admin', icon: '🏪', name: '商城管理', perms: { admin: true, supervisor: false, team_lead: false, worker: false } },
  { module: 'permission', icon: '🔐', name: '权限管理', perms: { admin: true, supervisor: false, team_lead: false, worker: false } },
];

Page({
  data: {
    roles: ROLES,
    permMatrix: PERM_MATRIX,
    roleFilters: [{ key: 'all', label: '全部' }].concat(ROLES),
    allStaff: [], filteredStaff: [],
    activeRoleFilter: 'all',
    showEditModal: false, editTarget: {}, selectedRole: '',
  },

  onLoad: function () { this.loadStaff(); },

  loadStaff: function () {
    var self = this;
    app.request({
      url: '/api/v1/users',
      success: function (res) {
        if (res.code === 200 && res.data) {
          var staff = [];
          var rawData = res.data || [];
          for (var i = 0; i < rawData.length; i++) {
            var s = rawData[i];
            staff.push({
              id: s.id, name: s.name,
              zone_name: (s.current_zones && s.current_zones.length > 0) ? s.current_zones[0] : '未分配',
              role: s.role >= 7 ? 'admin' : s.role >= 5 ? 'supervisor' : s.role >= 3 ? 'team_lead' : 'worker',
              avatarColor: '#C9A84C',
              initial: s.name ? s.name.substring(0, 1) : '?',
            });
          }
          self.processStaff(staff);
        } else {
          self.processStaff([
            { id: 1, name: '王建国', zone_name: '洗涤龙工区', role: 'admin', avatarColor: '#C9A84C', initial: '王' },
            { id: 2, name: '李秀英', zone_name: '展布平烫A', role: 'supervisor', avatarColor: '#EC4899', initial: '李' },
            { id: 3, name: '张伟', zone_name: '单机洗烘区', role: 'team_lead', avatarColor: '#F59E0B', initial: '张' },
            { id: 4, name: '刘芳', zone_name: '毛巾折叠区', role: 'worker', avatarColor: '#10B981', initial: '刘' },
            { id: 5, name: '陈强', zone_name: '机动物流区', role: 'worker', avatarColor: '#8B5CF6', initial: '陈' },
          ]);
        }
      },
    });
  },

  processStaff: function (staff) {
    var processed = [];
    for (var i = 0; i < staff.length; i++) {
      var s = staff[i];
      var roleInfo = ROLE_MAP[s.role] || ROLE_MAP.worker;
      processed.push({
        id: s.id, name: s.name, zone_name: s.zone_name,
        role: s.role, avatarColor: s.avatarColor, initial: s.initial,
        roleLabel: roleInfo.label, roleColor: roleInfo.color,
      });
    }
    this.setData({ allStaff: processed });
    this.applyFilter(this.data.activeRoleFilter, processed);
  },

  filterByRole: function (e) {
    var role = e.currentTarget.dataset.role;
    this.setData({ activeRoleFilter: role });
    this.applyFilter(role, this.data.allStaff);
  },

  applyFilter: function (role, staff) {
    var filtered = [];
    if (role === 'all') {
      filtered = staff;
    } else {
      for (var i = 0; i < staff.length; i++) {
        if (staff[i].role === role) filtered.push(staff[i]);
      }
    }
    this.setData({ filteredStaff: filtered });
  },

  editRole: function (e) {
    var staff = e.currentTarget.dataset.staff;
    this.setData({ showEditModal: true, editTarget: staff, selectedRole: staff.role });
  },

  selectRole: function (e) { this.setData({ selectedRole: e.currentTarget.dataset.role }); },

  confirmEditRole: function () {
    var editTarget = this.data.editTarget;
    var selectedRole = this.data.selectedRole;
    var self = this;
    if (editTarget.role === selectedRole) { self.closeModal(); return; }
    app.request({
      url: '/api/v1/users/' + editTarget.id + '/role',
      method: 'PATCH',
      data: { role: selectedRole },
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: '角色已更新', icon: 'success' });
          self.closeModal();
          self.loadStaff();
        } else {
          wx.showToast({ title: '更新失败，请重试', icon: 'none' });
        }
      },
    });
  },

  showAddModal: function () { wx.showToast({ title: '新建账号功能即将上线', icon: 'none' }); },
  closeModal: function () { this.setData({ showEditModal: false, editTarget: {}, selectedRole: '' }); },
});
