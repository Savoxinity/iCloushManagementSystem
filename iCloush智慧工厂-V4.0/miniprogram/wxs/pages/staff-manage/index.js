const app = getApp();
const util = require('../../utils/util');

const AVATAR_LIBRARY = [
  { key: 'male_washer_01', label: '洗涤工', initial: '男', color: '#3B82F6' },
  { key: 'male_washer_02', label: '洗涤工', initial: '男', color: '#1D4ED8' },
  { key: 'female_washer_01', label: '洗涤工', initial: '女', color: '#EC4899' },
  { key: 'female_washer_02', label: '洗涤工', initial: '女', color: '#BE185D' },
  { key: 'male_ironer_01', label: '烫平工', initial: '男', color: '#F59E0B' },
  { key: 'female_ironer_01', label: '烫平工', initial: '女', color: '#D97706' },
  { key: 'male_driver_01', label: '司机', initial: '男', color: '#10B981' },
  { key: 'female_driver_01', label: '司机', initial: '女', color: '#059669' },
  { key: 'male_supervisor_01', label: '主管', initial: '男', color: '#8B5CF6' },
  { key: 'female_supervisor_01', label: '主管', initial: '女', color: '#7C3AED' },
  { key: 'male_admin_01', label: '管理员', initial: '男', color: '#C9A84C' },
  { key: 'female_admin_01', label: '管理员', initial: '女', color: '#A87C2A' },
];

const ALL_SKILLS = ['洗涤龙', '单机洗', '烫平机', '展布机', '折叠', '客衣干洗', '制服洗烫', '收脏', '新货', '物流驾驶', '跟车小工'];

Page({
  data: {
    allStaff: [], filteredStaff: [],
    searchKeyword: '', activeRoleFilter: 'all',
    roleFilters: [
      { label: '全部', value: 'all' },
      { label: '管理员', value: 7 },
      { label: '主管', value: 5 },
      { label: '班组长', value: 3 },
      { label: '员工', value: 1 },
    ],
    roleOptions: [
      { label: '员工', value: 1 },
      { label: '班组长', value: 3 },
      { label: '主管', value: 5 },
      { label: '管理员', value: 7 },
    ],
    avatarLibrary: AVATAR_LIBRARY,
    allSkills: ALL_SKILLS,
    showDetailModal: false, showAddModal: false, editMode: false,
    currentStaff: {},
    newStaff: { name: '', role: 1, avatar_key: 'male_washer_01', skills: [], is_multi_post: false },
  },

  onLoad() { this.loadStaff(); },
  onShow() { this.loadStaff(); },

  loadStaff() {
    app.request({
      url: '/api/v1/users',
      success: (res) => {
        if (res.code !== 200) return;
        const allStaff = res.data.map(s => ({
          ...s,
          avatarColor: util.getAvatarColor(s.avatar_key),
          nameInitial: util.getAvatarInitial(s.name),
          roleLabel: util.getRoleLabel(s.role),
          roleShort: { 1: '员', 3: '长', 5: '管', 7: '总' }[s.role] || '员',
          skills: s.skills || [],
          total_points: s.total_points || 0,
          monthly_points: s.monthly_points || 0,
          task_completed: s.task_completed || 0,
        }));
        this.setData({ allStaff });
        this.applyFilter();
      },
    });
  },

  applyFilter() {
    const { allStaff, searchKeyword, activeRoleFilter } = this.data;
    let filtered = allStaff;
    if (activeRoleFilter !== 'all') filtered = filtered.filter(s => s.role === activeRoleFilter);
    if (searchKeyword) filtered = filtered.filter(s => s.name.includes(searchKeyword));
    this.setData({ filteredStaff: filtered });
  },

  onSearch(e) { this.setData({ searchKeyword: e.detail.value }); this.applyFilter(); },
  setRoleFilter(e) { this.setData({ activeRoleFilter: e.currentTarget.dataset.value }); this.applyFilter(); },

  showStaffDetail(e) {
    const id = e.currentTarget.dataset.id;
    const staff = this.data.allStaff.find(s => s.id === id);
    if (!staff) return;
    this.setData({ showDetailModal: true, editMode: false, currentStaff: { ...staff } });
  },

  closeDetailModal() { this.setData({ showDetailModal: false, editMode: false }); },
  enterEditMode() { this.setData({ editMode: true }); },
  cancelEdit() { this.setData({ editMode: false }); },

  selectAvatar(e) {
    if (!this.data.editMode) return;
    this.setData({ 'currentStaff.avatar_key': e.currentTarget.dataset.key, 'currentStaff.avatarColor': util.getAvatarColor(e.currentTarget.dataset.key) });
  },

  onEditName(e) { this.setData({ 'currentStaff.name': e.detail.value }); },
  selectRole(e) { this.setData({ 'currentStaff.role': e.currentTarget.dataset.value, 'currentStaff.roleLabel': util.getRoleLabel(e.currentTarget.dataset.value) }); },

  toggleSkill(e) {
    if (!this.data.editMode) return;
    const skill = e.currentTarget.dataset.skill;
    let skills = [...(this.data.currentStaff.skills || [])];
    const idx = skills.indexOf(skill);
    if (idx >= 0) skills.splice(idx, 1); else skills.push(skill);
    this.setData({ 'currentStaff.skills': skills, 'currentStaff.is_multi_post': skills.length > 1 });
  },

  toggleMultiPost(e) { this.setData({ 'currentStaff.is_multi_post': e.detail.value }); },

  saveStaff() {
    const { currentStaff } = this.data;
    if (!currentStaff.name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
    app.request({
      url: '/api/v1/users/' + currentStaff.id, method: 'PUT',
      data: { name: currentStaff.name, role: currentStaff.role, avatar_key: currentStaff.avatar_key, skills: currentStaff.skills, is_multi_post: currentStaff.is_multi_post },
      success: (res) => {
        if (res.code === 200) { wx.showToast({ title: '保存成功', icon: 'success' }); this.setData({ editMode: false, showDetailModal: false }); this.loadStaff(); }
        else { wx.showToast({ title: '保存失败', icon: 'none' }); }
      },
    });
  },

  confirmDisable() {
    wx.showModal({ title: '停用账号', content: '确认停用该员工账号？', confirmColor: '#EF4444', success: (res) => {
      if (!res.confirm) return;
      app.request({ url: '/api/v1/users/' + this.data.currentStaff.id + '/disable', method: 'POST', success: () => {
        wx.showToast({ title: '账号已停用', icon: 'success' }); this.setData({ showDetailModal: false }); this.loadStaff();
      }});
    }});
  },

  showAddModal() { this.setData({ showAddModal: true, newStaff: { name: '', role: 1, avatar_key: 'male_washer_01', skills: [], is_multi_post: false } }); },
  closeAddModal() { this.setData({ showAddModal: false }); },
  onNewName(e) { this.setData({ 'newStaff.name': e.detail.value }); },
  selectNewRole(e) { this.setData({ 'newStaff.role': e.currentTarget.dataset.value }); },
  selectNewAvatar(e) { this.setData({ 'newStaff.avatar_key': e.currentTarget.dataset.key }); },

  createStaff() {
    const { newStaff } = this.data;
    if (!newStaff.name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
    app.request({
      url: '/api/v1/users', method: 'POST', data: newStaff,
      success: (res) => {
        if (res.code === 200) { wx.showToast({ title: '员工账号已创建', icon: 'success' }); this.setData({ showAddModal: false }); this.loadStaff(); }
        else { wx.showToast({ title: '创建失败', icon: 'none' }); }
      },
    });
  },

  stopProp() {},
});
