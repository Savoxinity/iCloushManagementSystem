// ============================================
// 报销单创建页 — Phase 3B 极简三项
// 员工只需填写：事由、金额、凭证
// ★ 无成本分类选择器（成本分类由管理员审核时填写）
// ============================================

console.log('=== expense-create loaded ===');
var app = getApp();

Page({
  data: {
    purpose: '',
    claimedAmount: '',
    voucherType: 'invoice',  // invoice / receipt
    invoiceImage: '',        // 发票图片URL（上传后）
    receiptImage: '',        // 收据图片URL（上传后）
    tempInvoicePath: '',     // 本地临时路径
    tempReceiptPath: '',
    invoiceId: null,
    pointsHint: '+10 合规奖励',
    canSubmit: false,
    submitting: false,
    uploading: false,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '创建报销单' });
  },

  // ── 事由输入 ──
  onPurposeInput: function (e) {
    this.setData({ purpose: e.detail.value });
    this._checkCanSubmit();
  },

  // ── 金额输入 ──
  onAmountInput: function (e) {
    this.setData({ claimedAmount: e.detail.value });
    this._checkCanSubmit();
  },

  // ── 凭证类型切换 ──
  selectVoucherType: function (e) {
    var type = e.currentTarget.dataset.type;
    this.setData({
      voucherType: type,
      pointsHint: type === 'invoice' ? '+10 合规奖励' : '-5 无票扣减',
    });
    this._checkCanSubmit();
  },

  // ── 拍照/选择发票 ──
  chooseInvoice: function () {
    var self = this;
    if (self.data.uploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({ tempInvoicePath: tempPath });
        self._uploadImage(tempPath, 'invoice', function (url) {
          self.setData({ invoiceImage: url });
          self._checkCanSubmit();
        });
      },
    });
  },

  // ── 拍照/选择收据 ──
  chooseReceipt: function () {
    var self = this;
    if (self.data.uploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({ tempReceiptPath: tempPath });
        self._uploadImage(tempPath, 'receipt', function (url) {
          self.setData({ receiptImage: url });
          self._checkCanSubmit();
        });
      },
    });
  },

  // ── 通用图片上传 ──
  _uploadImage: function (tempPath, category, callback) {
    var self = this;
    self.setData({ uploading: true });
    var baseUrl = app.globalData.baseUrl || '';

    wx.uploadFile({
      url: baseUrl + '/api/v1/upload/image',
      filePath: tempPath,
      name: 'file',
      formData: { category: category },
      header: {
        'Authorization': 'Bearer ' + (app.globalData.token || ''),
      },
      success: function (uploadRes) {
        self.setData({ uploading: false });
        try {
          var data = JSON.parse(uploadRes.data);
          if (data.code === 200 && data.data && data.data.url) {
            callback(data.data.url);
          } else {
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ uploading: false });
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      },
    });
  },

  // ── 预览图片 ──
  previewInvoice: function () {
    var url = this.data.invoiceImage || this.data.tempInvoicePath;
    if (url) wx.previewImage({ urls: [url] });
  },
  previewReceipt: function () {
    var url = this.data.receiptImage || this.data.tempReceiptPath;
    if (url) wx.previewImage({ urls: [url] });
  },

  // ── 校验是否可提交 ──
  _checkCanSubmit: function () {
    var d = this.data;
    var hasAmount = d.claimedAmount && parseFloat(d.claimedAmount) > 0;
    var hasVoucher = d.voucherType === 'invoice' ? !!d.invoiceImage : !!d.receiptImage;
    this.setData({ canSubmit: !!d.purpose && hasAmount && hasVoucher });
  },

  // ── 提交报销单 ──
  submitExpense: function () {
    var self = this;
    if (!self.data.canSubmit || self.data.submitting) return;
    self.setData({ submitting: true });

    var payload = {
      purpose: self.data.purpose,
      claimed_amount: parseFloat(self.data.claimedAmount),
      voucher_type: self.data.voucherType,
    };

    if (self.data.voucherType === 'invoice' && self.data.invoiceId) {
      payload.invoice_id = self.data.invoiceId;
    }
    if (self.data.voucherType === 'receipt' && self.data.receiptImage) {
      payload.receipt_image_url = self.data.receiptImage;
    }
    // 发票报销也传图片URL（无论是否有 invoice_id）
    if (self.data.voucherType === 'invoice' && self.data.invoiceImage && !self.data.invoiceId) {
      payload.receipt_image_url = self.data.invoiceImage;
    }

    app.request({
      url: '/api/v1/expenses/create',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: '报销单已提交', icon: 'success', duration: 2000 });
          setTimeout(function () { wx.navigateBack(); }, 1500);
        } else {
          wx.showToast({ title: res.message || '提交失败', icon: 'none' });
        }
      },
    });
  },
});
