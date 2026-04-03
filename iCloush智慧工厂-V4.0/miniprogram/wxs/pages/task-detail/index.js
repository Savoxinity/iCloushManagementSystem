const app = getApp();
const util = require('../../utils/util');
const watermarkUtil = require('../../utils/watermark');

Page({
  data: {
    taskId: null, task: {}, canExecute: false, canManualReview: false,
    inputCount: 1, uploadedPhotos: [], uploading: false, submitting: false,
    aiReview: { result: 'pending', resultLabel: '审核中', comment: '人工智能正在分析...', reviewedAt: '' },
    executionRecords: [],
  },

  onLoad(options) {
    this.setData({ taskId: options.taskId });
    wx.setNavigationBarTitle({ title: '任务详情' });
    this.loadTask(options.taskId);
  },

  // 强制从后端拉取最新数据，不依赖本地缓存
  loadTask(taskId) {
    wx.showNavigationBarLoading();
    app.request({
      url: '/api/v1/tasks',
      success: (res) => {
        wx.hideNavigationBarLoading();
        if (res.code !== 200) return;
        const raw = res.data.find(t => String(t.id) === String(taskId));
        if (!raw) { wx.showToast({ title: '任务不存在', icon: 'none' }); return; }
        const userInfo = app.globalData.userInfo || {};
        const task = {
          ...raw,
          typeLabel: util.getTaskTypeLabel(raw.task_type),
          statusLabel: util.getTaskStatusLabel(raw.status),
          priorityLabel: ['', '普通', '重要', '紧急', '特急'][raw.priority] || '',
          deadlineText: raw.deadline ? util.getCountdown(raw.deadline) : '',
          progressPct: raw.target ? Math.min(Math.round((raw.progress / raw.target) * 100), 100) : 0,
          description: raw.description || '按标准操作规程执行，完成后拍照取证提交。',
        };
        const canExecute = raw.status < 3;
        const canManualReview = (userInfo.role || 1) >= 5;
        this.setData({ task, canExecute, canManualReview });
        wx.setNavigationBarTitle({ title: task.title.slice(0, 10) });
        if (raw.status >= 3) {
          this.setData({
            aiReview: {
              result: raw.status === 4 ? 'pass' : raw.status === 5 ? 'fail' : 'pending',
              resultLabel: raw.status === 4 ? '人工智能审核通过' : raw.status === 5 ? '审核未通过' : '审核中',
              comment: raw.status === 4 ? '照片清晰，任务完成情况符合标准。' : raw.status === 5 ? '照片模糊或与任务内容不符，请重新提交。' : '人工智能正在分析照片，通常30秒内完成...',
              reviewedAt: raw.status >= 4 ? util.formatDate(new Date(), 'HH:mm') : '',
            },
          });
        }
      },
      fail: () => { wx.hideNavigationBarLoading(); wx.showToast({ title: '加载失败', icon: 'none' }); },
    });
    this.loadExecutionRecords(taskId);
  },

  loadExecutionRecords(taskId) {
    app.request({
      url: '/api/v1/tasks/' + taskId + '/records',
      success: (res) => {
        if (res.code === 200 && res.data) this.setData({ executionRecords: res.data });
        else {
          // Mock 执行记录
          this.setData({ executionRecords: [
            { id: 1, action_type: 'start', actionLabel: '开始执行', note: '已确认接单', createdAtStr: '09:15', photos: [], count_delta: 0 },
            { id: 2, action_type: 'count', actionLabel: '提交计件', note: '', createdAtStr: '10:30', photos: [], count_delta: 35 },
          ]});
        }
      },
    });
  },

  decreaseCount() { if (this.data.inputCount > 1) this.setData({ inputCount: this.data.inputCount - 1 }); },
  increaseCount() { this.setData({ inputCount: this.data.inputCount + 1 }); },

  // 修复幽灵提交：提交后强制重拉后端数据，不在前端自行累加
  submitCount() {
    const count = this.data.inputCount;
    if (count <= 0) { wx.showToast({ title: '请输入数量', icon: 'none' }); return; }
    app.request({
      url: '/api/v1/tasks/' + this.data.taskId + '/count', method: 'POST', data: { count },
      success: (res) => {
        if (res.code === 200) {
          wx.showToast({ title: '+' + count + ' 件已记录', icon: 'success' });
          this.setData({ inputCount: 1 });
          // 强制重新从后端拉取最新进度，防止多人并发时前端数据撕裂
          this.loadTask(this.data.taskId);
        } else { wx.showToast({ title: '提交失败，请重试', icon: 'none' }); }
      },
    });
  },

  // 修复假水印假上传：Canvas合成水印 + wx.uploadFile真实上传
  takePhoto() {
    if (this.data.uploading) { wx.showToast({ title: '上一张正在上传，请稍候', icon: 'none' }); return; }
    if (this.data.uploadedPhotos.length >= 6) { wx.showToast({ title: '最多上传6张照片', icon: 'none' }); return; }
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['camera'], camera: 'back',
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        const userInfo = app.globalData.userInfo || {};
        const watermarkText = (userInfo.name || '员工') + ' · ' + util.formatDate(new Date(), 'YYYY-MM-DD HH:mm') + ' · iCloush';
        const localId = Date.now();
        // 先显示本地预览（状态：上传中）
        this.setData({
          uploading: true,
          uploadedPhotos: [...this.data.uploadedPhotos, { id: localId, url: tempPath, ai_status: 'uploading' }],
        });
        // Canvas水印合成 + wx.uploadFile真实上传
        watermarkUtil.composeWatermarkAndUpload(tempPath, watermarkText, this.data.taskId)
          .then((publicUrl) => {
            const photos = this.data.uploadedPhotos.map(p =>
              p.id === localId ? { ...p, url: publicUrl, ai_status: 'pending' } : p
            );
            this.setData({ uploadedPhotos: photos, uploading: false });
            // 模拟AI审核（生产环境由后端WebSocket推送）
            setTimeout(() => {
              const updated = this.data.uploadedPhotos.map(p =>
                p.id === localId ? { ...p, ai_status: 'pass' } : p
              );
              this.setData({ uploadedPhotos: updated });
            }, 2000);
          })
          .catch((err) => {
            console.error('[拍照上传] 失败:', err);
            this.setData({
              uploading: false,
              uploadedPhotos: this.data.uploadedPhotos.filter(p => p.id !== localId),
            });
            wx.showToast({ title: '上传失败，请重拍', icon: 'none' });
          });
      },
    });
  },

  removePhoto(e) { this.setData({ uploadedPhotos: this.data.uploadedPhotos.filter(p => p.id !== e.currentTarget.dataset.id) }); },
  previewPhoto(e) {
    const urls = this.data.uploadedPhotos.filter(p => p.ai_status !== 'uploading').map(p => p.url);
    if (urls.length > 0) wx.previewImage({ urls, current: e.currentTarget.dataset.url });
  },

  // 提交任务：只发送已获得公网URL的照片
  submitTask() {
    const { task, uploadedPhotos, uploading } = this.data;
    if (uploading) { wx.showToast({ title: '照片正在上传，请稍候', icon: 'none' }); return; }
    if (task.requires_photo && uploadedPhotos.length === 0) { wx.showToast({ title: '请先拍照取证', icon: 'none' }); return; }
    const validPhotos = uploadedPhotos.filter(p => p.ai_status !== 'uploading' && p.url && p.url.startsWith('http'));
    if (task.requires_photo && validPhotos.length === 0) { wx.showToast({ title: '照片尚未上传完成', icon: 'none' }); return; }
    this.setData({ submitting: true });
    app.request({
      url: '/api/v1/tasks/' + this.data.taskId + '/submit', method: 'POST',
      data: { photo_urls: validPhotos.map(p => p.url) }, // 全部为公网 https:// URL
      success: (res) => {
        this.setData({ submitting: false });
        if (res.code === 200) {
          wx.showToast({ title: '已提交，等待审核', icon: 'success' });
          this.loadTask(this.data.taskId); // 强制重拉最新状态
        } else { wx.showToast({ title: '提交失败', icon: 'none' }); }
      },
      fail: () => { this.setData({ submitting: false }); wx.showToast({ title: '网络错误', icon: 'none' }); },
    });
  },

  manualApprove() {
    wx.showModal({ title: '人工审核通过', content: '确认手动通过该任务？', confirmColor: '#00FF88', success: (res) => {
      if (!res.confirm) return;
      app.request({ url: '/api/v1/tasks/' + this.data.taskId + '/review', method: 'POST', data: { result: 'pass' }, success: () => {
        wx.showToast({ title: '审核通过', icon: 'success' }); this.loadTask(this.data.taskId);
      }});
    }});
  },

  manualReject() {
    wx.showModal({ title: '确认驳回', content: '确认驳回该任务？员工需重新提交。', confirmColor: '#EF4444', success: (res) => {
      if (!res.confirm) return;
      app.request({ url: '/api/v1/tasks/' + this.data.taskId + '/review', method: 'POST', data: { result: 'fail' }, success: () => {
        wx.showToast({ title: '已驳回', icon: 'none' }); this.loadTask(this.data.taskId);
      }});
    }});
  },
});
