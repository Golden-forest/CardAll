/**
 * 模拟真实用户使用场景，测试文件夹持久化问题
 */

// 模拟浏览器环境
const mockBrowser = {
  localStorage: {
    data: {},
    setItem(key, value) {
      this.data[key] = String(value);
      console.log(`📝 localStorage.setItem(${key}, ${value})`);
    },
    getItem(key) {
      const value = this.data[key] || null;
      console.log(`📖 localStorage.getItem(${key}) = ${value}`);
      return value;
    },
    removeItem(key) {
      delete this.data[key];
      console.log(`🗑️ localStorage.removeItem(${key})`);
    },
    clear() {
      this.data = {};
      console.log('🧹 localStorage.clear()');
    }
  },
  indexedDB: {
    folders: [],
    async clear() {
      this.folders = [];
      console.log('🧹 IndexedDB cleared');
    },
    async toArray() {
      console.log(`📊 IndexedDB.toArray(): ${this.folders.length} folders`);
      return [...this.folders];
    },
    async bulkAdd(items) {
      this.folders.push(...items);
      console.log(`➕ IndexedDB.bulkAdd(): ${items.length} folders`);
    },
    async bulkDelete(ids) {
      this.folders = this.folders.filter(f => !ids.includes(f.id));
      console.log(`🗑️ IndexedDB.bulkDelete(): ${ids.length} folders`);
    },
    async update(id, updates) {
      const index = this.folders.findIndex(f => f.id === id);
      if (index !== -1) {
        this.folders[index] = { ...this.folders[index], ...updates };
        console.log(`📝 IndexedDB.update(): ${id}`);
      }
    }
  }
};

// 创建正确的数据库对象结构
const mockDb = {
  folders: {
    clear: mockBrowser.indexedDB.clear.bind(mockBrowser.indexedDB),
    toArray: mockBrowser.indexedDB.toArray.bind(mockBrowser.indexedDB),
    bulkAdd: mockBrowser.indexedDB.bulkAdd.bind(mockBrowser.indexedDB),
    bulkDelete: mockBrowser.indexedDB.bulkDelete.bind(mockBrowser.indexedDB),
    update: mockBrowser.indexedDB.update.bind(mockBrowser.indexedDB)
  },
  transaction: (mode, stores, callback) => {
    console.log(`🔄 事务开始: ${mode}, ${Array.isArray(stores) ? stores.join(',') : stores}`);
    return callback();
  }
};

// 全局对象模拟
global.localStorage = mockBrowser.localStorage;
global.db = mockDb;

// 模拟 secureStorage
const secureStorage = {
  set(key, value, options = {}) {
    console.log(`🔐 secureStorage.set(${key}, ${JSON.stringify(value)})`);
    mockBrowser.localStorage.setItem(key, JSON.stringify(value));
  },
  get(key, options = {}) {
    const value = mockBrowser.localStorage.getItem(key);
    console.log(`🔐 secureStorage.get(${key}) = ${value}`);
    return value ? JSON.parse(value) : null;
  },
  remove(key) {
    console.log(`🔐 secureStorage.remove(${key})`);
    mockBrowser.localStorage.removeItem(key);
  }
};

// 模拟 React useState
function useState(initialValue) {
  let currentValue = initialValue;
  const setState = (newValue) => {
    console.log(`⚛️  useState update: ${JSON.stringify(currentValue)} -> ${JSON.stringify(newValue)}`);
    currentValue = newValue;
  };
  return [currentValue, setState];
}

// 模拟 React useEffect
function useEffect(callback, deps) {
  console.log(`⚛️  useEffect triggered, deps: ${JSON.stringify(deps)}`);
  callback();
}

// 模拟 React useCallback
function useCallback(callback, deps) {
  console.log(`⚛️  useCallback created, deps: ${JSON.stringify(deps)}`);
  return callback;
}

// Mock 数据
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

