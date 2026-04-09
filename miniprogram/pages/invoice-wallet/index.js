// ============================================
// 发票夹（重定向到 invoice-list）
// 保留此页面兼容旧入口，实际功能在 invoice-list
// ============================================
Page({
  onLoad: function () {
    wx.redirectTo({ url: '/pages/invoice-list/index' });
  },
});
