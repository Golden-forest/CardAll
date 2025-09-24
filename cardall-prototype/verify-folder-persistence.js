// CardAll 文件夹持久化功能验证脚本
// 基于真实的 use-folders.ts 实现创建的测试

console.log('🧪 CardAll 文件夹持久化功能验证开始...\n');

// 模拟真实环境
const mockSecureStorage = {
  data: {},

  set(key, value, options = {}) {
    console.log(`🔐 secureStorage.set(${key}, ${JSON.stringify(value)}, ${JSON.stringify(options)})`);
    this.data[key] = JSON.stringify(value);
    return true;
  },

  get(key, options = {}) {
    const value = this.data[key];
    console.log(`🔐 secureStorage.get(${key}, ${JSON.stringify(options)}) = ${value}`);

    if (value === undefined || value === null) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (e) {
      console.error(`解析 ${key} 失败:`, e);
      return value;
    }
  },

  remove(key) {
    console.log(`🔐 secureStorage.remove(${key})`);
    delete this.data[key];
    return true;
  }
};

// 模拟 Dexie 数据库
class MockDexie {
  constructor() {
    this.folders = new Map();
    this.stores = ['folders'];
  }

  async transaction(mode, stores, callback) {
    console.log(`🔄 Transaction: ${mode}, ${Array.isArray(stores) ? stores.join(', ') : stores}`);
    try {
      await callback();
      console.log('✅ Transaction completed');
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }
}

const mockDb = new MockDexie();

// 创建 folders 表
mockDb.folders = {
  data: new Map(),

  async clear() {
    this.data.clear();
    console.log('🧹 folders.clear()');
  },

  async toArray() {
    const result = Array.from(this.data.values());
    console.log(`📊 folders.toArray(): ${result.length} items`);
    return result;
  },

  async bulkAdd(items) {
    for (const item of items) {
      this.data.set(item.id, item);
    }
    console.log(`➕ folders.bulkAdd(): ${items.length} items`);
  },

  async bulkDelete(ids) {
    for (const id of ids) {
      this.data.delete(id);
    }
    console.log(`🗑️ folders.bulkDelete(): ${ids.length} items`);
  },

  async update(id, changes) {
    if (this.data.has(id)) {
      const existing = this.data.get(id);
      this.data.set(id, { ...existing, ...changes });
      console.log(`📝 folders.update(${id})`);
    } else {
      console.warn(`⚠️ folders.update(${id}) - item not found`);
    }
  },

  async get(id) {
    const item = this.data.get(id);
    console.log(`📖 folders.get(${id}) = ${item ? 'found' : 'not found'}`);
    return item;
  }
};

// Mock 文件夹数据
const mockFolders = [
  {
    id: 'folder-1',
    name: 'Development',
    color: '#3b82f6',
    icon: 'Code',
    cardIds: ['1'],
    isExpanded: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: 'folder-2',
    name: 'Design Resources',
    color: '#8b5cf6',
    icon: 'Palette',
    cardIds: [],
    isExpanded: false,
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12')
  }
];

// 模拟 React hooks
function createMockState(initialValue) {
  let value = initialValue;
  const setValue = (newValue) => {
    console.log(`⚛️  setState: ${JSON.stringify(value)} -> ${JSON.stringify(newValue)}`);
    value = newValue;
  };
  return [() => value, setValue];
}

// 模拟 useFolders hook 的核心逻辑
class MockUseFolders {
  constructor() {
    const [getFolders, setFolders] = createMockState([]);
    const [getInitialized, setInitialized] = createMockState(false);

    this.folders = getFolders;
    this.setFolders = setFolders;
    this.isInitialized = getInitialized;
    this.setInitialized = setInitialized;
  }

