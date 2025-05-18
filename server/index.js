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
        id: player.persistentPlayerId,
        name: player.name,
        joinTime: new Date(),
        answers: [],
        correctAnswers: 0,
        averageResponseTime: 0
      });
    }
  },
  
  recordAnswer(roomCode, persistentPlayerId, answer, isCorrect, responseTime) {
    const game = this.games[roomCode];
    if (!game) return;
    
    const playerAnalyticEntry = game.players.find(p => p.id === persistentPlayerId);
    if (!playerAnalyticEntry) return;
    
    playerAnalyticEntry.answers.push({ answer, isCorrect, responseTime });
    if (isCorrect) playerAnalyticEntry.correctAnswers++;
    
    const totalTime = playerAnalyticEntry.answers.reduce((sum, a) => sum + a.responseTime, 0);
    playerAnalyticEntry.averageResponseTime = totalTime / playerAnalyticEntry.answers.length;
    
    game.totalAnswers++;
    if (isCorrect) game.correctAnswers++;
    if (game.totalAnswers > 0) {
        game.averageResponseTime = (game.averageResponseTime * (game.totalAnswers - 1) + responseTime) / game.totalAnswers;
    } else {
        game.averageResponseTime = responseTime;
    }
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
function createGameRoom(roomCode, gamemasterPersistentId, gamemasterSocketId) {
  return {
    roomCode,
    gamemasterPersistentId, // Store persistent ID of GM
    gamemasterSocketId,     // Store current socket ID of GM
    gamemaster: gamemasterSocketId, // Keep original gamemaster field for compatibility or specific uses, points to socketId
    gamemasterDisconnected: false, // Track GM disconnect status
    gmDisconnectTimer: null, // Timer for GM auto-game-end
    players: [], // Player objects will now include persistentPlayerId
    playerDisconnectTimers: {}, // Store disconnect timers for players, keyed by persistentPlayerId
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
    Object.entries(room.playerBoards || {}).forEach(([pId, boardData]) => {
      if (boardData.roundIndex === index) {
        boardsForRound[pId] = boardData.boardData;
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
          playerId: player.persistentPlayerId,
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
      id: player.persistentPlayerId,
      persistentPlayerId: player.persistentPlayerId,
      name: player.name,
      finalLives: player.lives,
      isSpectator: player.isSpectator,
      isActive: player.isActive,
      isWinner: player.isWinner || (room.players.filter(p => p.isActive && p.lives > 0).length === 1 && player.persistentPlayerId === room.players.find(p => p.isActive && p.lives > 0)?.persistentPlayerId)
    })),
    rounds: playedRounds
  };
}

// Determine the correct build path based on environment
/*
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
*/

const server = http.createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true, // Recommended for CSR
  },
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

