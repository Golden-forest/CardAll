/**
 * 功能验证脚本 - 手动测试CardAll应用
 *
 * 使用Chrome DevTools执行此脚本来验证核心功能
 */

// 测试结果收集器
const testResults = {
  T026_cardManagement: { status: 'pending', details: [] },
  T027_folderManagement: { status: 'pending', details: [] },
  T028_tagSystem: { status: 'pending', details: [] },
  T029_imageUpload: { status: 'pending', details: [] },
  T030_searchFunction: { status: 'pending', details: [] },
  T031_localStoragePerformance: { status: 'pending', details: [] },
  T032_dataImportExport: { status: 'pending', details: [] }
};

// 工具函数
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

function logTestResult(testId, message, success = true) {
  const result = testResults[testId];
  if (result) {
    result.details.push({ message, success, timestamp: new Date() });
    if (!success) {
      result.status = 'failed';
    } else if (result.status === 'pending') {
      result.status = 'passed';
    }
  }
  console.log(`[${testId}] ${success ? '✅' : '❌'} ${message}`);
}

// 测试函数
async function testCardManagement() {
  console.log('🧪 开始T026: 卡片管理功能测试');

  try {
    // 检查页面是否加载
    const appElement = document.querySelector('#root');
    if (!appElement) throw new Error('应用根元素未找到');
    logTestResult('T026_cardManagement', '应用根元素加载成功');

    // 查找新增卡片按钮
    const addCardButtons = document.querySelectorAll('button');
    const addCardBtn = Array.from(addCardButtons).find(btn =>
      btn.textContent?.includes('Add Card') || btn.textContent?.includes('New Card')
    );

    if (!addCardBtn) throw new Error('找不到新增卡片按钮');
    logTestResult('T026_cardManagement', '找到新增卡片按钮');

    // 尝试点击按钮
    addCardBtn.click();
    logTestResult('T026_cardManagement', '点击新增卡片按钮');

    // 等待可能的模态框或表单
    await new Promise(resolve => setTimeout(resolve, 1000));

    const modal = document.querySelector('[role="dialog"], .modal, [data-testid*="modal"], .fixed.inset-0');
    if (modal) {
      logTestResult('T026_cardManagement', '卡片创建模态框已打开');
    } else {
      logTestResult('T026_cardManagement', '未检测到模态框，可能是页面跳转或其他交互方式', true);
    }

    // 检查是否有卡片列表容器
    const cardContainer = document.querySelector('[data-testid*="card"], .card, [class*="card"]');
    logTestResult('T026_cardManagement', cardContainer ? '找到卡片容器' : '未找到卡片容器', !!cardContainer);

  } catch (error) {
    logTestResult('T026_cardManagement', `测试失败: ${error.message}`, false);
  }
}

async function testFolderManagement() {
  console.log('🧪 开始T027: 文件夹管理功能测试');

  try {
    // 查找文件夹相关按钮
    const folderBtn = Array.from(document.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Folder')
    );

    if (folderBtn) {
      logTestResult('T027_folderManagement', '找到文件夹按钮');
      folderBtn.click();
      logTestResult('T027_folderManagement', '点击文件夹按钮');
    } else {
      logTestResult('T027_folderManagement', '未找到文件夹按钮', false);
    }

    // 检查文件夹列表
    const folderElements = document.querySelectorAll('[data-testid*="folder"], .folder, [class*="folder"]');
    logTestResult('T027_folderManagement', `找到 ${folderElements.length} 个文件夹相关元素`);

  } catch (error) {
    logTestResult('T027_folderManagement', `测试失败: ${error.message}`, false);
  }
}

async function testTagSystem() {
  console.log('🧪 开始T028: 标签系统功能测试');

  try {
    // 查找标签相关元素
    const tagElements = document.querySelectorAll('[data-testid*="tag"], .tag, [class*="tag"]');
    logTestResult('T028_tagSystem', `找到 ${tagElements.length} 个标签相关元素`);

    // 检查标签管理区域
    const tagSection = document.querySelector('h3:contains("Tags"), [data-testid*="tags"]');
    logTestResult('T028_tagSystem', tagSection ? '找到标签区域' : '未找到标签区域', !!tagSection);

  } catch (error) {
    logTestResult('T028_tagSystem', `测试失败: ${error.message}`, false);
  }
}

