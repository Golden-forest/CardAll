const fs = require('fs');

const path = './src/services/universal-storage-adapter.ts';
let content = fs.readFileSync(path, 'utf8');

console.log('Original content length:', content.length);

// 移除重复的export关键字
content = content.replace(/export\s+export\s+export/g, 'export');
console.log('Fixed duplicate exports');

// 修复方法声明后的分号问题
content = content.replace(/(\})\s*\n\s*(private|public|static|async|const|let|var|if|for|while|try|catch|finally|throw|return)\s+/g, '$1;\n\n  $2 ');
console.log('Fixed method declarations');

// 修复方法调用后的分号
content = content.replace(/([a-zA-Z_][a-zA-Z0-9_]*\([^)]*\))\s*\n\s*([a-zA-Z_])/g, '$1;\n    $2');
console.log('Fixed method calls');

// 修复console.warn后的语句
content = content.replace(/console\.warn\([^)]*\)\s*\n\s*([a-zA-Z_])/g, 'console.warn($1);\n    $2');
console.log('Fixed console.warn statements');

// 修复特定的语法错误
content = content.replace(/(\})\s*\n\s*const\s+(\w+):\s*([^=]+)\s*=\s*\{/g, '$1;\n\n  const $2: $3 = {');
console.log('Fixed const declarations');

fs.writeFileSync(path, content);
console.log('Fixed syntax errors in universal-storage-adapter.ts');
console.log('Final content length:', content.length);