const app = getApp();
const ROLES = [
  { key: 'admin', label: '管理员', color: '#C9A84C', desc: '全部权限，可管理账号和系统配置' },
  { key: 'supervisor', label: '主管', color: '#3B82F6', desc: '可查看报表、审核任务、调整排班' },
  { key: 'team_lead', label: '班组长', color: '#10B981', desc: '可发布任务、管理本工区员工' },
  { key: 'worker', label: '员工', color: '#6B7280', desc: '仅可查看和执行分配给自己的任务' },
];
const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.key, r]));
const PERM_MATRIX = [
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
    // roleFilters = [{key:'all', label:'全部'}, ...ROLES]
    // 在 JS 层合并，避免 WXML 展开运算符不兼容问题
    roleFilters: [{ key: 'all', label: '全部' }].concat(ROLES),
    allStaff: [], filteredStaff: [],
    activeRoleFilter: 'all',
    showEditModal: false, editTarget: {}, selectedRole: '',
  },
  onLoad() { this.loadStaff(); },
  loadStaff() {
    app.request({ url: '/api/v1/staff', method: 'GET' })
      .then(res => { this.processStaff(res.data || []); })
      .catch(() => {
        this.processStaff([
          { id: 1, name: '王建国', zone_name: '隧道洗涤龙工区', role: 'admin', avatarColor: '#C9A84C', initial: '王' },
          { id: 2, name: '李秀英', zone_name: '烫平展布工区', role: 'supervisor', avatarColor: '#EC4899', initial: '李' },
          { id: 3, name: '张伟', zone_name: '单机洗涤区', role: 'team_lead', avatarColor: '#F59E0B', initial: '张' },
          { id: 4, name: '刘芳', zone_name: '后处理折叠区', role: 'worker', avatarColor: '#10B981', initial: '刘' },
          { id: 5, name: '陈强', zone_name: '机动物流区', role: 'worker', avatarColor: '#8B5CF6', initial: '陈' },
        ]);
      });
  },
  processStaff(staff) {
    const processed = staff.map(s => {
      const roleInfo = ROLE_MAP[s.role] || ROLE_MAP.worker;
      return { ...s, roleLabel: roleInfo.label, roleColor: roleInfo.color };
    });
    this.setData({ allStaff: processed });
    this.applyFilter(this.data.activeRoleFilter, processed);
  },
  filterByRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ activeRoleFilter: role });
    this.applyFilter(role, this.data.allStaff);
  },
  applyFilter(role, staff) {
    const filtered = role === 'all' ? staff : staff.filter(s => s.role === role);
    this.setData({ filteredStaff: filtered });
  },
  editRole(e) {
    const staff = e.currentTarget.dataset.staff;
    this.setData({ showEditModal: true, editTarget: staff, selectedRole: staff.role });
  },
  selectRole(e) { this.setData({ selectedRole: e.currentTarget.dataset.role }); },
  confirmEditRole() {
    const { editTarget, selectedRole } = this.data;
    if (editTarget.role === selectedRole) { this.closeModal(); return; }
    app.request({ url: `/api/v1/staff/${editTarget.id}/role`, method: 'PATCH', data: { role: selectedRole } })
      .then(() => { wx.showToast({ title: '角色已更新', icon: 'success' }); this.closeModal(); this.loadStaff(); })
      .catch(() => { wx.showToast({ title: '更新失败，请重试', icon: 'none' }); });
  },
  showAddModal() { wx.showToast({ title: '新建账号功能即将上线', icon: 'none' }); },
  closeModal() { this.setData({ showEditModal: false, editTarget: {}, selectedRole: '' }); },
});
