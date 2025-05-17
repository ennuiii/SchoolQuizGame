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
    evaluatedAnswers: {}, // Store evaluated answers
    submissionPhaseOver: false, // Initialize submission phase flag
    isConcluded: false, // Added isConcluded flag
    joinedAsSpectator: false // Track if joined as spectator
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
    evaluatedAnswers: room.evaluatedAnswers,
    submissionPhaseOver: room.submissionPhaseOver // Include submission phase flag
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

  // Find the last played round index (at least one player has an answer)
  let lastPlayedRoundIndex = -1;
  for (let i = 0; i < room.questions.length; i++) {
    if (room.players.some(player => player.answers && player.answers[i])) {
      lastPlayedRoundIndex = i;
    }
  }

  // Only include rounds up to lastPlayedRoundIndex
  const playedRounds = room.questions.slice(0, lastPlayedRoundIndex + 1).map((question, index) => {
    // Get all boards for this round
    const boardsForRound = {};
    Object.entries(room.playerBoards || {}).forEach(([playerId, boardData]) => {
      if (boardData.roundIndex === index) {
        boardsForRound[playerId] = boardData.boardData;
      }
    });

    // Prepare question data for recap. Questions do not have their own drawingData.
    const questionForRecap = {
      id: question.id,
      text: question.text,
      type: question.type,
      answer: question.answer, // Assuming answer is available on the question object
      grade: question.grade,
      subject: question.subject,
      language: question.language
    };

    return {
      roundNumber: index + 1,
      question: questionForRecap,
      submissions: room.players.map(player => {
        const answer = player.answers[index];
        if (answer && answer.hasDrawing) {
          console.log(`[Server Recap DEBUG] Player ${player.id}, Round ${index + 1}: Retrieving drawingData for recap. Length: ${answer.drawingData?.length}`);
        } else if (answer && !answer.hasDrawing) {
          console.log(`[Server Recap DEBUG] Player ${player.id}, Round ${index + 1}: Submission hasDrawing is false.`);
        } else if (!answer) {
          console.log(`[Server Recap DEBUG] Player ${player.id}, Round ${index + 1}: No answer found for this round.`);
        }
        return {
          playerId: player.id,
          playerName: player.name,
          answer: answer ? answer.answer : null,
          hasDrawing: answer ? answer.hasDrawing : false,
          drawingData: answer && answer.hasDrawing ? answer.drawingData : null,
          isCorrect: answer ? answer.isCorrect : null
        };
      })
    };
  });

  // Sort players for the recap
  const sortedPlayers = [...room.players].sort((a, b) => {
    // Winners first
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;

    // If both are winners or both are not, then:
    // Active players (who are not winners but still in game) before eliminated/spectators
    if (a.isActive && !a.isSpectator && !(b.isActive && !b.isSpectator)) return -1;
    if (!(a.isActive && !a.isSpectator) && b.isActive && !b.isSpectator) return 1;

    // If both are effectively eliminated (isActive: false, isSpectator: true due to losing lives)
    // or both are still active non-winners, sort by lives (more lives = higher rank)
    if ((!a.isActive && a.isSpectator) && (!b.isActive && b.isSpectator) || (a.isActive && b.isActive)) {
      if (a.lives > b.lives) return -1;
      if (a.lives < b.lives) return 1;
    }
    
    // Finally, if one became a spectator by losing and the other was always a spectator
    // (or some other tie-breaking for spectator status if needed)
    // Prioritize players who lost over those who never played actively if lives are equal (e.g. 0)
    // This part might need refinement based on exact definition of "isSpectator" vs "isActive"
    // For now, if lives are equal, original spectators (potentially lives 0 and isActive false from start)
    // might rank lower than players who lost all lives (lives 0, isActive became false).
    // However, the primary sort keys (winner, active) should handle most cases.
    // If `isSpectator` is true AND `isActive` is false, they are eliminated or joined as spectator.
    // If `isSpectator` is true AND `isActive` is true (as per current Player interface), they are an active spectator.

    return 0; // Keep original order for ties not covered above
  });

  return {
    roomCode,
    startTime: room.startTime,
    endTime: new Date(),
    players: sortedPlayers.map(player => ({
      id: player.id,
      name: player.name,
      finalLives: player.lives,
      isSpectator: player.isSpectator,
      isActive: player.isActive,
      isWinner: player.isActive && player.lives > 0 && room.players.filter(p => p.isActive && p.lives > 0).length === 1 && player.id === room.players.find(p => p.isActive && p.lives > 0)?.id
    })),
    rounds: playedRounds
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

// Grace period for disconnects (player/gamemaster)
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 seconds
// Grace period for auto-submit after round ends
const AUTO_SUBMIT_GRACE_PERIOD_MS = 1000; // 1 second

// Timer management
const timers = new Map();

// Helper function to finalize round, perform auto-submissions, and broadcast state
function finalizeRoundAndAutoSubmit(roomCode) {
  const room = gameRooms[roomCode];
  if (!room) {
    console.log(`[FinalizeRound] Room ${roomCode} not found.`);
    return;
  }

  console.log(`[FinalizeRound] Finalizing round for room ${roomCode}. Current question index: ${room.currentQuestionIndex}`);
  room.submissionPhaseOver = true;

  if (room.players && room.currentQuestionIndex !== undefined && room.currentQuestionIndex !== null) {
    room.players.forEach(playerInRoom => {
      if (
        playerInRoom.isActive &&
        !playerInRoom.isSpectator &&
        (!playerInRoom.answers || !playerInRoom.answers[room.currentQuestionIndex])
      ) {
        console.log(`[FinalizeRound] Auto-submitting for player ${playerInRoom.id} in room ${roomCode}`);
        if (!playerInRoom.answers) {
          playerInRoom.answers = [];
        }

        let autoAnswerHasDrawing = false;
        let autoAnswerDrawingData = null;
        if (room.playerBoards && room.playerBoards[playerInRoom.id]) {
          const playerBoardEntry = room.playerBoards[playerInRoom.id];
          if (playerBoardEntry.roundIndex === room.currentQuestionIndex && playerBoardEntry.boardData) {
            autoAnswerHasDrawing = true;
            autoAnswerDrawingData = playerBoardEntry.boardData;
          }
        }

        const autoAnswer = {
          playerId: playerInRoom.id,
          playerName: playerInRoom.name,
          answer: '', // Text answer is empty for auto-submission
          hasDrawing: autoAnswerHasDrawing,
          drawingData: autoAnswerDrawingData,
          timestamp: Date.now(),
          isCorrect: null
        };
        playerInRoom.answers[room.currentQuestionIndex] = autoAnswer;

        if (room.roundAnswers) {
          room.roundAnswers[playerInRoom.id] = autoAnswer;
        }
      }
    });
  } else {
    console.warn(`[FinalizeRound] Could not perform auto-submissions for room ${roomCode}. Conditions not met: players array exists: ${!!room.players}, currentQuestionIndex defined: ${room.currentQuestionIndex !== undefined && room.currentQuestionIndex !== null}`);
  }

  broadcastGameState(roomCode);
  console.log(`[FinalizeRound] Game state broadcasted for room ${roomCode} after finalization.`);
}

// Helper function to conclude game and send recap to all
function concludeGameAndSendRecap(roomCode, winnerInfo = null) {
    const room = gameRooms[roomCode];
    if (!room) {
        console.log(`[ConcludeGame] Room ${roomCode} not found. Skipping.`);
        return;
    }
    if (room.isConcluded) {
        console.log(`[ConcludeGame] Room ${roomCode} already concluded. Skipping recap send.`);
        return;
    }

    room.isConcluded = true;
    clearRoomTimer(roomCode); // Stop any active timers

    console.log(`[ConcludeGame] Game concluded in room ${roomCode}. Emitting game_over_pending_recap.`);
    io.to(roomCode).emit('game_over_pending_recap', {
        roomCode,
        winner: winnerInfo
    });

    // Generate and send recap immediately
    const recap = generateGameRecap(roomCode);
    if (recap) {
        console.log(`[ConcludeGame] Automatically broadcasting recap for room ${roomCode} with initialSelectedRoundIndex and initialSelectedTabKey.`);
        // Add initialSelectedRoundIndex and initialSelectedTabKey to the recap payload for the client
        const recapWithInitialState = { ...recap, initialSelectedRoundIndex: 0, initialSelectedTabKey: 'overallResults' };
        io.to(roomCode).emit('game_recap', recapWithInitialState);
    } else {
        console.warn(`[ConcludeGame] Recap data generation failed for room ${roomCode} during auto-send.`);
    }
}

// --- Grace period for disconnects ---
const disconnectTimers = {};

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
      isSpectator,
      joinedAsSpectator: !!isSpectator // Track if joined as spectator
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
    console.log('[SERVER] START_GAME EVENT RECEIVED - IMMEDIATE LOG:', {
      socketId: socket.id,
      roomCode: data.roomCode,
      timestamp: new Date().toISOString()
    });

    const { roomCode, questions, timeLimit } = data;
    const room = gameRooms[roomCode];
    console.log('[SERVER] Received start_game request:', {
      roomCode,
      fromSocket: socket.id,
      currentGamemaster: room ? room.gamemaster : undefined,
      hasRoom: !!room,
      timeLimit,
      questionCount: questions ? questions.length : 0,
      timestamp: new Date().toISOString(),
      roomState: room ? {
        started: room.started,
        playerCount: Object.keys(room.players).length,
        currentQuestion: room.currentQuestion ? room.currentQuestion.text : null,
        roundAnswers: Object.keys(room.roundAnswers || {}).length
      } : null
    });

    if (!room) {
      console.log('[SERVER] Start game failed - Room not found:', { roomCode, timestamp: new Date().toISOString() });
      socket.emit('error', 'Room not found');
      return;
    }
    if (socket.id !== room.gamemaster) {
      console.log('[SERVER] Start game failed - Not authorized:', { 
        roomCode, 
        socketId: socket.id, 
        gamemaster: room.gamemaster,
        timestamp: new Date().toISOString() 
      });
      socket.emit('error', 'Not authorized to start game');
      return;
    }

    try {
      // Update room state
      room.started = true;
      room.questions = questions;
      room.timeLimit = timeLimit;
      room.currentQuestionIndex = 0;
      room.currentQuestion = questions[0];
      room.roundAnswers = {};
      room.evaluatedAnswers = {};
      room.questionStartTime = Date.now();
      room.submissionPhaseOver = false; // Reset submission phase flag

      console.log('[SERVER] Game started successfully:', {
        roomCode,
        timeLimit: room.timeLimit,
        currentQuestion: room.currentQuestion.text,
        playerCount: Object.keys(room.players).length,
        timestamp: new Date().toISOString()
      });

      // Notify all clients in the room
      io.to(roomCode).emit('game_started', {
        question: room.currentQuestion,
        timeLimit: room.timeLimit
      });

      // Send updated game state
      const gameState = {
        started: room.started,
        currentQuestion: room.currentQuestion,
        timeLimit: room.timeLimit,
        players: Object.values(room.players),
        roundAnswers: room.roundAnswers,
        evaluatedAnswers: room.evaluatedAnswers,
        questionStartTime: room.questionStartTime,
        submissionPhaseOver: room.submissionPhaseOver
      };

      console.log('[SERVER] Emitting game state update:', {
        roomCode,
        state: {
          started: gameState.started,
          hasQuestion: !!gameState.currentQuestion,
          timeLimit: gameState.timeLimit,
          playerCount: gameState.players.length,
          timestamp: new Date().toISOString()
        }
      });

      io.to(roomCode).emit('game_state_update', gameState);

      // Start timer for the first question if a specific time limit is set
      if (room.timeLimit && room.timeLimit < 99999) {
        console.log(`[SERVER] Starting timer for first question in room ${roomCode} with limit ${room.timeLimit}`);
        startQuestionTimer(roomCode);
      }

    } catch (error) {
      console.error('[SERVER] Error starting game:', {
        roomCode,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      socket.emit('error', 'Failed to start game');
    }
  });

  // Restart the game (Gamemaster only)
  socket.on('restart_game', ({ roomCode }) => {
    const room = gameRooms[roomCode];
    if (!room || room.gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to restart the game or room not found');
      return;
    }

    // Always set the current socket as gamemaster on restart
    room.gamemaster = socket.id;

    // Reset isConcluded so the new game can be ended
    room.isConcluded = false;

    // Reset analytics/recap for this room if present
    if (gameAnalytics && gameAnalytics.games && gameAnalytics.games[roomCode]) {
      delete gameAnalytics.games[roomCode];
    }

    console.log(`[Server Restart] Attempting to restart game in room: ${roomCode}`);
    // Clear any active timers
    clearRoomTimer(roomCode);
    // Reset the game state but keep the room and settings
    room.started = false;
    // DO NOT reset questions or timeLimit from room.questions and room.timeLimit
    // Reset progress
    room.currentQuestionIndex = 0;
    if (room.questions && room.questions.length > 0) {
      room.currentQuestion = room.questions[0];
    } else {
      room.currentQuestion = null;
    }
    room.questionStartTime = null; // Reset question start time
    room.roundAnswers = {};       // Clear current round's answers
    room.evaluatedAnswers = {};   // Clear evaluated answers
    room.submissionPhaseOver = false; // Reset submission phase flag
    // Reset all players, but keep them in the room
    room.players.forEach(player => {
      if (player.joinedAsSpectator) {
        // True spectator: keep as spectator
        player.lives = 0;
        player.isActive = true;
        player.isSpectator = true;
        player.answers = [];
      } else {
        // Player or eliminated player: reset to active player
        player.lives = 3;
        player.answers = [];
        player.isActive = true;
        player.isSpectator = false;
      }
    });
    // Clear player boards (drawings)
    if (room.playerBoards) {
      Object.keys(room.playerBoards).forEach(playerId => {
        room.playerBoards[playerId] = {
          boardData: '', // Clear the drawing data
        };
      });
    }
    // Notify everyone that the game has been restarted (optional, as broadcastGameState will update clients)
    io.to(roomCode).emit('game_restarted', { roomCode }); 
    // Broadcast the complete updated (reset) game state
    broadcastGameState(roomCode);
    console.log(`[Server Restart] Game restarted successfully in room: ${roomCode}. New state broadcasted.`);
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
    
    if (room.submissionPhaseOver) {
      console.warn(`[Server UpdateBoard] Denied: submission phase over for room ${roomCode}, player ${socket.id}`);
      return; // Silently ignore
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.isSpectator || !player.isActive) {
      console.warn(`[Server UpdateBoard] Denied for inactive/spectator player: ${socket.id}`);
      return;
    }
    
    room.playerBoards[socket.id] = {
      boardData,
      roundIndex: room.currentQuestionIndex,
      timestamp: Date.now()
    };

    // Get player name
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
    const { roomCode, answer, hasDrawing, drawingData: clientDrawingData } = data;
    console.log(`[Server] Answer submission:`, {
      roomCode,
      playerId: socket.id,
      hasDrawing, // This is the client's claim
      answerLength: answer?.length || 0,
      clientDrawingDataLength: clientDrawingData?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    const room = gameRooms[roomCode];
    if (!room) {
      console.error('[Server] Answer submission failed - Room not found:', roomCode);
      socket.emit('error', 'Room not found');
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.isSpectator || !player.isActive) {
      console.warn(`[Server SubmitAnswer] Denied for inactive/spectator player: ${socket.id}`);
      socket.emit('error', 'Submission denied: you are a spectator or inactive.');
      return;
    }

    if (room.submissionPhaseOver) {
      console.warn(`[Server SubmitAnswer] Denied: submission phase over for room ${roomCode}, player ${socket.id}`);
      socket.emit('error', 'Submission phase is over for this round.');
      return;
    }

    try {
      let drawingDataForStorage = null;
      let finalHasDrawing = false; // Server-determined truth for hasDrawing

      if (hasDrawing) { // If client claims there is a drawing
        if (clientDrawingData && clientDrawingData.trim() !== '') {
          drawingDataForStorage = clientDrawingData;
          finalHasDrawing = true;
          console.log(`[Server SubmitAns REFINED] Player ${socket.id}: using non-empty clientDrawingData. Length: ${clientDrawingData?.length}`);
        } else {
          console.warn(`[Server SubmitAns REFINED] Player ${socket.id}: hasDrawing true from client, but clientDrawingData is empty/null. Attempting fallback to playerBoards.`);
          if (room.playerBoards && room.playerBoards[socket.id]) {
            const playerBoardEntry = room.playerBoards[socket.id];
            if (playerBoardEntry.roundIndex === room.currentQuestionIndex && playerBoardEntry.boardData && playerBoardEntry.boardData.trim() !== '') {
              drawingDataForStorage = playerBoardEntry.boardData;
              finalHasDrawing = true;
              console.log(`[Server SubmitAns REFINED] Player ${socket.id}: using playerBoard fallback. Length: ${drawingDataForStorage?.length}`);
            } else {
              console.warn(`[Server SubmitAns REFINED] Player ${socket.id}: playerBoard fallback failed (round mismatch or empty boardData). BoardRound: ${playerBoardEntry.roundIndex}, CurrentRound: ${room.currentQuestionIndex}, BoardData Empty: ${!playerBoardEntry.boardData || playerBoardEntry.boardData.trim() === ''}`);
            }
          } else {
            console.warn(`[Server SubmitAns REFINED] Player ${socket.id}: hasDrawing true from client, clientDrawingData empty, and no playerBoard entry for fallback.`);
          }
        }
      } else {
        console.log(`[Server SubmitAns REFINED] Player ${socket.id}: hasDrawing is false from client. No drawing data to store.`);
      }

      const answerData = {
        playerId: socket.id,
        playerName: player.name,
        answer,
        hasDrawing: finalHasDrawing, // Use server-determined finalHasDrawing
        drawingData: drawingDataForStorage,
        timestamp: Date.now(),
        isCorrect: null
      };
      console.log(`[Server SubmitAns REFINED] Player ${socket.id}: Storing answerData. FinalHasDrawing: ${answerData.hasDrawing}, DrawingData Length: ${answerData.drawingData?.length}`);

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
      if (!player) {
        console.error('[Server EVal] Player not found for evaluation:', { roomCode, playerId });
        return;
      }

      console.log('[Server Eval] Player found:', { playerId: player.id, name: player.name, initialLives: player.lives });

      // Update both answer storages
      const answer = player.answers[room.currentQuestionIndex];
      const roundAnswer = room.roundAnswers[playerId];

      if (answer) answer.isCorrect = isCorrect;
      if (roundAnswer) roundAnswer.isCorrect = isCorrect;

      // Update player state
      if (!isCorrect) {
        console.log('[Server Eval] Answer marked incorrect. Decrementing lives for player:', { playerId: player.id, currentLives: player.lives });
        player.lives--;
        console.log('[Server Eval] Player lives after decrement:', { playerId: player.id, newLives: player.lives });
        if (player.lives <= 0) {
          player.isActive = false;
          player.isSpectator = true;
          console.log('[Server Eval] Player has no lives left. Setting to spectator.', { playerId: player.id });
          io.to(playerId).emit('become_spectator');
        }
      } else {
        console.log('[Server Eval] Answer marked correct. No change to lives for player:', { playerId: player.id, currentLives: player.lives });
      }

      // Store evaluation
      room.evaluatedAnswers[playerId] = isCorrect;

      // Check for game over
      const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
      console.log(`[Server Eval] Active players remaining: ${activePlayers.length}`);

      if (activePlayers.length <= 1) {
        // Game is over
        const winner = activePlayers.length === 1 ? { id: activePlayers[0].id, name: activePlayers[0].name } : null;
        concludeGameAndSendRecap(roomCode, winner);
      }

      // Broadcast updated game state
      broadcastGameState(roomCode);
      console.log('[Server Eval] Broadcasted game state after evaluation. Updated player data should include:', { playerId: player.id, lives: player.lives, isActive: player.isActive, isSpectator: player.isSpectator });

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
      room.submissionPhaseOver = false; // Reset for the new question

      // Reset round-specific states
      room.roundAnswers = {};
      room.evaluatedAnswers = {};
      console.log(`[Server NextQ] Cleared roundAnswers and evaluatedAnswers for room ${roomCode}`);

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

      // It's important to broadcast the full game state AFTER resetting round answers
      // so clients get the cleared evaluation state along with the new question.
      broadcastGameState(roomCode); 
      // The 'new_question' event is still useful for specific client-side actions like clearing canvas,
      // but the primary state update should come from 'game_state_update' triggered by broadcastGameState.
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

    const room = gameRooms[roomCode];
    if (!room) {
        console.error(`[EndRoundEarly] Room ${roomCode} not found internally.`);
        socket.emit('error', 'Internal server error: Room not found');
        return;
    }

    // Clear the timer for this room
    clearRoomTimer(roomCode);

    // Notify all players in the room that the round has ended early by triggering time_up
    io.to(roomCode).emit('time_up');
    console.log(`[EndRoundEarly] Emitted 'time_up' for room ${roomCode}. Starting grace period of ${AUTO_SUBMIT_GRACE_PERIOD_MS}ms.`);

    // Set a timer to finalize the round after the grace period
    setTimeout(() => {
      finalizeRoundAndAutoSubmit(roomCode);
    }, AUTO_SUBMIT_GRACE_PERIOD_MS);
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
    console.log(`[Rejoin] Attempt to rejoin as gamemaster for room: ${roomCode}`);
    
    if (!gameRooms[roomCode]) {
      console.log(`[Rejoin] Room ${roomCode} not found for gamemaster rejoin`);
      
      // Create a new room with the same code if it doesn't exist
      gameRooms[roomCode] = createGameRoom(roomCode, socket.id);
      
      console.log(`[Rejoin] Created new room ${roomCode} for gamemaster ${socket.id}`);
      socket.emit('room_created', { roomCode });
    } else {
      // Update gamemaster ID
      const oldGamemasterId = gameRooms[roomCode].gamemaster;
      gameRooms[roomCode].gamemaster = socket.id;
      
      // Clear disconnect timer for old gamemaster ID if it exists
      if (disconnectTimers[oldGamemasterId]) {
        clearTimeout(disconnectTimers[oldGamemasterId]);
        delete disconnectTimers[oldGamemasterId];
        console.log(`[Rejoin] Cleared disconnect timer for old gamemaster ${oldGamemasterId}`);
      }
      
      console.log(`[Rejoin] Updated gamemaster for room ${roomCode}: ${oldGamemasterId} -> ${socket.id}`);
    }
    
    // Join the room
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    const room = gameRooms[roomCode];
    
    // Send complete game state
    const gameState = getGameState(roomCode);
    if (gameState) {
      socket.emit('game_state_update', gameState);
      console.log(`[Rejoin] Sent complete game state to rejoining gamemaster`);
      // Also send players_update to ensure player list is up-to-date
      console.log(`[Rejoin][DEBUG] Emitting players_update to gamemaster for room ${roomCode}. Player count: ${room.players.length}`);
      room.players.forEach((p, idx) => {
        console.log(`[Rejoin][DEBUG] Player ${idx + 1}: id=${p.id}, name=${p.name}`);
      });
      socket.emit('players_update', room.players);
      console.log(`[Rejoin] Sent players_update to rejoining gamemaster`);
    }
    
    // Send all player boards
    if (room.playerBoards) {
      Object.keys(room.playerBoards).forEach(playerId => {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          socket.emit('board_update', {
            playerId,
            playerName: player.name,
            boardData: room.playerBoards[playerId].boardData
          });
        }
      });
      console.log(`[Rejoin] Sent all player boards to rejoining gamemaster`);
    }
    
    // If game is concluded, send recap
    if (room.isConcluded) {
      const recap = generateGameRecap(roomCode);
      if (recap) {
        socket.emit('game_recap', recap);
        console.log(`[Rejoin] Sent game recap to rejoining gamemaster`);
      }
    }
    
    console.log(`[Rejoin] Gamemaster successfully rejoined room: ${roomCode}`);
  });

  // Handle player rejoining
  socket.on('rejoin_player', ({ roomCode, playerName, isSpectator }) => {
    console.log(`[Rejoin] Player ${playerName} (${socket.id}) rejoining room ${roomCode}`);
    
    if (!gameRooms[roomCode]) {
      console.error(`[Rejoin] Room ${roomCode} not found for player rejoin`);
      socket.emit('error', 'Invalid room code');
      return;
    }

    // Add player back to room
    socket.join(roomCode);
    socket.roomCode = roomCode;

    const room = gameRooms[roomCode];
    const playerIndex = room.players.findIndex(p => p.name === playerName);
    
    if (playerIndex >= 0) {
      // Update existing player's socket ID and maintain their state
      const player = room.players[playerIndex];
      const oldId = player.id;
      player.id = socket.id;
      
      // Transfer all player data to new socket ID
      if (room.playerBoards[oldId]) {
        room.playerBoards[socket.id] = room.playerBoards[oldId];
        delete room.playerBoards[oldId];
      }
      if (room.roundAnswers[oldId]) {
        room.roundAnswers[socket.id] = room.roundAnswers[oldId];
        delete room.roundAnswers[oldId];
      }
      if (room.evaluatedAnswers[oldId]) {
        room.evaluatedAnswers[socket.id] = room.evaluatedAnswers[oldId];
        delete room.evaluatedAnswers[oldId];
      }
      
      // Clear disconnect timer for old socket ID
      if (disconnectTimers[oldId]) {
        clearTimeout(disconnectTimers[oldId]);
        delete disconnectTimers[oldId];
        console.log(`[Rejoin] Cleared disconnect timer for old socket ${oldId}`);
      }
      
      console.log(`[Rejoin] Updated existing player ${playerName} with new socket ID: ${socket.id}`);
    } else {
      // Add as new player if not found
      const player = {
        id: socket.id,
        name: playerName,
        lives: 3,
        answers: [],
        isActive: true,
        isSpectator: isSpectator || false,
        joinedAsSpectator: isSpectator || false
      };
      room.players.push(player);
      console.log(`[Rejoin] Added new player ${playerName} to room ${roomCode}`);
    }

    // Send complete game state
    const gameState = getGameState(roomCode);
    if (gameState) {
      socket.emit('game_state_update', gameState);
      console.log(`[Rejoin] Sent complete game state to rejoining player`);
    }
    
    // Send all player boards
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
      console.log(`[Rejoin] Sent all player boards to rejoining player`);
    }

    // If game is concluded, send recap
    if (room.isConcluded) {
      const recap = generateGameRecap(roomCode);
      if (recap) {
        socket.emit('game_recap', recap);
        console.log(`[Rejoin] Sent game recap to rejoining player`);
      }
    }

    // Broadcast updated player list
    io.to(roomCode).emit('players_update', room.players);
    console.log(`[Rejoin] Player ${playerName} successfully rejoined room ${roomCode}`);

    // Clear any existing disconnect timer
    if (disconnectTimers[socket.id]) {
      clearTimeout(disconnectTimers[socket.id]);
      delete disconnectTimers[socket.id];
      console.log(`[Rejoin] Cleared disconnect timer for socket ${socket.id}`);
    }
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
      evaluatedAnswers: room.evaluatedAnswers,
      submissionPhaseOver: room.submissionPhaseOver
    };
    
    socket.emit('game_state', state);
  });

  socket.on('gm_end_game_request', ({ roomCode }) => {
    const room = gameRooms[roomCode];
    if (!room) {
      console.warn(`[Server gm_end_game_request] Room not found for code: ${roomCode}`);
      return;
    }
    if (room.gamemaster !== socket.id) {
      console.warn(`[Server gm_end_game_request] Unauthorized attempt by ${socket.id} for room ${roomCode}`);
      return;
    }
    if (!room.isConcluded) {
      // Allow ending the game as long as it is not already concluded
      console.log(`[Server gm_end_game_request] GM ${socket.id} ended game in room ${roomCode}.`);
      const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
      const winnerPayload = activePlayers.length === 1 ? { id: activePlayers[0].id, name: activePlayers[0].name } : null;
      concludeGameAndSendRecap(roomCode, winnerPayload);
    } else {
      console.log(`[Server gm_end_game_request] Game in room ${roomCode} already concluded. No action taken.`);
    }
  });

  // GM controlled recap
  socket.on('gm_show_recap_to_all', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      // Optional: emit error back to GM if not authorized or room not found
      console.warn(`[Server gm_show_recap_to_all] Unauthorized attempt or room not found by ${socket.id} for room ${roomCode}`);
      return;
    }
    const recap = generateGameRecap(roomCode);
    if (recap) {
      console.log(`[Server gm_show_recap_to_all] GM ${socket.id} broadcasting recap for room ${roomCode}`);
      // Add initialSelectedRoundIndex and initialSelectedTabKey for consistency
      const recapWithInitialState = { ...recap, initialSelectedRoundIndex: 0, initialSelectedTabKey: 'overallResults' };
      io.to(roomCode).emit('game_recap', recapWithInitialState);
    } else {
      console.warn(`[Server gm_show_recap_to_all] Recap data generation failed for room ${roomCode}`);
    }
  });

  // GM navigates recap round
  socket.on('gm_navigate_recap_round', ({ roomCode, selectedRoundIndex }) => {
    const room = gameRooms[roomCode];
    // Basic validation
    if (!room || socket.id !== room.gamemaster) {
      console.warn(`[Server gm_navigate_recap_round] Unauthorized or room not found by ${socket.id} for ${roomCode}`);
      // Optionally emit an error back to the sender
      // socket.emit('error', 'Failed to navigate recap round: unauthorized or room not found.');
      return;
    }
    if (typeof selectedRoundIndex !== 'number') {
      console.warn(`[Server gm_navigate_recap_round] Invalid selectedRoundIndex: ${selectedRoundIndex} from ${socket.id}`);
      // socket.emit('error', 'Invalid round index for recap navigation.');
      return;
    }

    // Broadcast to all clients in the room
    console.log(`[Server gm_navigate_recap_round] GM ${socket.id} navigated recap to round ${selectedRoundIndex} for room ${roomCode}`);
    io.to(roomCode).emit('recap_round_changed', { selectedRoundIndex });
  });

  // GM navigates recap tab
  socket.on('gm_navigate_recap_tab', ({ roomCode, selectedTabKey }) => {
    const room = gameRooms[roomCode];
    // Basic validation
    if (!room || socket.id !== room.gamemaster) {
      console.warn(`[Server gm_navigate_recap_tab] Unauthorized or room not found by ${socket.id} for ${roomCode}`);
      return;
    }
    if (typeof selectedTabKey !== 'string') {
      console.warn(`[Server gm_navigate_recap_tab] Invalid selectedTabKey: ${selectedTabKey} from ${socket.id}`);
      return;
    }

    // Broadcast to all clients in the room
    console.log(`[Server gm_navigate_recap_tab] GM ${socket.id} navigated recap to tab ${selectedTabKey} for room ${roomCode}`);
    io.to(roomCode).emit('recap_tab_changed', { selectedTabKey });
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
  if (!room || !room.timeLimit || room.timeLimit === 99999) {
    console.log(`[TIMER] Timer not started for room ${roomCode}: ${!room ? 'room not found' : !room.timeLimit ? 'no time limit set' : 'infinite time limit (99999)'}`);
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
      console.log(`[TIMER] Emitted 'time_up' for room ${roomCode} due to natural timeout. Starting grace period of ${AUTO_SUBMIT_GRACE_PERIOD_MS}ms.`);
      
      // Set a timer to finalize the round after the grace period
      setTimeout(() => {
        finalizeRoundAndAutoSubmit(roomCode);
      }, AUTO_SUBMIT_GRACE_PERIOD_MS);
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
      // If user was gamemaster, start grace period
      if (room.gamemaster === socket.id) {
        console.log(`[Disconnect] Gamemaster ${socket.id} disconnected from room ${roomCode}. Starting grace period.`);
        // Store the old gamemaster ID for potential rejoin
        const oldGamemasterId = socket.id;
        
        // Set a timer to delete the room if gamemaster doesn't rejoin
        disconnectTimers[oldGamemasterId] = setTimeout(() => {
          console.log(`[Disconnect] Grace period expired for gamemaster ${oldGamemasterId} in room ${roomCode}. Deleting room.`);
          io.to(roomCode).emit('error', 'Game Master disconnected');
          delete gameRooms[roomCode];
          delete disconnectTimers[oldGamemasterId];
        }, DISCONNECT_GRACE_PERIOD_MS);
        
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