// 模拟 useFolders hook 的简化版本
function useFolders() {
  console.log('\n🚀 useFolders() 被调用');

  const [folders, setFolders] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConsistent, setIsConsistent] = useState(true);

  console.log(`📊 当前状态: folders=${folders.length}, isInitialized=${isInitialized}, isConsistent=${isConsistent}`);

  // 数据加载逻辑
  const loadFolders = async () => {
    console.log('\n🔄 开始加载文件夹数据...');

    if (isInitialized && folders.length > 0) {
      console.log('📁 文件夹数据已初始化且不为空，跳过加载');
      return;
    }

    try {
      let foldersToLoad = [];

      // 首先检查当前内存中是否已有数据
      if (folders.length > 0) {
        console.log('📋 内存中已有文件夹数据，跳过重新加载');
        setIsInitialized(true);
        return;
      }

      // 尝试从 IndexedDB 加载数据
      try {
        const dbFolders = await db.folders.toArray();
        console.log(`📊 从 IndexedDB 查找到文件夹: ${dbFolders.length}`);

        if (dbFolders.length > 0) {
          // 确保数据格式正确，添加默认同步字段
          foldersToLoad = dbFolders.map(folder => ({
            ...folder,
            syncVersion: folder.syncVersion || 1,
            pendingSync: folder.pendingSync || false,
            userId: folder.userId || 'default'
          }));
          console.log('✅ 使用 IndexedDB 中的文件夹数据');
        } else {
          // 检查是否有迁移标记，避免重复初始化默认数据
          const migrationComplete = secureStorage.get<boolean>('folder_migration_complete', {
            validate: true
          });

          if (migrationComplete) {
            console.log('🔄 迁移已完成但无数据，可能数据被清空，保持空状态');
            setIsInitialized(true);
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

          // 保存默认数据到 IndexedDB
          await db.folders.clear();
          await db.folders.bulkAdd(foldersToLoad);

          // 标记初始化完成
          secureStorage.set('folder_migration_complete', true, {
            validate: true
          });

          console.log('✅ 默认文件夹数据已保存到 IndexedDB');
        }
      } catch (dbError) {
        console.error('❌ 从 IndexedDB 加载失败:', dbError);

        // 数据库访问失败时，如果内存中有数据则保留，否则使用默认数据
        if (folders.length > 0) {
          console.log('⚠️ 数据库访问失败，保留内存中的现有数据');
          setIsInitialized(true);
          return;
        }

        // 只有在完全没有数据时才使用默认数据
        foldersToLoad = mockFolders.map(folder => ({
          ...folder,
          syncVersion: 1,
          pendingSync: false,
          userId: 'default'
        }));
        console.log('🚨 使用默认文件夹数据作为应急方案');
      }

      // 只有在确实有新数据时才更新状态
      if (foldersToLoad.length > 0 || folders.length === 0) {
        setFolders(foldersToLoad);
        setIsInitialized(true);
        console.log(`🎉 文件夹数据加载完成，共 ${foldersToLoad.length} 个文件夹`);
      } else {
        setIsInitialized(true);
      }

    } catch (error) {
      console.error('❌ 加载文件夹数据失败:', error);

      // 只有在完全失败且没有现有数据时才使用默认数据
      if (folders.length === 0) {
        const fallbackFolders = mockFolders.map(folder => ({
          ...folder,
          syncVersion: 1,
          pendingSync: false,
          userId: 'default'
        }));

        setFolders(fallbackFolders);
        setIsInitialized(true);
        console.log('🚨 使用应急默认文件夹数据');
      } else {
        console.log('🛡️ 加载失败但保留现有数据');
        setIsInitialized(true);
      }
    }
  };

  // 数据保存逻辑
  const saveFolders = async () => {
    console.log('\n💾 开始保存文件夹数据到 IndexedDB...');

    if (!isInitialized) {
      console.log('⏳ 数据初始化未完成，跳过保存操作');
      return;
    }

    if (folders.length === 0) {
      console.log('📋 没有文件夹数据，跳过保存操作');
      return;
    }

    try {
      // 先检查 IndexedDB 中是否已有数据，避免意外覆盖
      const existingFolders = await db.folders.toArray();
      const existingIds = new Set(existingFolders.map(f => f.id));
      const currentIds = new Set(folders.map(f => f.id));

      console.log(`📊 数据对比: 现有${existingFolders.length}个, 当前${folders.length}个`);

      // 如果 IndexedDB 中有数据但当前没有数据，可能是数据被意外清空，不执行保存
      if (existingFolders.length > 0 && folders.length === 0) {
        console.warn('⚠️ 检测到数据可能被清空，跳过保存以避免覆盖');
        return;
      }

      // 确保所有文件夹都有必要的同步字段
      const normalizedFolders = folders.map(folder => ({
        ...folder,
        syncVersion: folder.syncVersion || 1,
        pendingSync: folder.pendingSync || false,
        userId: folder.userId || 'default',
        updatedAt: new Date()
      }));

      // 使用事务确保数据一致性
      await db.transaction('rw', db.folders, async () => {
        // 只有在当前数据与现有数据不同时才执行删除操作
        if (currentIds.size > 0) {
          // 删除已不存在的文件夹
          const foldersToDelete = existingFolders.filter(f => !currentIds.has(f.id));
          if (foldersToDelete.length > 0) {
            await db.folders.bulkDelete(foldersToDelete.map(f => f.id));
            console.log(`🗑️ 删除已不存在的文件夹: ${foldersToDelete.length}`);
          }
        }

        // 更新现有文件夹
        const foldersToUpdate = normalizedFolders.filter(f => existingIds.has(f.id));
        for (const folder of foldersToUpdate) {
          await db.folders.update(folder.id, folder);
        }
        console.log(`📝 更新现有文件夹: ${foldersToUpdate.length}`);

        // 添加新文件夹
        const foldersToAdd = normalizedFolders.filter(f => !existingIds.has(f.id));
        if (foldersToAdd.length > 0) {
          await db.folders.bulkAdd(foldersToAdd);
          console.log(`➕ 添加新文件夹: ${foldersToAdd.length}`);
        }
      });

      console.log(`✅ 文件夹数据保存成功，共 ${normalizedFolders.length} 个文件夹`);

    } catch (error) {
      console.error('❌ 保存文件夹数据到 IndexedDB 失败:', error);
    }
  };

  // 模拟文件夹操作
  const createFolder = (name) => {
    console.log(`\n📂 创建文件夹: ${name}`);

    const newFolder = {
      id: `folder-${Date.now()}`,
      name,
      color: '#ff0000',
      icon: 'Folder',
      cardIds: [],
      syncVersion: 1,
      pendingSync: false,
      userId: 'default',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);

    console.log(`✅ 文件夹创建完成: ${newFolder.id}`);
    return newFolder;
  };

  // 模拟页面刷新
  const pageRefresh = () => {
    console.log('\n🔄 模拟页面刷新...');
    console.log('==========================');

    // 重置所有状态（模拟页面刷新）
    const [newFolders, newSetFolders] = useState([]);
    const [newIsInitialized, newSetIsInitialized] = useState(false);
    const [newIsConsistent, newSetIsConsistent] = useState(true);

    // 重新调用 useFolders
    return useFolders();
  };

  // 初始化
  useEffect(() => {
    console.log('\n🎯 useEffect - 初始化加载数据');
    loadFolders();
  }, [isInitialized, folders.length]);

  // 保存数据
  useEffect(() => {
    console.log('\n💾 useEffect - 保存数据');
    setTimeout(saveFolders, 100); // 模拟防抖
  }, [folders, isInitialized]);

  return {
    folders,
    isInitialized,
    createFolder,
    pageRefresh
  };
}

