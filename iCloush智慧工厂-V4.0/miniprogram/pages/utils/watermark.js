/**
 * watermark.js
 * 水印合成 + 真实上传工具
 * 
 * 流程：
 * 1. 用 OffscreenCanvas 将水印文字压印到图片像素上
 * 2. 将合成后的图片通过 wx.uploadFile 上传至后端中转接口
 * 3. 后端将文件转存至腾讯云 COS，返回公网 https:// URL
 * 4. 前端拿到真实 URL 后才允许提交任务
 */

var app = getApp();

/**
 * 合成水印并上传
 * @param {string} tempFilePath - wx.chooseMedia 返回的本地临时路径
 * @param {string} watermarkText - 水印文字（姓名·时间·iCloush）
 * @param {string} taskId - 任务ID，用于后端归档分类
 * @returns {Promise<string>} 公网 https:// URL
 */
function composeWatermarkAndUpload(tempFilePath, watermarkText, taskId) {
  return new Promise(function (resolve, reject) {
    // Step 1: 获取图片信息（宽高）
    wx.getImageInfo({
      src: tempFilePath,
      success: function (imgInfo) {
        var width = imgInfo.width;
        var height = imgInfo.height;

        // Step 2: 创建离屏 Canvas 合成水印
        wx.createOffscreenCanvas({
          type: '2d',
          width: width,
          height: height,
          success: function (canvas) {
            var ctx = canvas.getContext('2d');

            // 绘制原始图片
            var img = canvas.createImage();
            img.onload = function () {
              ctx.drawImage(img, 0, 0, width, height);

              // 绘制水印背景条（半透明黑底）
              var barHeight = Math.max(40, height * 0.06);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
              ctx.fillRect(0, height - barHeight, width, barHeight);

              // 绘制水印文字
              var fontSize = Math.max(18, Math.floor(barHeight * 0.45));
              ctx.font = fontSize + 'px sans-serif';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(watermarkText, 12, height - barHeight / 2);

              // Step 3: 导出合成图片为临时文件
              wx.canvasToTempFilePath({
                canvas: canvas,
                fileType: 'jpg',
                quality: 0.88,
                success: function (res) {
                  var mergedPath = res.tempFilePath;

                  // Step 4: wx.uploadFile 上传至后端中转接口
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
                          resolve(data.data.url); // 公网 https:// URL
                        } else {
                          reject(new Error('上传接口返回错误: ' + uploadRes.data));
                        }
                      } catch (e) {
                        reject(new Error('解析上传响应失败'));
                      }
                    },
                    fail: function (err) {
                      // Mock 模式下降级：返回本地路径（仅用于开发调试）
                      if (app.globalData.useMock) {
                        console.warn('[水印] Mock模式：跳过真实上传，返回本地路径');
                        resolve(mergedPath);
                      } else {
                        reject(new Error('上传失败: ' + JSON.stringify(err)));
                      }
                    },
                  });
                },
                fail: function (err) { reject(new Error('Canvas导出失败: ' + JSON.stringify(err))); },
              });
            };
            img.onerror = function () { reject(new Error('图片加载失败')); };
            img.src = tempFilePath;
          },
          fail: function (err) { reject(new Error('创建OffscreenCanvas失败: ' + JSON.stringify(err))); },
        });
      },
      fail: function (err) { reject(new Error('获取图片信息失败: ' + JSON.stringify(err))); },
    });
  });
}

module.exports = { composeWatermarkAndUpload: composeWatermarkAndUpload };
