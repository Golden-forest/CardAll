import { chromium } from 'playwright';

async function checkConsoleErrors() {
  console.log('开始检查CardAll应用控制台错误...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const networkErrors = [];

  // 监听控制台消息
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const location = msg.location();

    if (type === 'error') {
      consoleErrors.push({
        text,
        type,
        location,
        timestamp: new Date().toISOString()
      });
      console.error(`🔴 [${type.toUpperCase()}] ${text}`);
      if (location.url) {
        console.error(`   位置: ${location.url}:${location.lineNumber}:${location.columnNumber}`);
      }
    } else if (type === 'warning') {
      consoleWarnings.push({
        text,
        type,
        location,
        timestamp: new Date().toISOString()
      });
      console.warn(`🟡 [${type.toUpperCase()}] ${text}`);
    }
  });

  // 监听页面错误
  page.on('pageerror', error => {
    const errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    pageErrors.push(errorInfo);
    console.error('🚨 [页面错误]', errorInfo);
  });

  // 监听网络错误
  page.on('requestfailed', request => {
    const failure = request.failure();
    const errorInfo = {
      url: request.url(),
      method: request.method(),
      failure: failure,
      timestamp: new Date().toISOString()
    };
    networkErrors.push(errorInfo);
    console.error('🌐 [网络错误]', errorInfo);
  });

  try {
    // 访问应用
    console.log('📍 访问 http://localhost:5179');
    await page.goto('http://localhost:5179', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待页面加载
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ 页面加载完成');

    // 等待一段时间捕获异步错误
    console.log('⏳ 等待异步错误...');
    await page.waitForTimeout(10000);

    // 检查页面标题
    const title = await page.title();
    console.log(`📄 页面标题: ${title}`);

    // 尝试一些基本操作
    console.log('🔄 尝试基本操作...');

    // 查找并点击创建按钮
    try {
      const createButton = await page.locator('button').filter({ hasText: /创建|新建|添加/i }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
        console.log('✅ 点击了创建按钮');
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      console.log('⚠️ 未找到创建按钮或点击失败:', e.message);
    }

    // 查找并点击设置按钮
    try {
      const settingsButton = await page.locator('button[aria-label*="设置"], button[title*="设置"], .settings-btn, [class*="settings"]').first();
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        console.log('✅ 点击了设置按钮');
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      console.log('⚠️ 未找到设置按钮或点击失败:', e.message);
    }

    // 再次等待捕获错误
    await page.waitForTimeout(5000);

    // 生成错误报告
    console.log('\n' + '='.repeat(80));
    console.log('📊 CARDALL控制台错误检查报告');
    console.log('='.repeat(80));
    console.log(`📅 检查时间: ${new Date().toLocaleString()}`);
    console.log(`🌐 页面URL: ${page.url()}`);
    console.log(`📄 页面标题: ${title}`);
    console.log('');

    // 错误统计
    console.log('📈 错误统计:');
    console.log(`🔴 控制台错误: ${consoleErrors.length} 个`);
    console.log(`🟡 控制台警告: ${consoleWarnings.length} 个`);
    console.log(`🚨 页面错误: ${pageErrors.length} 个`);
    console.log(`🌐 网络错误: ${networkErrors.length} 个`);
    console.log('');

    // 详细错误信息
    if (consoleErrors.length > 0) {
      console.log('🔴 控制台错误详情:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.text}`);
        if (error.location.url) {
          console.log(`   位置: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
        }
        console.log(`   时间: ${error.timestamp}`);
        console.log('');
      });
    }

    if (pageErrors.length > 0) {
      console.log('🚨 页面错误详情:');
      pageErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.name}] ${error.message}`);
        if (error.stack) {
          console.log(`   堆栈: ${error.stack.split('\n')[0]}`);
        }
        console.log(`   时间: ${error.timestamp}`);
        console.log('');
      });
    }

    if (networkErrors.length > 0) {
      console.log('🌐 网络错误详情:');
      networkErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.method} ${error.url}`);
        console.log(`   错误: ${error.failure.errorText}`);
        console.log(`   时间: ${error.timestamp}`);
        console.log('');
      });
    }

    if (consoleWarnings.length > 0) {
      console.log('🟡 控制台警告详情:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.text}`);
        if (warning.location.url) {
          console.log(`   位置: ${warning.location.url}:${warning.location.lineNumber}:${warning.location.columnNumber}`);
        }
        console.log(`   时间: ${warning.timestamp}`);
        console.log('');
      });
    }

    // 保存详细报告
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      title: title,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      networkErrors,
      summary: {
        totalErrors: consoleErrors.length + pageErrors.length + networkErrors.length,
        totalWarnings: consoleWarnings.length
      }
    };

    console.log('📋 完整错误报告 (JSON):');
    console.log(JSON.stringify(report, null, 2));

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 控制台错误检查完成');
  }
}

// 运行检查
checkConsoleErrors().catch(console.error);