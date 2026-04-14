// ============================================
// 报销单创建页 V5.5.0 — 强制入池漏斗
// ★ 发票凭证上传后自动走 OCR → 强制入发票/票据池
// ★ OCR 失败也调用 /invoices/upload 创建 pending 记录
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
        self.setData({ tempInvoicePath: tempPath, ocrResult: null, invoiceId: null });
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

    // Mock 模式 — ★ 也返回 invoiceId，模拟强制入池
    if (app.globalData.useMock) {
      var mockInvoiceId = 'inv_mock_' + Date.now();
      self.setData({
        uploading: false,
        invoiceImage: tempPath,
        invoiceId: mockInvoiceId,
        ocrResult: { seller_name: '（Mock）供应商', total_amount: self.data.claimedAmount || '0' },
      });
      self._checkCanSubmit();
      wx.showToast({ title: '已入发票池', icon: 'success' });
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
  // ★ V5.6.4: OCR → 强制入池（两步走：先识别，再入库拿 invoice_id）
  _runOCR: function (imageUrl) {
    var self = this;
    self.setData({ ocrLoading: true });

    app.request({
      url: '/api/v1/invoices/ocr',
      method: 'POST',
      data: { image_url: imageUrl, source: 'expense_create' },
      success: function (res) {
        if (res.code === 200 && res.data && res.data.ocr_available && res.data.parsed) {
          var parsed = res.data.parsed;
          // ★ V5.5.2 Hotfix: 价税合计 fallback
          var totalAmt = parsed.total_amount;
          var preTax = parsed.pre_tax_amount;
          var taxAmt = parsed.tax_amount;
          if ((!totalAmt || totalAmt === '' || totalAmt === 'null') && preTax && taxAmt) {
            parsed.total_amount = (parseFloat(preTax) + parseFloat(taxAmt)).toFixed(2);
            console.log('[expense-create OCR Fallback] 价税合计:', parsed.total_amount);
          }
          self.setData({ ocrResult: parsed });
          // ★ V5.6.4 关键修复：OCR 成功后，必须调用 /upload 入池拿 invoice_id
          // 因为 /ocr 接口是纯识别，不入库，不返回 invoice_id
          self._uploadToPoolWithOCR(imageUrl, parsed, res.data.items || []);
        } else {
          // OCR 不可用 → fallback 强制入池（无 OCR 数据）
          self.setData({ ocrLoading: false });
          self._fallbackUploadToPool(imageUrl);
        }
      },
      fail: function () {
        self.setData({ ocrLoading: false });
        self._fallbackUploadToPool(imageUrl);
      },
    });
  },

  // ★ V5.6.4 新增：OCR 成功后，携带 OCR 数据调用 /upload 入池
  _uploadToPoolWithOCR: function (imageUrl, parsed, items) {
    var self = this;
    console.log('[expense-create] OCR 成功，携带数据入池:', imageUrl);

    app.request({
      url: '/api/v1/invoices/upload',
      method: 'POST',
      data: {
        image_url: imageUrl,
        invoice_type: parsed.invoice_type || '',
        invoice_code: parsed.invoice_code || '',
        invoice_number: parsed.invoice_number || '',
        invoice_date: parsed.invoice_date || '',
        check_code: parsed.check_code || '',
        buyer_name: parsed.buyer_name || '',
        buyer_tax_id: parsed.buyer_tax_id || '',
        seller_name: parsed.seller_name || '',
        seller_tax_id: parsed.seller_tax_id || '',
        pre_tax_amount: parsed.pre_tax_amount ? parseFloat(parsed.pre_tax_amount) : null,
        tax_amount: parsed.tax_amount ? parseFloat(parsed.tax_amount) : null,
        total_amount: parsed.total_amount ? parseFloat(parsed.total_amount) : null,
        remark: parsed.remark || '',
        ocr_raw_json: parsed,
        business_type: 'expense',
      },
      success: function (res) {
        self.setData({ ocrLoading: false });
        if (res.code === 200 && res.data && res.data.id) {
          self.setData({ invoiceId: res.data.id });
          console.log('[expense-create] ★ invoice_id 已获取:', res.data.id);
          wx.showToast({ title: 'OCR 识别成功，已入池', icon: 'success' });
        } else {
          wx.showToast({ title: 'OCR 成功但入池失败', icon: 'none', duration: 2000 });
        }
      },
      fail: function () {
        self.setData({ ocrLoading: false });
        wx.showToast({ title: 'OCR 成功但入池失败', icon: 'none', duration: 2000 });
      },
    });
  },

  // ★ V5.5.0: OCR 失败时 fallback 强制入池（无 OCR 数据）
  _fallbackUploadToPool: function (imageUrl) {
    var self = this;
    console.log('[expense-create] OCR 失败，fallback 入池:', imageUrl);

    app.request({
      url: '/api/v1/invoices/upload',
      method: 'POST',
      data: {
        image_url: imageUrl,
        business_type: 'expense',
      },
      success: function (res) {
        if (res.code === 200 && res.data && res.data.id) {
          self.setData({ invoiceId: res.data.id });
          console.log('[expense-create] ★ fallback invoice_id:', res.data.id);
          wx.showToast({ title: '已入发票池（待人工核验）', icon: 'none', duration: 2000 });
        } else {
          wx.showToast({ title: 'OCR 不可用，请手动确认', icon: 'none', duration: 2000 });
        }
      },
      fail: function () {
        wx.showToast({ title: 'OCR 不可用，请手动确认', icon: 'none', duration: 2000 });
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
  // ★ V5.5.0: 强制携带 invoice_id；无 invoice_id 时也传 image_url 兜底
  submitExpense: function () {
    var self = this;
    if (!self.data.canSubmit || self.data.submitting) return;
    self.setData({ submitting: true });

    var payload = {
      purpose: self.data.purpose,
      claimed_amount: parseFloat(self.data.claimedAmount),
      voucher_type: self.data.voucherType,
    };

    if (self.data.voucherType === 'invoice') {
      // ★ 强制携带 invoice_id（OCR 成功或 fallback 入池后都有）
      if (self.data.invoiceId) {
        payload.invoice_id = self.data.invoiceId;
      }
      // 兜底：始终传 image_url
      if (self.data.invoiceImage) {
        payload.invoice_image_url = self.data.invoiceImage;
      }
    }
    if (self.data.voucherType === 'receipt' && self.data.receiptImage) {
      payload.receipt_image_url = self.data.receiptImage;
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
      fail: function () {
        self.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