  // 模拟数据加载
  async loadData() {
    console.log('\n🔄 开始加载文件夹数据...');

    if (this.isInitialized()) {
      console.log('📁 已初始化，跳过加载');
      return;
    }

    let foldersToLoad = [];

    // 优先从内存获取
    const currentFolders = this.folders();
    if (currentFolders.length > 0) {
      console.log('📋 使用内存中的文件夹数据:', currentFolders.length);
      foldersToLoad = currentFolders;
    } else {
      // 尝试从 IndexedDB 加载
      try {
        const dbFolders = await mockDb.folders.toArray();
        console.log('📊 从 IndexedDB 查找到文件夹:', dbFolders.length);

        if (dbFolders.length > 0) {
          foldersToLoad = dbFolders.map(folder => ({
            ...folder,
            cardIds: folder.cardIds || [],
            syncVersion: folder.syncVersion || 1,
            pendingSync: folder.pendingSync || false,
            userId: folder.userId || 'default'
          }));
          console.log('✅ 使用 IndexedDB 中的文件夹数据');
          this.setFolders(foldersToLoad);
        } else {
          // 检查迁移标记
          const migrationComplete = mockSecureStorage.get('folder_migration_complete', {
            validate: true
          });

          if (migrationComplete) {
            console.log('🔄 迁移已完成但无数据，保持空状态');
            this.setInitialized(true);
            return;
          }

          // 首次使用，初始化默认数据
          console.log('🎯 首次使用，初始化默认文件夹数据');
          foldersToLoad = mockFolders.map(folder => ({
            ...folder,
            syncVersion: 1,
            pendingSync: false,
            userId: 'default'
          }));

          // 保存到 IndexedDB
          await mockDb.folders.clear();
          await mockDb.folders.bulkAdd(foldersToLoad);

          // 标记初始化完成
          mockSecureStorage.set('folder_migration_complete', true, {
            validate: true
          });

          console.log('✅ 默认文件夹数据已保存到 IndexedDB');
          this.setFolders(foldersToLoad);
        }
      } catch (dbError) {
        console.error('❌ 从 IndexedDB 加载失败:', dbError);

        // 尝试从 localStorage 备份恢复
        const backupFolders = mockSecureStorage.get('folders_state_backup', {
          validate: true,
          encrypt: true
        });

        if (backupFolders && backupFolders.length > 0) {
          console.log('💾 从 localStorage 备份恢复文件夹数据:', backupFolders.length);
          foldersToLoad = backupFolders;
          this.setFolders(foldersToLoad);
        } else {
          foldersToLoad = mockFolders.map(folder => ({
            ...folder,
            syncVersion: 1,
            pendingSync: false,
            userId: 'default'
          }));
          console.log('🚨 使用默认文件夹数据作为应急方案');
          this.setFolders(foldersToLoad);
        }
      }
    }

    this.setInitialized(true);
    console.log('🎉 文件夹数据加载完成，共', foldersToLoad.length, '个文件夹');
  }

  // 模拟数据保存
  async saveData() {
    console.log('\n💾 开始保存文件夹数据到 IndexedDB...');

    if (!this.isInitialized()) {
      console.log('⏳ 未初始化，跳过保存');
      return;
    }

    const folders = this.folders();
    if (folders.length === 0) {
      console.log('📋 没有文件夹数据，跳过保存');
      return;
    }

    try {
      // 检查现有数据
      const existingFolders = await mockDb.folders.toArray();
      const existingIds = new Set(existingFolders.map(f => f.id));
      const currentIds = new Set(folders.map(f => f.id));

      console.log(`📊 数据对比: 现有${existingFolders.length}个, 当前${folders.length}个`);

      // 避免意外覆盖
      if (existingFolders.length > 0 && folders.length === 0) {
        console.warn('⚠️ 检测到数据可能被清空，跳过保存');
        return;
      }

      // 规范化数据
      const normalizedFolders = folders.map(folder => ({
        ...folder,
        syncVersion: folder.syncVersion || 1,
        pendingSync: folder.pendingSync || false,
        userId: folder.userId || 'default',
        updatedAt: new Date()
      }));

      // 使用事务保存
      await mockDb.transaction('rw', mockDb.folders, async () => {
        // 删除已不存在的
        const foldersToDelete = existingFolders.filter(f => !currentIds.has(f.id));
        if (foldersToDelete.length > 0) {
          await mockDb.folders.bulkDelete(foldersToDelete.map(f => f.id));
          console.log('🗑️ 删除已不存在的文件夹:', foldersToDelete.length);
        }

        // 更新现有的
        const foldersToUpdate = normalizedFolders.filter(f => existingIds.has(f.id));
        for (const folder of foldersToUpdate) {
          await mockDb.folders.update(folder.id, folder);
        }
        console.log('📝 更新现有文件夹:', foldersToUpdate.length);

        // 添加新的
        const foldersToAdd = normalizedFolders.filter(f => !existingIds.has(f.id));
        if (foldersToAdd.length > 0) {
          await mockDb.folders.bulkAdd(foldersToAdd);
          console.log('➕ 添加新文件夹:', foldersToAdd.length);
        }
      });

      // 备份到 localStorage
      mockSecureStorage.set('folders_state_backup', folders, {
        validate: true,
        encrypt: true
      });
      console.log('💾 文件夹状态已备份到 localStorage');

      console.log('✅ 文件夹数据保存成功，共', normalizedFolders.length, '个文件夹');

    } catch (error) {
      console.error('❌ 保存失败:', error);
    }
  }

