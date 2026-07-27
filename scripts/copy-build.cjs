const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../dist');
const destDir = path.join(__dirname, '../extension');

function copyFolderRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderRecursiveSync(srcPath, destPath);
    } else {
      // Don't overwrite extension config scripts/manifests
      if (entry.name !== 'manifest.json' && entry.name !== 'background.js' && entry.name !== 'content.js' && entry.name !== 'popup.html' && entry.name !== 'icon.png') {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

try {
  console.log('Cleaning target extension/assets/ directory...');
  const assetsDest = path.join(destDir, 'assets');
  if (fs.existsSync(assetsDest)) {
    fs.rmSync(assetsDest, { recursive: true, force: true });
  }

  console.log('Copying dist/ files recursively to extension/ directory...');
  copyFolderRecursiveSync(srcDir, destDir);
  console.log('Successfully updated extension/ assets!');
} catch (err) {
  console.error('Failed to copy build assets to extension:', err);
}
