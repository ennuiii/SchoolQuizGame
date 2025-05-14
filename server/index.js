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

// Configure CORS for both development and production
const allowedOrigins = [
  'http://localhost:3000',
  'https://schoolquizgame-1.onrender.com',
  'https://schoolquizgame.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('CORS blocked origin:', origin);
      return callback(null, false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// Store active game rooms and game recaps
const gameRooms = {};

// Game Analytics
const gameAnalytics = {
  games: {},
  addGame(roomCode) {
    this.games[roomCode] = {
      startTime: new Date(),
      players: [],
      rounds: [],
      totalQuestions: 0,
      averageResponseTime: 0,
      correctAnswers: 0,
      totalAnswers: 0
    };
  },
  
  addPlayer(roomCode, player) {
    if (this.games[roomCode]) {
      this.games[roomCode].players.push({
        id: player.id,
        name: player.name,
        joinTime: new Date(),
        answers: [],
        correctAnswers: 0,
        averageResponseTime: 0
      });
    }
  },
  
  recordAnswer(roomCode, playerId, answer, isCorrect, responseTime) {
    const game = this.games[roomCode];
    if (!game) return;
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) return;
    
    player.answers.push({ answer, isCorrect, responseTime });
    if (isCorrect) player.correctAnswers++;
    
    // Update player average response time
    const totalTime = player.answers.reduce((sum, a) => sum + a.responseTime, 0);
    player.averageResponseTime = totalTime / player.answers.length;
    
    // Update game stats
    game.totalAnswers++;
    if (isCorrect) game.correctAnswers++;
    game.averageResponseTime = (game.averageResponseTime * (game.totalAnswers - 1) + responseTime) / game.totalAnswers;
  },
  
  endGame(roomCode) {
    const game = this.games[roomCode];
    if (!game) return;
    
    game.endTime = new Date();
    game.duration = (game.endTime - game.startTime) / 1000; // in seconds
    
    // Calculate final statistics
    const stats = {
      totalPlayers: game.players.length,
      averageScore: game.players.reduce((sum, p) => sum + (p.correctAnswers / game.totalQuestions), 0) / game.players.length,
      fastestPlayer: game.players.reduce((fastest, p) => 
        p.averageResponseTime < (fastest?.averageResponseTime ?? Infinity) ? p : fastest, null),
      mostAccuratePlayer: game.players.reduce((most, p) => 
        (p.correctAnswers / game.totalQuestions) > (most?.accuracy ?? 0) ? 
          { ...p, accuracy: p.correctAnswers / game.totalQuestions } : most, null)
    };
    
    game.finalStats = stats;
    return stats;
  },
  
  getGameStats(roomCode) {
    return this.games[roomCode];
  }
};

// Helper function to create a new game room with consistent structure
function createGameRoom(roomCode, gamemasterId) {
  return {
    roomCode,
    gamemaster: gamemasterId,
    players: [],
    started: false,
    startTime: null,
    questions: [],
    currentQuestionIndex: 0,
    currentQuestion: null,
    timeLimit: null,
    playerBoards: {},
    roundAnswers: {}, // Store current round answers separately
    evaluatedAnswers: {} // Store evaluated answers
  };
}

// Helper function to get full game state for a room
function getGameState(roomCode) {
  const room = gameRooms[roomCode];
  if (!room) return null;

  return {
    started: room.started,
    currentQuestion: room.currentQuestion,
    currentQuestionIndex: room.currentQuestionIndex,
    timeLimit: room.timeLimit,
    players: room.players,
    playerBoards: room.playerBoards,
    roundAnswers: room.roundAnswers,
    evaluatedAnswers: room.evaluatedAnswers
  };
}

// Helper function to broadcast game state to all players in a room
function broadcastGameState(roomCode) {
  const state = getGameState(roomCode);
  if (state) {
    io.to(roomCode).emit('game_state_update', state);
  }
}

// Helper function to generate game recap data
function generateGameRecap(roomCode) {
  const room = gameRooms[roomCode];
  if (!room) return null;

  return {
    roomCode,
    startTime: room.startTime,
    endTime: new Date(),
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      finalLives: player.lives,
      isSpectator: player.isSpectator,
      isWinner: player.isActive && player.lives > 0
    })),
    rounds: room.questions.map((question, index) => {
      // Get all boards for this round
      const boardsForRound = {};
      Object.entries(room.playerBoards || {}).forEach(([playerId, boardData]) => {
        if (boardData.roundIndex === index) {
          boardsForRound[playerId] = boardData.boardData;
        }
      });

      return {
        roundNumber: index + 1,
        question: question,
        submissions: room.players.map(player => {
          const answer = player.answers[index];
          return {
            playerId: player.id,
            playerName: player.name,
            answer: answer ? answer.answer : null,
            drawingData: boardsForRound[player.id] || null,
            isCorrect: answer ? answer.isCorrect : null,
            livesAfterRound: answer ? answer.livesAfterRound : null
          };
        })
      };
    })
  };
}

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
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  // Increase maximum allowed payload size for larger SVG content
  maxHttpBufferSize: 5e6, // 5MB
  pingTimeout: 60000
});

