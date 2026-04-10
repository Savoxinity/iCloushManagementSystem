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
    verifying: false,  // 核验中
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

  // ── 自动核验（调用腾讯云核验API） ──
  onAutoVerify: function () {
    var self = this;
    var inv = self.data.invoice;
    if (!inv || self.data.verifying) return;

    if (!inv.invoice_code && !inv.invoice_number) {
      wx.showToast({ title: '缺少发票代码或号码，无法自动核验', icon: 'none', duration: 2500 });
      return;
    }

    wx.showModal({
      title: '自动核验',
      content: '将调用国税局接口核验发票真伪，确认继续？',
      success: function (res) {
        if (res.confirm) {
          self.setData({ verifying: true });
          app.request({
            url: '/api/v1/invoices/' + inv.id + '/verify',
            method: 'POST',
            data: { auto_verify: true },
            success: function (res) {
              self.setData({ verifying: false });
              if (res.code === 200) {
                wx.showToast({
                  title: res.message || '核验完成',
                  icon: res.data && res.data.verify_status === 'verified' ? 'success' : 'none',
                  duration: 2000,
                });
                // 刷新详情
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

  // ── 手动标记核验通过 ──
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