// 测试场景
console.log('🧪 开始文件夹持久化测试\n');

// 场景1: 初始加载
console.log('=== 场景1: 首次加载应用 ===');
let { folders, isInitialized, createFolder, pageRefresh } = useFolders();

// 等待一下让异步操作完成
setTimeout(async () => {
  console.log(`\n📊 场景1结果: 文件夹数量=${folders.length}, 初始化=${isInitialized}`);

  // 显示 IndexedDB 中的数据
  const dbData = await db.folders.toArray();
  console.log(`📊 IndexedDB中的数据: ${dbData.length}个文件夹`);

  // 场景2: 创建文件夹
  console.log('\n=== 场景2: 创建新文件夹 ===');
  const newFolder = createFolder('测试文件夹');

  setTimeout(async () => {
    console.log(`\n📊 场景2结果: 文件夹数量=${folders.length}`);

    // 检查 IndexedDB 中的数据
    const dbDataAfterCreate = await db.folders.toArray();
    console.log(`📊 IndexedDB中的数据: ${dbDataAfterCreate.length}个文件夹`);

    // 场景3: 页面刷新
    console.log('\n=== 场景3: 页面刷新测试 ===');

    // 重新创建 useFolders 实例（模拟页面刷新）
    const refreshedState = pageRefresh();

    setTimeout(async () => {
      console.log(`\n📊 场景3结果: 文件夹数量=${refreshedState.folders.length}, 初始化=${refreshedState.isInitialized}`);

      // 检查 IndexedDB 中的数据
      const dbDataAfterRefresh = await db.folders.toArray();
      console.log(`📊 IndexedDB中的数据: ${dbDataAfterRefresh.length}个文件夹`);

      // 比较结果
      console.log('\n🔍 测试结果分析:');
      console.log(`- 刷新前文件夹数量: ${dbDataAfterCreate.length}`);
      console.log(`- 刷新后文件夹数量: ${dbDataAfterRefresh.length}`);
      console.log(`- 数据是否保持: ${dbDataAfterCreate.length === dbDataAfterRefresh.length ? '✅ 成功' : '❌ 失败'}`);

      if (dbDataAfterCreate.length !== dbDataAfterRefresh.length) {
        console.log('\n❌ 问题诊断:');
        console.log('1. 检查 migrationComplete 标记:', secureStorage.get('folder_migration_complete'));
        console.log('2. 检查是否有重复初始化逻辑');
        console.log('3. 检查数据加载时的条件判断');
      }

    }, 500);
  }, 200);
}, 100);