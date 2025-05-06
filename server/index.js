const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
app.use(cors());

// Determine the correct build path based on environment
let buildPath = path.join(__dirname, '../build');
if (process.env.NODE_ENV === 'production') {
  // Check multiple possible locations for build files (for render.com deployment)
  const possibleBuildPaths = [
    path.join(__dirname, 'build'),          // server/build
    path.join(__dirname, '../build'),       // build in root
    path.join(process.cwd(), 'build'),      // current working directory
    '/opt/render/project/src/build'         // absolute path on render.com
  ];
  
  let buildPathFound = false;
  // Find the first path that exists
  for (const pathToCheck of possibleBuildPaths) {
    if (fs.existsSync(pathToCheck)) {
      buildPath = pathToCheck;
      console.log('Using build path:', buildPath);
      console.log('Build index.html exists:', fs.existsSync(path.join(buildPath, 'index.html')));
      buildPathFound = true;
      break;
    }
  }
  
  if (!buildPathFound) {
    console.error('No valid build path found. Checked these paths:');
    possibleBuildPaths.forEach(p => console.error(`- ${p} (exists: ${fs.existsSync(p)})`));
    console.log('Current directory:', process.cwd());
    console.log('Directory listing for current directory:', fs.readdirSync(process.cwd()));
    try {
      console.log('Directory listing for server directory:', fs.readdirSync(__dirname));
    } catch (err) {
      console.error('Error reading server directory:', err);
    }
  }
  
  app.use(express.static(buildPath));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // Increase maximum allowed payload size for larger SVG content
  maxHttpBufferSize: 5e6, // 5MB
  pingTimeout: 60000
});

// Store active game rooms
const gameRooms = {};