// Debug endpoint to view active rooms
app.get('/debug/rooms', (req, res) => {
  res.json({
    rooms: Object.keys(gameRooms),
    details: gameRooms
  });
});

// Game recap endpoints
app.get('/api/recaps', (req, res) => {
  // Return list of all recaps with basic info
  const recapsList = Object.values(gameRooms).map(recap => ({
    id: recap.id,
    roomCode: recap.roomCode,
    startTime: recap.startTime,
    endTime: recap.endTime,
    playerCount: recap.players.length,
    roundCount: recap.rounds.length,
    winner: recap.winner
  }));
  res.json(recapsList);
});

app.get('/api/recaps/:recapId', (req, res) => {
  const recap = gameRooms[req.params.recapId];
  if (!recap) {
    res.status(404).json({ error: 'Recap not found' });
    return;
  }
  res.json(recap);
});

app.get('/api/recaps/room/:roomCode', (req, res) => {
  const roomRecaps = Object.values(gameRooms)
    .filter(recap => recap.roomCode === req.params.roomCode)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  res.json(roomRecaps);
});

app.get('/api/recaps/:recapId/round/:roundNumber', (req, res) => {
  const recap = gameRooms[req.params.recapId];
  if (!recap) {
    res.status(404).json({ error: 'Recap not found' });
    return;
  }
  
  const roundIndex = parseInt(req.params.roundNumber) - 1;
  const round = recap.rounds[roundIndex];
  if (!round) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }
  
  res.json(round);
});

// Timer management
const timers = new Map();

