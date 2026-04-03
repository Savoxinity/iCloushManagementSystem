// ============================================
// 员工管理页面
// ============================================
var app = getApp();
var util = require('../../utils/util');

var AVATAR_LIBRARY = [
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

var ALL_SKILLS = ['洗涤龙', '单机洗', '烫平机', '展布机', '折叠', '客衣干洗', '制服洗烫', '收脏', '新货', '物流驾驶', '跟车小工'];

Page({
  data: {
    allStaff: [],
    filteredStaff: [],
    searchKeyword: '',
    activeRoleFilter: 'all',
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
    showDetailModal: false,
    showAddModal: false,
    editMode: false,
    currentStaff: {},
    newStaff: { name: '', role: 1, avatar_key: 'male_washer_01', skills: [], is_multi_post: false },
  },

  onLoad: function () { this.loadStaff(); },
  onShow: function () { this.loadStaff(); },

  loadStaff: function () {
    var self = this;
    app.request({
      url: '/api/v1/users',
      success: function (res) {
        if (res.code !== 200) return;
        var rawData = res.data || [];
        var allStaff = [];
        var roleShortMap = { 1: '员', 3: '长', 5: '管', 7: '总' };
        for (var i = 0; i < rawData.length; i++) {
          var s = rawData[i];
          allStaff.push({
            id: s.id, name: s.name, role: s.role,
            avatar_key: s.avatar_key || 'default',
            avatarColor: util.getAvatarColor(s.avatar_key || 'default'),
            nameInitial: util.getAvatarInitial(s.name),
            roleLabel: util.getRoleLabel(s.role),
            roleShort: roleShortMap[s.role] || '员',
            skills: s.skills || [],
            is_multi_post: s.is_multi_post || false,
            status: s.status || 'active',
            total_points: s.total_points || 0,
            monthly_points: s.monthly_points || 0,
            task_completed: s.task_completed || 0,
            current_zones: s.current_zones || [],
          });
        }
        self.setData({ allStaff: allStaff });
        self.applyFilter();
      },
    });
  },

  applyFilter: function () {
    var allStaff = this.data.allStaff;
    var searchKeyword = this.data.searchKeyword;
    var activeRoleFilter = this.data.activeRoleFilter;
    var filtered = [];
    for (var i = 0; i < allStaff.length; i++) {
      var s = allStaff[i];
      if (activeRoleFilter !== 'all' && s.role !== activeRoleFilter) continue;
      if (searchKeyword && s.name.indexOf(searchKeyword) === -1) continue;
      filtered.push(s);
    }
    this.setData({ filteredStaff: filtered });
  },

  onSearch: function (e) { this.setData({ searchKeyword: e.detail.value }); this.applyFilter(); },
  setRoleFilter: function (e) { this.setData({ activeRoleFilter: e.currentTarget.dataset.value }); this.applyFilter(); },

  showStaffDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    var staff = null;
    for (var i = 0; i < this.data.allStaff.length; i++) {
      if (this.data.allStaff[i].id === id) { staff = this.data.allStaff[i]; break; }
    }
    if (!staff) return;
    var copy = {};
    var keys = Object.keys(staff);
    for (var k = 0; k < keys.length; k++) { copy[keys[k]] = staff[keys[k]]; }
    // 深拷贝skills数组
    copy.skills = (staff.skills || []).slice();
    this.setData({ showDetailModal: true, editMode: false, currentStaff: copy });
  },

  closeDetailModal: function () { this.setData({ showDetailModal: false, editMode: false }); },
  enterEditMode: function () { this.setData({ editMode: true }); },
  cancelEdit: function () { this.setData({ editMode: false }); },

  selectAvatar: function (e) {
    if (!this.data.editMode) return;
    this.setData({
      'currentStaff.avatar_key': e.currentTarget.dataset.key,
      'currentStaff.avatarColor': util.getAvatarColor(e.currentTarget.dataset.key),
    });
  },

  onEditName: function (e) { this.setData({ 'currentStaff.name': e.detail.value }); },
  selectRole: function (e) {
    this.setData({
      'currentStaff.role': e.currentTarget.dataset.value,
      'currentStaff.roleLabel': util.getRoleLabel(e.currentTarget.dataset.value),
    });
  },

  toggleSkill: function (e) {
    if (!this.data.editMode) return;
    var skill = e.currentTarget.dataset.skill;
    var skills = (this.data.currentStaff.skills || []).slice();
    var idx = skills.indexOf(skill);
    if (idx >= 0) { skills.splice(idx, 1); } else { skills.push(skill); }
    this.setData({ 'currentStaff.skills': skills, 'currentStaff.is_multi_post': skills.length > 1 });
  },

  toggleMultiPost: function (e) { this.setData({ 'currentStaff.is_multi_post': e.detail.value }); },

  saveStaff: function () {
    var currentStaff = this.data.currentStaff;
    if (!currentStaff.name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
    var self = this;
    app.request({
      url: '/api/v1/users/' + currentStaff.id,
      method: 'PUT',
      data: { name: currentStaff.name, role: currentStaff.role, avatar_key: currentStaff.avatar_key, skills: currentStaff.skills, is_multi_post: currentStaff.is_multi_post },
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          self.setData({ editMode: false, showDetailModal: false });
          self.loadStaff();
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  confirmDisable: function () {
    var self = this;
    wx.showModal({
      title: '停用账号',
      content: '确认停用该员工账号？',
      confirmColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) return;
        app.request({
          url: '/api/v1/users/' + self.data.currentStaff.id + '/disable',
          method: 'POST',
          success: function () {
            wx.showToast({ title: '账号已停用', icon: 'success' });
            self.setData({ showDetailModal: false });
            self.loadStaff();
          },
        });
      },
    });
  },

  showAddModal: function () {
    this.setData({ showAddModal: true, newStaff: { name: '', role: 1, avatar_key: 'male_washer_01', skills: [], is_multi_post: false } });
  },
  closeAddModal: function () { this.setData({ showAddModal: false }); },
  onNewName: function (e) { this.setData({ 'newStaff.name': e.detail.value }); },
  selectNewRole: function (e) { this.setData({ 'newStaff.role': e.currentTarget.dataset.value }); },
  selectNewAvatar: function (e) { this.setData({ 'newStaff.avatar_key': e.currentTarget.dataset.key }); },

  createStaff: function () {
    var newStaff = this.data.newStaff;
    if (!newStaff.name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
    var self = this;
    app.request({
      url: '/api/v1/users',
      method: 'POST',
      data: newStaff,
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: '员工账号已创建', icon: 'success' });
          self.setData({ showAddModal: false });
          self.loadStaff();
        } else {
          wx.showToast({ title: '创建失败', icon: 'none' });
        }
      },
    });
  },

  stopProp: function () {},
});
