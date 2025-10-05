const fs = require('fs');
const path = require('path');

// 修复所有文件中的重复export问题
const serviceFiles = [
  'src/services/file-system.ts',
  'src/services/ui/performance-monitor.ts',
  'src/services/data-converter-adapter.ts',
  'src/services/storage-adapter.ts'
];

serviceFiles.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');

      // 修复重复的export关键字
      content = content.replace(/export\s+export\s+export\s+export\s+/g, 'export interface ');
      content = content.replace(/export\s+export\s+export\s+/g, 'export ');
      content = content.replace(/export\s+export\s+/g, 'export ');

      fs.writeFileSync(filePath, content);
      console.log(`Fixed export syntax in ${filePath}`);
    }
  } catch (error) {
    console.warn(`Error fixing ${filePath}:`, error.message);
  }
});

console.log('Export syntax fixes completed');