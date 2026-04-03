/**
 * 新增/编辑车辆 — 车辆台账全生命周期管理
 * Phase 4.1 PRD 1.2
 */
const app = getApp()

Page({
  data: {
    isEdit: false,
    vehicleId: null,
    submitting: false,

    // 表单字段
    plate_number: '',
    brand: '',
    vehicle_type: 'medium',
    load_capacity: '',
    load_unit: 'kg',
    mileage: '',
    status: 'idle',

    // 四险一金到期日
    inspection_due: '',
    compulsory_ins_due: '',
    commercial_ins_due: '',
    maintenance_due: '',

    // 选项
    typeOptions: ['小型', '中型', '大型'],
    typeValues: ['small', 'medium', 'large'],
    typeIndex: 1,

    unitOptions: ['kg', '吨', '件'],
    unitIndex: 0,

    statusOptions: ['空闲', '运送中', '维修中', '已报废'],
    statusValues: ['idle', 'delivering', 'maintenance', 'retired'],
    statusIndex: 0,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, vehicleId: parseInt(options.id) })
      wx.setNavigationBarTitle({ title: '编辑车辆' })
      this.loadVehicle(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '新增车辆' })
    }
  },

  // ── 加载车辆详情（编辑模式）──
  loadVehicle(id) {
    var self = this
    app.request({
      url: '/api/v1/vehicles/fleet/' + id,
      success(res) {
        if (res.code === 200 && res.data) {
          var v = res.data
          var typeIdx = self.data.typeValues.indexOf(v.vehicle_type || 'medium')
          var unitIdx = self.data.unitOptions.indexOf(v.load_unit || 'kg')
          var statusIdx = self.data.statusValues.indexOf(v.status || 'idle')
          self.setData({
            plate_number: v.plate_number || '',
            brand: v.brand || '',
            vehicle_type: v.vehicle_type || 'medium',
            load_capacity: v.load_capacity ? String(v.load_capacity) : '',
            load_unit: v.load_unit || 'kg',
            mileage: v.mileage ? String(v.mileage) : '',
            status: v.status || 'idle',
            inspection_due: v.inspection_due || '',
            compulsory_ins_due: v.compulsory_ins_due || '',
            commercial_ins_due: v.commercial_ins_due || '',
            maintenance_due: v.maintenance_due || '',
            typeIndex: typeIdx >= 0 ? typeIdx : 1,
            unitIndex: unitIdx >= 0 ? unitIdx : 0,
            statusIndex: statusIdx >= 0 ? statusIdx : 0,
          })
        }
      },
    })
  },

  // ── 表单输入事件 ──
  onInputPlate(e) { this.setData({ plate_number: e.detail.value }) },
  onInputBrand(e) { this.setData({ brand: e.detail.value }) },
  onInputCapacity(e) { this.setData({ load_capacity: e.detail.value }) },
  onInputMileage(e) { this.setData({ mileage: e.detail.value }) },

  onTypeChange(e) {
    var idx = parseInt(e.detail.value)
    this.setData({ typeIndex: idx, vehicle_type: this.data.typeValues[idx] })
  },

  onUnitChange(e) {
    var idx = parseInt(e.detail.value)
    this.setData({ unitIndex: idx, load_unit: this.data.unitOptions[idx] })
  },

  onStatusChange(e) {
    var idx = parseInt(e.detail.value)
    this.setData({ statusIndex: idx, status: this.data.statusValues[idx] })
  },

  onInspectionDateChange(e) { this.setData({ inspection_due: e.detail.value }) },
  onCompulsoryDateChange(e) { this.setData({ compulsory_ins_due: e.detail.value }) },
  onCommercialDateChange(e) { this.setData({ commercial_ins_due: e.detail.value }) },
  onMaintenanceDateChange(e) { this.setData({ maintenance_due: e.detail.value }) },

  // ── 提交 ──
  onSubmit() {
    var self = this
    var d = this.data

    // 校验
    if (!d.plate_number.trim()) {
      wx.showToast({ title: '请输入车牌号', icon: 'none' }); return
    }

    this.setData({ submitting: true })

    var payload = {
      plate_number: d.plate_number.trim(),
      brand: d.brand.trim(),
      vehicle_type: d.vehicle_type,
      load_capacity: parseFloat(d.load_capacity) || 0,
      load_unit: d.load_unit,
      mileage: parseFloat(d.mileage) || 0,
      status: d.status,
    }

    // 可选的到期日字段
    if (d.inspection_due) payload.inspection_due = d.inspection_due
    if (d.compulsory_ins_due) payload.compulsory_ins_due = d.compulsory_ins_due
    if (d.commercial_ins_due) payload.commercial_ins_due = d.commercial_ins_due
    if (d.maintenance_due) payload.maintenance_due = d.maintenance_due

    var url = d.isEdit
      ? '/api/v1/vehicles/fleet/' + d.vehicleId
      : '/api/v1/vehicles/fleet/create'
    var method = d.isEdit ? 'PUT' : 'POST'

    app.request({
      url: url,
      method: method,
      data: payload,
      success(res) {
        self.setData({ submitting: false })
        if (res.code === 200) {
          wx.showToast({ title: d.isEdit ? '更新成功' : '创建成功', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 1200)
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' })
        }
      },
      fail() {
        self.setData({ submitting: false })
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
    })
  },
})
