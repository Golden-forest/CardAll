#!/usr/bin/env node

/**
 * CardAll 浏览器数据备份启动脚本
 *
 * 此脚本将：
 * 1. 启动开发服务器（如果未运行）
 * 2. 打开浏览器并执行备份脚本
 * 3. 监控备份完成状态
 * 4. 生成备份报告
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  port: 5177,
  backupScriptPath: path.join(__dirname, 'browser-data-backup.js'),
  backupDir: path.join(__dirname, '..', '..', 'backup'),
  checkInterval: 2000, // 检查间隔（毫秒）
  maxWaitTime: 60000   // 最大等待时间（毫秒）
};

/**
 * 检查服务器是否运行
 */
function checkServerStatus(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 启动开发服务器
 */
function startDevServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 启动开发服务器...');

    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverStarted = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📝 服务器输出:', output.trim());

      if (output.includes('Local:') && !serverStarted) {
        serverStarted = true;
        console.log('✅ 开发服务器已启动');
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('❌ 服务器错误:', data.toString().trim());
    });

    serverProcess.on('error', (error) => {
      console.error('❌ 启动服务器失败:', error);
      reject(error);
    });

    // 超时处理
    setTimeout(() => {
      if (!serverStarted) {
        console.log('⏰ 服务器启动超时，但继续检查状态...');
        resolve(serverProcess);
      }
    }, 30000);
  });
}

/**
 * 打开浏览器并执行备份
 */
