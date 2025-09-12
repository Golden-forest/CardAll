const sharp = require('sharp');
const fs = require('fs');

async function generateFavicon() {
  try {
    // 读取SVG文件
    const svgBuffer = fs.readFileSync('./public/cardall-icon.svg');
    
    // 生成不同尺寸的PNG
    const sizes = [16, 32, 48];
    const pngBuffers = [];
    
    for (const size of sizes) {
      const pngBuffer = await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push(pngBuffer);
    }
    
    // 这里我们先生成PNG文件，ICO转换需要额外的库
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile('./public/favicon-32x32.png');
      
    await sharp(svgBuffer)
      .resize(16, 16)
      .png()
      .toFile('./public/favicon-16x16.png');
    
    console.log('Favicon PNG files generated successfully!');
  } catch (error) {
    console.error('Error generating favicon:', error);
  }
}

generateFavicon();