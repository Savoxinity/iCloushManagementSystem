// ============================================
// 发票上传页 — OCR识别 + 上传
// ★ 上传图片后自动调用后端 OCR 识别接口
// ★ 识别结果可编辑确认后提交
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    imageUrl: '',        // 发票图片URL（上传后）
    tempPath: '',        // 本地临时路径
    uploading: false,
    ocrLoading: false,   // OCR 识别中
    ocrResult: null,     // OCR识别结果（结构化）
    ocrAvailable: false, // OCR 是否可用
    ocrFields: [
      { key: 'invoice_type', label: '发票类型', value: '' },
      { key: 'invoice_code', label: '发票代码', value: '' },
      { key: 'invoice_number', label: '发票号码', value: '' },
      { key: 'invoice_date', label: '开票日期', value: '' },
      { key: 'total_amount', label: '价税合计', value: '' },
      { key: 'pre_tax_amount', label: '不含税金额', value: '' },
      { key: 'tax_amount', label: '税额', value: '' },
      { key: 'seller_name', label: '销方名称', value: '' },
      { key: 'buyer_name', label: '购方名称', value: '' },
      { key: 'check_code', label: '校验码', value: '' },
    ],
    submitDisabled: true,
    submitting: false,
  },

  onLoad: function () {
    wx.setNavigationBarTitle({ title: '发票上传' });
  },

  // ── 选择/拍照发票 ──
  chooseInvoice: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        self.setData({
          tempPath: tempPath,
          imageUrl: '',
          ocrResult: null,
          ocrAvailable: false,
        });
        // 重置 OCR 字段
        var fields = self.data.ocrFields.map(function (f) {
          return Object.assign({}, f, { value: '' });
        });
        self.setData({ ocrFields: fields });
        self.uploadImage(tempPath);
      },
    });
  },

  // ── 上传图片到后端 ──
  uploadImage: function (tempPath) {
    var self = this;
    self.setData({ uploading: true });
    var baseUrl = app.globalData.baseUrl || '';

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
            self.setData({
              imageUrl: data.data.url,
              submitDisabled: false,
            });
            wx.showToast({ title: '图片上传成功', icon: 'success' });
            // ★ 自动调用后端 OCR 识别
            self.runOCR(data.data.url);
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '解析响应失败', icon: 'none' });
        }
      },
      fail: function (err) {
        self.setData({ uploading: false });
        console.error('[发票上传] 失败:', err);
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      },
    });
  },

  // ── 调用后端 OCR 识别接口 ──
  runOCR: function (imageUrl) {
    var self = this;
    self.setData({ ocrLoading: true });

    app.request({
      url: '/api/v1/invoices/ocr',
      method: 'POST',
      data: { image_url: imageUrl },
      success: function (res) {
        self.setData({ ocrLoading: false });
        if (res.code === 200 && res.data) {
          if (res.data.ocr_available) {
            // OCR 识别成功 → 填充字段
            var parsed = res.data.parsed || {};
            self.setData({ ocrResult: parsed, ocrAvailable: true });

            // 更新 ocrFields 的 value
            var fields = self.data.ocrFields.map(function (f) {
              var val = parsed[f.key];
              return Object.assign({}, f, {
                value: val !== null && val !== undefined ? String(val) : '',
              });
            });
            self.setData({ ocrFields: fields });

            wx.showToast({ title: 'OCR 识别成功', icon: 'success' });
          } else {
            // OCR 不可用（密钥未配置等）
            self.setData({ ocrAvailable: false });
            wx.showToast({
              title: res.data.error || 'OCR 不可用，请手动填写',
              icon: 'none',
              duration: 3000,
            });
          }
        }
      },
      fail: function () {
        self.setData({ ocrLoading: false });
        wx.showToast({ title: 'OCR 请求失败，请手动填写', icon: 'none' });
      },
    });
  },

  // ── 预览图片 ──
  previewImage: function () {
    var url = this.data.imageUrl || this.data.tempPath;
    if (url) {
      wx.previewImage({ urls: [url], current: url });
    }
  },

  // ── 编辑 OCR 字段 ──
  onFieldInput: function (e) {
    var idx = e.currentTarget.dataset.idx;
    var value = e.detail.value;
    var key = 'ocrFields[' + idx + '].value';
    this.setData({ [key]: value });
  },

  // ── 提交发票 ──
  submitInvoice: function () {
    var self = this;
    if (self.data.submitting || !self.data.imageUrl) return;
    self.setData({ submitting: true });

    // 从 ocrFields 收集数据
    var fieldData = {};
    self.data.ocrFields.forEach(function (f) {
      if (f.value) {
        fieldData[f.key] = f.value;
      }
    });

    var payload = {
      image_url: self.data.imageUrl,
      invoice_type: fieldData.invoice_type || null,
      invoice_code: fieldData.invoice_code || null,
      invoice_number: fieldData.invoice_number || null,
      invoice_date: fieldData.invoice_date || null,
      total_amount: fieldData.total_amount ? parseFloat(fieldData.total_amount) : null,
      pre_tax_amount: fieldData.pre_tax_amount ? parseFloat(fieldData.pre_tax_amount) : null,
      tax_amount: fieldData.tax_amount ? parseFloat(fieldData.tax_amount) : null,
      seller_name: fieldData.seller_name || null,
      buyer_name: fieldData.buyer_name || null,
      check_code: fieldData.check_code || null,
    };

    app.request({
      url: '/api/v1/invoices/upload',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          var msg = '发票上传成功';
          if (res.data && res.data.auto_resolved && res.data.auto_resolved.length > 0) {
            msg += '，自动核销 ' + res.data.auto_resolved.length + ' 条欠票';
          }
          wx.showToast({ title: msg, icon: 'success', duration: 2000 });
          setTimeout(function () { wx.navigateBack(); }, 1500);
        } else {
          wx.showToast({ title: res.message || '提交失败', icon: 'none' });
        }
      },
    });
  },
});