// Debug endpoint to view active rooms
app.get('/debug/rooms', (req, res) => {
  res.json({
    rooms: Object.keys(gameRooms),
    details: gameRooms
  });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game room (Gamemaster)
  socket.on('create_room', ({ roomCode } = {}) => {
    // If no roomCode provided, generate one
    const finalRoomCode = roomCode || generateRoomCode();
    
    gameRooms[finalRoomCode] = {
      gamemaster: socket.id,
      players: [],
      started: false,
      questions: [],
      currentQuestion: null,
      playerBoards: {},
      timeLimit: null,
      timers: {}
    };

    socket.join(finalRoomCode);
    socket.roomCode = finalRoomCode; // Store room code in socket for reference
    socket.emit('room_created', { roomCode: finalRoomCode });
    console.log(`Room created: ${finalRoomCode} by ${socket.id}`);
    console.log('Available rooms now:', Object.keys(gameRooms));
  });

  // Join a game room (Player)
  socket.on('join_room', ({ roomCode, playerName }) => {
    console.log(`Join room attempt - Room: ${roomCode}, Player: ${playerName}, Socket ID: ${socket.id}`);
    console.log('Available rooms:', Object.keys(gameRooms));
    
    if (!gameRooms[roomCode]) {
      console.log(`Room ${roomCode} not found!`);
      socket.emit('error', 'Room does not exist');
      return;
    }

    if (gameRooms[roomCode].started) {
      socket.emit('error', 'Game has already started');
      return;
    }

    // Check if a player with the same name already exists in this room
    const existingPlayerWithSameName = gameRooms[roomCode].players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (existingPlayerWithSameName && existingPlayerWithSameName.id !== socket.id) {
      socket.emit('error', 'A player with this name already exists in the room');
      return;
    }

    // Check if player with same socket ID already exists in this room and remove them
    const existingPlayerIndex = gameRooms[roomCode].players.findIndex(p => p.id === socket.id);
    if (existingPlayerIndex !== -1) {
      gameRooms[roomCode].players.splice(existingPlayerIndex, 1);
    }

    const playerInfo = {
      id: socket.id,
      name: playerName,
      lives: 3,
      answers: [],
      isActive: true
    };

    gameRooms[roomCode].players.push(playerInfo);
    gameRooms[roomCode].playerBoards[socket.id] = {
      boardData: '',
      answers: [],
      answerSubmitted: false
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    socket.emit('joined_room', roomCode);
    
    // Make sure gamemaster gets notified about the new player
    if (gameRooms[roomCode].gamemaster) {
      io.to(gameRooms[roomCode].gamemaster).emit('player_joined', playerInfo);
    }
    
    // Send updated player list to everyone in the room
    io.to(roomCode).emit('players_update', gameRooms[roomCode].players);
    
    console.log(`Player ${playerName} (${socket.id}) joined room: ${roomCode}`);
    console.log(`Current players in room ${roomCode}:`, gameRooms[roomCode].players);
  });

  // Start the game (Gamemaster only)
  socket.on('start_game', ({ roomCode, questions, timeLimit }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to start the game');
      return;
    }

    if (gameRooms[roomCode].players.length < 2) {
      socket.emit('error', 'Need at least 2 players to start');
      return;
    }

    gameRooms[roomCode].started = true;
    gameRooms[roomCode].questions = questions;
    gameRooms[roomCode].currentQuestionIndex = 0;
    gameRooms[roomCode].timeLimit = timeLimit || null;
    
    const currentQuestion = gameRooms[roomCode].questions[0];
    gameRooms[roomCode].currentQuestion = currentQuestion;

    io.to(roomCode).emit('game_started', { question: currentQuestion, timeLimit });
    console.log(`Game started in room: ${roomCode}`);
    
    // Start the timer for this question if a time limit is set
    if (timeLimit) {
      startQuestionTimer(roomCode);
    }
  });

  // Restart the game (Gamemaster only)
  socket.on('restart_game', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to restart the game');
      return;
    }
    
    // Clear any active timers
    if (gameRooms[roomCode].timers.questionTimer) {
      clearTimeout(gameRooms[roomCode].timers.questionTimer);
      gameRooms[roomCode].timers.questionTimer = null;
    }
    
    // Reset the game state but keep the room
    gameRooms[roomCode].started = false;
    gameRooms[roomCode].questions = [];
    gameRooms[roomCode].currentQuestion = null;
    gameRooms[roomCode].currentQuestionIndex = 0;
    gameRooms[roomCode].timeLimit = null;
    
    // Reset all players, but keep them in the room
    gameRooms[roomCode].players.forEach(player => {
      player.lives = 3;
      player.answers = [];
      player.isActive = true;
    });
    
    // Clear player boards
    Object.keys(gameRooms[roomCode].playerBoards).forEach(playerId => {
      gameRooms[roomCode].playerBoards[playerId] = {
        boardData: '',
        answers: [],
        answerSubmitted: false
      };
    });
    
    // Notify everyone that the game has been restarted
    io.to(roomCode).emit('game_restarted');
    io.to(roomCode).emit('players_update', gameRooms[roomCode].players);
    
    console.log(`Game restarted in room: ${roomCode}`);
  });

  // Board update from a player
  socket.on('board_update', ({ roomCode, boardData }) => {
    if (!gameRooms[roomCode]) {
      console.log('Board update for non-existent room:', roomCode);
      return;
    }
    
    // Store the latest board data for this player
    if (!gameRooms[roomCode].playerBoards[socket.id]) {
      console.log('Creating board data for player:', socket.id);
      gameRooms[roomCode].playerBoards[socket.id] = {
        boardData: '',
        answers: [],
        answerSubmitted: false
      };
    }
    
    gameRooms[roomCode].playerBoards[socket.id].boardData = boardData;
    
    // Send to gamemaster only if connected
    if (gameRooms[roomCode].gamemaster) {
      io.to(gameRooms[roomCode].gamemaster).emit('player_board_update', {
        playerId: socket.id,
        playerName: getPlayerName(roomCode, socket.id),
        boardData
      });
    } else {
      console.log('No gamemaster connected to receive board update');
    }
  });

  // Player submits an answer
  socket.on('submit_answer', ({ roomCode, answer }) => {
    console.log(`Player ${socket.id} submitting answer in room ${roomCode}: "${answer}"`);
    
    if (!gameRooms[roomCode]) {
      console.log(`Room ${roomCode} not found for answer submission`);
      socket.emit('error', 'Room not found');
      return;
    }
    
    const playerId = socket.id;
    const playerIndex = gameRooms[roomCode].players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      console.log(`Player ${playerId} not found in room ${roomCode}`);
      socket.emit('error', 'Player not found in room');
      return;
    }
    
    const playerName = gameRooms[roomCode].players[playerIndex].name;
    console.log(`Identified player: ${playerName}`);
    
    // Make sure player board exists
    if (!gameRooms[roomCode].playerBoards[playerId]) {
      console.log(`Creating player board for ${playerName} (${playerId})`);
      gameRooms[roomCode].playerBoards[playerId] = {
        boardData: '',
        answers: [],
        answerSubmitted: false
      };
    }
    
    gameRooms[roomCode].playerBoards[playerId].answers.push(answer);
    gameRooms[roomCode].playerBoards[playerId].answerSubmitted = true;
    
    console.log(`Answer submitted by ${playerName} (${playerId}): "${answer}"`);
    
    // Notify gamemaster - critical path for answer delivery
    if (gameRooms[roomCode].gamemaster) {
      console.log(`Sending answer to gamemaster ${gameRooms[roomCode].gamemaster}`);
      try {
        io.to(gameRooms[roomCode].gamemaster).emit('answer_submitted', {
          playerId,
          playerName,
          answer
        });
        
        // Also send confirmation to the player that their answer was received
        socket.emit('answer_received', { status: 'success', message: 'Your answer has been sent to the Game Master' });
      } catch (error) {
        console.error(`Failed to send answer to gamemaster: ${error.message}`);
        socket.emit('error', 'Failed to send answer to Game Master');
      }
    } else {
      console.log(`No gamemaster found for room ${roomCode}`);
      socket.emit('error', 'Game Master not found');
    }
  });

  // Gamemaster evaluates an answer
  socket.on('evaluate_answer', ({ roomCode, playerId, isCorrect }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to evaluate answers');
      return;
    }
    
    const playerIndex = gameRooms[roomCode].players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;
    
    const player = gameRooms[roomCode].players[playerIndex];
    
    if (!isCorrect) {
      player.lives--;
      
      if (player.lives <= 0) {
        player.isActive = false;
        io.to(playerId).emit('game_over');
      }
    }
    
    io.to(playerId).emit('answer_evaluation', { isCorrect, lives: player.lives });
    io.to(roomCode).emit('players_update', gameRooms[roomCode].players);
    
    // Check if only one player is left
    const activePlayers = gameRooms[roomCode].players.filter(p => p.isActive);
    if (activePlayers.length === 1) {
      io.to(roomCode).emit('game_winner', {
        playerId: activePlayers[0].id,
        playerName: activePlayers[0].name
      });
    }
  });

  // Next question from gamemaster
  socket.on('next_question', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to change questions');
      return;
    }
    
    // Clear any active timers
    if (gameRooms[roomCode].timers.questionTimer) {
      clearTimeout(gameRooms[roomCode].timers.questionTimer);
      gameRooms[roomCode].timers.questionTimer = null;
    }
    
    gameRooms[roomCode].currentQuestionIndex++;
    const index = gameRooms[roomCode].currentQuestionIndex;
    
    if (index >= gameRooms[roomCode].questions.length) {
      io.to(roomCode).emit('game_completed');
      return;
    }
    
    const nextQuestion = gameRooms[roomCode].questions[index];
    gameRooms[roomCode].currentQuestion = nextQuestion;
    
    // Clear boards for next question
    Object.keys(gameRooms[roomCode].playerBoards).forEach(id => {
      gameRooms[roomCode].playerBoards[id].boardData = '';
      gameRooms[roomCode].playerBoards[id].answerSubmitted = false;
    });
    
    io.to(roomCode).emit('new_question', { question: nextQuestion, timeLimit: gameRooms[roomCode].timeLimit });
    
    // Start the timer for this question if a time limit is set
    if (gameRooms[roomCode].timeLimit) {
      startQuestionTimer(roomCode);
    }
  });

  // Rejoin as gamemaster (when refreshing)
  socket.on('rejoin_gamemaster', ({ roomCode }) => {
    console.log(`Attempt to rejoin as gamemaster for room: ${roomCode}`);
    
    if (!gameRooms[roomCode]) {
      console.log(`Room ${roomCode} not found for gamemaster rejoin`);
      
      // Create a new room with the same code if it doesn't exist
      gameRooms[roomCode] = {
        gamemaster: socket.id,
        players: [],
        started: false,
        questions: [],
        currentQuestion: null,
        playerBoards: {},
        timeLimit: null,
        timers: {}
      };
      
      console.log(`Created new room ${roomCode} for gamemaster ${socket.id}`);
      socket.emit('room_created', roomCode);
    } else {
      // Update gamemaster ID
      const oldGamemasterId = gameRooms[roomCode].gamemaster;
      gameRooms[roomCode].gamemaster = socket.id;
      
      console.log(`Updated gamemaster for room ${roomCode}: ${oldGamemasterId} -> ${socket.id}`);
    }
    
    // Join the room
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    // Send current game state
    socket.emit('players_update', gameRooms[roomCode].players);
    console.log(`Sent player update to gamemaster: ${gameRooms[roomCode].players.length} players`);
    
    // If game already started, send current question
    if (gameRooms[roomCode].started && gameRooms[roomCode].currentQuestion) {
      socket.emit('game_started', { question: gameRooms[roomCode].currentQuestion });
      
      // Send all player boards
      Object.keys(gameRooms[roomCode].playerBoards).forEach(playerId => {
        const player = gameRooms[roomCode].players.find(p => p.id === playerId);
        if (player) {
          socket.emit('player_board_update', {
            playerId,
            playerName: player.name,
            boardData: gameRooms[roomCode].playerBoards[playerId].boardData
          });
        }
      });
    }
    
    console.log(`Gamemaster rejoined room: ${roomCode}`);
    console.log('Available rooms:', Object.keys(gameRooms));
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Save roomCode before cleanup for logging
    let wasInRoom = null;
    
    // Check if user was in a room
    Object.keys(gameRooms).forEach(roomCode => {
      const room = gameRooms[roomCode];
      
      // If gamemaster disconnects, end the game
      if (room.gamemaster === socket.id) {
        wasInRoom = roomCode;
        io.to(roomCode).emit('gamemaster_left');
        delete gameRooms[roomCode];
        console.log(`Room ${roomCode} deleted because gamemaster left`);
        return;
      }
      
      // If player disconnects, remove them from the room
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        wasInRoom = roomCode;
        room.players.splice(playerIndex, 1);
        delete room.playerBoards[socket.id];
        
        io.to(roomCode).emit('player_left', { playerId: socket.id });
        io.to(roomCode).emit('players_update', room.players);
        
        // Only delete the room if both game master and all players are gone
        if (room.players.length === 0 && !room.gamemaster) {
          delete gameRooms[roomCode];
          console.log(`Room ${roomCode} deleted because all players and gamemaster left`);
        } else {
          console.log(`Room ${roomCode} still has game master or ${room.players.length} players`);
        }
        
        // Check if only one player is left in an active game
        if (room.started && room.players.length > 0) {
          const activePlayers = room.players.filter(p => p.isActive);
          if (activePlayers.length === 1) {
            io.to(roomCode).emit('game_winner', {
              playerId: activePlayers[0].id,
              playerName: activePlayers[0].name
            });
          }
        }
      }
    });
    
    if (wasInRoom) {
      console.log(`After disconnect, remaining rooms:`, Object.keys(gameRooms));
    }
  });
});

