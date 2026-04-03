// ============================================
// 发票上传页 — OCR识别 + 上传
// 使用 app.request + wx.uploadFile
// ============================================
var app = getApp();
var util = require('../../utils/util');

Page({
  data: {
    imageUrl: '',        // 发票图片URL（上传后）
    tempPath: '',        // 本地临时路径
    uploading: false,
    ocrResult: null,     // OCR识别结果
    ocrFields: [],       // 展示用字段列表
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
        self.setData({ tempPath: tempPath, imageUrl: '', ocrResult: null, ocrFields: [] });
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
            // 这里可以调用 OCR 接口识别发票
            // self.runOCR(data.data.url);
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

  // ── 预览图片 ──
  previewImage: function () {
    var url = this.data.imageUrl || this.data.tempPath;
    if (url) {
      wx.previewImage({ urls: [url], current: url });
    }
  },

  // ── 手动填写OCR字段 ──
  onFieldInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var value = e.detail.value;
    var ocrResult = this.data.ocrResult || {};
    ocrResult[field] = value;
    this.setData({ ocrResult: ocrResult });
  },

  // ── 提交发票 ──
  submitInvoice: function () {
    var self = this;
    if (self.data.submitting || !self.data.imageUrl) return;
    self.setData({ submitting: true });

    var ocr = self.data.ocrResult || {};
    var payload = {
      image_url: self.data.imageUrl,
      invoice_type: ocr.invoice_type || null,
      invoice_code: ocr.invoice_code || null,
      invoice_number: ocr.invoice_number || null,
      invoice_date: ocr.invoice_date || null,
      total_amount: ocr.total_amount ? parseFloat(ocr.total_amount) : null,
      seller_name: ocr.seller_name || null,
      buyer_name: ocr.buyer_name || null,
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
