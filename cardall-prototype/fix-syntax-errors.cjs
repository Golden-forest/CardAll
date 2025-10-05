const fs = require('fs');

// 修复database.ts的语法错误
let content = fs.readFileSync('./src/services/database.ts', 'utf8');

// 修复方法声明缺少分号的问题
content = content.replace(/(\s+)\}(\s*\n\s*\/\*\*)/g, '$1};$2');

// 修复类方法结束的分号问题
content = content.replace(/(\s+)\}\s*\n\s*}/g, '$1};\n  }');

// 修复catch块后的多余分号
content = content.replace(/}\s*}\s*;/g, '};');

fs.writeFileSync('./src/services/database.ts', content);
console.log('Fixed database.ts syntax errors');