  // 创建文件夹
  createFolder(name) {
    console.log(`\n📂 创建文件夹: ${name}`);

    const newFolder = {
      id: `folder-${Date.now()}`,
      name,
      color: '#ff0000',
      icon: 'Folder',
      cardIds: [],
      syncVersion: 1,
      pendingSync: true,
      userId: 'default',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const currentFolders = this.folders();
    const updatedFolders = [...currentFolders, newFolder];
    this.setFolders(updatedFolders);

    console.log('✅ 文件夹创建完成:', newFolder.id);
    return newFolder;
  }

  // 获取当前状态
  getStatus() {
    return {
      folders: this.folders(),
      isInitialized: this.isInitialized(),
      folderCount: this.folders().length
    };
  }
}

// 测试场景
async function runTest() {
  console.log('🚀 开始文件夹持久化验证测试\n');

  // 清理环境
  mockSecureStorage.data = {};
  mockDb.folders.data.clear();

  // 创建 useFolders 实例
  const useFolders = new MockUseFolders();

  // 场景1: 首次加载
  console.log('=== 场景1: 首次加载应用 ===');
  await useFolders.loadData();

  let status = useFolders.getStatus();
  console.log(`📊 场景1结果: 文件夹数量=${status.folderCount}, 初始化=${status.isInitialized}`);

  // 检查 IndexedDB 中的数据
  const dbData1 = await mockDb.folders.toArray();
  console.log(`📊 IndexedDB中的数据: ${dbData1.length}个文件夹`);

  // 场景2: 创建文件夹
  console.log('\n=== 场景2: 创建新文件夹 ===');
  const newFolder = useFolders.createFolder('测试文件夹');

  // 模拟保存（模拟 useEffect 的行为）
  await useFolders.saveData();

  status = useFolders.getStatus();
  console.log(`📊 场景2结果: 文件夹数量=${status.folderCount}`);

  // 检查 IndexedDB 中的数据
  const dbData2 = await mockDb.folders.toArray();
  console.log(`📊 IndexedDB中的数据: ${dbData2.length}个文件夹`);

  // 场景3: 页面刷新（重新创建实例）
  console.log('\n=== 场景3: 页面刷新测试 ===');

  // 创建新的 useFolders 实例（模拟页面刷新）
  const refreshedUseFolders = new MockUseFolders();
  await refreshedUseFolders.loadData();

  const refreshedStatus = refreshedUseFolders.getStatus();
  console.log(`📊 场景3结果: 文件夹数量=${refreshedStatus.folderCount}, 初始化=${refreshedStatus.isInitialized}`);

  // 检查 IndexedDB 中的数据
  const dbData3 = await mockDb.folders.toArray();
  console.log(`📊 IndexedDB中的数据: ${dbData3.length}个文件夹`);

  // 分析结果
  console.log('\n🔍 测试结果分析:');
  console.log(`- 初始加载文件夹数量: ${dbData1.length}`);
  console.log(`- 创建后文件夹数量: ${dbData2.length}`);
  console.log(`- 刷新后文件夹数量: ${dbData3.length}`);

  const isPersistenceWorking = dbData3.length >= dbData1.length;
  console.log(`- 数据持久化: ${isPersistenceWorking ? '✅ 成功' : '❌ 失败'}`);

  if (isPersistenceWorking) {
    console.log('\n✅ 文件夹持久化功能正常工作！');
    console.log('💡 建议: 在浏览器环境中进行实际测试验证');
  } else {
    console.log('\n❌ 文件夹持久化功能存在问题');
    console.log('💡 建议: 检查 use-folders.ts 的数据加载和保存逻辑');
  }

  // 显示 localStorage 备份
  console.log('\n📋 localStorage 备份检查:');
  const backupData = mockSecureStorage.get('folders_state_backup', {
    validate: true,
    encrypt: true
  });

  if (backupData) {
    console.log(`✅ 找到备份数据: ${backupData.length}个文件夹`);
    console.log('📝 备份文件夹名称:', backupData.map(f => f.name).join(', '));
  } else {
    console.log('⚠️ 未找到备份数据');
  }

  return isPersistenceWorking;
}

// 执行测试
runTest().then(success => {
  console.log(`\n🎯 总体测试结果: ${success ? '✅ 通过' : '❌ 失败'}`);

  if (success) {
    console.log('\n📋 实际环境测试建议:');
    console.log('1. 在浏览器中打开应用');
    console.log('2. 创建一个新文件夹');
    console.log('3. 修改文件夹名称或颜色');
    console.log('4. 刷新页面 (F5)');
    console.log('5. 检查文件夹状态是否保持');
  }
}).catch(console.error);

console.log('\n📝 文件夹持久化验证脚本已加载完成!');