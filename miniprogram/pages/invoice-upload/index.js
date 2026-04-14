// ============================================
// 发票上传页 V5.6.6 — 云端上传链路重构
// ★ 彻底废弃 wx.uploadFile，统一走 Base64 + app.request
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
      { key: 'invoice_type_label', label: '发票类型', value: '' },
      { key: 'invoice_code', label: '发票代码', value: '' },
      { key: 'invoice_number', label: '发票号码', value: '' },
      { key: 'invoice_date', label: '开票日期', value: '' },
      { key: 'total_amount', label: '价税合计（小写）', value: '' },
      { key: 'pre_tax_amount', label: '合计金额（不含税）', value: '' },
      { key: 'tax_amount', label: '合计税额', value: '' },
      { key: 'check_code', label: '校验码', value: '' },
      { key: 'buyer_name', label: '购买方名称', value: '' },
      { key: 'buyer_tax_id', label: '购买方纳税人识别号', value: '' },
      { key: 'seller_name', label: '销售方名称', value: '' },
      { key: 'seller_tax_id', label: '销售方纳税人识别号', value: '' },
      { key: 'buyer_address_phone', label: '购买方地址、电话', value: '' },
      { key: 'buyer_bank_account', label: '购买方开户行及账号', value: '' },
      { key: 'seller_address_phone', label: '销售方地址、电话', value: '' },
      { key: 'seller_bank_account', label: '销售方开户行及账号', value: '' },
      { key: 'goods_name_summary', label: '货物/服务名称', value: '' },
      { key: 'drawer', label: '开票人', value: '' },
      { key: 'payee', label: '收款人', value: '' },
      { key: 'reviewer', label: '复核人', value: '' },
      { key: 'remark', label: '备注', value: '' },
      { key: 'machine_number', label: '机器编号', value: '' },
      { key: 'check_code_last6', label: '校验码后6位', value: '' },
    ],
    // 明细条目
    ocrItems: [],
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
          ocrItems: [],
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

  // ── V5.6.6 重构：上传图片到后端（Base64 + app.request） ──
  uploadImage: function (tempPath) {
    var self = this;
    self.setData({ uploading: true });

    // ★ V5.6.9: 异步读取图片为 Base64（兼容云沙箱环境）
    var fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: tempPath,
      success: function (readRes) {
        var base64Data;
        try {
          base64Data = wx.arrayBufferToBase64(readRes.data);
        } catch (e) {
          self.setData({ uploading: false });
          wx.showToast({ title: 'Base64转码失败', icon: 'none' });
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
            if (res.code === 200 && res.data && res.data.url) {
              self.setData({
                imageUrl: res.data.url,
                submitDisabled: false,
              });
              wx.showToast({ title: '图片上传成功', icon: 'success' });
              // ★ 自动调用后端 OCR 识别
              self.runOCR(res.data.url);
            } else {
              wx.showToast({ title: res.message || '上传失败', icon: 'none' });
            }
          },
          fail: function (err) {
            self.setData({ uploading: false });
            console.error('[发票上传] Base64上传失败:', err);
            wx.showToast({ title: '上传失败，请重试', icon: 'none' });
          },
        });
      },
      fail: function (readErr) {
        console.error('[发票上传] 异步读取文件失败:', readErr);
        self.setData({ uploading: false });
        wx.showToast({ title: '图片读取失败，请重试', icon: 'none' });
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
      data: { image_url: imageUrl, source: 'invoice_upload' },
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

            // ★ V5.5.2 Hotfix: 价税合计 fallback
            // 如果 OCR 未识别出 total_amount，则自动计算 = pre_tax_amount + tax_amount
            var totalAmt = parsed.total_amount;
            var preTax = parsed.pre_tax_amount;
            var taxAmt = parsed.tax_amount;
            if ((!totalAmt || totalAmt === '' || totalAmt === 'null') && preTax && taxAmt) {
              var computed = (parseFloat(preTax) + parseFloat(taxAmt)).toFixed(2);
              parsed.total_amount = computed;
              console.log('[OCR Fallback] 价税合计自动计算:', preTax, '+', taxAmt, '=', computed);
              // 同步更新 fields 中的 total_amount
              fields = fields.map(function (f) {
                if (f.key === 'total_amount') {
                  return Object.assign({}, f, { value: computed });
                }
                return f;
              });
            }
            self.setData({ ocrFields: fields });

            // 保存明细条目
            var items = res.data.items || [];
            self.setData({ ocrItems: items });

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

    // 发票类型需要传内部代码，从OCR结果中获取
    var invoiceType = null;
    if (self.data.ocrResult && self.data.ocrResult.invoice_type) {
      invoiceType = self.data.ocrResult.invoice_type;
    }

    var payload = {
      image_url: self.data.imageUrl,
      invoice_type: invoiceType,
      invoice_code: fieldData.invoice_code || null,
      invoice_number: fieldData.invoice_number || null,
      invoice_date: fieldData.invoice_date || null,
      total_amount: fieldData.total_amount ? parseFloat(fieldData.total_amount) : null,
      pre_tax_amount: fieldData.pre_tax_amount ? parseFloat(fieldData.pre_tax_amount) : null,
      tax_amount: fieldData.tax_amount ? parseFloat(fieldData.tax_amount) : null,
      seller_name: fieldData.seller_name || null,
      seller_tax_id: fieldData.seller_tax_id || null,
      buyer_name: fieldData.buyer_name || null,
      buyer_tax_id: fieldData.buyer_tax_id || null,
      check_code: fieldData.check_code || null,
      remark: fieldData.remark || null,
    };

    app.request({
      url: '/api/v1/invoices/upload',
      method: 'POST',
      data: payload,
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          var msg = '发票上传成功';
          if (res.data && res.data.is_duplicate) {
            msg = '发票上传成功（检测到重复发票）';
          }
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
