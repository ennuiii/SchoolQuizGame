#!/bin/bash

# Exit on error
set -e

# Build the React app
echo "Building React application..."
npm install --legacy-peer-deps
npm run build

# Add a Render route config
echo "/* /index.html 200" > build/_redirects
echo "Creating a 200.html fallback..."
cp build/index.html build/200.html
cp build/index.html build/404.html

echo "Static build completed!" 