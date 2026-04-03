/**
 * watermark.js — iCloush 专属水印标识系统
 * ═══════════════════════════════════════════════════
 * 设计风格：小米徕卡水印相机 / 胶片机日期标记
 * 
 * 特征：
 *   - 左下角紧凑方形标识（非底部整条横幅）
 *   - 10% 透明度黑底圆角矩形
 *   - 胶片机日期级别的小字体
 *   - 品牌金色标题 + 白色信息文字
 * 
 * 水印信息：
 *   行1: iCloush LAB.（品牌标识，金色）
 *   行2: 2026.04.02 14:30:25（拍照时间）
 *   行3: 张伟 | 水洗区（员工 | 工区）
 *   行4: TASK #T-0042（任务编号）
 *   行5: 31.23°N 121.47°E（GPS，可选）
 * 
 * 流程：
 *   1. OffscreenCanvas 绘制原图 + 左下角水印标识
 *   2. 导出合成图片
 *   3. wx.uploadFile 上传至后端
 *   4. 返回公网 URL
 */

var app = getApp();
var util = require('./util');

// ── 水印配置常量 ──────────────────────────────

var WATERMARK_CONFIG = {
  // 位置：距左下角的边距比例（相对图片尺寸）
  marginRatio: 0.025,        // 距边缘 2.5%
  
  // 背景
  bgOpacity: 0.10,           // 10% 透明度黑底
  bgRadius: 6,               // 圆角半径（会按比例缩放）
  bgPaddingX: 0.012,         // 水平内边距比例
  bgPaddingY: 0.006,         // 垂直内边距比例
  
  // 字体大小比例（相对图片短边）
  brandFontRatio: 0.022,     // 品牌名字体
  infoFontRatio: 0.016,      // 信息行字体
  gpsFontRatio: 0.013,       // GPS 字体（最小）
  
  // 行间距比例
  lineSpacingRatio: 0.006,
  
  // 颜色
  brandColor: '#C9A84C',     // iCloush 品牌金色
  textColor: 'rgba(255, 255, 255, 0.88)',
  gpsColor: 'rgba(255, 255, 255, 0.60)',
};


// ── 获取 GPS 定位 ─────────────────────────────

function getLocation() {
  return new Promise(function (resolve) {
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        resolve({
          lat: res.latitude.toFixed(4),
          lng: res.longitude.toFixed(4),
          latDir: res.latitude >= 0 ? 'N' : 'S',
          lngDir: res.longitude >= 0 ? 'E' : 'W',
        });
      },
      fail: function () {
        resolve(null); // GPS 获取失败时不阻塞
      },
    });
  });
}


// ── 格式化 GPS 显示文本 ───────────────────────

function formatGPS(loc) {
  if (!loc) return '';
  return Math.abs(loc.lat) + '°' + loc.latDir + ' ' + Math.abs(loc.lng) + '°' + loc.lngDir;
}


// ── 绘制圆角矩形 ─────────────────────────────

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}


// ── 核心：合成水印 ────────────────────────────

function composeWatermark(canvas, ctx, img, width, height, watermarkData) {
  // 绘制原始图片
  ctx.drawImage(img, 0, 0, width, height);
  
  var cfg = WATERMARK_CONFIG;
  var shortSide = Math.min(width, height);
  
  // 计算字体大小（基于图片短边，确保在任何分辨率下都清晰但不突兀）
  var brandFontSize = Math.max(14, Math.round(shortSide * cfg.brandFontRatio));
  var infoFontSize = Math.max(11, Math.round(shortSide * cfg.infoFontRatio));
  var gpsFontSize = Math.max(9, Math.round(shortSide * cfg.gpsFontRatio));
  var lineSpacing = Math.max(4, Math.round(shortSide * cfg.lineSpacingRatio));
  
  // 构建水印文本行
  var lines = [];
  
  // 行1: 品牌标识
  lines.push({
    text: 'iCloush LAB.',
    font: 'bold ' + brandFontSize + 'px "Helvetica Neue", Helvetica, sans-serif',
    color: cfg.brandColor,
    size: brandFontSize,
  });
  
  // 行2: 拍照时间
  lines.push({
    text: watermarkData.timestamp || util.formatDate(new Date(), 'YYYY.MM.DD HH:mm:ss'),
    font: infoFontSize + 'px "Helvetica Neue", Helvetica, sans-serif',
    color: cfg.textColor,
    size: infoFontSize,
  });
  
  // 行3: 员工 | 工区
  var staffZone = (watermarkData.staffName || '员工');
  if (watermarkData.zoneName) {
    staffZone += ' | ' + watermarkData.zoneName;
  }
  lines.push({
    text: staffZone,
    font: infoFontSize + 'px "Helvetica Neue", Helvetica, sans-serif',
    color: cfg.textColor,
    size: infoFontSize,
  });
  
  // 行4: 任务编号
  if (watermarkData.taskId) {
    lines.push({
      text: 'TASK #T-' + String(watermarkData.taskId).padStart(4, '0'),
      font: infoFontSize + 'px "Menlo", "Courier New", monospace',
      color: cfg.textColor,
      size: infoFontSize,
    });
  }
  
  // 行5: GPS（可选）
  if (watermarkData.gps) {
    lines.push({
      text: watermarkData.gps,
      font: gpsFontSize + 'px "Menlo", "Courier New", monospace',
      color: cfg.gpsColor,
      size: gpsFontSize,
    });
  }
  
  // ── 计算水印区域尺寸 ──
  var paddingX = Math.max(8, Math.round(shortSide * cfg.bgPaddingX));
  var paddingY = Math.max(6, Math.round(shortSide * cfg.bgPaddingY));
  var margin = Math.max(10, Math.round(shortSide * cfg.marginRatio));
  var radius = Math.max(3, Math.round(shortSide * 0.004));
  
  // 测量最大文本宽度
  var maxTextWidth = 0;
  for (var i = 0; i < lines.length; i++) {
    ctx.font = lines[i].font;
    var tw = ctx.measureText(lines[i].text).width;
    if (tw > maxTextWidth) maxTextWidth = tw;
  }
  
  // 计算总高度
  var totalTextHeight = 0;
  for (var j = 0; j < lines.length; j++) {
    totalTextHeight += lines[j].size;
    if (j < lines.length - 1) totalTextHeight += lineSpacing;
  }
  
  var boxWidth = maxTextWidth + paddingX * 2;
  var boxHeight = totalTextHeight + paddingY * 2;
  
  // 水印位置：左下角
  var boxX = margin;
  var boxY = height - margin - boxHeight;
  
  // ── 绘制半透明背景 ──
  ctx.save();
  ctx.globalAlpha = cfg.bgOpacity;
  ctx.fillStyle = '#000000';
  drawRoundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
  ctx.fill();
  ctx.restore();
  
  // ── 绘制文字 ──
  var textX = boxX + paddingX;
  var textY = boxY + paddingY;
  
  for (var k = 0; k < lines.length; k++) {
    ctx.font = lines[k].font;
    ctx.fillStyle = lines[k].color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(lines[k].text, textX, textY);
    textY += lines[k].size + lineSpacing;
  }
}


