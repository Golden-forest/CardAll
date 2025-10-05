import sharp from 'sharp';
import fs from 'fs';

async function generateFavicon() {
  try {
    // 读取SVG文件
    const svgBuffer = fs.readFileSync('./public/cardall-icon.svg');
    
    // 生成不同尺寸的PNG
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile('./public/favicon-32x32.png');
      
    await sharp(svgBuffer)
      .resize(16, 16)
      .png()
      .toFile('./public/favicon-16x16.png');

    // 生成Apple touch icon
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile('./public/apple-touch-icon.png');
    
    console.log('Favicon PNG files generated successfully!');
  } catch (error) {
    console.error('Error generating favicon:', error);
  }
}

generateFavicon();