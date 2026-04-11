// ============================================
// 付款申请单 — Type A/B/C 三板斧
// Phase 5.3
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
    uploading: false,
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

  // ── 发票上传 ──
  chooseInvoice: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({ uploading: true });
        self.uploadFile(tempPath, function (url) {
          self.setData({ invoiceImage: url, uploading: false });
          self.checkCanSubmit();
        });
      },
    });
  },

  uploadFile: function (filePath, cb) {
    var self = this;
    app.request({
      url: '/api/v1/upload/token',
      success: function (res) {
        if (res.code !== 200) {
          self.setData({ uploading: false });
          wx.showToast({ title: '获取上传凭证失败', icon: 'none' });
          return;
        }
        wx.uploadFile({
          url: res.data.upload_url,
          filePath: filePath,
          name: 'file',
          formData: res.data.form_data || {},
          success: function (uploadRes) {
            try {
              var data = JSON.parse(uploadRes.data);
              cb(data.url || data.file_url || filePath);
            } catch (err) {
              cb(filePath);
            }
          },
          fail: function () {
            self.setData({ uploading: false });
            wx.showToast({ title: '上传失败', icon: 'none' });
          },
        });
      },
      fail: function () {
        self.setData({ uploading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
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
      // 每笔分期都必须有金额和日期
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
    } else if (d.paymentType === 'B') {
      payload.total_amount = parseFloat(d.totalAmount);
      payload.expected_invoice_date = d.expectedInvoiceDate;
      if (d.isToday && d.invoiceImage) {
        payload.invoice_image_url = d.invoiceImage;
      }
    } else if (d.paymentType === 'C') {
      payload.total_amount = parseFloat(d.installmentTotal);
      payload.expected_invoice_date = d.expectedInvoiceDate;
      payload.installments = d.installments.map(function (item) {
        return { amount: parseFloat(item.amount), date: item.date };
      });
      if (d.isToday && d.invoiceImage) {
        payload.invoice_image_url = d.invoiceImage;
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
