# School Quiz Game

A multiplayer educational game based on the German school system. Players join a room and answer questions while the Game Master evaluates their answers.

## Features

- **Game Master Role**: Create a room, manage questions, and evaluate player answers
- **Player Role**: Join rooms, draw answers on a virtual chalkboard, and compete with other players
- **Real-time Drawing**: Players can draw their answers on a chalkboard that updates in real-time
- **Lives System**: Players have three lives and lose one for each incorrect answer
- **German Educational Content**: Questions based on the German school system

## Technology Stack

- **Frontend**: React, TypeScript, Fabric.js for canvas drawing
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO
- **Styling**: Bootstrap and custom CSS

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone <your-repository-url>
   cd SchoolQuizGame
   ```

2. Install dependencies
   ```
   npm install --legacy-peer-deps
   ```

3. Start the backend server
   ```
   cd server
   node index.js
   ```

4. In a new terminal, start the frontend development server
   ```
   cd ..
   npm start
   ```

5. Open your browser to [http://localhost:3000](http://localhost:3000)

### Quick Start with PowerShell Script

Run the included PowerShell script to start both the server and client:
```
powershell -ExecutionPolicy Bypass -File .\start-app.ps1
```

## How to Play

### As a Game Master

1. Click "Create Game" on the home page
2. Share the displayed room code with players
3. Wait for players to join
4. Start the game when everyone has joined
5. Monitor player answers and evaluate them as correct or incorrect
6. Advance to the next question when ready

### As a Player

1. Click "Join Game" on the home page
2. Enter the room code provided by the Game Master
3. Enter your name
4. Wait for the Game Master to start the game
5. Draw and type your answers for each question
6. Try to stay alive by giving correct answers!

## Deployment

See the [Deployment Guide](./deployment-guide.md) for instructions on how to deploy the game online so you can play with friends.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to all the contributors who have helped with this project
- Special thanks to the German education system for inspiration 