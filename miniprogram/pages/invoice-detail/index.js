// ============================================
// 发票详情页 V5.6.7 — 使用 invoice-info-card 组件
// 页面只负责数据加载和核验操作，UI 渲染全部委托给组件
// ============================================
var app = getApp();

Page({
  data: {
    invoiceId: null,
    invoice: null,
    loading: true,
    error: '',
    verifying: false,
  },

  onLoad: function (options) {
    if (options.id) {
      var id = options.id;
      this.setData({ invoiceId: id });
      this.loadDetail();
    } else {
      this.setData({ error: '缺少发票ID', loading: false });
    }
  },

  loadDetail: function () {
    var self = this;
    self.setData({ loading: true });

    app.request({
      url: '/api/v1/invoices/' + self.data.invoiceId,
      success: function (res) {
        self.setData({ loading: false });
        if (res.code === 200 && res.data) {
          var invoice = res.data;
          // ★ 数据格式化现在由组件内部完成，这里只做最基础的处理
          self.setData({ invoice: invoice });
          wx.setNavigationBarTitle({
            title: invoice.goods_name_summary || invoice.seller_name || '发票详情'
          });
        } else {
          self.setData({ error: '加载失败' });
        }
      },
      fail: function () {
        self.setData({ loading: false, error: '网络错误' });
      },
    });
  },

  // ── 自动核验（由组件触发） ──
  onAutoVerify: function () {
    var self = this;
    var inv = self.data.invoice;
    if (!inv || self.data.verifying) return;

    if (!inv.invoice_number && !inv.invoice_code) {
      wx.showToast({ title: '缺少发票号码或代码，无法自动核验', icon: 'none', duration: 2500 });
      return;
    }

    wx.showModal({
      title: '自动核验',
      content: '将自动检查发票号码是否重复，并根据字段完整性自动标记状态。确认继续？',
      success: function (modalRes) {
        if (modalRes.confirm) {
          self.setData({ verifying: true });
          app.request({
            url: '/api/v1/invoices/' + inv.id + '/verify',
            method: 'POST',
            data: {
              auto_verify: true,
              invoice_number: inv.invoice_number || '',
              invoice_code: inv.invoice_code || '',
            },
            success: function (res) {
              self.setData({ verifying: false });
              if (res.code === 200 && res.data) {
                var d = res.data;
                var msg = '';
                if (d.is_duplicate) {
                  msg = '检测到重复发票！已自动标记';
                } else if (d.verify_status === 'verified') {
                  msg = '核验通过，字段完整';
                } else if (d.verify_status === 'manual_review') {
                  msg = '关键字段缺失，已标记待人工复核';
                } else {
                  msg = res.message || '核验完成';
                }
                wx.showToast({ title: msg, icon: 'none', duration: 3000 });
                self.loadDetail();
              } else {
                wx.showToast({ title: res.message || '核验失败', icon: 'none' });
              }
            },
            fail: function () {
              self.setData({ verifying: false });
              wx.showToast({ title: '网络错误', icon: 'none' });
            },
          });
        }
      },
    });
  },

  // ── 手动标记核验（由组件触发） ──
  onManualVerify: function () {
    var self = this;
    var inv = self.data.invoice;
    if (!inv) return;

    wx.showActionSheet({
      itemList: ['标记为已核验', '标记为核验失败', '标记为重复发票'],
      success: function (res) {
        var statusMap = ['verified', 'failed', 'duplicate'];
        var status = statusMap[res.tapIndex];
        self.setData({ verifying: true });
        app.request({
          url: '/api/v1/invoices/' + inv.id + '/verify',
          method: 'POST',
          data: { verify_result: status },
          success: function (res) {
            self.setData({ verifying: false });
            if (res.code === 200) {
              wx.showToast({ title: '标记成功', icon: 'success' });
              self.loadDetail();
            } else {
              wx.showToast({ title: res.message || '操作失败', icon: 'none' });
            }
          },
          fail: function () {
            self.setData({ verifying: false });
            wx.showToast({ title: '网络错误', icon: 'none' });
          },
        });
      },
    });
  },

  // 返回
  goBack: function () {
    wx.navigateBack();
  },
});
