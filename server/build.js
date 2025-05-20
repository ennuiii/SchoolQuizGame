const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Make sure the dist directory exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

console.log('Building TypeScript server...');

// Run TypeScript compiler
exec('npx tsc', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error during compilation: ${error.message}`);
    console.error(`stderr: ${stderr}`);
    return;
  }
  
  if (stdout) {
    console.log(`Compiler output: ${stdout}`);
  }
  
  console.log('TypeScript compilation complete!');
  console.log('Starting server...');
  
  // Run the compiled server
  const server = exec('node dist/index.js');
  
  server.stdout.on('data', (data) => {
    console.log(data);
  });
  
  server.stderr.on('data', (data) => {
    console.error(`Server error: ${data}`);
  });
  
  server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}); 