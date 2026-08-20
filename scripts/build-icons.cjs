/**
 * Generates PNG icons from SVG at build time.
 * Uses sharp if available, otherwise skips gracefully.
 */
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    const sharp = require('sharp');
    const svgPath = path.join(__dirname, '..', 'public', 'icon-512.svg');
    const svg = fs.readFileSync(svgPath);

    await sharp(svg).resize(192, 192).png().toFile(path.join(__dirname, '..', 'public', 'icon-192.png'));
    await sharp(svg).resize(512, 512).png().toFile(path.join(__dirname, '..', 'public', 'icon-512.png'));
    
    console.log('✓ Generated PNG icons (192x192, 512x512)');
  } catch (e) {
    // sharp not installed — skip PNG generation, SVG icons will be used
    console.log('ℹ sharp not installed — using SVG icons. Run "npm install -D sharp" for PNG icons.');
  }
}

generateIcons();
