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
      // ★ V5.5.2 Hotfix: invoiceId 可能是字符串（如 inv_003），不强制 parseInt
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
          // 格式化明细条目
          var invoice = res.data;
          if (invoice.items && invoice.items.length > 0) {
            invoice.hasItems = true;
          } else {
            invoice.hasItems = false;
          }
          // ★ V5.5.2 Hotfix: 价税合计 fallback
          if ((!invoice.total_amount || invoice.total_amount === 0) && invoice.pre_tax_amount && invoice.tax_amount) {
            invoice.total_amount = parseFloat(invoice.pre_tax_amount) + parseFloat(invoice.tax_amount);
            console.log('[invoice-detail] 价税合计 fallback:', invoice.total_amount);
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

  // ★ V5.5.2 Hotfix: 图片加载失败处理
  onImageError: function (e) {
    console.error('[invoice-detail] 图片加载失败:', e.detail);
    // 图片加载失败时，尝试使用本地临时路径
    var inv = this.data.invoice;
    if (inv && inv.temp_image_path && inv.image_url !== inv.temp_image_path) {
      this.setData({ 'invoice.image_url': inv.temp_image_path });
    }
  },

  // ★ V5.5.2 Hotfix: 预览发票图片 — 增加 fallback 到本地临时路径
  previewImage: function () {
    var inv = this.data.invoice;
    if (!inv) return;
    // 优先使用服务器 URL，fallback 到本地临时路径
    var url = inv.image_url || inv.temp_image_path || inv.imageUrl;
    if (url) {
      wx.previewImage({ urls: [url], current: url });
    } else {
      wx.showToast({ title: '图片加载失败', icon: 'none' });
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

  // ── ★ V5.5.2 Hotfix: 自动核验重构 — 发票号码查重 + 自动标签 ──
  // 核验逻辑：
  //   1. 检查发票号码/代码是否已存在于发票池中（查重）
  //   2. 如果重复 → 自动打上“重复”标签
  //   3. 如果不重复 + 金额字段完整 → 自动标记“已核验”
  //   4. 如果不重复 + 金额字段缺失 → 标记“待人工复核”
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
                  msg = '⚠️ 检测到重复发票！已自动标记';
                } else if (d.verify_status === 'verified') {
                  msg = '✅ 核验通过，字段完整';
                } else if (d.verify_status === 'manual_review') {
                  msg = 'ℹ️ 关键字段缺失，已标记待人工复核';
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