io.on('connection', (socket) => {
  console.log(`[Server] User connected: ${socket.id}`);

  // Create a new game room (Gamemaster)
  socket.on('create_room', ({ roomCode } = {}) => {
    const finalRoomCode = roomCode || generateRoomCode();
    console.log(`[Server] Creating room:`, {
      roomCode: finalRoomCode,
      gamemaster: socket.id,
      timestamp: new Date().toISOString()
    });
    
    gameRooms[finalRoomCode] = createGameRoom(finalRoomCode, socket.id);

    socket.join(finalRoomCode);
    socket.roomCode = finalRoomCode;
    socket.emit('room_created', { roomCode: finalRoomCode });
    console.log(`[Server] Room created successfully:`, {
      roomCode: finalRoomCode,
      gamemaster: socket.id,
      timestamp: new Date().toISOString()
    });
  });

  // Handle player joining
  socket.on('join_room', ({ roomCode, playerName, isSpectator }) => {
    console.log(`[Server] Player joining room:`, {
      roomCode,
      playerName,
      playerId: socket.id,
      isSpectator,
      timestamp: new Date().toISOString()
    });
    
    if (!gameRooms[roomCode]) {
      console.error(`[Server] Join room failed - Invalid room code:`, {
        roomCode,
        playerName,
        playerId: socket.id
      });
      socket.emit('error', 'Invalid room code');
      return;
    }

    const room = gameRooms[roomCode];

    // Check for duplicate names
    const isDuplicateName = room.players.some(player => 
      player.name.toLowerCase() === playerName.toLowerCase()
    );

    if (isDuplicateName) {
      console.error(`[Server] Join room failed - Name already taken:`, {
        roomCode,
        playerName,
        playerId: socket.id
      });
      socket.emit('error', 'This name is already taken in the room. Please choose a different name.');
      return;
    }
    
    // Add player to room
    socket.join(roomCode);
    const player = {
      id: socket.id,
      name: playerName,
      lives: 3,
      answers: [],
      isActive: true,
      isSpectator
    };
    room.players.push(player);

    console.log(`[Server] Player joined successfully:`, {
      roomCode,
      playerName,
      playerId: socket.id,
      totalPlayers: room.players.length,
      timestamp: new Date().toISOString()
    });

    // Send full game state to the joining player
    socket.emit('room_joined', { roomCode });
    const gameState = getGameState(roomCode);
    if (gameState) {
      socket.emit('game_state_update', gameState);
      console.log(`[Server] Sent initial game state to player:`, {
        roomCode,
        playerId: socket.id,
        gameStarted: gameState.started,
        currentQuestionIndex: gameState.currentQuestionIndex
      });
    }

    // Broadcast updated player list
    broadcastGameState(roomCode);
  });

  // Start the game (Gamemaster only)
  socket.on('start_game', async (data) => {
    const { roomCode, questions, timeLimit } = data;
    const room = gameRooms[roomCode];
    console.log('[SERVER] Received start_game request:', {
      roomCode,
      fromSocket: socket.id,
      currentGamemaster: room ? room.gamemaster : undefined,
      hasRoom: !!room,
      timeLimit,
      timestamp: new Date().toISOString()
    });

    if (!room) {
      console.log('[SERVER] Start game failed - Room not found:', { roomCode, timestamp: new Date().toISOString() });
      socket.emit('error', 'Room not found');
      return;
    }
    if (socket.id !== room.gamemaster) {
      console.log('[SERVER] Start game failed - Not authorized:', { roomCode, socketId: socket.id, gamemaster: room.gamemaster, timestamp: new Date().toISOString() });
      socket.emit('error', 'Not authorized to start game');
      return;
    }
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      console.log('[SERVER] Start game failed - No questions provided:', { roomCode, timestamp: new Date().toISOString() });
      socket.emit('error', 'No questions provided');
      return;
    }
    
    try {
      console.log('[SERVER] Starting game:', { roomCode, questionCount: questions.length, timeLimit: timeLimit || 99999, timestamp: new Date().toISOString() });
      
      // Add startTime to room
      room.startTime = new Date();
      room.questions = questions;
      room.currentQuestionIndex = 0;
      room.started = true;
      room.timeLimit = timeLimit || 99999;
      room.questionStartTime = Date.now();
      room.currentQuestion = questions[0];
      
      // Initialize playerBoards with round tracking
      if (!room.playerBoards) {
        room.playerBoards = {};
      }

      // Initialize round answers and evaluations
      room.roundAnswers = {};
      room.evaluatedAnswers = {};
      
      // Send complete game state to all clients
      const gameState = {
        started: room.started,
        currentQuestion: room.currentQuestion,
        currentQuestionIndex: room.currentQuestionIndex,
        timeLimit: room.timeLimit,
        questionStartTime: room.questionStartTime,
        players: room.players,
        playerBoards: room.playerBoards,
        roundAnswers: room.roundAnswers,
        evaluatedAnswers: room.evaluatedAnswers
      };

      // First send game_started event
      console.log('[SERVER] Sending game_started event:', {
        roomCode,
        questionText: questions[0].text,
        timeLimit: room.timeLimit,
        timestamp: new Date().toISOString()
      });
      
      io.to(roomCode).emit('game_started', {
        question: questions[0],
        timeLimit: room.timeLimit
      });

      // Small delay to ensure proper event ordering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then send complete game state
      console.log('[SERVER] Sending game_state_update event:', {
        roomCode,
        started: gameState.started,
        questionIndex: gameState.currentQuestionIndex,
        playerCount: gameState.players.length,
        timestamp: new Date().toISOString()
      });
      
      io.to(roomCode).emit('game_state_update', gameState);

      // Start the timer for the first question if time limit is set and not infinite
      if (room.timeLimit && room.timeLimit < 99999) {
        console.log(`[SERVER] Starting timer for room ${roomCode} with limit ${room.timeLimit}`);
        startQuestionTimer(roomCode);
      }

      gameAnalytics.addGame(roomCode);
      gameAnalytics.games[roomCode].totalQuestions = questions.length;
    } catch (error) {
      console.error('[SERVER] Error starting game:', error);
      socket.emit('error', 'Failed to start game properly');
      
      // Reset room state on error
      room.started = false;
      room.currentQuestion = null;
      room.timeLimit = null;
      room.questionStartTime = null;
      
      // Notify clients of the failure
      io.to(roomCode).emit('game_state_update', {
        started: false,
        currentQuestion: null,
        currentQuestionIndex: 0,
        timeLimit: null,
        players: room.players,
        playerBoards: {},
        roundAnswers: {},
        evaluatedAnswers: {}
      });
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
    
    // Reset the game state but keep the room and settings
    gameRooms[roomCode].started = false;
    // DO NOT reset questions or timeLimit
    // Reset progress
    gameRooms[roomCode].currentQuestionIndex = 0;
    if (gameRooms[roomCode].questions && gameRooms[roomCode].questions.length > 0) {
      gameRooms[roomCode].currentQuestion = gameRooms[roomCode].questions[0];
    } else {
      gameRooms[roomCode].currentQuestion = null;
    }
    
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

  // Handle board updates
  socket.on('update_board', ({ roomCode, boardData }) => {
    console.log(`[Server] Received board update:`, {
      roomCode,
      playerId: socket.id,
      dataSize: boardData?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    if (!gameRooms[roomCode]) {
      console.error('[Server] Board update failed - Invalid room:', roomCode);
      return;
    }

    // Check if the socket is in the room
    if (!socket.rooms.has(roomCode)) {
      console.error('[Server] Board update failed - Socket not in room:', {
        roomCode,
        playerId: socket.id
      });
      return;
    }

    const room = gameRooms[roomCode];
    if (!room.playerBoards) {
      room.playerBoards = {};
    }
    
    room.playerBoards[socket.id] = {
      boardData,
      roundIndex: room.currentQuestionIndex,
      timestamp: Date.now()
    };

    // Get player name
    const player = gameRooms[roomCode].players.find(p => p.id === socket.id);
    const playerName = player ? player.name : 'Unknown Player';

    console.log(`[Server] Broadcasting board update:`, {
      roomCode,
      playerId: socket.id,
      playerName,
      roundIndex: room.currentQuestionIndex,
      timestamp: new Date().toISOString()
    });

    // Broadcast to all clients in the room including the sender
    io.to(roomCode).emit('board_update', {
      playerId: socket.id,
      playerName,
      boardData
    });
  });

  // Handle answer submission
  socket.on('submit_answer', (data) => {
    const { roomCode, answer, hasDrawing } = data;
    console.log(`[Server] Answer submission:`, {
      roomCode,
      playerId: socket.id,
      hasDrawing,
      answerLength: answer?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    const room = gameRooms[roomCode];
    if (!room) {
      console.error('[Server] Answer submission failed - Room not found:', roomCode);
      socket.emit('error', 'Room not found');
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      console.error('[Server] Answer submission failed - Player not found:', {
        roomCode,
        playerId: socket.id
      });
      socket.emit('error', 'Player not found');
      return;
    }

    try {
      // Store the answer
      const answerData = {
        playerId: socket.id,
        playerName: player.name,
        answer,
        hasDrawing,
        timestamp: Date.now(),
        isCorrect: null
      };

      // Store in both places for consistency
      player.answers[room.currentQuestionIndex] = answerData;
      room.roundAnswers[socket.id] = answerData;

      console.log(`[Server] Answer stored successfully:`, {
        roomCode,
        playerId: socket.id,
        playerName: player.name,
        questionIndex: room.currentQuestionIndex,
        timestamp: new Date().toISOString()
      });

      // Notify the player
      socket.emit('answer_received', { 
        status: 'success',
        message: 'Answer received!'
      });

      // Broadcast the new game state
      broadcastGameState(roomCode);
      
      const responseTime = Date.now() - room.questionStartTime;
      gameAnalytics.recordAnswer(roomCode, socket.id, answer, null, responseTime);
      
    } catch (error) {
      console.error('[Server] Error storing answer:', {
        error,
        roomCode,
        playerId: socket.id
      });
      socket.emit('error', 'Failed to submit answer');
    }
  });

  // Gamemaster evaluates an answer
  socket.on('evaluate_answer', ({ roomCode, playerId, isCorrect }) => {
    const room = gameRooms[roomCode];
    if (!room || room.gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to evaluate answers');
      return;
    }

    try {
      const player = room.players.find(p => p.id === playerId);
      if (!player) return;

      // Update both answer storages
      const answer = player.answers[room.currentQuestionIndex];
      const roundAnswer = room.roundAnswers[playerId];

      if (answer) answer.isCorrect = isCorrect;
      if (roundAnswer) roundAnswer.isCorrect = isCorrect;

      // Update player state
      if (!isCorrect) {
        player.lives--;
        if (player.lives <= 0) {
          player.isActive = false;
          player.isSpectator = true;
          io.to(playerId).emit('become_spectator');
        }
      }

      // Store evaluation
      room.evaluatedAnswers[playerId] = isCorrect;

      // Check for game over
      const activePlayers = room.players.filter(p => p.isActive);
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        const gameRecap = generateGameRecap(roomCode);
        io.to(roomCode).emit('game_recap', gameRecap);
        io.to(roomCode).emit('game_winner', {
          playerId: winner.id,
          playerName: winner.name
        });
      }

      // Broadcast updated game state
      broadcastGameState(roomCode);

      const responseTime = Date.now() - room.questionStartTime;
      gameAnalytics.recordAnswer(roomCode, playerId, answer.answer, isCorrect, responseTime);

    } catch (error) {
      console.error('Error evaluating answer:', error);
      socket.emit('error', 'Failed to evaluate answer');
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
      room.questionStartTime = Date.now();

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

      // Clear existing timer and start a new one if time limit is set and not infinite
      clearRoomTimer(roomCode);
      if (room.timeLimit && room.timeLimit < 99999) {
        console.log(`[SERVER] Starting timer for next question in room ${roomCode} with limit ${room.timeLimit}`);
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
  });

  // Preview Mode handlers
  socket.on('start_preview_mode', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to start preview mode');
      return;
    }
    // Broadcast to all clients in the room
    io.to(roomCode).emit('start_preview_mode');
  });

  socket.on('stop_preview_mode', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to stop preview mode');
      return;
    }
    // Broadcast to all clients in the room
    io.to(roomCode).emit('stop_preview_mode');
  });

  socket.on('focus_submission', ({ roomCode, playerId }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to focus submission');
      return;
    }
    // Broadcast to all clients in the room
    io.to(roomCode).emit('focus_submission', { playerId });
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
        roundAnswers: {},
        evaluatedAnswers: {}
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
          socket.emit('board_update', {
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

  // Handle spectator joining
  socket.on('join_as_spectator', ({ roomCode, playerName }) => {
    console.log(`Spectator ${playerName} attempting to join room ${roomCode}`);
    
    if (!gameRooms[roomCode]) {
      console.log(`Room ${roomCode} not found!`);
      socket.emit('error', 'Room not found');
      return;
    }

    // Check for duplicate names
    const isDuplicateName = gameRooms[roomCode].players.some(player => 
      player.name.toLowerCase() === playerName.toLowerCase()
    );

    if (isDuplicateName) {
      console.error(`[Server] Spectator join failed - Name already taken:`, {
        roomCode,
        playerName,
        playerId: socket.id
      });
      socket.emit('error', 'This name is already taken in the room. Please choose a different name.');
      return;
    }

    // Add spectator to room
    socket.join(roomCode);
    socket.roomCode = roomCode;

    const spectator = {
      id: socket.id,
      name: playerName,
      lives: 0,
      answers: [],
      isActive: true,
      isSpectator: true
    };

    // Add spectator to players list
    gameRooms[roomCode].players.push(spectator);

    // Notify spectator they joined successfully
    socket.emit('room_joined', { roomCode });

    // Notify gamemaster about new spectator
    if (gameRooms[roomCode].gamemaster) {
      io.to(gameRooms[roomCode].gamemaster).emit('player_joined', spectator);
    }

    // Send current game state to spectator
    if (gameRooms[roomCode].currentQuestion) {
      socket.emit('question', gameRooms[roomCode].currentQuestion);
    }

    // Broadcast player update to all clients in room
    io.to(roomCode).emit('players_update', gameRooms[roomCode].players);
    // Send the current player list directly to the joining spectator
    socket.emit('players_update', gameRooms[roomCode].players);
    
    console.log(`Spectator ${playerName} (${socket.id}) joined room: ${roomCode}`);
    console.log(`Current players in room ${roomCode}:`, gameRooms[roomCode].players);
  });

  // Add new handler for switching to spectator mode
  socket.on('switch_to_spectator', ({ roomCode, playerId }) => {
    try {
      const room = gameRooms[roomCode];
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        socket.emit('error', 'Player not found');
        return;
      }

      // Update player to spectator
      player.isSpectator = true;
      player.isActive = false;

      // Update session info
      if (socket.playerInfo) {
        socket.playerInfo.isSpectator = true;
      }

      // Notify everyone in the room
      io.to(roomCode).emit('players_update', room.players);
      io.to(playerId).emit('become_spectator');

      console.log(`Player ${player.name} switched to spectator mode`);
    } catch (error) {
      console.error('Error in switch_to_spectator:', error);
      socket.emit('error', 'Failed to switch to spectator mode');
    }
  });

  // Add new handler for switching from spectator to player
  socket.on('switch_to_player', ({ roomCode, playerName }) => {
    try {
      const room = gameRooms[roomCode];
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }
      // Remove the spectator entry
      const oldIndex = room.players.findIndex(p => p.id === socket.id);
      if (oldIndex !== -1) {
        room.players.splice(oldIndex, 1);
      }
      // Add as a new player
      const player = {
        id: socket.id,
        name: playerName,
        lives: 3,
        answers: [],
        isActive: true,
        isSpectator: false
      };
      room.players.push(player);
      // Update session info
      socket.playerInfo = { roomCode, playerName, isSpectator: false };
      // Notify everyone in the room
      io.to(roomCode).emit('players_update', room.players);
      io.to(roomCode).emit('player_joined', player);
      console.log(`Spectator ${playerName} switched to player in room ${roomCode}`);
    } catch (error) {
      console.error('Error in switch_to_player:', error);
      socket.emit('error', 'Failed to switch to player mode');
    }
  });

  // Handle player rejoining
  socket.on('rejoin_player', ({ roomCode, playerName, isSpectator }) => {
    console.log(`Player ${playerName} (${socket.id}) rejoining room ${roomCode}`);
    
    if (!gameRooms[roomCode]) {
      socket.emit('error', 'Invalid room code');
      return;
    }

    // Add player back to room
    socket.join(roomCode);
    socket.roomCode = roomCode; // Store room code in socket for cleanup

    const room = gameRooms[roomCode];
    const playerIndex = room.players.findIndex(p => p.name === playerName);
    
    if (playerIndex >= 0) {
      // Update existing player's socket ID and maintain their state
      const player = room.players[playerIndex];
      const oldId = player.id;
      player.id = socket.id;
      
      // Transfer any existing board data to new socket ID
      if (room.playerBoards[oldId]) {
        room.playerBoards[socket.id] = room.playerBoards[oldId];
        delete room.playerBoards[oldId];
      }

      // Transfer any existing round answers
      if (room.roundAnswers[oldId]) {
        room.roundAnswers[socket.id] = room.roundAnswers[oldId];
        delete room.roundAnswers[oldId];
      }

      // Transfer any existing evaluated answers
      if (room.evaluatedAnswers[oldId]) {
        room.evaluatedAnswers[socket.id] = room.evaluatedAnswers[oldId];
        delete room.evaluatedAnswers[oldId];
      }
    } else {
      // If player not found, add them as a new player
      const player = {
        id: socket.id,
        name: playerName,
        lives: 3,
        answers: [],
        isActive: true,
        isSpectator: isSpectator || false
      };
      room.players.push(player);
    }

    // Send current game state to the rejoining player
    socket.emit('room_joined', { roomCode });
    
    if (room.started) {
      socket.emit('game_started', {
        question: room.currentQuestion,
        timeLimit: room.timeLimit
      });
    }

    // Send all existing board data to the rejoining player
    if (room.playerBoards) {
      Object.keys(room.playerBoards).forEach(playerId => {
        const boardPlayer = room.players.find(p => p.id === playerId);
        if (boardPlayer) {
          socket.emit('board_update', {
            playerId,
            playerName: boardPlayer.name,
            boardData: room.playerBoards[playerId].boardData
          });
        }
      });
    }

    // Broadcast updated player list to all clients in the room
    io.to(roomCode).emit('players_update', room.players);
    console.log(`Player ${playerName} successfully rejoined room ${roomCode}`);
  });

  // Get current game state for a room
  socket.on('get_game_state', ({ roomCode }) => {
    const room = gameRooms[roomCode];
    if (!room) {
      socket.emit('game_state', { started: false });
      return;
    }

    // Send complete game state
    const state = {
      started: room.started,
      currentQuestion: room.currentQuestion,
      currentQuestionIndex: room.currentQuestionIndex,
      timeLimit: room.timeLimit,
      questionStartTime: room.questionStartTime,
      players: room.players,
      playerBoards: room.playerBoards,
      roundAnswers: room.roundAnswers,
      evaluatedAnswers: room.evaluatedAnswers
    };
    
    socket.emit('game_state', state);
  });

  // Add new event for requesting recap
  socket.on('request_recap', ({ roomCode }) => {
    const recap = generateGameRecap(roomCode);
    if (recap) {
      socket.emit('game_recap', recap);
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
  if (!room || !room.timeLimit) {
    console.log(`[TIMER] Cannot start timer for room ${roomCode}: ${!room ? 'room not found' : 'no time limit'}`);
    return;
  }

  // Clear any existing timer for this room
  clearRoomTimer(roomCode);

  let timeRemaining = room.timeLimit;
  const startTime = Date.now();
  
  console.log(`[TIMER] Starting timer for room ${roomCode} with ${timeRemaining} seconds`);
  
  // Create a new timer that uses absolute time
  const timer = setInterval(() => {
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    timeRemaining = Math.max(0, room.timeLimit - elapsedTime);
    
    // Broadcast the remaining time to all clients
    io.to(roomCode).emit('timer_update', { timeRemaining });
    console.log(`[TIMER] Room ${roomCode}: ${timeRemaining} seconds remaining`);
    
    if (timeRemaining <= 0) {
      console.log(`[TIMER] Time's up for room ${roomCode}`);
      clearInterval(timer);
      timers.delete(roomCode);
      io.to(roomCode).emit('time_up');
      
      // Auto-submit answers for players who haven't submitted yet
      const currentRoom = gameRooms[roomCode];
      if (currentRoom) {
        currentRoom.players.forEach(player => {
          if (player.isActive && !player.answers[currentRoom.currentQuestionIndex]) {
            // Auto-submit empty answer
            player.answers[currentRoom.currentQuestionIndex] = {
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
  console.log(`[TIMER] Timer started and stored for room ${roomCode}`);
}

function clearRoomTimer(roomCode) {
  const timer = timers.get(roomCode);
  if (timer) {
    console.log(`[TIMER] Clearing timer for room ${roomCode}`);
    clearInterval(timer);
    timers.delete(roomCode);
  } else {
    console.log(`[TIMER] No timer found to clear for room ${roomCode}`);
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

// Add analytics endpoints
app.get('/api/analytics/game/:roomCode', (req, res) => {
  const stats = gameAnalytics.getGameStats(req.params.roomCode);
  if (!stats) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  res.json(stats);
});

// Set up the port
const PORT = process.env.PORT || 5000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Build path: ${buildPath}`);
});