// ── 主函数：合成水印并上传 ─────────────────────

function composeWatermarkAndUpload(tempFilePath, watermarkText, taskId) {
  // watermarkText 参数保留向后兼容，但新版本使用结构化数据
  // 从 app.globalData 获取丰富的水印信息
  var userInfo = app.globalData.userInfo || {};
  
  return new Promise(function (resolve, reject) {
    // 并行获取 GPS
    var gpsPromise = getLocation();
    
    // Step 1: 获取图片信息
    wx.getImageInfo({
      src: tempFilePath,
      success: function (imgInfo) {
        var width = imgInfo.width;
        var height = imgInfo.height;
        
        gpsPromise.then(function (gpsData) {
          // 构建水印数据
          var watermarkData = {
            timestamp: util.formatDate(new Date(), 'YYYY.MM.DD HH:mm:ss'),
            staffName: userInfo.name || '员工',
            zoneName: '',
            taskId: taskId,
            gps: gpsData ? formatGPS(gpsData) : '',
          };
          
          // 尝试获取工区名称
          // 从全局缓存的工区数据中，根据用户的 current_zones 查找
          var zones = app.globalData._cachedZones || [];
          var userZones = userInfo.current_zones || [];
          if (userZones.length > 0 && zones.length > 0) {
            for (var z = 0; z < zones.length; z++) {
              if (zones[z].code === userZones[0]) {
                watermarkData.zoneName = zones[z].name;
                break;
              }
            }
          }
          if (!watermarkData.zoneName) {
            // 从任务数据中获取工区名称（如果有缓存）
            var tasks = app.globalData._cachedTasks || [];
            for (var t = 0; t < tasks.length; t++) {
              if (String(tasks[t].id) === String(taskId)) {
                watermarkData.zoneName = tasks[t].zone_name || '';
                break;
              }
            }
          }
          
          // Step 2: 创建离屏 Canvas
          wx.createOffscreenCanvas({
            type: '2d',
            width: width,
            height: height,
            success: function (canvas) {
              var ctx = canvas.getContext('2d');
              var img = canvas.createImage();
              
              img.onload = function () {
                // 合成水印
                composeWatermark(canvas, ctx, img, width, height, watermarkData);
                
                // Step 3: 导出合成图片
                wx.canvasToTempFilePath({
                  canvas: canvas,
                  fileType: 'jpg',
                  quality: 0.90,
                  success: function (res) {
                    var mergedPath = res.tempFilePath;
                    
                    // Step 4: 上传
                    var uploadUrl = (app.globalData.baseUrl || '') + '/api/v1/upload/task-photo';
                    wx.uploadFile({
                      url: uploadUrl,
                      filePath: mergedPath,
                      name: 'file',
                      formData: { task_id: taskId },
                      header: {
                        'Authorization': 'Bearer ' + (app.globalData.token || ''),
                      },
                      success: function (uploadRes) {
                        try {
                          var data = JSON.parse(uploadRes.data);
                          if (data.code === 200 && data.data && data.data.url) {
                            resolve(data.data.url);
                          } else {
                            reject(new Error('上传接口返回错误: ' + uploadRes.data));
                          }
                        } catch (e) {
                          reject(new Error('解析上传响应失败'));
                        }
                      },
                      fail: function (err) {
                        // Mock 模式降级
                        if (app.globalData.useMock) {
                          console.warn('[水印] Mock模式：返回本地路径');
                          resolve(mergedPath);
                        } else {
                          reject(new Error('上传失败: ' + JSON.stringify(err)));
                        }
                      },
                    });
                  },
                  fail: function (err) {
                    reject(new Error('Canvas导出失败: ' + JSON.stringify(err)));
                  },
                });
              };
              
              img.onerror = function () {
                reject(new Error('图片加载失败'));
              };
              img.src = tempFilePath;
            },
            fail: function (err) {
              reject(new Error('创建OffscreenCanvas失败: ' + JSON.stringify(err)));
            },
          });
        });
      },
      fail: function (err) {
        reject(new Error('获取图片信息失败: ' + JSON.stringify(err)));
      },
    });
  });
}


module.exports = {
  composeWatermarkAndUpload: composeWatermarkAndUpload,
};
