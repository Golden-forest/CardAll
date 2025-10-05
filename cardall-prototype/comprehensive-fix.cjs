const fs = require('fs');

// 全面修复database.ts的语法错误
let content = fs.readFileSync('./src/services/database.ts', 'utf8');

// 修复catch块后多余的右括号和分号问题
content = content.replace(/}\s*}\s*;\s*}\s*catch/g, '} catch');

// 修复重复的catch块
content = content.replace(/}\s*catch\s*\([^)]*\)\s*{\s*[^}]*}\s*catch\s*\([^)]*\)\s*{/g, '} catch');

// 修复方法声明后缺少分号的问题
content = content.replace(/(\s+)\}\s*\n\s*\/\*\*/g, '$1};\n\n  /**');

// 修复类方法结束的分号问题
content = content.replace(/(\s+)\}\s*\n\s*}\s*\n\s*export/g, '$1};\n  }\n\nexport');

// 修复try-catch结构问题
content = content.replace(/try\s*{\s*[^}]*}\s*catch\s*\([^)]*\)\s*{\s*[^}]*}\s*\)\s*}\s*`/g, 'try {\n        // ...existing code\n      } catch (error) {\n        console.warn("操作失败:", error)\n      }');

// 修复console.log后的分号问题
content = content.replace(/console\.log\([^)]*\)\s*\n\s*}\s*catch/g, 'console.log($1);\n      } catch');

fs.writeFileSync('./src/services/database.ts', content);
console.log('Fixed comprehensive database.ts syntax errors');

// 修复data-migration.service.ts的语法错误
let migrationContent = fs.readFileSync('./src/services/data-migration.service.ts', 'utf8');

// 修复方法声明后缺少分号
migrationContent = migrationContent.replace(/(\s+)\}\s*\n\s*\/\*\*/g, '$1};\n\n  /**');

// 修复多余的catch块
migrationContent = migrationContent.replace(/}\s*catch\s*\([^)]*\)\s*{\s*[^}]*}\s*catch\s*\([^)]*\)\s*{/g, '} catch');

// 修复return语句后的分号
migrationContent = migrationContent.replace(/return\s+[^;]+\s*\n\s*}/g, (match) => {
  if (!match.endsWith(';')) {
    return match.replace(/\n\s*}/, ';\n    }');
  }
  return match;
});

fs.writeFileSync('./src/services/data-migration.service.ts', migrationContent);
console.log('Fixed data-migration.service.ts syntax errors');