// Helper function to start a timer for the current question
function startQuestionTimer(roomCode) {
  const room = gameRooms[roomCode];
  if (!room || !room.timeLimit) return;
  
  console.log(`Starting ${room.timeLimit} second timer for room ${roomCode}`);
  
  // Clear any existing timer
  if (room.timers.questionTimer) {
    clearTimeout(room.timers.questionTimer);
  }
  
  // Set a new timer
  room.timers.questionTimer = setTimeout(() => {
    console.log(`Time's up for question in room ${roomCode}`);
    
    // For each active player who hasn't submitted, send individual time_up event
    let playersNotified = 0;
    room.players.forEach(player => {
      if (player.isActive) {
        // Check if this player has already submitted an answer for this question
        const playerBoard = room.playerBoards[player.id];
        const hasSubmitted = playerBoard && playerBoard.answerSubmitted;
        
        if (!hasSubmitted) {
          // IMPORTANT: DO NOT mark as submitted - let the client handle everything via submit_answer
          console.log(`Sending time_up to player: ${player.name} (${player.id})`);
          io.to(player.id).emit('time_up');
          playersNotified++;
        }
      }
    });
    
    console.log(`Notified ${playersNotified} players about time's up`);
    
    // Also notify everyone in the room that time is up (for UI updates)
    io.to(roomCode).emit('time_up');
    
    // Clear the timer reference
    room.timers.questionTimer = null;
  }, room.timeLimit * 1000);
}

// Serve the React app for any other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    console.log(`Requested: ${req.url}, attempting to serve: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error(`Error: index.html not found at ${indexPath}`);
      res.status(404).send(`Build files not found. Checked: ${indexPath}<br>
        Current directory: ${process.cwd()}<br>
        Build path: ${buildPath}<br>
        Please check deployment configuration.`);
    }
  });
}

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getPlayerName(roomCode, playerId) {
  if (!gameRooms[roomCode]) return 'Unknown Player';
  const player = gameRooms[roomCode].players.find(p => p.id === playerId);
  return player ? player.name : 'Unknown Player';
}

// Use PORT from environment variable for deployment platforms
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 