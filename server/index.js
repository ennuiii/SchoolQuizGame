// Last updated: May 2025
// School Quiz Game server file
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

// Timer management
const timers = new Map();

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

    console.log(`Starting game in room ${roomCode} with first question:`, JSON.stringify(currentQuestion));
    
    // Send the game_started event with the first question
    io.to(roomCode).emit('game_started', { 
      question: currentQuestion, 
      timeLimit: timeLimit || null 
    });
    
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
    clearRoomTimer(roomCode);
    
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

  // Handle board updates from players
  socket.on('board_update', (data) => {
    const { roomCode, boardData } = data;
    if (!gameRooms[roomCode]) {
      console.log(`Board update for non-existent room: ${roomCode}`);
      return;
    }
    
    // Store the board data for this player
    const playerIndex = gameRooms[roomCode].players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      gameRooms[roomCode].players[playerIndex].boardData = boardData;
      
      // Emit the board update to the game master
      const gameMasterId = gameRooms[roomCode].gamemaster;
      if (gameMasterId) {
        io.to(gameMasterId).emit('player_board_update', {
          playerId: socket.id,
          playerName: gameRooms[roomCode].players[playerIndex].name,
          boardData: boardData
        });
      }
    }
  });

  // Handle answer submission
  socket.on('submit_answer', (data) => {
    const { roomCode, answer, hasDrawing } = data;
    console.log(`Player ${socket.id} submitting answer in room ${roomCode}: "${answer}" ${hasDrawing ? '(with drawing)' : ''}`);
    
    if (!gameRooms[roomCode]) {
      console.log(`Room ${roomCode} not found for answer submission. Available rooms: ${Object.keys(gameRooms).join(', ')}`);
      return;
    }

    const playerIndex = gameRooms[roomCode].players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) {
      console.log(`Player ${socket.id} not found in room ${roomCode}`);
      return;
    }

    // Store the answer
    gameRooms[roomCode].players[playerIndex].answers.push({
      answer,
      hasDrawing,
      timestamp: new Date().toISOString()
    });

    // Notify game master
    const gameMasterId = gameRooms[roomCode].gamemaster;
    if (gameMasterId) {
      io.to(gameMasterId).emit('answer_submitted', {
        playerId: socket.id,
        playerName: gameRooms[roomCode].players[playerIndex].name,
        answer,
        hasDrawing
      });
    }

    // Notify the player that their answer was received
    socket.emit('answer_received');
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
      socket.emit('error', 'Not authorized to move to next question');
      return;
    }

    const room = gameRooms[roomCode];
    // Only increment if there is a next question
    if (room.currentQuestionIndex < room.questions.length - 1) {
      room.currentQuestionIndex += 1;
      room.currentQuestion = room.questions[room.currentQuestionIndex];

      // Reset answer for the new question index for all players
      room.players.forEach(player => {
        player.answers[room.currentQuestionIndex] = undefined;
      });

      // Clear playerBoards answerSubmitted flag if you use it
      if (room.playerBoards) {
        Object.keys(room.playerBoards).forEach(pid => {
          if (room.playerBoards[pid]) {
            room.playerBoards[pid].answerSubmitted = false;
          }
        });
      }

      // Clear existing timer and start a new one if time limit is set
      if (room.timeLimit) {
        startQuestionTimer(roomCode);
      }

      io.to(roomCode).emit('new_question', {
        question: room.currentQuestion,
        timeLimit: room.timeLimit
      });
    }
  });

  // Handle end round early request from gamemaster
  socket.on('end_round_early', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to end round early');
      return;
    }

    // Clear the timer for this room
    clearRoomTimer(roomCode);

    // Notify all players in the room that the round has ended early
    io.to(roomCode).emit('end_round_early');

    // Auto-submit answers for players who haven't submitted yet for the current question index
    const room = gameRooms[roomCode];
    if (room) {
      const qIndex = room.currentQuestionIndex;
      room.players.forEach(player => {
        if (player.isActive && (!player.answers[qIndex] || player.answers[qIndex] === undefined)) {
          // Auto-submit empty answer for current question index
          player.answers[qIndex] = {
            answer: '',
            timestamp: Date.now()
          };
        }
      });
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
      console.log('Game already started, sending current question to rejoining gamemaster:', 
                 JSON.stringify(gameRooms[roomCode].currentQuestion));
      
      socket.emit('game_started', { 
        question: gameRooms[roomCode].currentQuestion,
        timeLimit: gameRooms[roomCode].timeLimit
      });
      
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
        clearRoomTimer(roomCode);
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
          clearRoomTimer(roomCode);
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

// Helper function to get player name from room
function getPlayerName(roomCode, playerId) {
  if (!gameRooms[roomCode] || !gameRooms[roomCode].players) {
    return 'Unknown Player';
  }
  const player = gameRooms[roomCode].players.find(p => p.id === playerId);
  return player ? player.name : 'Unknown Player';
}

// Helper function to generate a room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper function to start question timer
function startQuestionTimer(roomCode) {
  const room = gameRooms[roomCode];
  if (!room || !room.timeLimit) return;

  // Clear any existing timer for this room
  clearRoomTimer(roomCode);

  let timeRemaining = room.timeLimit;
  const startTime = Date.now();
  
  // Create a new timer that uses absolute time
  const timer = setInterval(() => {
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    timeRemaining = Math.max(0, room.timeLimit - elapsedTime);
    
    // Broadcast the remaining time to all clients
    io.to(roomCode).emit('timer_update', { timeRemaining });
    
    if (timeRemaining <= 0) {
      clearInterval(timer);
      io.to(roomCode).emit('time_up');
      
      // Auto-submit answers for players who haven't submitted yet
      const room = gameRooms[roomCode];
      if (room) {
        room.players.forEach(player => {
          if (player.isActive && !player.answers[room.currentQuestionIndex]) {
            // Auto-submit empty answer
            player.answers[room.currentQuestionIndex] = {
              answer: '',
              timestamp: Date.now()
            };
          }
        });
      }
    }
  }, 1000);

  // Store the timer reference
  timers.set(roomCode, timer);
}

function clearRoomTimer(roomCode) {
  const timer = timers.get(roomCode);
  if (timer) {
    clearInterval(timer);
    timers.delete(roomCode);
  }
}

// Handle disconnection
io.on('disconnect', (socket) => {
  console.log(`User disconnected: ${socket.id}`);
  
  // If user was in a room, handle cleanup
  if (socket.roomCode) {
    const roomCode = socket.roomCode;
    const room = gameRooms[roomCode];
    
    if (room) {
      // If user was gamemaster, end the game
      if (room.gamemaster === socket.id) {
        io.to(roomCode).emit('error', 'Game Master disconnected');
        delete gameRooms[roomCode];
        return;
      }
      
      // If user was a player, remove them
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        delete room.playerBoards[socket.id];
        
        // Notify remaining players
        io.to(roomCode).emit('players_update', room.players);
      }
    }
  }
});

// Set up the port
const PORT = process.env.PORT || 5000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Build path: ${buildPath}`);
});