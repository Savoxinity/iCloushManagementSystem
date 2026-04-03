// ============================================
// 员工管理页面
// V5 修复：新增弹窗补齐技能标签 + 飞书式默认头像（渐变色）
// ============================================
var app = getApp();
var util = require('../../utils/util');

// ★ 飞书式头像颜色库：每个 key 带主色 + 暗色（用于 linear-gradient）
var AVATAR_LIBRARY = [
  { key: 'male_washer_01', label: '洗涤工', initial: '男', color: '#3B82F6', colorDark: '#1E40AF' },
  { key: 'male_washer_02', label: '洗涤工', initial: '男', color: '#1D4ED8', colorDark: '#1E3A8A' },
  { key: 'female_washer_01', label: '洗涤工', initial: '女', color: '#EC4899', colorDark: '#BE185D' },
  { key: 'female_washer_02', label: '洗涤工', initial: '女', color: '#BE185D', colorDark: '#831843' },
  { key: 'male_ironer_01', label: '烫平工', initial: '男', color: '#F59E0B', colorDark: '#B45309' },
  { key: 'female_ironer_01', label: '烫平工', initial: '女', color: '#D97706', colorDark: '#92400E' },
  { key: 'male_driver_01', label: '司机', initial: '男', color: '#10B981', colorDark: '#047857' },
  { key: 'female_driver_01', label: '司机', initial: '女', color: '#059669', colorDark: '#065F46' },
  { key: 'male_supervisor_01', label: '主管', initial: '男', color: '#8B5CF6', colorDark: '#5B21B6' },
  { key: 'female_supervisor_01', label: '主管', initial: '女', color: '#7C3AED', colorDark: '#4C1D95' },
  { key: 'male_admin_01', label: '管理员', initial: '男', color: '#C9A84C', colorDark: '#8B6914' },
  { key: 'female_admin_01', label: '管理员', initial: '女', color: '#A87C2A', colorDark: '#6B4F1A' },
];

var ALL_SKILLS = ['洗涤龙', '单机洗烘', '展布机平烫', '平烫后处理', '毛巾折叠', '布草分拣', '衣服分拣', '手工洗涤', '熨烫', '物流驾驶', '跟车小工'];

// 根据 avatar_key 查找颜色
function getAvatarColors(key) {
  for (var i = 0; i < AVATAR_LIBRARY.length; i++) {
    if (AVATAR_LIBRARY[i].key === key) return { color: AVATAR_LIBRARY[i].color, colorDark: AVATAR_LIBRARY[i].colorDark };
  }
  return { color: '#6B7280', colorDark: '#374151' };
}

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
    newStaff: { name: '', username: '', password: '', role: 1, avatar_key: 'male_washer_01', skills: [], is_multi_post: false },
    showNewPassword: false,
    newStaffAvatarColor: '#3B82F6',
    newStaffAvatarColorDark: '#1E40AF',
    newStaffInitial: '新',
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
          var colors = getAvatarColors(s.avatar_key || 'default');
          allStaff.push({
            id: s.id, name: s.name, role: s.role,
            avatar_key: s.avatar_key || 'default',
            avatarColor: colors.color,
            avatarColorDark: colors.colorDark,
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
    copy.skills = (staff.skills || []).slice();
    this.setData({ showDetailModal: true, editMode: false, currentStaff: copy });
  },

  closeDetailModal: function () { this.setData({ showDetailModal: false, editMode: false }); },
  enterEditMode: function () { this.setData({ editMode: true }); },
  cancelEdit: function () { this.setData({ editMode: false }); },

  selectAvatar: function (e) {
    if (!this.data.editMode) return;
    var key = e.currentTarget.dataset.key;
    var colors = getAvatarColors(key);
    this.setData({
      'currentStaff.avatar_key': key,
      'currentStaff.avatarColor': colors.color,
      'currentStaff.avatarColorDark': colors.colorDark,
    });
  },

  onEditName: function (e) {
    var name = e.detail.value;
    this.setData({
      'currentStaff.name': name,
      'currentStaff.nameInitial': util.getAvatarInitial(name),
    });
  },

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

  // ── 新增员工弹窗 ──────────────────────────────────────────
  showAddModal: function () {
    var defaultColors = getAvatarColors('male_washer_01');
    this.setData({
      showAddModal: true,
      newStaff: { name: '', username: '', password: '', role: 1, avatar_key: 'male_washer_01', skills: [], is_multi_post: false },
      showNewPassword: false,
      newStaffAvatarColor: defaultColors.color,
      newStaffAvatarColorDark: defaultColors.colorDark,
      newStaffInitial: '新',
    });
  },
  closeAddModal: function () { this.setData({ showAddModal: false }); },

  onNewName: function (e) {
    var name = e.detail.value;
    this.setData({
      'newStaff.name': name,
      newStaffInitial: name ? util.getAvatarInitial(name) : '新',
    });
  },

  // ★ V6 新增：登录账号输入
  onNewUsername: function (e) {
    this.setData({ 'newStaff.username': e.detail.value });
  },

  // ★ V6 新增：密码输入
  onNewPassword: function (e) {
    this.setData({ 'newStaff.password': e.detail.value });
  },

  // ★ V6 新增：切换密码可见
  toggleNewPwdVisible: function () {
    this.setData({ showNewPassword: !this.data.showNewPassword });
  },

  selectNewRole: function (e) { this.setData({ 'newStaff.role': e.currentTarget.dataset.value }); },

  selectNewAvatar: function (e) {
    var key = e.currentTarget.dataset.key;
    var colors = getAvatarColors(key);
    this.setData({
      'newStaff.avatar_key': key,
      newStaffAvatarColor: colors.color,
      newStaffAvatarColorDark: colors.colorDark,
    });
  },

  // ★ V5 新增：新增弹窗技能标签切换
  toggleNewSkill: function (e) {
    var skill = e.currentTarget.dataset.skill;
    var skills = (this.data.newStaff.skills || []).slice();
    var idx = skills.indexOf(skill);
    if (idx >= 0) { skills.splice(idx, 1); } else { skills.push(skill); }
    this.setData({
      'newStaff.skills': skills,
      'newStaff.is_multi_post': skills.length > 1,
    });
  },

  // ★ V5 新增：新增弹窗多岗位开关
  toggleNewMultiPost: function (e) {
    this.setData({ 'newStaff.is_multi_post': e.detail.value });
  },

  createStaff: function () {
    var newStaff = this.data.newStaff;
    if (!newStaff.name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
    if (!newStaff.username || newStaff.username.trim().length < 2) {
      wx.showToast({ title: '请输入登录账号（至少2位）', icon: 'none' }); return;
    }
    if (!newStaff.password || newStaff.password.trim().length < 6) {
      wx.showToast({ title: '密码至少6位', icon: 'none' }); return;
    }
    if (!newStaff.skills || newStaff.skills.length === 0) {
      wx.showToast({ title: '请至少选择一个技能标签', icon: 'none' }); return;
    }
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
