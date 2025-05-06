# Deployment Guide for SchoolQuizGame

This guide will help you deploy the SchoolQuizGame so you can play it with friends over the internet.

## Option 1: Deploy to Render.com (Free Tier)

### 1. Create a GitHub Repository

1. Create a new GitHub repository
2. Push your SchoolQuizGame code to this repository

### 2. Deploy the Backend (Server)

1. Sign up for a free account at [Render.com](https://render.com)
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: school-quiz-game-server
   - **Root Directory**: server
   - **Runtime**: Node
   - **Build Command**: npm install
   - **Start Command**: node index.js
   - **Plan**: Free
5. Click "Create Web Service"
6. Wait for the deployment to complete
7. Note the URL of your server (e.g., https://school-quiz-game-server.onrender.com)

### 3. Deploy the Frontend (React App)

1. In your project, create a file named `.env.production` at the root with:
   ```
   REACT_APP_SOCKET_URL=https://your-server-name.onrender.com
   ```
   (Replace with your actual server URL from step 2)

2. Build your React app:
   ```
   cd \SchoolQuizGame
   npm run build
   ```

3. On Render.com, click "New" and select "Static Site"
4. Connect your GitHub repository
5. Configure the site:
   - **Name**: school-quiz-game
   - **Root Directory**: (leave blank)
   - **Build Command**: npm run build
   - **Publish Directory**: build
6. Click "Create Static Site"
7. Wait for the deployment to complete
8. Your game will be available at the provided URL

## Option 2: Deploy to Netlify + Heroku

### Backend (Heroku)

1. Create a `Procfile` in the server directory:
   ```
   web: node index.js
   ```

2. Sign up for [Heroku](https://heroku.com)
3. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
4. Run these commands:
   ```
   cd \SchoolQuizGame\server
   heroku login
   heroku create school-quiz-game-server
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku master
   ```
5. Your server will be running at `https://school-quiz-game-server.herokuapp.com`

### Frontend (Netlify)

1. Create a `.env.production` file as described in Option 1
2. Build your React app
3. Sign up for [Netlify](https://netlify.com)
4. Drag and drop your `build` folder to Netlify
5. Your game will be available at the provided URL

## Option 3: Run on Your Home Computer (Port Forwarding)

If you have a stable internet connection and a computer that can stay on while playing:

1. Configure your router to forward port 5000 to your computer
2. Find your public IP address (search "what is my IP" on Google)
3. Run the game server on your computer:
   ```
   cd \SchoolQuizGame\server
   node index.js
   ```
4. Have friends connect to `http://YOUR_PUBLIC_IP:5000`

## Playing the Game

1. Share the frontend URL with your friends
2. Create a game room as Game Master
3. Share the room code with players
4. Have fun playing! 