function openBrowserWithBackup(port) {
  return new Promise((resolve, reject) => {
    console.log('🌐 准备打开浏览器执行备份...');

    // 读取备份脚本
    const backupScript = fs.readFileSync(CONFIG.backupScriptPath, 'utf8');

    // 创建一个临时的HTML文件来执行备份
    const tempHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>CardAll 数据备份</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f3f4f6;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .status {
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .info { background: #dbeafe; color: #1e40af; }
        .success { background: #d1fae5; color: #065f46; }
        .error { background: #fee2e2; color: #991b1b; }
        .loader {
            border: 4px solid #f3f4f6;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .log {
            background: #1f2937;
            color: #10b981;
            padding: 15px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            height: 200px;
            overflow-y: auto;
            white-space: pre-wrap;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗄️ CardAll 数据备份</h1>

        <div id="status" class="status info">
            <div class="loader"></div>
            <p>正在初始化备份系统...</p>
        </div>

        <div class="log" id="log">等待备份开始...\n</div>

        <div id="result" style="display: none;">
            <h3>备份结果</h3>
            <div id="resultContent"></div>
        </div>
    </div>

    <script>
        // 日志输出函数
        function addLog(message, type = 'info') {
            const log = document.getElementById('log');
            const timestamp = new Date().toLocaleTimeString();
            log.textContent += \`[\${timestamp}] \${message}\n\`;
            log.scrollTop = log.scrollHeight;
        }

        // 更新状态
        function updateStatus(message, type = 'info') {
            const status = document.getElementById('status');
            status.className = \`status \${type}\`;
            status.innerHTML = \`
                \${type === 'success' ? '✅' : type === 'error' ? '❌' : '⏳'} \${message}
            \`;
        }

        // 显示结果
        function showResult(result) {
            const resultDiv = document.getElementById('result');
            const resultContent = document.getElementById('resultContent');

            resultDiv.style.display = 'block';

            if (result.success) {
                resultContent.innerHTML = \`
                    <div class="status success">
                        <h4>✅ 备份成功完成</h4>
                        <p><strong>文件名:</strong> \${result.fileName}</p>
                        <p><strong>耗时:</strong> \${result.duration} 秒</p>
                        <p><strong>记录总数:</strong> \${result.backupData.statistics.totalCards + result.backupData.statistics.totalFolders + result.backupData.statistics.totalTags + result.backupData.statistics.totalImages + result.backupData.statistics.totalSettings} 条</p>
                    </div>
                    <div style="margin-top: 15px;">
                        <h4>📊 数据统计:</h4>
                        <ul>
                            <li>卡片: \${result.backupData.statistics.totalCards} 条</li>
                            <li>文件夹: \${result.backupData.statistics.totalFolders} 条</li>
                            <li>标签: \${result.backupData.statistics.totalTags} 条</li>
                            <li>图片: \${result.backupData.statistics.totalImages} 条</li>
                            <li>设置: \${result.backupData.statistics.totalSettings} 条</li>
                        </ul>
                    </div>
                \`;
            } else {
                resultContent.innerHTML = \`
                    <div class="status error">
                        <h4>❌ 备份失败</h4>
                        <p><strong>错误:</strong> \${result.error}</p>
                    </div>
                \`;
            }
        }

        // 重写console方法以捕获输出
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn
        };

        console.log = function(...args) {
            addLog(args.join(' '), 'info');
            originalConsole.log.apply(console, args);
        };

        console.error = function(...args) {
            addLog(args.join(' '), 'error');
            originalConsole.error.apply(console, args);
        };

        console.warn = function(...args) {
            addLog(args.join(' '), 'warn');
            originalConsole.warn.apply(console, args);
        };

        // 页面加载完成后执行备份
        window.addEventListener('load', () => {
            addLog('页面加载完成，准备开始备份...');
            updateStatus('正在执行数据备份...', 'info');

            // 执行备份脚本
            ${backupScript}
        });

        // 监听备份完成事件
        window.addEventListener('message', (event) => {
            if (event.data.type === 'BACKUP_COMPLETE') {
                const result = event.data.result;
                addLog(\`备份完成: \${result.success ? '成功' : '失败'}\`);
                updateStatus(
                    result.success ? '备份成功完成!' : '备份失败!',
                    result.success ? 'success' : 'error'
                );
                showResult(result);
            }
        });
    </script>
</body>
</html>
    `;

    // 保存临时HTML文件
    const tempHtmlPath = path.join(__dirname, 'temp-backup.html');
    fs.writeFileSync(tempHtmlPath, tempHtml);

    // 打开浏览器
    const url = `http://localhost:${port}`;
    const startCommand = process.platform === 'darwin' ? 'open' :
                        process.platform === 'win32' ? 'start' : 'xdg-open';

    const browserProcess = spawn(startCommand, [url], { shell: true });

    browserProcess.on('error', (error) => {
      console.error('❌ 打开浏览器失败:', error);
      reject(error);
    });

    console.log(`🌐 浏览器已打开: ${url}`);
    console.log('📝 备份将在浏览器中自动执行...');

    // 监控备份完成
    monitorBackupCompletion().then(resolve).catch(reject);
  });
}

/**
 * 监控备份完成状态
 */
function monitorBackupCompletion() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = CONFIG.maxWaitTime / CONFIG.checkInterval;

    console.log('👀 监控备份完成状态...');

    const checkInterval = setInterval(() => {
      attempts++;

      // 检查备份目录中是否有新的备份文件
      try {
        const backupFiles = fs.readdirSync(CONFIG.backupDir)
          .filter(file => file.includes('cardall-browser-backup'))
          .sort((a, b) => {
            const statA = fs.statSync(path.join(CONFIG.backupDir, a));
            const statB = fs.statSync(path.join(CONFIG.backupDir, b));
            return statB.mtime - statA.mtime;
          });

        if (backupFiles.length > 0) {
          const latestBackup = backupFiles[0];
          const backupPath = path.join(CONFIG.backupDir, latestBackup);
          const stats = fs.statSync(backupPath);

          // 检查文件是否是最近创建的（1分钟内）
          const ageInMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
          if (ageInMinutes < 2) {
            clearInterval(checkInterval);

            console.log('✅ 检测到备份文件已创建:', latestBackup);

            // 验证备份文件
            try {
              const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
              const totalRecords = backupData.statistics.totalCards +
                                 backupData.statistics.totalFolders +
                                 backupData.statistics.totalTags +
                                 backupData.statistics.totalImages +
                                 backupData.statistics.totalSettings;

              resolve({
                success: true,
                fileName: latestBackup,
                filePath: backupPath,
                backupData,
                totalRecords,
                fileSize: (stats.size / 1024).toFixed(2) + ' KB'
              });
            } catch (error) {
              reject(new Error(`备份文件验证失败: ${error.message}`));
            }
          }
        }
      } catch (error) {
        console.error('❌ 检查备份文件时出错:', error);
      }

      // 超时处理
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('备份监控超时，请检查浏览器中的备份状态'));
      }
    }, CONFIG.checkInterval);
  });
}

/**
 * 生成备份报告
 */
function generateReport(backupResult) {
  const reportPath = path.join(CONFIG.backupDir, `browser-backup-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    type: 'browser-backup',
    result: backupResult,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      port: CONFIG.port
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('📋 备份报告已生成:', reportPath);

  return reportPath;
}

/**
 * 主执行流程
 */
async function main() {
  console.log('🎯 CardAll 浏览器数据备份启动');
  console.log('='.repeat(50));

  try {
    // 1. 检查服务器状态
    console.log('🔍 检查开发服务器状态...');
    const serverRunning = await checkServerStatus(CONFIG.port);

    if (!serverRunning) {
      console.log('🚀 开发服务器未运行，正在启动...');
      await startDevServer();

      // 等待服务器完全启动
      console.log('⏳ 等待服务器完全启动...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('✅ 开发服务器已在运行');
    }

    // 2. 确保备份目录存在
    if (!fs.existsSync(CONFIG.backupDir)) {
      fs.mkdirSync(CONFIG.backupDir, { recursive: true });
      console.log('📁 备份目录已创建');
    }

    // 3. 执行浏览器备份
    console.log('🌐 开始浏览器端备份流程...');
    const backupResult = await openBrowserWithBackup(CONFIG.port);

    // 4. 生成报告
    const reportPath = generateReport(backupResult);

    // 5. 显示最终结果
    console.log('='.repeat(50));
    console.log('🎉 浏览器备份操作完成!');
    console.log('='.repeat(50));
    console.log(`📁 备份文件: ${backupResult.filePath}`);
    console.log(`📊 文件大小: ${backupResult.fileSize}`);
    console.log(`📝 记录总数: ${backupResult.totalRecords}`);
    console.log(`📋 备份报告: ${reportPath}`);
    console.log('='.repeat(50));

    process.exit(0);

  } catch (error) {
    console.error('❌ 备份流程失败:', error);
    console.log('\n建议操作:');
    console.log('1. 检查开发服务器是否正常运行');
    console.log('2. 确认浏览器已正确打开');
    console.log('3. 检查备份目录权限');
    console.log('4. 手动在浏览器中执行备份脚本');

    process.exit(1);
  }
}

// 执行主流程
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  main,
  checkServerStatus,
  startDevServer,
  openBrowserWithBackup,
  monitorBackupCompletion
};