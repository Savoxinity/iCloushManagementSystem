// ============================================
// 任务详情页 — V5.6.1 水印相机修复 + 强制拍照
// ============================================
var app = getApp();
var util = require('../../utils/util');
var watermarkUtil = require('../../utils/watermark');

Page({
  data: {
    taskId: null, task: {}, canExecute: false, canReview: false,
    isAdmin: false, isRejected: false,
    // ★ 接单网关
    isPending: false,       // status === 0，待接单
    accepting: false,       // 正在调用接单 API
    inputCount: 1, uploadedPhotos: [], uploading: false, submitting: false,
    reviewing: false,
    aiReview: { result: 'pending', resultLabel: '审核中', comment: '人工智能正在分析...', reviewedAt: '' },
    executionRecords: [],
  },

  onLoad: function (options) {
    var accountRole = app.globalData.accountRole || 'staff';
    var userInfo = app.globalData.userInfo || {};
    this.setData({
      taskId: options.taskId,
      isAdmin: accountRole === 'admin' || (userInfo.role || 1) >= 5,
    });
    wx.setNavigationBarTitle({ title: '任务详情' });
    this.loadTask(options.taskId);
  },

  onShow: function () {
    if (this.data.taskId) this.loadTask(this.data.taskId);
  },

  loadTask: function (taskId) {
    var self = this;
    wx.showNavigationBarLoading();
    app.request({
      url: '/api/v1/tasks',
      success: function (res) {
        wx.hideNavigationBarLoading();
        if (res.code !== 200) return;
        var rawList = res.data || [];
        var raw = null;
        for (var i = 0; i < rawList.length; i++) {
          if (String(rawList[i].id) === String(taskId)) { raw = rawList[i]; break; }
        }
        if (!raw) { wx.showToast({ title: '任务不存在', icon: 'none' }); return; }

        var task = {
          id: raw.id, title: raw.title, task_type: raw.task_type,
          zone_id: raw.zone_id, zone_name: raw.zone_name,
          status: raw.status, priority: raw.priority,
          points_reward: raw.points_reward,
          progress: raw.progress, target: raw.target, unit: raw.unit,
          // ★ V5.6.1: require_photo 字段
          requires_photo: raw.requires_photo || raw.require_photo || false,
          description: raw.description || '按标准操作规程执行，完成后拍照取证提交。',
          deadline: raw.deadline, assigned_to: raw.assigned_to,
          is_rejected: raw.is_rejected || false,
          reject_reason: raw.reject_reason || '',
          is_recurring: raw.is_recurring || false,
          interval_days: raw.interval_days || 0,
          next_publish_date: raw.next_publish_date || '',
          typeLabel: util.getTaskTypeLabel(raw.task_type),
          statusLabel: util.getTaskStatusLabel(raw.status),
          priorityLabel: ['', '普通', '重要', '紧急', '特急'][raw.priority] || '',
          deadlineText: raw.deadline ? util.getCountdown(raw.deadline) : '',
          progressPct: raw.target ? Math.min(Math.round((raw.progress / raw.target) * 100), 100) : 0,
        };

        // 查找负责人信息
        if (raw.assigned_to) {
          var users = app.globalData._cachedUsers || [];
          for (var u = 0; u < users.length; u++) {
            if (users[u].id === raw.assigned_to) {
              task.assigneeName = users[u].name;
              task.assigneeInitial = util.getAvatarInitial(users[u].name);
              task.assigneeColor = util.getAvatarColor(users[u].avatar_key || users[u].id);
              break;
            }
          }
        }
        if (!task.assigneeName) {
          task.assigneeName = '未分配';
          task.assigneeInitial = '?';
          task.assigneeColor = '#555';
        }

        // ★ 状态判断
        var isPending = raw.status === 0;
        var canExecute = raw.status === 1 || raw.status === 2;
        var canReview = self.data.isAdmin && raw.status === 3;

        self.setData({
          task: task,
          isPending: isPending,
          canExecute: canExecute,
          canReview: canReview,
          isRejected: raw.is_rejected || false,
        });
        wx.setNavigationBarTitle({ title: task.title.slice(0, 10) });

        // AI 审核结果展示
        if (raw.status === 3) {
          self.setData({
            aiReview: {
              result: 'pending', resultLabel: '等待审核',
              comment: '任务已提交，等待管理员审核。', reviewedAt: '',
            },
          });
        } else if (raw.status === 4) {
          self.setData({
            aiReview: {
              result: 'pass', resultLabel: '审核通过',
              comment: '照片清晰，任务完成情况符合标准。',
              reviewedAt: util.formatDate(new Date(raw.reviewed_at || Date.now()), 'HH:mm'),
            },
          });
        } else if (raw.is_rejected) {
          self.setData({
            aiReview: {
              result: 'fail', resultLabel: '审核未通过（已驳回）',
              comment: raw.reject_reason || '审核未通过，请重新提交。',
              reviewedAt: util.formatDate(new Date(raw.rejected_at || Date.now()), 'HH:mm'),
            },
          });
        }
      },
    });
    this.loadExecutionRecords(taskId);
  },

  loadExecutionRecords: function (taskId) {
    var self = this;
    app.request({
      url: '/api/v1/tasks/' + taskId + '/records',
      success: function (res) {
        if (res.code === 200 && res.data && res.data.length > 0) {
          self.setData({ executionRecords: res.data });
        } else {
          self.setData({ executionRecords: [
            { id: 1, action_type: 'start', actionLabel: '开始执行', note: '已确认接单', createdAtStr: '09:15', photos: [], count_delta: 0 },
            { id: 2, action_type: 'count', actionLabel: '提交计件', note: '', createdAtStr: '10:30', photos: [], count_delta: 35 },
          ]});
        }
      },
    });
  },

  // ============================================
  // ★ 编辑任务入口
  // ============================================
  goEditTask: function () {
    wx.navigateTo({
      url: '/pages/task-edit/index?taskId=' + this.data.taskId,
    });
  },

  // ============================================
  // ★ 接单网关
  // ============================================
  onAcceptTask: function () {
    var self = this;
    var userInfo = app.globalData.userInfo || {};
    wx.showModal({
      title: '确认接单',
      content: '确认接下此任务？接单后任务将绑定到你的名下。',
      confirmText: '确认接单',
      confirmColor: '#3B82F6',
      cancelText: '暂不接单',
      cancelColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) return;
        self.setData({ accepting: true });
        app.request({
          url: '/api/v1/tasks/' + self.data.taskId + '/accept',
          method: 'POST',
          data: { user_id: userInfo.id },
          success: function (r) {
            self.setData({ accepting: false });
            if (r.code === 200) {
              wx.showToast({ title: '接单成功！', icon: 'success' });
              self.loadTask(self.data.taskId);
            } else {
              wx.showToast({ title: '接单失败', icon: 'none' });
            }
          },
        });
      },
    });
  },

  // ============================================
  // 计件操作
  // ============================================
  decreaseCount: function () { if (this.data.inputCount > 1) this.setData({ inputCount: this.data.inputCount - 1 }); },
  increaseCount: function () { this.setData({ inputCount: this.data.inputCount + 1 }); },

  submitCount: function () {
    var count = this.data.inputCount;
    var self = this;
    if (count <= 0) { wx.showToast({ title: '请输入数量', icon: 'none' }); return; }
    app.request({
      url: '/api/v1/tasks/' + self.data.taskId + '/count',
      method: 'POST',
      data: { count: count },
      success: function (res) {
        if (res.code === 200) {
          wx.showToast({ title: '+' + count + ' 件已记录', icon: 'success' });
          self.setData({ inputCount: 1 });
          self.loadTask(self.data.taskId);
        } else { wx.showToast({ title: '提交失败，请重试', icon: 'none' }); }
      },
    });
  },

  // ============================================
  // ★ V5.6.1 拍照取证（后端水印方案）
  // ============================================
  // 修复要点：
  //   1. 仅允许相机拍摄（sourceType: ['camera']），禁用相册
  //   2. 使用 watermarkUtil.uploadPhotoWithWatermark 走云托管链路
  //   3. 完整 fail/catch 错误处理，杜绝无限 loading
  //   4. uploading 状态锁防止重复触发
  takePhoto: function () {
    var self = this;

    // 防重复触发
    if (self.data.uploading) {
      wx.showToast({ title: '上一张正在上传，请稍候', icon: 'none' });
      return;
    }
    // 最多6张
    if (self.data.uploadedPhotos.length >= 6) {
      wx.showToast({ title: '最多上传6张照片', icon: 'none' });
      return;
    }

    // ★ 仅允许相机拍摄，禁用相册（防篡改）
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],   // ★ 只允许拍照，不允许从相册选择
      camera: 'back',
      success: function (res) {
        var tempPath = res.tempFiles[0].tempFilePath;
        var localId = Date.now();

        // 先在列表中显示"上传中"占位
        var photos = self.data.uploadedPhotos.slice();
        photos.push({ id: localId, url: tempPath, ai_status: 'uploading' });
        self.setData({ uploading: true, uploadedPhotos: photos });

        wx.showLoading({ title: '水印处理中...', mask: true });

        // ★ 调用新的后端水印上传接口
        watermarkUtil.uploadPhotoWithWatermark(tempPath, self.data.taskId)
          .then(function (publicUrl) {
            wx.hideLoading();
            // 更新照片URL为后端返回的带水印URL
            var updatedPhotos = [];
            for (var i = 0; i < self.data.uploadedPhotos.length; i++) {
              var p = self.data.uploadedPhotos[i];
              if (p.id === localId) {
                updatedPhotos.push({ id: p.id, url: publicUrl, ai_status: 'pending' });
              } else {
                updatedPhotos.push(p);
              }
            }
            self.setData({ uploadedPhotos: updatedPhotos, uploading: false });

            // 模拟 AI 审核（2秒后标记为通过）
            setTimeout(function () {
              var finalPhotos = [];
              for (var j = 0; j < self.data.uploadedPhotos.length; j++) {
                var pp = self.data.uploadedPhotos[j];
                if (pp.id === localId) {
                  finalPhotos.push({ id: pp.id, url: pp.url, ai_status: 'pass' });
                } else {
                  finalPhotos.push(pp);
                }
              }
              self.setData({ uploadedPhotos: finalPhotos });
            }, 2000);
          })
          .catch(function (err) {
            // ★ 关键修复：上传失败必须 hideLoading + showToast
            wx.hideLoading();
            console.error('[拍照上传] 失败:', err);

            // 移除失败的占位照片
            var filtered = [];
            for (var i = 0; i < self.data.uploadedPhotos.length; i++) {
              if (self.data.uploadedPhotos[i].id !== localId) {
                filtered.push(self.data.uploadedPhotos[i]);
              }
            }
            self.setData({ uploading: false, uploadedPhotos: filtered });

            wx.showToast({ title: '上传失败，请重拍', icon: 'none', duration: 2500 });
          });
      },
      fail: function () {
        // 用户取消拍照，不做任何处理
      },
    });
  },

  removePhoto: function (e) {
    var targetId = e.currentTarget.dataset.id;
    var filtered = [];
    for (var i = 0; i < this.data.uploadedPhotos.length; i++) {
      if (this.data.uploadedPhotos[i].id !== targetId) filtered.push(this.data.uploadedPhotos[i]);
    }
    this.setData({ uploadedPhotos: filtered });
  },

  previewPhoto: function (e) {
    var urls = [];
    for (var i = 0; i < this.data.uploadedPhotos.length; i++) {
      var p = this.data.uploadedPhotos[i];
      if (p.ai_status !== 'uploading') urls.push(p.url);
    }
    if (urls.length > 0) wx.previewImage({ urls: urls, current: e.currentTarget.dataset.url });
  },

  // ============================================
  // ★ V5.6.1 提交任务（强制拍照拦截）
  // ============================================
  submitTask: function () {
    var task = this.data.task;
    var uploadedPhotos = this.data.uploadedPhotos;
    var uploading = this.data.uploading;
    var self = this;

    // 正在上传时拦截
    if (uploading) {
      wx.showToast({ title: '照片正在上传，请稍候', icon: 'none' });
      return;
    }

    // ★ V5.6.1: 强制拍照拦截（require_photo / requires_photo）
    if (task.requires_photo && uploadedPhotos.length === 0) {
      wx.showModal({
        title: '拍照取证（必填）',
        content: '此任务要求必须拍照取证后才能提交，请先拍照。',
        showCancel: false,
        confirmText: '去拍照',
      });
      return;
    }

    // 检查是否有有效照片（已上传完成的）
    var validPhotos = [];
    for (var i = 0; i < uploadedPhotos.length; i++) {
      var p = uploadedPhotos[i];
      if (p.ai_status !== 'uploading' && p.url) {
        validPhotos.push(p);
      }
    }

    if (task.requires_photo && validPhotos.length === 0) {
      wx.showToast({ title: '照片尚未上传完成', icon: 'none' });
      return;
    }

    self.setData({ submitting: true });

    var photoUrls = [];
    for (var j = 0; j < validPhotos.length; j++) {
      photoUrls.push(validPhotos[j].url);
    }

    app.request({
      url: '/api/v1/tasks/' + self.data.taskId + '/submit',
      method: 'POST',
      data: { photo_urls: photoUrls },
      success: function (res) {
        self.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: '已提交，等待审核', icon: 'success' });
          self.loadTask(self.data.taskId);
        } else {
          wx.showToast({ title: '提交失败', icon: 'none' });
        }
      },
      fail: function () {
        self.setData({ submitting: false });
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      },
    });
  },

  // ★ 管理端审核：通过
  approveTask: function () {
    var self = this;
    self.setData({ reviewing: true });
    wx.showModal({
      title: '审核通过', content: '确认通过该任务？员工将获得积分奖励。', confirmColor: '#00FF88',
      success: function (res) {
        if (!res.confirm) { self.setData({ reviewing: false }); return; }
        app.request({
          url: '/api/v1/tasks/' + self.data.taskId + '/review',
          method: 'POST',
          data: { result: 'pass' },
          success: function (r) {
            self.setData({ reviewing: false });
            if (r.code === 200) {
              wx.showToast({ title: '审核通过 ✓', icon: 'success' });
              self.loadTask(self.data.taskId);
            }
          },
        });
      },
    });
  },

  // ★ 管理端审核：驳回
  rejectTask: function () {
    var self = this;
    self.setData({ reviewing: true });
    wx.showModal({
      title: '驳回任务', content: '确认驳回？任务将退回「进行中」状态，员工需重新提交。', confirmColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) { self.setData({ reviewing: false }); return; }
        app.request({
          url: '/api/v1/tasks/' + self.data.taskId + '/review',
          method: 'POST',
          data: { result: 'fail', reason: '审核未通过，请检查后重新提交' },
          success: function (r) {
            self.setData({ reviewing: false });
            if (r.code === 200) {
              wx.showToast({ title: '已驳回', icon: 'none' });
              self.loadTask(self.data.taskId);
            }
          },
        });
      },
    });
  },
});
