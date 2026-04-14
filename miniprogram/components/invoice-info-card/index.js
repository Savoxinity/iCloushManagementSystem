// ============================================
// 发票详情卡片组件 V5.6.7
// 归一化发票信息展示，可在任意页面/弹窗中复用
// 接收 invoiceData 属性，自动格式化并渲染
// ============================================
Component({
  properties: {
    // 发票数据对象（来自后端 /invoices/:id 或 expense 的 invoice_info）
    invoiceData: {
      type: Object,
      value: null,
    },
    // 是否显示核验操作区（仅发票详情页需要，审核弹窗不需要）
    showVerifyActions: {
      type: Boolean,
      value: false,
    },
    // 是否显示核验信息组（仅发票详情页需要）
    showVerifyInfo: {
      type: Boolean,
      value: false,
    },
    // 是否显示图片区域（发票详情页自己有图片区，弹窗也有，可选）
    showImage: {
      type: Boolean,
      value: false,
    },
    // 是否为紧凑模式（弹窗内使用时字体略小）
    compact: {
      type: Boolean,
      value: false,
    },
  },

  observers: {
    'invoiceData': function (newVal) {
      if (newVal) {
        this.formatInvoice(newVal);
      }
    },
  },

  data: {
    inv: null,  // 格式化后的发票数据
    verifying: false,
  },

  lifetimes: {
    attached: function () {
      if (this.properties.invoiceData) {
        this.formatInvoice(this.properties.invoiceData);
      }
    },
  },

  methods: {
    // ── 核心：格式化发票数据（与 invoice-detail 100% 一致的逻辑） ──
    formatInvoice: function (raw) {
      if (!raw) return;

      // 深拷贝避免污染原始数据
      var invoice = JSON.parse(JSON.stringify(raw));

      // ★ 发票类型翻译映射
      var typeMap = {
        'special_vat': '增值税专用发票',
        'general_vat': '增值税普通发票',
        'electronic_vat': '增值税电子普通发票',
        'electronic_special_vat': '增值税电子专用发票',
        'toll_electronic': '通行费电子发票',
        'motor_vehicle': '机动车销售统一发票',
        'used_vehicle': '二手车销售统一发票',
        'blockchain': '区块链电子发票',
        'quota': '定额发票',
        'general': '通用机打发票',
        'taxi': '出租车发票',
        'train': '火车票',
        'flight': '飞机行程单',
        'bus': '客运汽车票',
        'receipt': '收据/小票',
        'other': '其他票据',
      };
      invoice.invoice_type_label = typeMap[invoice.invoice_type] || invoice.invoice_type || '--';

      // ★ 发票类型角标代码
      if (!invoice.invoice_type_code) {
        if (invoice.invoice_type && invoice.invoice_type.indexOf('special') >= 0) {
          invoice.invoice_type_code = '专';
        } else {
          invoice.invoice_type_code = '普';
        }
      }

      // ★ 核验状态翻译
      var verifyMap = {
        'verified': '已核验',
        'pending': '待核验',
        'failed': '核验失败',
        'manual_review': '待人工复核',
        'duplicate': '重复发票',
      };
      invoice.verify_status_label = verifyMap[invoice.verify_status] || '待核验';

      // ★ 价税合计 fallback
      if ((!invoice.total_amount || invoice.total_amount === 0) && invoice.pre_tax_amount && invoice.tax_amount) {
        invoice.total_amount = parseFloat(invoice.pre_tax_amount) + parseFloat(invoice.tax_amount);
      }

      // ★ 兼容不同字段名（后端可能返回 amount_without_tax 或 pre_tax_amount）
      if (!invoice.pre_tax_amount && invoice.amount_without_tax) {
        invoice.pre_tax_amount = invoice.amount_without_tax;
      }
      if (!invoice.amount_without_tax && invoice.pre_tax_amount) {
        invoice.amount_without_tax = invoice.pre_tax_amount;
      }

      // ★ 商品明细处理
      if (invoice.items && invoice.items.length > 0) {
        invoice.hasItems = true;
      } else {
        invoice.hasItems = false;
      }

      // ★ 图片 URL fallback
      if (!invoice.image_url && invoice.temp_image_path) {
        invoice.image_url = invoice.temp_image_path;
      }
      if (!invoice.image_url && invoice.imageUrl) {
        invoice.image_url = invoice.imageUrl;
      }

      this.setData({ inv: invoice });
    },

    // ── 预览图片 ──
    onPreviewImage: function () {
      var inv = this.data.inv;
      if (!inv) return;
      var url = inv.image_url || inv.temp_image_path || inv.imageUrl;
      if (url) {
        wx.previewImage({ urls: [url], current: url });
      }
    },

    // ── 图片加载失败 ──
    onImageError: function () {
      var inv = this.data.inv;
      if (inv && inv.temp_image_path && inv.image_url !== inv.temp_image_path) {
        this.setData({ 'inv.image_url': inv.temp_image_path });
      }
    },

    // ── 复制发票号码 ──
    onCopyNumber: function () {
      var inv = this.data.inv;
      if (inv && inv.invoice_number) {
        wx.setClipboardData({
          data: inv.invoice_number,
          success: function () {
            wx.showToast({ title: '已复制发票号码', icon: 'success' });
          },
        });
      }
    },

    // ── 复制校验码 ──
    onCopyCheckCode: function () {
      var inv = this.data.inv;
      if (inv && inv.check_code) {
        wx.setClipboardData({
          data: inv.check_code,
          success: function () {
            wx.showToast({ title: '已复制校验码', icon: 'success' });
          },
        });
      }
    },

    // ── 自动核验（触发父页面事件） ──
    onAutoVerify: function () {
      this.triggerEvent('autoVerify', { invoice: this.data.inv });
    },

    // ── 手动标记（触发父页面事件） ──
    onManualVerify: function () {
      this.triggerEvent('manualVerify', { invoice: this.data.inv });
    },
  },
});