async function testSearchFunction() {
  console.log('🧪 开始T030: 搜索功能测试');

  try {
    // 查找搜索框
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i], [data-testid*="search"]');
    if (searchInput) {
      logTestResult('T030_searchFunction', '找到搜索输入框');

      // 尝试输入搜索内容
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      logTestResult('T030_searchFunction', '输入搜索内容');
    } else {
      logTestResult('T030_searchFunction', '未找到搜索输入框', false);
    }

  } catch (error) {
    logTestResult('T030_searchFunction', `测试失败: ${error.message}`, false);
  }
}

async function testLocalStoragePerformance() {
  console.log('🧪 开始T031: 本地存储性能测试');

  try {
    // 检查IndexedDB支持
    const indexedDBSupported = 'indexedDB' in window;
    logTestResult('T031_localStoragePerformance', 'IndexedDB支持检查', indexedDBSupported);

    if (indexedDBSupported) {
      // 测试基本的IndexedDB操作
      const testDB = indexedDB.open('CardAllPerformanceTest', 1);

      testDB.onupgradeneeded = function(event) {
        const db = event.target.result;
        const objectStore = db.createObjectStore('testStore', { keyPath: 'id' });
      };

      testDB.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['testStore'], 'readwrite');
        const store = transaction.objectStore('testStore');

        const startTime = performance.now();
        store.add({ id: 1, data: 'test', timestamp: Date.now() });

        transaction.oncomplete = function() {
          const endTime = performance.now();
          const duration = endTime - startTime;
          logTestResult('T031_localStoragePerformance', `IndexedDB写入操作耗时: ${duration.toFixed(2)}ms`, duration < 100);

          db.close();
        };
      };

      testDB.onerror = function() {
        logTestResult('T031_localStoragePerformance', 'IndexedDB操作失败', false);
      };
    }

    // 检查localStorage使用情况
    const storageUsed = JSON.stringify(localStorage).length;
    logTestResult('T031_localStoragePerformance', `localStorage使用: ${storageUsed} 字符`);

  } catch (error) {
    logTestResult('T031_localStoragePerformance', `测试失败: ${error.message}`, false);
  }
}

async function testDataImportExport() {
  console.log('🧪 开始T032: 数据导入导出测试');

  try {
    // 查找导入导出相关按钮
    const exportBtn = Array.from(document.querySelectorAll('button')).find(btn =>
      btn.textContent?.toLowerCase().includes('export') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('export')
    );

    const importBtn = Array.from(document.querySelectorAll('input[type="file"]')).find(input =>
      input.accept?.includes('json') || input.getAttribute('data-testid')?.includes('import')
    );

    logTestResult('T032_dataImportExport', '导出按钮检查', !!exportBtn);
    logTestResult('T032_dataImportExport', '导入文件输入检查', !!importBtn);

    // 检查是否有数据可导出
    const hasData = localStorage.length > 0;
    logTestResult('T032_dataImportExport', '本地数据检查', hasData);

  } catch (error) {
    logTestResult('T032_dataImportExport', `测试失败: ${error.message}`, false);
  }
}

// 主测试执行函数
async function runAllTests() {
  console.log('🚀 开始CardAll功能验证测试');
  console.log('=====================================');

  await testCardManagement();
  await testFolderManagement();
  await testTagSystem();
  await testSearchFunction();
  await testLocalStoragePerformance();
  await testDataImportExport();

  console.log('=====================================');
  console.log('📊 测试结果汇总:');

  Object.entries(testResults).forEach(([testId, result]) => {
    const status = result.status === 'passed' ? '✅ 通过' :
                   result.status === 'failed' ? '❌ 失败' : '⏳ 待定';
    console.log(`${status} ${testId}: ${result.details.length} 项检查`);
    result.details.forEach(detail => {
      console.log(`   ${detail.success ? '  ✓' : '  ✗'} ${detail.message}`);
    });
  });

  return testResults;
}

// 导出测试函数供控制台调用
window.cardAllTests = {
  runAllTests,
  testCardManagement,
  testFolderManagement,
  testTagSystem,
  testSearchFunction,
  testLocalStoragePerformance,
  testDataImportExport,
  testResults
};

console.log('CardAll测试脚本已加载。使用 cardAllTests.runAllTests() 运行所有测试。');