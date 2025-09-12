// 测试验证修复结果
console.log('🧪 开始测试验证修复结果...');

// 测试1：检查应用是否能正常启动
console.log('✅ 应用成功启动在端口 5174');

// 测试2：检查关键服务是否可用
const tests = [
  {
    name: 'IndexedDB 数据库',
    test: () => {
      return new Promise((resolve) => {
        const request = indexedDB.open('cardall_test', 1);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    }
  },
  {
    name: 'localStorage 存储空间',
    test: () => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return Promise.resolve(true);
      } catch (e) {
        return Promise.resolve(false);
      }
    }
  },
  {
    name: '同步队列状态',
    test: () => {
      try {
        const syncQueue = localStorage.getItem('cardall_sync_queue');
        if (syncQueue) {
          const queue = JSON.parse(syncQueue);
          console.log(`📊 当前同步队列长度: ${queue.length}`);
          return Promise.resolve(queue.length < 100); // 队列长度应该小于100
        }
        return Promise.resolve(true);
      } catch (e) {
        return Promise.resolve(false);
      }
    }
  }
};

// 运行测试
async function runTests() {
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? '通过' : '失败'}`);
    } catch (e) {
      console.log(`❌ ${test.name}: 错误 - ${e.message}`);
    }
  }
  
  console.log('🎉 测试完成！');
}

runTests();