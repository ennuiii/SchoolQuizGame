const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n=== Building TypeScript Server ===');

// Ensure dist directory exists and is empty
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Cleaning dist directory...');
  try {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log('Dist directory cleaned.');
  } catch (err) {
    console.error('Error cleaning dist directory:', err);
  }
}

// Create the dist directory
try {
  fs.mkdirSync(distPath, { recursive: true });
  console.log('Created dist directory.');
} catch (err) {
  console.error('Error creating dist directory:', err);
}

// Run the TypeScript compiler
try {
  console.log('Compiling TypeScript...');
  execSync('npx tsc', { stdio: 'inherit', cwd: __dirname });
  console.log('TypeScript compilation complete.');
} catch (err) {
  console.error('Error compiling TypeScript:', err);
  process.exit(1);
}

// Copy necessary files to dist
try {
  // Files that might need to be copied (non-TypeScript files)
  const filesToCopy = [
    // Add any non-TypeScript files that need to be copied to dist
  ];

  for (const file of filesToCopy) {
    const sourcePath = path.join(__dirname, file);
    const destPath = path.join(distPath, file);
    
    if (fs.existsSync(sourcePath)) {
      // Create directory structure if needed
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${file} to dist.`);
    } else {
      console.warn(`Warning: File ${file} not found.`);
    }
  }
} catch (err) {
  console.error('Error copying files:', err);
}

// Make backup of index.js if it doesn't exist already
const indexJsPath = path.join(__dirname, 'index.js');
const indexJsBakPath = path.join(__dirname, 'index.js.bak');

if (fs.existsSync(indexJsPath) && !fs.existsSync(indexJsBakPath)) {
  try {
    console.log('Creating backup of original index.js...');
    fs.copyFileSync(indexJsPath, indexJsBakPath);
    console.log('Backup created as index.js.bak');
  } catch (err) {
    console.error('Error creating backup of index.js:', err);
  }
}

console.log('\n=== Build Complete ===');
console.log('You can now run the server using:');
console.log('  npm run start       - to run the TypeScript version');
console.log('  npm run start:js    - to run the original JavaScript version\n'); 