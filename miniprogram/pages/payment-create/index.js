// ============================================
// 付款申请单 V5.5.0 — 强制入池漏斗
// ★ Type A/B(当日)/C(当日) 发票自动走 OCR → 强制入发票/票据池
// ★ OCR 失败也 fallback 到 /invoices/upload 创建 pending 记录
// ★ 提交时强制携带 invoice_id
// ============================================
var app = getApp();

Page({
  data: {
    paymentType: '',       // A / B / C
    supplierName: '',
    purpose: '',
    totalAmount: '',
    expectedInvoiceDate: '',
    isToday: false,
    invoiceImage: '',
    invoiceId: null,       // ★ V5.5.0 新增：强制关联发票池 ID
    uploading: false,
    ocrLoading: false,
    ocrResult: null,
    submitting: false,
    notes: '',
    canSubmit: false,

    // Type C 分期
    installments: [{ amount: '', date: '' }],
    installmentTotal: '0.00',
  },

  selectType: function (e) {
    var type = e.currentTarget.dataset.type;
    this.setData({
      paymentType: type,
      totalAmount: '',
      expectedInvoiceDate: '',
      isToday: false,
      invoiceImage: '',
      invoiceId: null,
      ocrResult: null,
      ocrLoading: false,
      installments: [{ amount: '', date: '' }],
      installmentTotal: '0.00',
    });
    this.checkCanSubmit();
  },

  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var obj = {};
    obj[field] = e.detail.value;
    this.setData(obj);
    this.checkCanSubmit();
  },

  onDateChange: function (e) {
    var field = e.currentTarget.dataset.field;
    var val = e.detail.value;
    var today = this.getTodayStr();
    var obj = {};
    obj[field] = val;
    obj.isToday = (val === today);
    this.setData(obj);
    this.checkCanSubmit();
  },

  getTodayStr: function () {
    var d = new Date();
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  },

  // ── Type C 分期操作 ──
  addInstallment: function () {
    var list = this.data.installments.concat([{ amount: '', date: '' }]);
    this.setData({ installments: list });
  },

  removeInstallment: function (e) {
    var idx = e.currentTarget.dataset.index;
    var list = this.data.installments.filter(function (_, i) { return i !== idx; });
    this.setData({ installments: list });
    this.calcInstallmentTotal();
    this.checkCanSubmit();
  },

  onInstallmentInput: function (e) {
    var idx = e.currentTarget.dataset.index;
    var field = e.currentTarget.dataset.field;
    var key = 'installments[' + idx + '].' + field;
    var obj = {};
    obj[key] = e.detail.value;
    this.setData(obj);
    this.calcInstallmentTotal();
    this.checkCanSubmit();
  },

  onInstallmentDateChange: function (e) {
    var idx = e.currentTarget.dataset.index;
    var key = 'installments[' + idx + '].date';
    var obj = {};
    obj[key] = e.detail.value;
    this.setData(obj);
    this.checkCanSubmit();
  },

  calcInstallmentTotal: function () {
    var total = 0;
    for (var i = 0; i < this.data.installments.length; i++) {
      var amt = parseFloat(this.data.installments[i].amount);
      if (!isNaN(amt)) total += amt;
    }
    this.setData({ installmentTotal: total.toFixed(2) });
  },

  // ── 发票上传（统一走 OCR 链路） ──
  chooseInvoice: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({ uploading: true, ocrResult: null, invoiceId: null });
        self.uploadAndOCR(tempPath);
      },
    });
  },

  // ★ 统一上传 + OCR 链路：上传图片 → 调用 OCR → 结果入发票/票据池
  uploadAndOCR: function (tempPath) {
    var self = this;
    var baseUrl = app.globalData.baseUrl || '';

    // Mock 模式 — ★ 也返回 invoiceId，模拟强制入池
    if (app.globalData.useMock) {
      var mockInvoiceId = 'inv_mock_' + Date.now();
      self.setData({
        uploading: false,
        invoiceImage: tempPath,
        invoiceId: mockInvoiceId,
        ocrResult: {
          seller_name: '（Mock）供应商',
          total_amount: self.data.totalAmount || '0.00',
          invoice_number: 'MOCK' + Date.now(),
        },
      });
      self.checkCanSubmit();
      wx.showToast({ title: '已入发票池', icon: 'success' });
      return;
    }

    // 真实模式：上传图片
    wx.uploadFile({
      url: baseUrl + '/api/v1/upload/image',
      filePath: tempPath,
      name: 'file',
      formData: { category: 'invoice' },
      header: {
        'Authorization': 'Bearer ' + (app.globalData.token || ''),
      },
      success: function (uploadRes) {
        self.setData({ uploading: false });
        try {
          var data = JSON.parse(uploadRes.data);
          if (data.code === 200 && data.data && data.data.url) {
            var imageUrl = data.data.url;
            self.setData({ invoiceImage: imageUrl });
            self.checkCanSubmit();
            // ★ 自动调用 OCR 识别 → 结果进发票/票据池
            self.runOCR(imageUrl);
          } else {
            // 上传失败但不阻塞流程，使用本地路径
            self.setData({ invoiceImage: tempPath });
            self.checkCanSubmit();
            wx.showToast({ title: data.message || '上传失败，使用本地图片', icon: 'none' });
          }
        } catch (e) {
          self.setData({ invoiceImage: tempPath });
          self.checkCanSubmit();
        }
      },
      fail: function () {
        self.setData({ uploading: false, invoiceImage: tempPath });
        self.checkCanSubmit();
        wx.showToast({ title: '上传失败，使用本地图片', icon: 'none' });
      },
    });
  },

  // ★ 调用后端 OCR 识别 → 自动入发票/票据池
  // ★ V5.5.0: OCR 失败时 fallback 到 /invoices/upload 强制入池
  runOCR: function (imageUrl) {
    var self = this;
    self.setData({ ocrLoading: true });

    app.request({
      url: '/api/v1/invoices/ocr',
      method: 'POST',
      data: { image_url: imageUrl, source: 'payment_create' },
      success: function (res) {
        self.setData({ ocrLoading: false });
        if (res.code === 200 && res.data) {
          if (res.data.ocr_available && res.data.parsed) {
            self.setData({ ocrResult: res.data.parsed });
            // ★ OCR 成功 → 拿到 invoice_id
            if (res.data.invoice_id) {
              self.setData({ invoiceId: res.data.invoice_id });
            }
            wx.showToast({ title: 'OCR 识别成功，已入池', icon: 'success' });
          } else {
            // ★ OCR 不可用 → fallback 强制入池
            self.fallbackUploadToPool(imageUrl);
          }
        } else {
          self.fallbackUploadToPool(imageUrl);
        }
      },
      fail: function () {
        self.setData({ ocrLoading: false });
        self.fallbackUploadToPool(imageUrl);
      },
    });
  },

  // ★ V5.5.0 新增：OCR 失败时 fallback 强制入池
  fallbackUploadToPool: function (imageUrl) {
    var self = this;
    console.log('[payment-create] OCR 失败，fallback 入池:', imageUrl);

    app.request({
      url: '/api/v1/invoices/upload',
      method: 'POST',
      data: {
        image_url: imageUrl,
        source: 'payment_create',
      },
      success: function (res) {
        if (res.code === 200 && res.data && res.data.id) {
          self.setData({ invoiceId: res.data.id });
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

  // ── 提交校验 ──
  checkCanSubmit: function () {
    var d = this.data;
    var ok = false;

    if (!d.paymentType || !d.supplierName || !d.purpose) {
      this.setData({ canSubmit: false });
      return;
    }

    if (d.paymentType === 'A') {
      ok = parseFloat(d.totalAmount) > 0 && !!d.invoiceImage;
    } else if (d.paymentType === 'B') {
      ok = parseFloat(d.totalAmount) > 0 && !!d.expectedInvoiceDate;
      if (d.isToday) ok = ok && !!d.invoiceImage;
    } else if (d.paymentType === 'C') {
      ok = !!d.expectedInvoiceDate;
      var allFilled = true;
      for (var i = 0; i < d.installments.length; i++) {
        if (!d.installments[i].amount || !d.installments[i].date) {
          allFilled = false;
          break;
        }
      }
      ok = ok && allFilled && d.installments.length > 0;
      if (d.isToday) ok = ok && !!d.invoiceImage;
    }

    this.setData({ canSubmit: ok });
  },

  // ── 提交 ──
  // ★ V5.5.0: 强制携带 invoice_id
  submitPayment: function () {
    if (!this.data.canSubmit || this.data.submitting) return;
    this.setData({ submitting: true });

    var d = this.data;
    var payload = {
      payment_type: d.paymentType,
      supplier_name: d.supplierName,
      purpose: d.purpose,
      notes: d.notes || '',
    };

    if (d.paymentType === 'A') {
      payload.total_amount = parseFloat(d.totalAmount);
      payload.invoice_image_url = d.invoiceImage;
      // ★ 强制携带 invoice_id
      if (d.invoiceId) {
        payload.invoice_id = d.invoiceId;
      }
      if (d.ocrResult) {
        payload.ocr_data = d.ocrResult;
      }
    } else if (d.paymentType === 'B') {
      payload.total_amount = parseFloat(d.totalAmount);
      payload.expected_invoice_date = d.expectedInvoiceDate;
      if (d.isToday && d.invoiceImage) {
        payload.invoice_image_url = d.invoiceImage;
        // ★ 强制携带 invoice_id
        if (d.invoiceId) {
          payload.invoice_id = d.invoiceId;
        }
        if (d.ocrResult) payload.ocr_data = d.ocrResult;
      }
    } else if (d.paymentType === 'C') {
      payload.total_amount = parseFloat(d.installmentTotal);
      payload.expected_invoice_date = d.expectedInvoiceDate;
      payload.installments = d.installments.map(function (item) {
        return { amount: parseFloat(item.amount), date: item.date };
      });
      if (d.isToday && d.invoiceImage) {
        payload.invoice_image_url = d.invoiceImage;
        // ★ 强制携带 invoice_id
        if (d.invoiceId) {
          payload.invoice_id = d.invoiceId;
        }
        if (d.ocrResult) payload.ocr_data = d.ocrResult;
      }
    }

    var self = this;
    app.request({
      url: '/api/v1/payments/',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200 || res.code === 201) {
          wx.showToast({ title: '提交成功', icon: 'success' });
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
