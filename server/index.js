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
  'https://schoolquizgame.onrender.com',
  'https://schoolquizgame-admin.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'), false);
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
function createGameRoom(roomCode, gamemasterId, gamemasterPersistentId) {
  return {
    roomCode,
    gamemaster: gamemasterId,
    gamemasterSocketId: gamemasterId,
    gamemasterPersistentId,
    gamemasterDisconnected: false,
    gamemasterDisconnectTimer: null,
    players: [],
    started: false,
    questions: [],
    currentQuestion: null,
    currentQuestionIndex: 0,
    timeLimit: null,
    questionStartTime: null,
    roundAnswers: {},
    evaluatedAnswers: {},
    playerBoards: {}, // Initialize playerBoards as empty object, not null
    submissionPhaseOver: false,
    isConcluded: false
  };
}

// Helper function to get full game state for a room
function getGameState(roomCode) {
  const room = gameRooms[roomCode];
  if (!room) return null;

  // Create a clean copy of player boards to ensure drawings are preserved
  const playerBoardsForState = {};
  
  if (room.playerBoards) {
    // Convert to a consistent format that's serializable and retains all drawing data
    Object.entries(room.playerBoards).forEach(([playerId, boardData]) => {
      playerBoardsForState[playerId] = {
        playerId,
        boardData: boardData.boardData || '',
        persistentPlayerId: room.players.find(p => p.id === playerId)?.persistentPlayerId || '',
        playerName: room.players.find(p => p.id === playerId)?.name || 'Unknown Player',
        roundIndex: boardData.roundIndex !== undefined ? boardData.roundIndex : room.currentQuestionIndex || 0,
        timestamp: boardData.timestamp || Date.now()
      };
    });
  }

  return {
    started: room.started,
    currentQuestion: room.currentQuestion,
    currentQuestionIndex: room.currentQuestionIndex,
    timeLimit: room.timeLimit,
    questionStartTime: room.questionStartTime,
    players: room.players,
    roundAnswers: room.roundAnswers || {},
    evaluatedAnswers: room.evaluatedAnswers || {},
    submissionPhaseOver: room.submissionPhaseOver || false,
    isConcluded: room.isConcluded || false,
    playerBoards: playerBoardsForState, // Include formatted player boards
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
      // Check if this board entry has a persistentPlayerId, if so, use that
      const persistentId = boardData.persistentPlayerId || playerId;
      
      if (boardData.roundIndex === index) {
        boardsForRound[persistentId] = boardData.boardData;
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

    // Organize submissions by persistentPlayerId
    const submissionsByPersistentId = room.players.reduce((acc, player) => {
      if (player.answers[index]) {
        acc[player.persistentPlayerId] = player.answers[index];
      }
      return acc;
    }, {});

    return {
      roundNumber: index + 1,
      question: questionForRecap,
      submissions: room.players.map(player => {
        // Use the submission from submissionsByPersistentId
        const answer = submissionsByPersistentId[player.persistentPlayerId];
        
        if (answer && answer.hasDrawing) {
          console.log(`[Server Recap DEBUG] Player ${player.persistentPlayerId}, Round ${index + 1}: Retrieving drawingData for recap. Length: ${answer.drawingData?.length}`);
        } else if (answer && !answer.hasDrawing) {
          console.log(`[Server Recap DEBUG] Player ${player.persistentPlayerId}, Round ${index + 1}: Submission hasDrawing is false.`);
        } else if (!answer) {
          console.log(`[Server Recap DEBUG] Player ${player.persistentPlayerId}, Round ${index + 1}: No answer found for this round.`);
        }
        
        return {
          playerId: player.id,
          persistentPlayerId: player.persistentPlayerId,
          playerName: player.name,
          answer: answer ? answer.answer : null,
          hasDrawing: answer ? answer.hasDrawing : false,
          drawingData: answer && answer.hasDrawing ? answer.drawingData : null,
          isCorrect: answer ? answer.isCorrect : null
        };
      })
    };
  });

  // Sort players for the recap - using persistentPlayerId for stability
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
    
    // Finally, if tied by all above criteria, sort by persistentPlayerId for stability
    return a.persistentPlayerId.localeCompare(b.persistentPlayerId);
  });

  return {
    roomCode,
    startTime: room.startTime,
    endTime: new Date(),
    players: sortedPlayers.map(player => ({
      id: player.id,
      persistentPlayerId: player.persistentPlayerId,
      name: player.name,
      finalLives: player.lives,
      isSpectator: player.isSpectator,
      isActive: player.isActive,
      isWinner: player.isActive && player.lives > 0 && room.players.filter(p => p.isActive && p.lives > 0).length === 1 && player.persistentPlayerId === room.players.find(p => p.isActive && p.lives > 0)?.persistentPlayerId
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
  pingTimeout: 60000,
  // Enable Connection State Recovery
  connectionStateRecovery: {
    // Set max disconnection duration to 2 minutes (in milliseconds)
    maxDisconnectionDuration: 2 * 60 * 1000,
    // Skip middleware during recovery
    skipMiddlewares: true
  }
});

// Authentication Middleware for persistentPlayerId management
io.use((socket, next) => {
  try {
    // Extract data from socket.handshake
    const auth = socket.handshake.auth || {};
    const query = socket.handshake.query || {};
    
    // Check for Game Master flag in query parameters
    const isGameMasterQuery = query.isGameMaster === "true";
    const roomCodeQuery = query.roomCode;
    const isInitialConnection = query.isInitialConnection === "true";

    console.log(`[AUTH] Socket ${socket.id} authentication check:`, {
      query,
      isInitialConnection,
      auth
    });

    // Initialize socket.data property
    socket.data = socket.data || {};
    
    // Set Game Master flag
    socket.data.isGameMaster = isGameMasterQuery;
    
    // Set player name from auth
    socket.data.playerName = auth.playerName;
    
    // Handle persistentPlayerId logic
    if (auth.persistentPlayerId) {
      // Use existing persistentPlayerId if provided
      socket.data.persistentPlayerId = auth.persistentPlayerId;
    } else if (isGameMasterQuery) {
      // Generate new persistentPlayerId for Game Master
      socket.data.persistentPlayerId = `GM-${uuidv4()}`;
    } else if (auth.playerName) {
      // Generate new persistentPlayerId for regular Player
      socket.data.persistentPlayerId = `P-${uuidv4()}`;
    }
    
    // Log the assigned values
    console.log(`[AUTH] Socket ${socket.id} authenticated:`, {
      persistentPlayerId: socket.data.persistentPlayerId,
      playerName: socket.data.playerName,
      isGameMaster: socket.data.isGameMaster,
      isInitialConnection,
      timestamp: new Date().toISOString()
    });

    // Allow initial connections without player name (for the Join Game page)
    // Also allow game masters and recovered sessions
    if (isInitialConnection || socket.data.isGameMaster || socket.recovered || socket.data.playerName) {
      return next();
    }
    
    // For non-initial player connection attempts without a name, return error
    return next(new Error('Player name required'));
  } catch (error) {
    console.error('[AUTH] Middleware error:', error);
    next(error);
  }
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

io.on('connection', (socket) => {
  console.log(`[Server] User connected: ${socket.id}, persistentPlayerId: ${socket.data.persistentPlayerId}, playerName: ${socket.data.playerName}, isGameMaster: ${socket.data.isGameMaster}, recovered: ${socket.recovered}`);
  
  // Emit persistent_id_assigned back to the client
  socket.emit('persistent_id_assigned', { persistentPlayerId: socket.data.persistentPlayerId });

  // Handle session recovery
  if (socket.recovered === true) {
    console.log(`[Server] Session recovery for socket ${socket.id} with persistentPlayerId ${socket.data.persistentPlayerId}`);
    
    // Try to find the room this user was in
    let recoveredRoomCode = null;
    let recoveredAsGameMaster = false;
    
    // Search through all game rooms to find the user
    for (const roomCode in gameRooms) {
      const room = gameRooms[roomCode];
      
      // Check if socket was a game master
      if (room.gamemasterPersistentId === socket.data.persistentPlayerId) {
        recoveredRoomCode = roomCode;
        recoveredAsGameMaster = true;
        
        // Update the room with new socket ID
        room.gamemasterSocketId = socket.id;
        room.gamemaster = socket.id;
        
        // Clear any GM disconnect timer if it was set
        if (room.gamemasterDisconnected === true) {
          if (room.gamemasterDisconnectTimer) {
            clearTimeout(room.gamemasterDisconnectTimer);
            room.gamemasterDisconnectTimer = null;
          }
          room.gamemasterDisconnected = false;
          
          // Emit an update to all clients in the room
          io.to(roomCode).emit('gm_disconnected_status', { disconnected: false });
        }
        
        console.log(`[Server] GM re-associated: PersistentID ${socket.data.persistentPlayerId} with socket ${socket.id} in room ${roomCode}`);
        break;
      }
      
      // Check if socket was a player
      const playerIndex = room.players.findIndex(p => p.persistentPlayerId === socket.data.persistentPlayerId);
      if (playerIndex !== -1) {
        recoveredRoomCode = roomCode;
        
        // Update player data
        room.players[playerIndex].id = socket.id;
        room.players[playerIndex].isActive = true;
        
        // Clear any player disconnect timer
        if (room.players[playerIndex].disconnectTimer) {
          clearTimeout(room.players[playerIndex].disconnectTimer);
          room.players[playerIndex].disconnectTimer = null;
        }
        
        console.log(`[Server] Player re-associated: PersistentID ${socket.data.persistentPlayerId} with socket ${socket.id} in room ${roomCode}`);
        
        // Emit to all clients that this player has reconnected
        io.to(roomCode).emit('player_reconnected_status', { 
          playerId: socket.id,
          persistentPlayerId: socket.data.persistentPlayerId,
          isActive: true
        });
        break;
      }
    }
    
    // If we found a room, make sure the socket joins it
    if (recoveredRoomCode) {
      socket.roomCode = recoveredRoomCode;
      socket.join(recoveredRoomCode);
      
      // Send current game state to the recovered client
      const gameState = getGameState(recoveredRoomCode);
      if (gameState) {
        socket.emit('game_state_update', gameState);
      }
    } else {
      // If we couldn't fully recover the session
      socket.emit('session_not_fully_recovered_join_manually');
      console.log(`[Server] Could not fully recover session for persistentPlayerId ${socket.data.persistentPlayerId}. Manual rejoin may be needed.`);
    }
  } else {
    console.log(`[Server] New connection or CSR failed: ${socket.id}. Client will need to send create_room or join_room.`);
  }

  // Create a new game room (Gamemaster)
  socket.on('create_room', ({ roomCode } = {}) => {
    const finalRoomCode = roomCode || generateRoomCode();
    console.log(`[Server] Creating room:`, {
      roomCode: finalRoomCode,
      gamemaster: socket.id,
      persistentGamemasterId: socket.data.persistentPlayerId,
      timestamp: new Date().toISOString()
    });
    
    // Only allow connection with isGameMaster = true to create rooms
    if (!socket.data.isGameMaster) {
      console.error(`[Server] Create room failed - Socket ${socket.id} not identified as GM`);
      socket.emit('error', { message: 'Only game masters can create rooms' });
      return;
    }
    
    gameRooms[finalRoomCode] = createGameRoom(finalRoomCode, socket.id, socket.data.persistentPlayerId);

    socket.join(finalRoomCode);
    socket.roomCode = finalRoomCode;
    socket.emit('room_created', { roomCode: finalRoomCode });
    console.log(`[Server] Room created successfully:`, {
      roomCode: finalRoomCode,
      gamemaster: socket.id,
      persistentGamemasterId: socket.data.persistentPlayerId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle player joining
  socket.on('join_room', ({ roomCode, playerName, isSpectator }) => {
    console.log(`[Server] Player joining room:`, {
      roomCode,
      playerName,
      playerId: socket.id,
      persistentPlayerId: socket.data.persistentPlayerId,
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
    
    // Explicitly mark as NOT gamemaster
    socket.data.isGameMaster = false;

    // Get persistent player ID from socket data
    const persistentPlayerId = socket.data.persistentPlayerId;
    const currentPlayerName = playerName || socket.data.playerName;

    // Check if this player is already in the room (by persistentPlayerId)
    const existingPlayerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
    
    if (existingPlayerIndex !== -1) {
      const existingPlayer = room.players[existingPlayerIndex];
      
      if (existingPlayer.isActive === false) {
        // Rejoining after disconnect
        console.log(`[Server] Player ${persistentPlayerId} rejoining room ${roomCode}`);
        
        // Update the player record
        existingPlayer.id = socket.id;
        existingPlayer.isActive = true;
        
        // Update name if it changed
        if (currentPlayerName && currentPlayerName !== existingPlayer.name) {
          existingPlayer.name = currentPlayerName;
        }
        
        // Clear any disconnect timer
        if (existingPlayer.disconnectTimer) {
          clearTimeout(existingPlayer.disconnectTimer);
          existingPlayer.disconnectTimer = null;
        }
        
        // Add socket to the room
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`[Server] Player rejoined successfully:`, {
          roomCode,
          playerName: existingPlayer.name,
          playerId: socket.id,
          persistentPlayerId,
          timestamp: new Date().toISOString()
        });
        
        // Emit events
        socket.emit('room_joined', { 
          roomCode,
          playerId: persistentPlayerId
        });
        
        // Notify room of player reconnection
        io.to(roomCode).emit('player_reconnected_status', {
          playerId: socket.id,
          persistentPlayerId,
          isActive: true
        });
        
        // Send full game state
        const gameState = getGameState(roomCode);
        if (gameState) {
          socket.emit('game_state_update', gameState);
        }
        
        // Broadcast updated player list
        broadcastGameState(roomCode);
        return;
      } 
      else if (existingPlayer.isActive === true && existingPlayer.id !== socket.id) {
        // Player already connected from another tab/device
        console.error(`[Server] Join room failed - Already connected from another tab/device:`, {
          roomCode,
          persistentPlayerId,
          existingSocketId: existingPlayer.id,
          newSocketId: socket.id
        });
        socket.emit('error', 'Already connected from another tab/device');
        return;
      }
      else if (existingPlayer.isActive === true && existingPlayer.id === socket.id) {
        // Redundant join request
        console.log(`[Server] Redundant join request from ${socket.id} for room ${roomCode}. Ensuring state consistency.`);
        
        // Ensure socket is in room
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        // Send room and game state
        socket.emit('room_joined', { 
          roomCode,
          playerId: persistentPlayerId
        });
        
        const gameState = getGameState(roomCode);
        if (gameState) {
          socket.emit('game_state_update', gameState);
        }
        
        return;
      }
    }
    
    // Check for duplicate names
    const isDuplicateName = room.players.some(player => 
      player.name.toLowerCase() === currentPlayerName.toLowerCase()
    );

    if (isDuplicateName) {
      console.error(`[Server] Join room failed - Name already taken:`, {
        roomCode,
        playerName: currentPlayerName,
        playerId: socket.id
      });
      socket.emit('error', 'This name is already taken in the room. Please choose a different name.');
      return;
    }
    
    // Add player to room
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    const player = {
      id: socket.id,
      persistentPlayerId: persistentPlayerId,
      name: currentPlayerName,
      lives: 3,
      answers: [],
      isActive: true,
      isSpectator,
      joinedAsSpectator: !!isSpectator,
      disconnectTimer: null
    };
    room.players.push(player);

    console.log(`[Server] Player joined successfully:`, {
      roomCode,
      playerName: currentPlayerName,
      playerId: socket.id,
      persistentPlayerId,
      totalPlayers: room.players.length,
      timestamp: new Date().toISOString()
    });

    // Send full game state to the joining player
    socket.emit('room_joined', { 
      roomCode,
      playerId: persistentPlayerId
    });
    
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

  // Add handler for request_players event
  socket.on('request_players', ({ roomCode }) => {
    console.log(`[Server] Received request_players for room:`, {
      roomCode,
      socketId: socket.id,
      persistentPlayerId: socket.data.persistentPlayerId,
      timestamp: new Date().toISOString()
    });
    
    const room = gameRooms[roomCode];
    if (!room) {
      console.error('[Server] request_players failed - Room not found:', roomCode);
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check if socket is the gamemaster or a player in this room
    // Use persistentPlayerId to identify rather than socket.id
    const isPotentialGameMaster = room.gamemasterPersistentId === socket.data.persistentPlayerId;
    const isPlayerInRoom = room.players.some(p => p.persistentPlayerId === socket.data.persistentPlayerId);
    
    console.log(`[Server] request_players authorization check:`, {
      roomCode,
      socketId: socket.id,
      isPotentialGameMaster,
      isPlayerInRoom,
      persistentPlayerId: socket.data.persistentPlayerId,
      gmPersistentId: room.gamemasterPersistentId,
      isGameMaster: socket.data.isGameMaster,
      timestamp: new Date().toISOString()
    });
    
    // Only authenticate as GM if: has same persistentId as GM AND declared isGameMaster: true in connection
    if (isPotentialGameMaster && socket.data.isGameMaster === true) {
      // This is a GM reconnection - update the socket ID reference
      if (room.gamemaster !== socket.id) {
        // Only update if claiming GM role with isGameMaster=true
        console.log(`[Server] Game master re-authenticated:`, {
          roomCode, 
          socketId: socket.id,
          persistentPlayerId: socket.data.persistentPlayerId
        });
        room.gamemaster = socket.id;
        room.gamemasterSocketId = socket.id;
        
        if (room.gamemasterDisconnected) {
          // Clear any disconnect timer
          if (room.gamemasterDisconnectTimer) {
            clearTimeout(room.gamemasterDisconnectTimer);
            room.gamemasterDisconnectTimer = null;
          }
          room.gamemasterDisconnected = false;
          
          // Notify everyone that GM is back
          io.to(roomCode).emit('gm_disconnected_status', { disconnected: false });
        }
      }
    }
  });

  // Handle answer submission
  socket.on('submit_answer', (data) => {
    const { roomCode, answer, hasDrawing, drawingData: clientDrawingData, answerAttemptId } = data;
    console.log(`[Server] Answer submission:`, {
      roomCode,
      playerId: socket.id,
      persistentPlayerId: socket.data.persistentPlayerId,
      hasDrawing, // This is the client's claim
      answerLength: answer?.length || 0,
      clientDrawingDataLength: clientDrawingData?.length || 0,
      answerAttemptId: answerAttemptId || 'no_id',
      timestamp: new Date().toISOString()
    });
    
    const room = gameRooms[roomCode];
    if (!room) {
      console.error('[Server] Answer submission failed - Room not found:', roomCode);
      socket.emit('error', 'Room not found');
      return;
    }

    const player = room.players.find(p => p.persistentPlayerId === socket.data.persistentPlayerId);
    if (!player || player.isSpectator || !player.isActive) {
      console.warn(`[Server SubmitAnswer] Denied for inactive/spectator player: ${socket.id}, persistentId: ${socket.data.persistentPlayerId}`);
      socket.emit('error', 'Submission denied: you are a spectator or inactive.');
      return;
    }

    if (room.submissionPhaseOver) {
      console.warn(`[Server SubmitAnswer] Denied: submission phase over for room ${roomCode}, player ${socket.id}`);
      socket.emit('error', 'Submission phase is over for this round.');
      return;
    }

    // Check for duplicate submission with same answerAttemptId
    if (answerAttemptId && 
        player.answers[room.currentQuestionIndex] && 
        player.answers[room.currentQuestionIndex].answerAttemptId === answerAttemptId) {
      console.log(`[Server SubmitAnswer] Duplicate submission detected with answerAttemptId ${answerAttemptId}`);
      // Acknowledge receipt to client but don't process further
      socket.emit('answer_received', { 
        status: 'success',
        message: 'Answer already received'
      });
      return;
    }

    // Check if player already submitted an answer for this question
    if (player.answers && 
        player.answers[room.currentQuestionIndex] && 
        !player.answers[room.currentQuestionIndex].answerAttemptId) {
      console.log(`[Server SubmitAnswer] Player ${socket.id} already submitted an answer for this question.`);
      // Acknowledge receipt but don't overwrite existing answer
      socket.emit('answer_received', { 
        status: 'success',
        message: 'Answer already received'
      });
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
        persistentPlayerId: socket.data.persistentPlayerId,
        playerName: player.name,
        answer,
        hasDrawing: finalHasDrawing, // Use server-determined finalHasDrawing
        drawingData: drawingDataForStorage,
        timestamp: Date.now(),
        isCorrect: null,
        answerAttemptId: answerAttemptId || null // Store the answerAttemptId
      };
      console.log(`[Server SubmitAns REFINED] Player ${socket.id}: Storing answerData. FinalHasDrawing: ${answerData.hasDrawing}, DrawingData Length: ${answerData.drawingData?.length}`);

      // Store in both places for consistency
      player.answers[room.currentQuestionIndex] = answerData;
      room.roundAnswers[socket.data.persistentPlayerId] = answerData;

      // Also update player boards if there's drawing data
      if (finalHasDrawing && drawingDataForStorage) {
        if (!room.playerBoards) {
          room.playerBoards = {};
        }
        
        // Store drawing in playerBoards with consistent format
        room.playerBoards[socket.id] = {
          boardData: drawingDataForStorage,
          roundIndex: room.currentQuestionIndex,
          timestamp: Date.now(),
          playerId: socket.id,
          persistentPlayerId: socket.data.persistentPlayerId
        };
        
        console.log(`[Server SubmitAns] Updated playerBoards for player ${socket.id} with drawing data`);
      }

      console.log(`[Server] Answer stored successfully:`, {
        roomCode,
        playerId: socket.id,
        persistentPlayerId: socket.data.persistentPlayerId,
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
      gameAnalytics.recordAnswer(roomCode, socket.data.persistentPlayerId, answer, null, responseTime);
      
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
      const persistentPlayerIdFromClient = playerId; // Use this clear name for the ID from client
      const playerObjInRoom = room.players.find(p => p.persistentPlayerId === persistentPlayerIdFromClient);
      const submittedAnswerData = room.roundAnswers[persistentPlayerIdFromClient];

      if (!submittedAnswerData) {
        console.warn(`[Server EVal] No answer submission found in roundAnswers for persistentPlayerId: ${persistentPlayerIdFromClient} in room ${roomCode}. Evaluation aborted.`);
        // Optionally, inform GM that this player didn't submit or answer already cleared.
        socket.emit('info', { message: `No answer found for player to evaluate.` });
        return;
      }

      // Update the canonical answer record in roundAnswers and evaluatedAnswers
      submittedAnswerData.isCorrect = isCorrect;
      room.evaluatedAnswers[persistentPlayerIdFromClient] = isCorrect;

      if (playerObjInRoom) {
        // Player is still actively in the room.players array, update their specific records and lives
        console.log('[Server Eval] Player found in room.players:', { persistentPlayerId: playerObjInRoom.persistentPlayerId, name: playerObjInRoom.name, currentLives: playerObjInRoom.lives });
        
        // Update player's answer array (indexed by question number)
        const playerSpecificAnswerRecord = playerObjInRoom.answers[room.currentQuestionIndex];
        if (playerSpecificAnswerRecord) {
            playerSpecificAnswerRecord.isCorrect = isCorrect;
        } else {
            // This case should ideally not happen if roundAnswers has the submission,
            // but as a fallback, ensure the player's answer array is updated.
            // This assumes player.answers is an array initialized for each question.
            if (playerObjInRoom.answers && room.currentQuestionIndex !== undefined) {
                 playerObjInRoom.answers[room.currentQuestionIndex] = { 
                    ...(submittedAnswerData), // copy data from roundAnswer
                    isCorrect: isCorrect 
                };
            }
        }

        if (!isCorrect) {
          playerObjInRoom.lives = Math.max(0, (playerObjInRoom.lives || 0) - 1);
          console.log('[Server Eval] Player lives after decrement:', { persistentPlayerId: playerObjInRoom.persistentPlayerId, newLives: playerObjInRoom.lives });
          if (playerObjInRoom.lives <= 0) {
            playerObjInRoom.isActive = false;
            playerObjInRoom.isSpectator = true;
            const playerSocket = io.sockets.sockets.get(playerObjInRoom.id);
            if (playerSocket) {
                playerSocket.emit('become_spectator');
                console.log('[Server Eval] Notified player socket ${playerObjInRoom.id} to become spectator.');
            } else {
                console.warn('[Server Eval] Could not find active socket for player ${playerObjInRoom.id} to notify become_spectator.');
            }
            console.log('[Server Eval] Player has no lives left. Setting to spectator.', { persistentPlayerId: playerObjInRoom.persistentPlayerId });
          }
        }
      } else {
        console.log(`[Server EVal] Player object for persistentPlayerId ${persistentPlayerIdFromClient} not found in room.players. Evaluation recorded in roundAnswers/evaluatedAnswers, but lives/player-specific answer array not updated directly on a player object.`);
      }

      // Game over check (based on players still actively in room.players)
      const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
      console.log(`[Server Eval] Active players remaining in room.players: ${activePlayers.length}`);

      if (room.started && activePlayers.length <= 1 && room.players.length > 0) {
        if (!room.isConcluded) {
            const winner = activePlayers.length === 1 ? { 
                id: activePlayers[0].id, 
                persistentPlayerId: activePlayers[0].persistentPlayerId,
                name: activePlayers[0].name 
            } : null;
            console.log(`[Server Eval] Game ending condition met. Winner: ${winner ? winner.name : 'None (draw or all out)'}`);
            concludeGameAndSendRecap(roomCode, winner);
        }
      }

      broadcastGameState(roomCode);
      console.log('[Server Eval] Broadcasted game state after evaluation for persistentPlayerId:', persistentPlayerIdFromClient);

      const responseTime = Date.now() - (room.questionStartTime || Date.now());
      gameAnalytics.recordAnswer(roomCode, persistentPlayerIdFromClient, submittedAnswerData.answer, isCorrect, responseTime);

    } catch (error) {
      console.error('Error evaluating answer:', { error: error.message, stack: error.stack, roomCode, persistentPlayerIdFromClient: playerId });
      socket.emit('error', 'Failed to evaluate answer due to server error.');
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

  // Handle player kick
  socket.on('kick_player', ({ roomCode, playerIdToKick }) => {
    try {
      const room = gameRooms[roomCode];
      if (!room) {
        console.error(`[Server Kick] Kick failed: Room ${roomCode} not found.`);
        socket.emit('error', { message: `Room ${roomCode} not found.` });
        return;
      }
      
      console.log(`[Server Kick] Kick request from socket ${socket.id} for player ${playerIdToKick} in room ${roomCode}`);
      console.log(`[Server Kick] Room gamemaster is: ${room.gamemaster}, comparing with requester: ${socket.id}`);

      // Simple check: is the socket ID that's making the request the current game master?
      if (socket.id !== room.gamemaster) {
        console.error(`[Server Kick] Kick failed: Socket ${socket.id} is not the GM of room ${roomCode}.`);
        socket.emit('error', { message: 'Only the Game Master can kick players.' });
        return;
      }

      // Check if trying to kick self - use the provided ID directly
      if (playerIdToKick === socket.id) {
        console.error(`[Server Kick] Kick failed: GM ${socket.id} cannot kick themselves from room ${roomCode}.`);
        socket.emit('error', { message: 'Game Master cannot kick themselves.' });
        return;
      }

      // Determine if playerIdToKick is a socket ID or persistentPlayerId
      let playerIndex = room.players.findIndex(p => p.id === playerIdToKick);
      
      // If not found by socket ID, try persistent ID
      if (playerIndex === -1) {
        playerIndex = room.players.findIndex(p => p.persistentPlayerId === playerIdToKick);
      }

      if (playerIndex === -1) {
        console.warn(`[Server Kick] Player with ID ${playerIdToKick} not found in room ${roomCode} for kicking. Broadcasting current state.`);
        socket.emit('error', { message: 'Player not found. They may have already left the game.' });
        return;
      }

      const kickedPlayer = room.players[playerIndex];
      room.players.splice(playerIndex, 1);
      console.log(`[Server Kick] Player ${kickedPlayer.name} (Socket ID: ${kickedPlayer.id}) kicked from room ${roomCode} by GM ${socket.id}`);

      // Notify the kicked player
      const kickedPlayerSocket = io.sockets.sockets.get(kickedPlayer.id);
      if (kickedPlayerSocket) {
        kickedPlayerSocket.emit('kicked_from_room', { roomCode, reason: 'Kicked by Game Master' });
        kickedPlayerSocket.leave(roomCode);
        console.log(`[Server Kick] Notified player ${kickedPlayer.id} and made them leave room ${roomCode}.`);
      }

      // Clean up player boards
      if (room.playerBoards && room.playerBoards[kickedPlayer.id]) {
        delete room.playerBoards[kickedPlayer.id];
      }
      
      // Clean up from roundAnswers and evaluatedAnswers which are keyed by persistentPlayerId
      const persistentId = kickedPlayer.persistentPlayerId;
      if (room.roundAnswers && room.roundAnswers[persistentId]) {
        delete room.roundAnswers[persistentId];
      }
      
      if (room.evaluatedAnswers && room.evaluatedAnswers[persistentId]) {
        delete room.evaluatedAnswers[persistentId];
      }

      // Broadcast updated game state which includes player list
      broadcastGameState(roomCode);
      console.log(`[Server Kick] Broadcasted game state for room ${roomCode} after kicking player.`);

    } catch (error) {
      console.error(`[Server Kick] Error handling kick_player for room ${roomCode}, player ${playerIdToKick}:`, error);
      socket.emit('error', { message: 'An internal server error occurred while trying to kick the player.' });
    }
  });

  // Handle kick player by socket ID (new method)
  socket.on('kick_player_by_socket', ({ roomCode, playerSocketId, kickerSocketId }) => {
    try {
      const room = gameRooms[roomCode];
      if (!room) {
        console.error(`[Server Kick] Kick failed: Room ${roomCode} not found.`);
        socket.emit('error', { message: `Room ${roomCode} not found.` });
        return;
      }

      // Make sure the kicker is the game master
      if (socket.id !== room.gamemaster) {
        console.error(`[Server Kick] Kick failed: Socket ${socket.id} is not the GM of room ${roomCode}.`);
        socket.emit('error', { message: 'Only the Game Master can kick players.' });
        return;
      }

      // Find player by socket ID (not persistentPlayerId)
      const playerIndex = room.players.findIndex(p => p.id === playerSocketId);
      if (playerIndex === -1) {
        console.warn(`[Server Kick] Player with socket ID ${playerSocketId} not found in room ${roomCode} for kicking. Broadcasting current state.`);
        socket.emit('error', { message: 'Player not found. They may have already left the game.' });
        return;
      }

      const kickedPlayer = room.players[playerIndex];
      
      // Check if this is the game master trying to kick themselves
      if (kickedPlayer.persistentPlayerId === room.gamemasterPersistentId) {
        console.error(`[Server Kick] Kick failed: GM ${socket.id} cannot kick themselves from room ${roomCode}.`);
        socket.emit('error', { message: 'Game Master cannot kick themselves.' });
        return;
      }

      // Remove the player from the room
      room.players.splice(playerIndex, 1);
      console.log(`[Server Kick] Player ${kickedPlayer.name} (Socket ID: ${playerSocketId}) kicked from room ${roomCode} by GM ${socket.id}`);

      // Notify the kicked player
      const kickedPlayerSocket = io.sockets.sockets.get(playerSocketId);
      if (kickedPlayerSocket) {
        kickedPlayerSocket.emit('kicked_from_room', { roomCode, reason: 'Kicked by Game Master' });
        kickedPlayerSocket.leave(roomCode);
        console.log(`[Server Kick] Notified player ${playerSocketId} and made them leave room ${roomCode}.`);
      }

      // Clean up player boards
      if (room.playerBoards && room.playerBoards[playerSocketId]) {
        delete room.playerBoards[playerSocketId];
      }
      
      // Clean up from roundAnswers and evaluatedAnswers which are keyed by persistentPlayerId
      const persistentId = kickedPlayer.persistentPlayerId;
      if (room.roundAnswers && room.roundAnswers[persistentId]) {
        delete room.roundAnswers[persistentId];
      }
      
      if (room.evaluatedAnswers && room.evaluatedAnswers[persistentId]) {
        delete room.evaluatedAnswers[persistentId];
      }

      // Broadcast updated game state which includes player list
      broadcastGameState(roomCode);
      console.log(`[Server Kick] Broadcasted game state for room ${roomCode} after kicking player by socket ID.`);

    } catch (error) {
      console.error(`[Server Kick] Error handling kick_player_by_socket for room ${roomCode}, player ${playerSocketId}:`, error);
      socket.emit('error', { message: 'An internal server error occurred while trying to kick the player.' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    // Get data from socket
    const roomCode = socket.roomCode;
    const { persistentPlayerId, playerName, isGameMaster } = socket.data || {};
    
    console.log(`[Server] Socket disconnected:`, {
      socketId: socket.id, 
      persistentPlayerId, 
      playerName, 
      isGameMaster, 
      reason, 
      roomCode,
      timestamp: new Date().toISOString()
    });
    
    // If not in a room, nothing to do
    if (!roomCode || !gameRooms[roomCode]) {
      console.log(`[Server] Disconnect: No roomCode found on socket or room not found: ${roomCode}`);
      return;
    }
    
    const room = gameRooms[roomCode];
    
    // Check if the disconnect is likely to be temporary and eligible for CSR
    const isTemporaryDisconnect = (
      reason === 'transport close' || 
      reason === 'transport error' || 
      reason === 'ping timeout' ||
      reason === 'client ping timeout'
    );
    
    console.log(`[Server] Disconnect reason: ${reason}, considered temporary for CSR: ${isTemporaryDisconnect}`);
    
    // Handle Game Master disconnect
    if (isGameMaster && persistentPlayerId === room.gamemasterPersistentId && socket.id === room.gamemasterSocketId) {
      console.log(`[Server] Game Master disconnected from room ${roomCode}`);
      
      // Mark the GM as disconnected
      room.gamemasterDisconnected = true;
      
      // Notify all clients in the room
      io.to(roomCode).emit('gm_disconnected_status', { 
        disconnected: true,
        temporary: isTemporaryDisconnect
      });
      
      // Set timer only if this is not likely a temporary disconnect
      // If it's a temporary disconnect, Socket.IO CSR will handle reconnection
      if (!isTemporaryDisconnect) {
        // Start a timer to end the game if GM doesn't reconnect
        const maxDisconnectionDuration = 2 * 60 * 1000; // 2 minutes, matching CSR setting
        const gracePeriod = 10 * 1000; // Additional 10 seconds grace period
        
        room.gamemasterDisconnectTimer = setTimeout(() => {
          // If GM is still disconnected when timer fires
          if (room.gamemasterDisconnected) {
            console.log(`[Server] Game Master did not reconnect within allowed time. Ending game in room ${roomCode}`);
            
            // End the game
            io.to(roomCode).emit('game_over', { reason: 'Game Master disconnected' });
            
            // Clean up the room
            delete gameRooms[roomCode];
          }
        }, maxDisconnectionDuration + gracePeriod);
      }
    }
    // Handle Player disconnect
    else if (!isGameMaster) {
      // Find the player by persistentPlayerId
      const playerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
      
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        
        // Ensure it's the active socket for this player
        if (player.id === socket.id) {
          if (reason === 'client namespace disconnect' || reason === 'server namespace disconnect') {
            // Graceful disconnect - remove player completely
            console.log(`[Server] Player ${player.name} (${player.id}) gracefully disconnected from room ${roomCode}`);
            
            // Remove player from the room
            room.players.splice(playerIndex, 1);
            
            // Clean up associated data
            if (room.playerBoards && room.playerBoards[player.id]) {
              delete room.playerBoards[player.id];
            }
            
            if (room.roundAnswers && room.roundAnswers[persistentPlayerId]) {
              delete room.roundAnswers[persistentPlayerId];
            }
            
            if (room.evaluatedAnswers && room.evaluatedAnswers[persistentPlayerId]) {
              delete room.evaluatedAnswers[persistentPlayerId];
            }
            
            // Notify clients
            io.to(roomCode).emit('player_left_gracefully', { 
              playerId: player.id,
              persistentPlayerId: player.persistentPlayerId,
              playerName: player.name
            });
          } 
          else {
            // Abrupt disconnect - mark player as inactive but give time to reconnect
            console.log(`[Server] Player ${player.name} (${player.id}) abruptly disconnected from room ${roomCode}. Waiting for reconnection.`);
            
            // Mark as inactive
            player.isActive = false;
            
            // Notify clients
            io.to(roomCode).emit('player_disconnected_status', {
              playerId: player.id,
              persistentPlayerId: player.persistentPlayerId,
              isActive: false,
              temporary: isTemporaryDisconnect
            });
            
            // Set timer only if this is not likely a temporary disconnect
            // If it's a temporary disconnect, Socket.IO CSR will handle reconnection
            if (!isTemporaryDisconnect) {
              // Start a timer to remove player if they don't reconnect
              const maxDisconnectionDuration = 2 * 60 * 1000; // 2 minutes, matching CSR setting
              const gracePeriod = 15 * 1000; // Additional 15 seconds grace period
              
              player.disconnectTimer = setTimeout(() => {
                // Check if the player is still inactive when timer fires
                const currentPlayerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
                
                if (currentPlayerIndex !== -1 && room.players[currentPlayerIndex].isActive === false) {
                  console.log(`[Server] Player ${player.name} (persistentPlayerId: ${persistentPlayerId}) did not reconnect within allowed time. Removing from room ${roomCode}`);
                  
                  // Remove player from the room
                  const removedPlayer = room.players.splice(currentPlayerIndex, 1)[0];
                  
                  // Clean up associated data
                  if (room.playerBoards && room.playerBoards[removedPlayer.id]) {
                    delete room.playerBoards[removedPlayer.id];
                  }
                  
                  if (room.roundAnswers && room.roundAnswers[persistentPlayerId]) {
                    delete room.roundAnswers[persistentPlayerId];
                  }
                  
                  if (room.evaluatedAnswers && room.evaluatedAnswers[persistentPlayerId]) {
                    delete room.evaluatedAnswers[persistentPlayerId];
                  }
                  
                  // Notify clients
                  io.to(roomCode).emit('player_removed_after_timeout', { 
                    playerId: removedPlayer.id,
                    persistentPlayerId: removedPlayer.persistentPlayerId,
                    playerName: removedPlayer.name
                  });
                }
                
                // Broadcast updated game state
                broadcastGameState(roomCode);
              }, maxDisconnectionDuration + gracePeriod);
            }
          }
          
          // Broadcast updated game state after any player status change
          broadcastGameState(roomCode);
        }
      }
    }
  });

  // Handle rejoin_room for reconnections (especially after F5)
  socket.on('rejoin_room', ({ roomCode, isGameMaster, persistentPlayerId }) => {
    console.log(`[Server] Received rejoin_room request:`, {
      roomCode,
      socketId: socket.id,
      persistentPlayerId: persistentPlayerId || socket.data.persistentPlayerId,
      isGameMaster,
      timestamp: new Date().toISOString()
    });
    
    const room = gameRooms[roomCode];
    if (!room) {
      console.error('[Server] rejoin_room failed - Room not found:', roomCode);
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Get the persistent ID (prefer the one passed in the event, fallback to socket.data)
    const actualPersistentId = persistentPlayerId || socket.data.persistentPlayerId;
    
    // Handle game master rejoining - must explicitly claim GM role with isGameMaster=true
    if (isGameMaster === true && room.gamemasterPersistentId === actualPersistentId) {
      // This is indeed the game master, update references
      room.gamemaster = socket.id;
      room.gamemasterSocketId = socket.id;
      
      // Add socket to the room
      socket.join(roomCode);
      socket.roomCode = roomCode;
      
      // Clear GM disconnect status if needed
      if (room.gamemasterDisconnected) {
        if (room.gamemasterDisconnectTimer) {
          clearTimeout(room.gamemasterDisconnectTimer);
          room.gamemasterDisconnectTimer = null;
        }
        room.gamemasterDisconnected = false;
        io.to(roomCode).emit('gm_disconnected_status', { disconnected: false });
      }
      
      console.log(`[Server] Game master rejoined room ${roomCode}:`, {
        socketId: socket.id,
        persistentPlayerId: actualPersistentId
      });
      
      // Confirm room joined
      socket.emit('room_created', { roomCode });
      
      // Send the current game state
      const gameState = getGameState(roomCode);
      if (gameState) {
        socket.emit('game_state_update', gameState);
      }
      
      // Send the current player list
      socket.emit('players_update', room.players);
      return;
    }
    
    // Handle player rejoining
    const playerIndex = room.players.findIndex(p => p.persistentPlayerId === actualPersistentId);
    if (playerIndex !== -1) {
      // Found the player, update their socket info
      const player = room.players[playerIndex];
      const oldSocketId = player.id;
      
      // Update player info
      player.id = socket.id;
      player.isActive = true;
      
      // Clear any disconnect timer
      if (player.disconnectTimer) {
        clearTimeout(player.disconnectTimer);
        player.disconnectTimer = null;
      }
      
      // Add socket to the room
      socket.join(roomCode);
      socket.roomCode = roomCode;
      
      console.log(`[Server] Player rejoined room ${roomCode}:`, {
        socketId: socket.id,
        oldSocketId,
        playerName: player.name,
        persistentPlayerId: actualPersistentId
      });
      
      // Notify everyone about reconnection
      io.to(roomCode).emit('player_reconnected_status', {
        playerId: socket.id,
        persistentPlayerId: actualPersistentId,
        isActive: true
      });
      
      // Confirm room joined
      socket.emit('room_joined', { 
        roomCode,
        playerId: actualPersistentId
      });
      
      // Send the current game state
      const gameState = getGameState(roomCode);
      if (gameState) {
        socket.emit('game_state_update', gameState);
      }
      
      // Send the current player list
      socket.emit('players_update', room.players);
      return;
    }
    
    // If we get here, the persistent ID doesn't match any GM or player
    console.error('[Server] rejoin_room failed - Unauthorized:', {
      roomCode,
      socketId: socket.id,
      persistentPlayerId: actualPersistentId
    });
    socket.emit('error', { message: 'Not authorized to rejoin this room' });
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