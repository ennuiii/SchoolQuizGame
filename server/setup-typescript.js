const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n=== Setting up TypeScript Server ===');

// Check if TypeScript and other dependencies are installed
try {
  console.log('Installing TypeScript dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  console.log('Dependencies installed successfully.');
} catch (err) {
  console.error('Error installing dependencies:', err);
  process.exit(1);
}

// Create backup of index.js if it doesn't exist already
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

// Build the TypeScript project
try {
  console.log('Building TypeScript project...');
  execSync('node build.js', { stdio: 'inherit', cwd: __dirname });
  console.log('TypeScript build completed successfully.');
} catch (err) {
  console.error('Error building TypeScript project:', err);
  process.exit(1);
}

console.log('\n=== Setup Complete ===');
console.log('You can now run the server using:');
console.log('  npm run start       - to run the TypeScript version');
console.log('  npm run start:js    - to run the original JavaScript version');
console.log('\nFor development with automatic reloading:');
console.log('  npm run dev         - to run the TypeScript version in development mode');
console.log('  npm run dev:js      - to run the JavaScript version in development mode\n'); 