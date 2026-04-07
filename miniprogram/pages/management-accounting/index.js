// ============================================
// 管理会计入口页 — 导航到子功能
// ============================================
var app = getApp();

Page({
  data: {
    menuItems: [
      { id: 'missing-invoice', icon: '📋', title: '欠票看板', desc: '查看未补票记录、一键催票', url: '/pages/missing-invoice/index' },
      { id: 'cost-entry', icon: '💰', title: '成本直录', desc: '财务直接录入成本条目', url: '/pages/cost-entry/index' },
      { id: 'revenue-entry', icon: '💵', title: '营收直录', desc: '录入每月总营收数据', url: '/pages/revenue-entry/index' },
      { id: 'profit-statement', icon: '📊', title: '管理利润表', desc: '边际贡献、盈亏平衡分析', url: '/pages/profit-statement/index' },
    ],
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '管理会计' });
  },

  goPage: function (e) {
    var url = e.currentTarget.dataset.url;
    // 检查权限（管理员功能）
    var userInfo = app.globalData.userInfo;
    if (userInfo && (userInfo.role >= 5 || userInfo.role_name === 'admin' || userInfo.role_name === 'finance')) {
      wx.navigateTo({ url: url });
    } else {
      wx.showToast({ title: '需要管理员权限', icon: 'none' });
    }
  },
});
