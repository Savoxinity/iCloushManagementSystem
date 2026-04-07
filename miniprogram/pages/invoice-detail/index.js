// ============================================
// 发票详情页（照搬华通APP — 上30%图片 + 下70%详情）
// ============================================
var app = getApp();

Page({
  data: {
    invoiceId: null,
    invoice: null,
    loading: true,
    error: '',
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ invoiceId: parseInt(options.id) });
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
          // 格式化明细条目
          var invoice = res.data;
          if (invoice.items && invoice.items.length > 0) {
            invoice.hasItems = true;
          } else {
            invoice.hasItems = false;
          }
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

  // 预览发票图片
  previewImage: function () {
    var url = this.data.invoice && this.data.invoice.image_url;
    if (url) {
      wx.previewImage({ urls: [url], current: url });
    }
  },

  // 复制发票号码
  copyNumber: function () {
    var inv = this.data.invoice;
    if (inv && inv.invoice_number) {
      wx.setClipboardData({
        data: inv.invoice_number,
        success: function () {
          wx.showToast({ title: '已复制发票号码', icon: 'success' });
        },
      });
    }
  },

  // 复制校验码
  copyCheckCode: function () {
    var inv = this.data.invoice;
    if (inv && inv.check_code) {
      wx.setClipboardData({
        data: inv.check_code,
        success: function () {
          wx.showToast({ title: '已复制校验码', icon: 'success' });
        },
      });
    }
  },

  // 返回
  goBack: function () {
    wx.navigateBack();
  },
});
