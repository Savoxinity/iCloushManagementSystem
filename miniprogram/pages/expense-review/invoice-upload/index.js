// ============================================
// 审核页补传发票 V5.6.6 — 云端上传链路重构
// ★ 彻底废弃 wx.uploadFile，统一走 Base64 + app.request
// ★ 增强错误处理和日志
// ============================================
var app = getApp();

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
        self.setData({ tempPath: tempPath, imageUrl: '', ocrResult: null, ocrFields: [], submitDisabled: true });
        self.uploadImage(tempPath);
      },
    });
  },

  // ── V5.6.6 重构：上传图片到后端（Base64 + app.request） ──
  uploadImage: function (tempPath) {
    var self = this;
    self.setData({ uploading: true });

    // ★ V5.6.6: 读取图片为 Base64，通过 app.request (JSON) 上传
    var fs = wx.getFileSystemManager();
    try {
      var fileData = fs.readFileSync(tempPath);
      var base64Data = wx.arrayBufferToBase64(fileData);
    } catch (e) {
      self.setData({ uploading: false });
      console.error('[审核补传] 图片读取失败:', e);
      wx.showToast({ title: '图片读取失败: ' + e.message, icon: 'none' });
      return;
    }

    app.request({
      url: '/api/v1/upload/image-base64',
      method: 'POST',
      data: {
        image_base64: base64Data,
        category: 'invoice',
        filename: 'invoice.jpg',
      },
      success: function (res) {
        self.setData({ uploading: false });
        console.log('[审核补传] 图片上传响应:', JSON.stringify(res));
        if (res.code === 200 && res.data && res.data.url) {
          self.setData({
            imageUrl: res.data.url,
            submitDisabled: false,
          });
          wx.showToast({ title: '图片上传成功', icon: 'success' });
        } else {
          console.error('[审核补传] 图片上传失败:', res);
          wx.showToast({ title: res.message || '上传失败', icon: 'none' });
        }
      },
      fail: function (err) {
        self.setData({ uploading: false });
        console.error('[审核补传] Base64上传失败:', err);
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
    if (self.data.submitting) return;

    if (!self.data.imageUrl) {
      wx.showToast({ title: '请先上传发票图片', icon: 'none' });
      return;
    }

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

    console.log('[审核补传] 提交payload:', JSON.stringify(payload));

    app.request({
      url: '/api/v1/invoices/upload',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        console.log('[审核补传] 提交响应:', JSON.stringify(res));
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
      fail: function (err) {
        self.setData({ submitting: false });
        console.error('[审核补传] 提交失败:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      },
    });
  },
});
