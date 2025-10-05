const fs = require('fs');

const path = './src/services/data-migration.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 简单的修复方法
content = content.replace(/(\});\s*\n\s*(private)/g, '$1;\n\n  private');
content = content.replace(/(\});\s*\n\s*(public)/g, '$1;\n\n  public');
content = content.replace(/(\});\s*\n\s*(async)/g, '$1;\n\n  async');
content = content.replace(/(\});\s*\n\s*(const)/g, '$1;\n\n  const');
content = content.replace(/(\});\s*\n\s*(\/\/)/g, '$1;\n  //');

fs.writeFileSync(path, content);
console.log('Fixed data-migration.service.ts syntax errors');