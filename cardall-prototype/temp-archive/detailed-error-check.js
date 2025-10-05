import { chromium } from 'playwright';

async function detailedErrorCheck() {
  console.log('🔍 开始详细的CardAll错误检查...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allErrors = [];
  const detailedLogs = [];

  // 监听所有控制台消息
  page.on('console', msg => {
    const logEntry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString()
    };

    detailedLogs.push(logEntry);

    if (msg.type() === 'error') {
      allErrors.push(logEntry);
      console.error(`🔴 [ERROR] ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      console.warn(`🟡 [WARN] ${msg.text()}`);
    } else if (msg.type() === 'log') {
      console.log(`📝 [LOG] ${msg.text()}`);
    }
  });

  // 监听页面错误（JavaScript运行时错误）
  page.on('pageerror', error => {
    const errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    allErrors.push(errorInfo);
    console.error('🚨 [PAGE ERROR]', errorInfo);
  });

  // 监听请求失败
  page.on('requestfailed', request => {
    const failure = request.failure();
    const errorInfo = {
      type: 'network',
      url: request.url(),
      method: request.method(),
      status: request.response()?.status,
      failure: failure,
      timestamp: new Date().toISOString()
    };
    allErrors.push(errorInfo);
    console.error('🌐 [NETWORK ERROR]', errorInfo);
  });

  // 监听响应错误
  page.on('response', response => {
    if (response.status() >= 400) {
      const errorInfo = {
        type: 'http',
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        timestamp: new Date().toISOString()
      };
      allErrors.push(errorInfo);
      console.error('📡 [HTTP ERROR]', errorInfo);
    }
  });

  try {
    // 1. 访问应用
    console.log('📍 步骤1: 访问应用首页');
    await page.goto('http://localhost:5179', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ 页面加载完成');

    // 2. 等待初始错误
    console.log('⏳ 步骤2: 等待初始错误出现...');
    await page.waitForTimeout(5000);

    // 3. 尝试检查具体的模块
    console.log('🔧 步骤3: 检查模块加载状态');

    // 尝试执行一些JavaScript来检查模块状态
    const moduleCheck = await page.evaluate(() => {
      const checks = {
        react: typeof React !== 'undefined',
        reactDOM: typeof ReactDOM !== 'undefined',
        supabase: typeof supabase !== 'undefined',
        dexie: typeof Dexie !== 'undefined',
        framerMotion: typeof framerMotion !== 'undefined',
        cardAllContext: typeof CardAllContext !== 'undefined'
      };
      return checks;
    });

    console.log('📦 模块检查结果:', moduleCheck);

    // 4. 尝试触发更多错误
    console.log('🔄 步骤4: 尝试交互操作');

    // 检查页面是否有错误相关的元素
    const errorElements = await page.$$('[class*="error"], [class*="warning"], [role="alert"]');
    console.log(`🔍 发现 ${errorElements.length} 个可能的错误元素`);

    for (let i = 0; i < errorElements.length; i++) {
      const text = await errorElements[i].textContent();
      console.log(`错误元素 ${i + 1}:`, text);
    }

    // 5. 尝试点击按钮
    const buttons = await page.$$('button');
    console.log(`🔘 发现 ${buttons.length} 个按钮`);

    // 尝试点击前3个按钮
    for (let i = 0; i < Math.min(3, buttons.length); i++) {
      try {
        await buttons[i].click();
        console.log(`✅ 点击了按钮 ${i + 1}`);
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log(`❌ 点击按钮 ${i + 1} 失败:`, e.message);
      }
    }

    // 6. 等待更多错误
    console.log('⏳ 步骤5: 等待更多错误...');
    await page.waitForTimeout(5000);

    // 7. 检查TypeScript编译错误
    console.log('📝 步骤6: 检查编译相关错误');
    const compileErrors = allErrors.filter(error =>
      error.text?.includes('Failed to load resource') ||
      error.url?.includes('.ts') ||
      error.url?.includes('.tsx')
    );

    if (compileErrors.length > 0) {
      console.log('🔧 发现编译相关错误:');
      compileErrors.forEach((error, index) => {
        console.log(`${index + 1}.`, error);
      });
    }

    // 8. 生成详细报告
    console.log('\n' + '='.repeat(80));
    console.log('📊 CARDALL详细错误分析报告');
    console.log('='.repeat(80));
    console.log(`📅 检查时间: ${new Date().toLocaleString()}`);
    console.log(`🌐 页面URL: ${page.url()}`);
    console.log(`📄 页面标题: ${await page.title()}`);
    console.log('');

    // 错误分类统计
    const errorTypes = {
      console: allErrors.filter(e => e.type === 'error').length,
      page: allErrors.filter(e => e.name).length,
      network: allErrors.filter(e => e.type === 'network').length,
      http: allErrors.filter(e => e.type === 'http').length,
      compile: compileErrors.length
    };

    console.log('📈 错误类型统计:');
    console.log(`🔴 控制台错误: ${errorTypes.console} 个`);
    console.log(`🚨 页面错误: ${errorTypes.page} 个`);
    console.log(`🌐 网络错误: ${errorTypes.network} 个`);
    console.log(`📡 HTTP错误: ${errorTypes.http} 个`);
    console.log(`🔧 编译错误: ${errorTypes.compile} 个`);
    console.log('');

    // 详细的错误分析
    console.log('🔍 详细错误分析:');

    // 编译错误分析
    if (compileErrors.length > 0) {
      console.log('\n🔧 编译错误分析:');
      const compileErrorFiles = {};
      compileErrors.forEach(error => {
        const file = error.url?.split('/').pop() || 'unknown';
        if (!compileErrorFiles[file]) {
          compileErrorFiles[file] = [];
        }
        compileErrorFiles[file].push(error);
      });

      Object.entries(compileErrorFiles).forEach(([file, errors]) => {
        console.log(`  📁 ${file}: ${errors.length} 个错误`);
        errors.forEach((error, index) => {
          console.log(`    ${index + 1}. ${error.text || error.failure?.errorText}`);
        });
      });
    }

    // 保存完整报告
    const fullReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      title: await page.title(),
      moduleCheck,
      errorTypes,
      totalErrors: allErrors.length,
      allErrors,
      compileErrors,
      detailedLogs
    };

    console.log('\n📋 完整错误报告 (JSON格式已保存到内存)');

    // 返回报告
    return fullReport;

  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
    return { error: error.message };
  } finally {
    await browser.close();
    console.log('\n✅ 详细错误检查完成');
  }
}

// 运行检查
detailedErrorCheck().then(report => {
  console.log('\n📊 检查完成，报告已生成');
}).catch(console.error);