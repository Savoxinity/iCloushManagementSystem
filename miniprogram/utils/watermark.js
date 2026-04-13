/**
 * watermark.js — iCloush 任务取证上传模块
 * ═══════════════════════════════════════════════════
 * V5.6.1 重构：前端不再做 Canvas 水印合成
 * 
 * 新方案（后端水印）：
 *   1. 前端仅调用原生相机拍摄原图（禁用相册，防篡改）
 *   2. 获取 GPS 定位 + 时间戳 + 员工/工区信息
 *   3. 原图 + 元数据通过 app.request（云托管链路）上传后端
 *   4. 后端 Python（Pillow）烙印仿小米徕卡风格水印
 *   5. 水印图存 COS，返回公网 URL
 * 
 * 水印风格（后端处理）：
 *   底部白色横条，左侧品牌名+时间，中间 iCloush LOGO，
 *   右侧员工|工区+GPS坐标，竖线分隔
 * 
 * 修复记录：
 *   - 废弃 wx.uploadFile 直连外部IP（导致云托管拦截→死循环）
 *   - 废弃前端 OffscreenCanvas 合成（高像素照片内存溢出）
 *   - 所有网络请求统一走 app.request（wx.cloud.callContainer）
 *   - 完整 fail/catch 错误处理，杜绝无限 loading
 */

var app = getApp();
var util = require('./util');


// ── 获取 GPS 定位 ─────────────────────────────

function getLocation() {
  return new Promise(function (resolve) {
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          lat: res.latitude.toFixed(4),
          lng: res.longitude.toFixed(4),
          latDir: res.latitude >= 0 ? 'N' : 'S',
          lngDir: res.longitude >= 0 ? 'E' : 'W',
        });
      },
      fail: function () {
        resolve(null); // GPS 获取失败时不阻塞流程
      },
    });
  });
}


// ── 格式化 GPS 显示文本 ───────────────────────

function formatGPS(loc) {
  if (!loc) return '';
  return Math.abs(loc.lat) + '\u00B0' + loc.latDir + ' ' + Math.abs(loc.lng) + '\u00B0' + loc.lngDir;
}


// ── 构建水印元数据 ────────────────────────────

function buildWatermarkMeta(taskId) {
  var userInfo = app.globalData.userInfo || {};
  var meta = {
    timestamp: util.formatDate(new Date(), 'YYYY.MM.DD HH:mm:ss'),
    staff_name: userInfo.name || '员工',
    zone_name: '',
    task_id: taskId,
    gps_text: '',
    latitude: 0,
    longitude: 0,
  };

  // 尝试从全局缓存获取工区名称
  var zones = app.globalData._cachedZones || [];
  var userZones = userInfo.current_zones || [];
  if (userZones.length > 0 && zones.length > 0) {
    for (var z = 0; z < zones.length; z++) {
      if (zones[z].code === userZones[0]) {
        meta.zone_name = zones[z].name;
        break;
      }
    }
  }
  // 兜底：从任务缓存获取工区名称
  if (!meta.zone_name) {
    var tasks = app.globalData._cachedTasks || [];
    for (var t = 0; t < tasks.length; t++) {
      if (String(tasks[t].id) === String(taskId)) {
        meta.zone_name = tasks[t].zone_name || '';
        break;
      }
    }
  }

  return meta;
}


// ── 主函数：上传原图 + 元数据到后端水印接口 ────
// 
// 流程：
//   拍照 → readFile → base64 → app.request POST → 后端水印+COS → 返回URL
//
// 错误处理：
//   每一步 fail/catch 都会 reject，调用方负责 hideLoading + showToast

function uploadPhotoWithWatermark(tempFilePath, taskId) {
  return new Promise(function (resolve, reject) {
    // 并行获取 GPS（不阻塞主流程）
    var gpsPromise = getLocation();
    var meta = buildWatermarkMeta(taskId);

    gpsPromise.then(function (gpsData) {
      if (gpsData) {
        meta.gps_text = formatGPS(gpsData);
        meta.latitude = gpsData.latitude;
        meta.longitude = gpsData.longitude;
      }

      // 读取临时文件为 ArrayBuffer → 转 base64
      var fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: tempFilePath,
        success: function (readRes) {
          var base64Data;
          try {
            base64Data = wx.arrayBufferToBase64(readRes.data);
          } catch (e) {
            reject(new Error('图片编码失败: ' + e.message));
            return;
          }

          // 通过 app.request（云托管内网链路）上传
          app.request({
            url: '/api/v1/upload/task-photo-watermark',
            method: 'POST',
            data: {
              image_base64: base64Data,
              task_id: taskId,
              timestamp: meta.timestamp,
              staff_name: meta.staff_name,
              zone_name: meta.zone_name,
              gps_text: meta.gps_text,
              latitude: meta.latitude,
              longitude: meta.longitude,
            },
            success: function (res) {
              if (res.code === 200 && res.data && res.data.url) {
                resolve(res.data.url);
              } else if (app.globalData.useMock) {
                // Mock 模式降级：返回模拟 URL
                console.warn('[水印上传] Mock模式：返回模拟URL');
                resolve(res.data && res.data.url ? res.data.url : tempFilePath);
              } else {
                reject(new Error('上传接口返回错误: ' + JSON.stringify(res)));
              }
            },
            fail: function (err) {
              if (app.globalData.useMock) {
                console.warn('[水印上传] Mock模式降级：返回本地路径');
                resolve(tempFilePath);
              } else {
                reject(new Error('网络请求失败: ' + JSON.stringify(err)));
              }
            },
          });
        },
        fail: function (readErr) {
          reject(new Error('读取图片文件失败: ' + JSON.stringify(readErr)));
        },
      });
    }).catch(function (err) {
      reject(new Error('获取定位异常: ' + err.message));
    });
  });
}


module.exports = {
  // ★ 新接口
  uploadPhotoWithWatermark: uploadPhotoWithWatermark,
  getLocation: getLocation,
  formatGPS: formatGPS,
  buildWatermarkMeta: buildWatermarkMeta,
  // ★ 旧接口名称保留（向后兼容），指向新函数
  composeWatermarkAndUpload: uploadPhotoWithWatermark,
};
