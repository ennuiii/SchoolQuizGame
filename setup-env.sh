#!/bin/bash

# Root project (client/game)
cat > .env << EOL
REACT_APP_SUPABASE_URL=https://msocknepcnzlrelwplkf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb2NrbmVwY256bHJlbHdwbGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1MTU3MTIsImV4cCI6MjA2MjA5MTcxMn0.vOoZEjyKKcbym8nkK5knRb_JTiOBlP1m6fUK7Z2wTN4
NODE_ENV=development
SKIP_PREFLIGHT_CHECK=true
CI=false
TSC_COMPILE_ON_ERROR=true
EOL

# Admin panel
cat > admin-panel/.env << EOL
REACT_APP_SUPABASE_URL=https://msocknepcnzlrelwplkf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb2NrbmVwY256bHJlbHdwbGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1MTU3MTIsImV4cCI6MjA2MjA5MTcxMn0.vOoZEjyKKcbym8nkK5knRb_JTiOBlP1m6fUK7Z2wTN4
SKIP_PREFLIGHT_CHECK=true
NODE_ENV=development
CI=false
TSC_COMPILE_ON_ERROR=true
EOL

# Server
cat > server/.env << EOL
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
EOL

echo "Environment files created successfully!"
echo "Root .env file created at: $(pwd)/.env"
echo "Admin panel .env file created at: $(pwd)/admin-panel/.env"
echo "Server .env file created at: $(pwd)/server/.env"
echo "These files are already in .gitignore and won't be committed to Git."

# Make the script executable
chmod +x setup-env.sh 