// Middleware for authentication and persistent player ID management
io.use((socket, next) => {
  const { persistentPlayerId: authPlayerId, playerName: authPlayerName } = socket.handshake.auth;
  const { isGameMaster: isGameMasterQuery, roomCode: roomCodeQuery } = socket.handshake.query;

  socket.data = socket.data || {}; // Ensure socket.data exists

  socket.data.isGameMaster = isGameMasterQuery === 'true';
  socket.data.playerName = authPlayerName;

  let assignedPersistentId = authPlayerId;

  if (!assignedPersistentId) {
    if (socket.data.isGameMaster) {
      assignedPersistentId = `GM-${uuidv4()}`;
    } else if (socket.data.playerName) { // Only assign P-id if player name is present
      assignedPersistentId = `P-${uuidv4()}`;
    }
    // If not GM and no playerName, assignedPersistentId remains undefined for now
    // The connection handler or subsequent events (like join_room) will need playerName
  }
  socket.data.persistentPlayerId = assignedPersistentId;

  // For initial GM connection via query, store temp room code on socket.data for connection handler
  if (socket.data.isGameMaster && roomCodeQuery) {
    socket.data.initialRoomCodeQuery = roomCodeQuery;
  }

  console.log(`[Server Auth Middleware] Socket ID: ${socket.id}, Auth Data:`, socket.handshake.auth, 
              `Query Data:`, socket.handshake.query);
  console.log(`[Server Auth Middleware] Assigned Socket Data: persistentPlayerId: ${socket.data.persistentPlayerId}, ` +
              `playerName: ${socket.data.playerName}, isGameMaster: ${socket.data.isGameMaster}`);

  // For non-CSR, non-GM connections, playerName is critical.
  // If CSR is active (socket.recovered is true), this middleware might be skipped or data might be stale initially.
  // The main connection handler will deal with recovered state.
  if (!socket.recovered && !socket.data.isGameMaster && !socket.data.playerName) {
    // This error will be caught by client's connect_error listener
    return next(new Error('Player name required for new connection.'));
  }

  next();
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
  console.log(`[Server Connection] User connected. Socket ID: ${socket.id}, Persistent ID: ${socket.data.persistentPlayerId}, Player Name: ${socket.data.playerName}, Is GM (from query): ${socket.data.isGameMaster}, Recovered: ${socket.recovered}`);

  if (!socket.data.persistentPlayerId && !socket.recovered) {
    console.warn(`[Server Connection] User ${socket.id} connected without a persistentPlayerId assigned by middleware and not recovered. Client will need to send join_room or create_room.`);
    socket.emit('persistent_id_assigned', { persistentPlayerId: socket.data.persistentPlayerId });
  }

  if (socket.recovered) {
    console.log(`[Server Connection] Session recovered for Socket ID: ${socket.id}, Persistent ID: ${socket.data.persistentPlayerId}`);
    let roomFoundForRecovery = false;
    let recoveredRoomCode = null;

    for (const rc in gameRooms) {
      const room = gameRooms[rc];
      // Try to find GM by persistentId
      if (room.gamemasterPersistentId === socket.data.persistentPlayerId) {
        console.log(`[Server Recovery] GM ${socket.data.persistentPlayerId} reconnected to room ${rc}. Old socket: ${room.gamemasterSocketId}, New socket: ${socket.id}`);
        const oldSocketId = room.gamemasterSocketId;
        room.gamemasterSocketId = socket.id; // Update to new socket ID
        room.gamemaster = socket.id; // Keep this field updated too
        socket.roomCode = rc; // Associate new socket with the room code
        recoveredRoomCode = rc;

        if (room.gamemasterDisconnected) {
          console.log(`[Server Recovery] GM ${socket.data.persistentPlayerId} was marked disconnected. Clearing timer and status.`);
          if (room.gmDisconnectTimer) {
            clearTimeout(room.gmDisconnectTimer);
            room.gmDisconnectTimer = null;
          }
          room.gamemasterDisconnected = false;
          io.to(rc).emit('gm_disconnected_status', { roomCode: rc, isDisconnected: false, gmName: socket.data.playerName || 'GameMaster' });
        }
        roomFoundForRecovery = true;
        break;
      }

      // Try to find Player by persistentId
      const player = room.players.find(p => p.persistentPlayerId === socket.data.persistentPlayerId);
      if (player) {
        console.log(`[Server Recovery] Player ${player.name} (${socket.data.persistentPlayerId}) reconnected to room ${rc}. Old socket: ${player.id}, New socket: ${socket.id}`);
        player.id = socket.id; // Update to new socket ID
        player.isActive = true;
        socket.roomCode = rc; // Associate new socket with the room code
        recoveredRoomCode = rc;

        if (room.playerDisconnectTimers && room.playerDisconnectTimers[player.persistentPlayerId]) {
          console.log(`[Server Recovery] Clearing disconnect timer for player ${player.persistentPlayerId}`);
          clearTimeout(room.playerDisconnectTimers[player.persistentPlayerId]);
          delete room.playerDisconnectTimers[player.persistentPlayerId];
        }
        io.to(rc).emit('player_reconnected_status', { roomCode: rc, playerId: player.persistentPlayerId, playerName: player.name, newSocketId: socket.id });
        roomFoundForRecovery = true;
        break;
      }
    }

    if (roomFoundForRecovery && recoveredRoomCode) {
      console.log(`[Server Recovery] Socket ${socket.id} attempting to rejoin Socket.IO room ${recoveredRoomCode}`);
      socket.join(recoveredRoomCode); // Client socket should auto-rejoin, this is an explicit server-side confirmation/action
      console.log(`[Server Recovery] Emitting current game state to recovered socket ${socket.id} for room ${recoveredRoomCode}`);
      const currentGameState = getGameState(recoveredRoomCode);
      if (currentGameState) {
        socket.emit('game_state_update', currentGameState);
      } else {
        console.warn(`[Server Recovery] No game state found for room ${recoveredRoomCode} to send to recovered socket.`);
      }
    } else {
      console.log(`[Server Recovery] Persistent ID ${socket.data.persistentPlayerId} recovered session but no active room association found.`);
      socket.emit('session_not_fully_recovered_join_manually');
    }

  } else { // socket.recovered === false (New connection or CSR failed)
    console.log(`[Server Connection] New connection (or CSR failed) for Socket ID: ${socket.id}, Persistent ID: ${socket.data.persistentPlayerId}. Client needs to send create_room or join_room.`);
    // If it's a GM connecting for the first time with query parameters, create_room logic might be triggered by client.
    // If it was initial GM connection via query, middleware stored initialRoomCodeQuery.
    // We could optimistically try to use it here, but it's safer to let client send create_room.
  }

  // Create a new game room (Gamemaster)
  socket.on('create_room', ({ roomCode: requestedRoomCode } = {}) => {
    // Use persistentPlayerId and playerName from socket.data (assigned by middleware)
    const { persistentPlayerId: gmPersistentId, playerName: gmName, isGameMaster } = socket.data;

    if (!isGameMaster) {
      socket.emit('error', { message: 'Only designated Game Masters can create rooms via this path.' });
      console.warn(`[Server CreateRoom] Attempt by non-GM socket ${socket.id} (PersistentID: ${gmPersistentId}) to create room.`);
      return;
    }

    if (!gmPersistentId) {
      // This should ideally not happen if middleware ran correctly for a GM
      console.error(`[Server CreateRoom] Critical: Game Master (socket ${socket.id}) has no persistentPlayerId. Cannot create room.`);
      socket.emit('error', { message: 'Internal server error: Game Master identity not established.' });
      return;
    }

    const finalRoomCode = requestedRoomCode || generateRoomCode();
    console.log(`[Server CreateRoom] GM ${gmName} (${gmPersistentId}, socket ${socket.id}) creating room: ${finalRoomCode}`);
    
    // createGameRoom now takes (roomCode, gamemasterPersistentId, gamemasterSocketId)
    gameRooms[finalRoomCode] = createGameRoom(finalRoomCode, gmPersistentId, socket.id);
    // Optionally, store GM name in room if needed: gameRooms[finalRoomCode].gamemasterName = gmName;

    socket.join(finalRoomCode);
    socket.roomCode = finalRoomCode; // Important: associate socket with roomCode
    
    socket.emit('room_created', { roomCode: finalRoomCode, gamemasterPersistentId: gmPersistentId });
    console.log(`[Server CreateRoom] Room ${finalRoomCode} created successfully by GM ${gmPersistentId}.`);
  });

  // Handle player joining
  socket.on('join_room', ({ roomCode, playerName: clientPlayerName, isSpectator }) => {
    const { persistentPlayerId: pIdFromAuth, playerName: nameFromAuth } = socket.data;
    const effectivePlayerName = clientPlayerName || nameFromAuth; // Prefer name from join_room payload, fallback to auth

    console.log(`[Server JoinRoom] Player ${effectivePlayerName} (PersistentAuthID: ${pIdFromAuth}, Socket: ${socket.id}) attempting to join room: ${roomCode}`);
    
    if (!gameRooms[roomCode]) {
      console.error(`[Server JoinRoom] Failed: Invalid room code ${roomCode} for player ${effectivePlayerName}`);
      socket.emit('error', 'Invalid room code');
      return;
    }

    const room = gameRooms[roomCode];
    let playerPersistentId = pIdFromAuth;

    // If persistentId was not assigned by auth (e.g. player name was missing then), try to generate one now if we have a name
    if (!playerPersistentId && effectivePlayerName) {
        playerPersistentId = `P-${uuidv4()}`;
        socket.data.persistentPlayerId = playerPersistentId; // Update socket.data for this session
        socket.emit('persistent_id_assigned', { persistentPlayerId }); // Inform client of newly assigned P-ID
        console.log(`[Server JoinRoom] Assigned new persistentPlayerId ${playerPersistentId} to player ${effectivePlayerName} (socket ${socket.id}) during join.`);
    } else if (!playerPersistentId && !effectivePlayerName) {
        console.error(`[Server JoinRoom] Failed: Player name missing for new player (Socket: ${socket.id}) in room ${roomCode}.`);
        socket.emit('error', 'Player name is required to join.');
        return;
    }

    socket.roomCode = roomCode; // Associate socket with roomCode
    let existingPlayer = room.players.find(p => p.persistentPlayerId === playerPersistentId);

    if (existingPlayer) {
      if (!existingPlayer.isActive) { // Rejoining after abrupt disconnect
        console.log(`[Server JoinRoom] Player ${existingPlayer.name} (${playerPersistentId}) rejoining room ${roomCode}. Old socket: ${existingPlayer.id}, New socket: ${socket.id}`);
        existingPlayer.id = socket.id; // Update socket id
        existingPlayer.isActive = true;
        existingPlayer.name = effectivePlayerName; // Allow name update on rejoin
        existingPlayer.isSpectator = !!isSpectator; // Allow role update on rejoin

        if (room.playerDisconnectTimers && room.playerDisconnectTimers[playerPersistentId]) {
          clearTimeout(room.playerDisconnectTimers[playerPersistentId]);
          delete room.playerDisconnectTimers[playerPersistentId];
          console.log(`[Server JoinRoom] Cleared disconnect timer for rejoining player ${playerPersistentId}.`);
        }
        socket.join(roomCode);
        socket.emit('room_joined', { roomCode, playerId: playerPersistentId, message: 'Rejoined room successfully.' });
        io.to(roomCode).emit('player_reconnected_status', { roomCode, playerId: playerPersistentId, playerName: existingPlayer.name, newSocketId: socket.id, isActive: true });
        broadcastGameState(roomCode);
      } else if (existingPlayer.id !== socket.id) { // Active but with a different socket (duplicate tab/device)
        console.warn(`[Server JoinRoom] Player ${effectivePlayerName} (${playerPersistentId}) trying to join room ${roomCode} from new socket ${socket.id} but already active with socket ${existingPlayer.id}.`);
        socket.emit('error', 'Already connected to this room from another tab or device.');
        // Do not add to room or change existing player's socket id
        return; // Explicitly return to prevent further processing for this socket connection
      } else { // existingPlayer.id === socket.id (already joined with this exact socket, redundant call)
        console.log(`[Server JoinRoom] Player ${effectivePlayerName} (${playerPersistentId}) sent redundant join for room ${roomCode} with same socket ${socket.id}. Ensuring state is correct.`);
        socket.join(roomCode); // Ensure in Socket.IO room
        socket.emit('room_joined', { roomCode, playerId: playerPersistentId, message: 'Already in room.' });
        // No need to broadcast state if nothing changed.
      }
    } else { // New player
      const isDuplicateName = room.players.some(p => p.name.toLowerCase() === effectivePlayerName.toLowerCase() && p.isActive);
      if (isDuplicateName) {
        console.error(`[Server JoinRoom] Failed: Name "${effectivePlayerName}" already taken in room ${roomCode}.`);
        socket.emit('error', 'This name is already taken in the room. Please choose a different name.');
        return;
      }

      const newPlayer = {
        id: socket.id,
        persistentPlayerId: playerPersistentId, // Store persistent ID
        name: effectivePlayerName,
        lives: 3, // Default lives
        answers: [],
        isActive: true,
        isSpectator: !!isSpectator,
        score: 0, // Initialize score
        isWinner: false, // Initialize winner status
        joinedAsSpectator: !!isSpectator
      };
      room.players.push(newPlayer);
      socket.join(roomCode);
      console.log(`[Server JoinRoom] New player ${newPlayer.name} (${playerPersistentId}) added to room ${roomCode}. Total players: ${room.players.length}`);
      socket.emit('room_joined', { roomCode, playerId: playerPersistentId, initialPlayers: room.players });
      broadcastGameState(roomCode); // Broadcast updated player list and game state
    }
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
    const { persistentPlayerId, playerName: nameFromData } = socket.data; // Get persistentPlayerId from socket data
    console.log(`[Server UpdateBoard] Received board update for room ${roomCode} from player ${nameFromData} (PersistentID: ${persistentPlayerId}), Socket: ${socket.id}, DataSize: ${boardData?.length || 0}`);
    
    if (!roomCode || !gameRooms[roomCode]) {
      console.error('[Server UpdateBoard] Failed: Invalid room code:', roomCode);
      return;
    }
    if (!persistentPlayerId) {
      console.error('[Server UpdateBoard] Failed: No persistentPlayerId for socket:', socket.id);
      return;
    }

    const room = gameRooms[roomCode];
    const player = room.players.find(p => p.persistentPlayerId === persistentPlayerId);

    if (!player || !player.isActive || player.isSpectator) {
      console.warn(`[Server UpdateBoard] Denied for non-active/spectator player: ${persistentPlayerId} (Socket: ${socket.id})`);
      return;
    }
    
    if (room.submissionPhaseOver) {
      console.warn(`[Server UpdateBoard] Denied: submission phase over for room ${roomCode}, player ${persistentPlayerId}`);
      return; // Silently ignore
    }
    
    // Key playerBoards by persistentPlayerId
    room.playerBoards[persistentPlayerId] = {
      boardData,
      roundIndex: room.currentQuestionIndex,
      timestamp: Date.now()
    };

    console.log(`[Server UpdateBoard] Broadcasting board update for player ${player.name} (PersistentID: ${persistentPlayerId}) in room ${roomCode}`);

    // Broadcast to all clients in the room including the sender
    io.to(roomCode).emit('board_update', {
      playerId: persistentPlayerId, // Send persistentPlayerId
      playerName: player.name,
      boardData
    });
  });

  // Handle answer submission
  socket.on('submit_answer', (data) => {
    const { roomCode, answer, hasDrawing, drawingData: clientDrawingData, answerAttemptId } = data;
    const { persistentPlayerId, playerName: nameFromData } = socket.data;

    console.log(`[Server SubmitAnswer] Received for room ${roomCode} from P_ID: ${persistentPlayerId} (Socket: ${socket.id}), Name: ${nameFromData}, AttemptID: ${answerAttemptId}`);
    
    if (!roomCode || !gameRooms[roomCode]) {
      console.error('[Server SubmitAnswer] Failed: Room not found:', roomCode);
      socket.emit('error', 'Room not found');
      return;
    }
    if (!persistentPlayerId) {
      console.error('[Server SubmitAnswer] Failed: No persistentPlayerId for socket:', socket.id);
      socket.emit('error', 'Player identity not established.');
      return;
    }

    const room = gameRooms[roomCode];
    const player = room.players.find(p => p.persistentPlayerId === persistentPlayerId);

    if (!player || !player.isActive || player.isSpectator) {
      console.warn(`[Server SubmitAnswer] Denied for non-active/spectator player: ${persistentPlayerId} (Socket: ${socket.id})`);
      socket.emit('error', 'Submission denied: you are a spectator or inactive.');
      return;
    }

    if (room.submissionPhaseOver) {
      console.warn(`[Server SubmitAnswer] Denied: submission phase over for room ${roomCode}, player ${persistentPlayerId}`);
      socket.emit('error', 'Submission phase is over for this round.');
      return;
    }

    // Idempotency check
    if (player.answers[room.currentQuestionIndex] && player.answers[room.currentQuestionIndex].answerAttemptId === answerAttemptId) {
      console.log(`[Server SubmitAnswer] Duplicate answer submission detected for attempt ${answerAttemptId} by ${persistentPlayerId}. Acknowledging receipt.`);
      socket.emit('answer_received', { status: 'duplicate', message: 'Answer already received (duplicate attempt).', attemptId: answerAttemptId });
      return;
    }

    try {
      let drawingDataForStorage = null;
      let finalHasDrawing = false;

      if (hasDrawing) {
        if (clientDrawingData && clientDrawingData.trim() !== '') {
          drawingDataForStorage = clientDrawingData;
          finalHasDrawing = true;
        } else if (room.playerBoards && room.playerBoards[persistentPlayerId]) {
          const playerBoardEntry = room.playerBoards[persistentPlayerId];
          if (playerBoardEntry.roundIndex === room.currentQuestionIndex && playerBoardEntry.boardData && playerBoardEntry.boardData.trim() !== '') {
            drawingDataForStorage = playerBoardEntry.boardData;
            finalHasDrawing = true;
          }
        }
      }

      const answerData = {
        playerId: persistentPlayerId,
        playerName: player.name,
        answer,
        hasDrawing: finalHasDrawing,
        drawingData: drawingDataForStorage,
        timestamp: Date.now(),
        isCorrect: null,
        answerAttemptId
      };

      player.answers[room.currentQuestionIndex] = answerData;
      room.roundAnswers[persistentPlayerId] = answerData;

      console.log(`[Server SubmitAnswer] Answer stored for P_ID: ${persistentPlayerId}, Q_Index: ${room.currentQuestionIndex}, AttemptID: ${answerAttemptId}`);
      socket.emit('answer_received', { status: 'success', message: 'Answer received!', attemptId: answerAttemptId });
      broadcastGameState(roomCode);
      
      const responseTime = Date.now() - (room.questionStartTime || Date.now());
      gameAnalytics.recordAnswer(roomCode, persistentPlayerId, answerData.answer, answerData.isCorrect, responseTime);
      
    } catch (error) {
      console.error('[Server SubmitAnswer] Error storing answer:', { error, roomCode, persistentPlayerId });
      socket.emit('error', 'Failed to submit answer');
    }
  });

  // Gamemaster evaluates an answer
  socket.on('evaluate_answer', ({ roomCode, playerId, isCorrect }) => {
    const { persistentPlayerId: gmPersistentId, isGameMaster } = socket.data;
    const room = gameRooms[roomCode];

    if (!room || !isGameMaster || room.gamemasterPersistentId !== gmPersistentId) {
      console.warn(`[Server EvaluateAnswer] Unauthorized attempt or room not found. GM_P_ID: ${gmPersistentId}, Socket_IsGM: ${isGameMaster}, Room_GM_P_ID: ${room?.gamemasterPersistentId}`);
      socket.emit('error', 'Not authorized to evaluate answers or room not found');
      return;
    }

    try {
      const player = room.players.find(p => p.persistentPlayerId === playerId);
      if (!player) {
        console.error('[Server EvaluateAnswer] Player not found for evaluation:', { roomCode, targetPlayerPersistentId: playerId });
        socket.emit('error', 'Player not found for evaluation.');
        return;
      }

      console.log(`[Server EvaluateAnswer] Evaluating answer for player ${player.name} (P_ID: ${playerId}), Correct: ${isCorrect}`);

      const answerInPlayerArray = player.answers[room.currentQuestionIndex];
      const answerInRoundAnswers = room.roundAnswers[playerId];

      if (answerInPlayerArray) answerInPlayerArray.isCorrect = isCorrect;
      else console.warn(`[Server EvaluateAnswer] No answer found in player.answers array for ${playerId} at index ${room.currentQuestionIndex}`);
      
      if (answerInRoundAnswers) answerInRoundAnswers.isCorrect = isCorrect;
      else console.warn(`[Server EvaluateAnswer] No answer found in room.roundAnswers for ${playerId}`);

      if (!isCorrect) {
        player.lives--;
        if (player.lives <= 0) {
          player.isActive = false;
          player.isSpectator = true;
          console.log(`[Server EvaluateAnswer] Player ${player.name} (${playerId}) has no lives left. Marking inactive/spectator.`);
          const targetSocket = io.sockets.sockets.get(player.id);
          if (targetSocket) targetSocket.emit('become_spectator');
        }
      }

      room.evaluatedAnswers[playerId] = isCorrect;

      const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
      if (activePlayers.length <= 1 && room.started) {
        const winner = activePlayers.length === 1 ? { id: activePlayers[0].persistentPlayerId, name: activePlayers[0].name } : null;
        console.log(`[Server EvaluateAnswer] Game over condition met. Winner: ${winner ? winner.name : 'None'}`);
        concludeGameAndSendRecap(roomCode, winner);
      }

      broadcastGameState(roomCode);
      console.log(`[Server EvaluateAnswer] Broadcasted game state. Player ${player.name} lives: ${player.lives}, isActive: ${player.isActive}`);

      if (answerInPlayerArray) {
        gameAnalytics.recordAnswer(roomCode, playerId, answerInPlayerArray.answer, isCorrect, Date.now() - (room.questionStartTime || Date.now()));
      }

    } catch (error) {
      console.error('[Server EvaluateAnswer] Error evaluating answer:', error);
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

  socket.on('kick_player', ({ roomCode, playerIdToKick }) => {
    try {
      const room = gameRooms[roomCode];
      if (!room) {
        console.error(`[Server Kick] Kick failed: Room ${roomCode} not found.`);
        socket.emit('error', { message: `Room ${roomCode} not found.` });
        return;
      }
      // Use socket.data for GM's persistentId
      if (socket.data.persistentPlayerId !== room.gamemasterPersistentId || !socket.data.isGameMaster) {
        console.error(`[Server Kick] Kick failed: Socket ${socket.id} (P_ID: ${socket.data.persistentPlayerId}) is not the GM of room ${roomCode}.`);
        socket.emit('error', { message: 'Only the Game Master can kick players.' });
        return;
      }

      if (playerIdToKick === room.gamemasterPersistentId) {
        console.error(`[Server Kick] Kick failed: GM ${socket.data.persistentPlayerId} cannot kick themselves from room ${roomCode}.`);
        socket.emit('error', { message: 'Game Master cannot kick themselves.' });
        return;
      }

      const playerIndex = room.players.findIndex(p => p.persistentPlayerId === playerIdToKick);
      if (playerIndex === -1) {
        console.warn(`[Server Kick] Player with P_ID ${playerIdToKick} not found in room ${roomCode} for kicking.`);
      } else {
        const kickedPlayer = room.players.splice(playerIndex, 1)[0];
        console.log(`[Server Kick] Player ${kickedPlayer.name} (P_ID: ${playerIdToKick}) kicked from room ${roomCode} by GM ${socket.data.persistentPlayerId}`);

        const kickedPlayerSocket = io.sockets.sockets.get(kickedPlayer.id); // kickedPlayer.id is their current socketId
        if (kickedPlayerSocket) {
          kickedPlayerSocket.emit('kicked_from_room', { roomCode, reason: 'Kicked by Game Master' });
          kickedPlayerSocket.leave(roomCode); 
          console.log(`[Server Kick] Notified player ${playerIdToKick} via socket ${kickedPlayer.id} and made them leave room ${roomCode}.`);
        }

        if (room.playerBoards && room.playerBoards[playerIdToKick]) { // Keyed by persistentPlayerId
          delete room.playerBoards[playerIdToKick];
          console.log(`[Server Kick] Removed playerBoard for kicked player P_ID ${playerIdToKick} in room ${roomCode}.`);
        }
        // Clear disconnect timer if any
        if (room.playerDisconnectTimers && room.playerDisconnectTimers[playerIdToKick]){
            clearTimeout(room.playerDisconnectTimers[playerIdToKick]);
            delete room.playerDisconnectTimers[playerIdToKick];
            console.log(`[Server Kick] Cleared disconnect timer for kicked player P_ID ${playerIdToKick}.`);
        }
      }
      broadcastGameState(roomCode);
      console.log(`[Server Kick] Broadcasted game state for room ${roomCode} after kicking P_ID ${playerIdToKick}.`);

    } catch (error) {
      console.error(`[Server Kick] Error handling kick_player for room ${roomCode}, player P_ID ${playerIdToKick}:`, error);
      socket.emit('error', { message: 'An internal server error occurred while trying to kick the player.' });
    }
  });

  // Refactored Disconnection Handler
  socket.on('disconnect', (reason) => {
    const { persistentPlayerId, playerName, isGameMaster, initialRoomCodeQuery } = socket.data;
    const roomCode = socket.roomCode; // This should be set by create_room or join_room or recovery logic

    console.log(`[Server Disconnect] User disconnected. Socket ID: ${socket.id}, Persistent ID: ${persistentPlayerId}, ` +
                `Player Name: ${playerName}, Is GM: ${isGameMaster}, Reason: ${reason}, Room Code: ${roomCode}`);

    if (!roomCode || !gameRooms[roomCode]) {
      console.log(`[Server Disconnect] No room context (roomCode: ${roomCode}) or room not found for disconnected socket ${socket.id}. No further action.`);
      return;
    }

    const room = gameRooms[roomCode];

    if (isGameMaster && room.gamemasterPersistentId === persistentPlayerId && room.gamemasterSocketId === socket.id) {
      console.log(`[Server Disconnect] Game Master ${playerName} (${persistentPlayerId}) disconnected from room ${roomCode}.`);
      room.gamemasterDisconnected = true;
      io.to(roomCode).emit('gm_disconnected_status', { roomCode, isDisconnected: true, gmName: playerName || 'GameMaster' });

      // Clear any existing timer before setting a new one
      if (room.gmDisconnectTimer) {
        clearTimeout(room.gmDisconnectTimer);
      }
      room.gmDisconnectTimer = setTimeout(() => {
        if (room.gamemasterDisconnected) { // Check if still disconnected
          console.log(`[Server Disconnect] GM ${persistentPlayerId} did not reconnect to room ${roomCode} in time. Ending game.`);
          io.to(roomCode).emit('game_over', { message: 'Game Master disconnected and did not rejoin. Game ended.' });
          // Clean up the room after a delay to allow clients to receive game_over
          setTimeout(() => {
            delete gameRooms[roomCode];
            console.log(`[Server Disconnect] Room ${roomCode} deleted due to GM timeout.`);
          }, 5000); // 5s delay for cleanup
        }
      }, GM_AUTO_END_TIMEOUT_MS);
      console.log(`[Server Disconnect] GM disconnect timer started for room ${roomCode}. Timeout: ${GM_AUTO_END_TIMEOUT_MS}ms`);

    } else if (!isGameMaster && persistentPlayerId) {
      const playerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        // Only act if the disconnecting socket is the player's current active socket
        if (player.id === socket.id) { 
          console.log(`[Server Disconnect] Player ${player.name} (${persistentPlayerId}) disconnected from room ${roomCode}.`);
          
          // Graceful disconnect (client explicitly left or server initiated close for this socket)
          if (reason === 'client namespace disconnect' || reason === 'server namespace disconnect') {
            console.log(`[Server Disconnect] Player ${player.name} (${persistentPlayerId}) left gracefully.`);
            room.players.splice(playerIndex, 1);
            if (room.playerBoards && room.playerBoards[persistentPlayerId]) {
              delete room.playerBoards[persistentPlayerId];
            }
            // Also clear any pending disconnect timer for this player
            if (room.playerDisconnectTimers && room.playerDisconnectTimers[persistentPlayerId]) {
              clearTimeout(room.playerDisconnectTimers[persistentPlayerId]);
              delete room.playerDisconnectTimers[persistentPlayerId];
            }
            io.to(roomCode).emit('player_left_gracefully', { roomCode, playerId: persistentPlayerId, playerName: player.name });
            broadcastGameState(roomCode); // Update everyone
          } else { // Abrupt disconnect (transport error, ping timeout, etc.)
            console.log(`[Server Disconnect] Player ${player.name} (${persistentPlayerId}) disconnected abruptly. Marking inactive.`);
            player.isActive = false;
            io.to(roomCode).emit('player_disconnected_status', { roomCode, playerId: persistentPlayerId, playerName: player.name, isActive: false });
            broadcastGameState(roomCode); // Update about inactive status

            // Clear any existing timer before setting a new one
            if (room.playerDisconnectTimers && room.playerDisconnectTimers[persistentPlayerId]) {
              clearTimeout(room.playerDisconnectTimers[persistentPlayerId]);
            }
            room.playerDisconnectTimers[persistentPlayerId] = setTimeout(() => {
              // Check if player is still inactive and associated with this persistentId
              const currentPlayerInRoom = room.players.find(p => p.persistentPlayerId === persistentPlayerId);
              if (currentPlayerInRoom && !currentPlayerInRoom.isActive) {
                console.log(`[Server Disconnect] Player ${persistentPlayerId} did not reconnect to room ${roomCode} in time. Removing permanently.`);
                const idxToRemove = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
                if (idxToRemove !== -1) room.players.splice(idxToRemove, 1);
                
                if (room.playerBoards && room.playerBoards[persistentPlayerId]) {
                  delete room.playerBoards[persistentPlayerId];
                }
                io.to(roomCode).emit('player_removed_after_timeout', { roomCode, playerId: persistentPlayerId, playerName: currentPlayerInRoom.name });
                broadcastGameState(roomCode); // Update everyone about removal
              }
              delete room.playerDisconnectTimers[persistentPlayerId]; // Clean up timer ref
            }, PLAYER_AUTO_REMOVE_TIMEOUT_MS);
            console.log(`[Server Disconnect] Player ${persistentPlayerId} disconnect timer started for room ${roomCode}. Timeout: ${PLAYER_AUTO_REMOVE_TIMEOUT_MS}ms`);
          }
        } else {
          console.log(`[Server Disconnect] Player ${playerName} (${persistentPlayerId}) disconnected, but socket ${socket.id} was not their active socket (${player.id}). No action on player state.`);
        }
      } else {
        console.log(`[Server Disconnect] Player with persistentId ${persistentPlayerId} not found in room ${roomCode}.`);
      }
    } else {
      console.log(`[Server Disconnect] Disconnected socket ${socket.id} was not a recognized GM or Player with a persistentId in room ${roomCode}.`);
    }
  }); // End of socket.on('disconnect')

}); // End of io.on('connection') - IMPORTANT: Ensure disconnect is INSIDE connection

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
  // console.log(`Build path: ${buildPath}`);
});