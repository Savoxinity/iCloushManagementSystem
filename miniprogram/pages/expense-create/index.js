// ============================================
// 报销单创建页 V5.4.1 — 统一 OCR 链路
// ★ 发票凭证上传后自动走 OCR → 进发票/票据池
// ★ 收据图片也统一上传（但不走 OCR）
// ============================================

console.log('=== expense-create loaded ===');
var app = getApp();

Page({
  data: {
    purpose: '',
    claimedAmount: '',
    voucherType: 'invoice',  // invoice / receipt
    invoiceImage: '',
    receiptImage: '',
    tempInvoicePath: '',
    tempReceiptPath: '',
    invoiceId: null,
    ocrLoading: false,
    ocrResult: null,
    pointsHint: '积分将在审核后发放',
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
      pointsHint: '积分将在审核后发放',
    });
    this._checkCanSubmit();
  },

  // ── 拍照/选择发票（★ 走 OCR 链路） ──
  chooseInvoice: function () {
    var self = this;
    if (self.data.uploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({ tempInvoicePath: tempPath, ocrResult: null });
        self._uploadAndOCR(tempPath, 'invoice');
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

  // ★ 统一上传 + OCR 链路
  _uploadAndOCR: function (tempPath, category) {
    var self = this;
    self.setData({ uploading: true });

    // Mock 模式
    if (app.globalData.useMock) {
      self.setData({
        uploading: false,
        invoiceImage: tempPath,
        ocrResult: { seller_name: '（Mock）供应商', total_amount: self.data.claimedAmount || '0' },
      });
      self._checkCanSubmit();
      wx.showToast({ title: '图片已选择', icon: 'success' });
      return;
    }

    var baseUrl = app.globalData.baseUrl || '';
    wx.uploadFile({
      url: baseUrl + '/api/v1/upload/image',
      filePath: tempPath,
      name: 'file',
      formData: { category: category },
      header: { 'Authorization': 'Bearer ' + (app.globalData.token || '') },
      success: function (uploadRes) {
        self.setData({ uploading: false });
        try {
          var data = JSON.parse(uploadRes.data);
          if (data.code === 200 && data.data && data.data.url) {
            var imageUrl = data.data.url;
            self.setData({ invoiceImage: imageUrl });
            self._checkCanSubmit();
            // ★ 自动调用 OCR → 进发票/票据池
            self._runOCR(imageUrl);
          } else {
            self.setData({ invoiceImage: tempPath });
            self._checkCanSubmit();
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          }
        } catch (e) {
          self.setData({ invoiceImage: tempPath });
          self._checkCanSubmit();
        }
      },
      fail: function () {
        self.setData({ uploading: false, invoiceImage: tempPath });
        self._checkCanSubmit();
        wx.showToast({ title: '上传失败，使用本地图片', icon: 'none' });
      },
    });
  },

  // ★ 调用后端 OCR 识别 → 自动入发票/票据池
  _runOCR: function (imageUrl) {
    var self = this;
    self.setData({ ocrLoading: true });

    app.request({
      url: '/api/v1/invoices/ocr',
      method: 'POST',
      data: { image_url: imageUrl, source: 'expense_create' },
      success: function (res) {
        self.setData({ ocrLoading: false });
        if (res.code === 200 && res.data) {
          if (res.data.ocr_available && res.data.parsed) {
            self.setData({ ocrResult: res.data.parsed });
            // 如果 OCR 返回了发票 ID，关联
            if (res.data.invoice_id) {
              self.setData({ invoiceId: res.data.invoice_id });
            }
            wx.showToast({ title: 'OCR 识别成功', icon: 'success' });
          } else {
            wx.showToast({ title: 'OCR 不可用，请手动确认', icon: 'none', duration: 2000 });
          }
        }
      },
      fail: function () {
        self.setData({ ocrLoading: false });
      },
    });
  },

  // ── 通用图片上传（收据用） ──
  _uploadImage: function (tempPath, category, callback) {
    var self = this;
    self.setData({ uploading: true });
    var baseUrl = app.globalData.baseUrl || '';

    // Mock 模式
    if (app.globalData.useMock) {
      self.setData({ uploading: false });
      callback(tempPath);
      wx.showToast({ title: '图片已选择', icon: 'success' });
      return;
    }

    wx.uploadFile({
      url: baseUrl + '/api/v1/upload/image',
      filePath: tempPath,
      name: 'file',
      formData: { category: category },
      header: { 'Authorization': 'Bearer ' + (app.globalData.token || '') },
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
    if (self.data.voucherType === 'invoice' && self.data.invoiceImage && !self.data.invoiceId) {
      payload.receipt_image_url = self.data.invoiceImage;
    }
    // 附带 OCR 结果
    if (self.data.ocrResult) {
      payload.ocr_data = self.data.ocrResult;
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
