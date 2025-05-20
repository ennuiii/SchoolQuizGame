// Last updated: May 2025
// School Quiz Game server file
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Import our services
import { logger, logEvent } from './services/logService';
import * as roomService from './services/roomService';
import { gameAnalytics } from './services/gameAnalytics';
import { 
  CustomSocket, GameRoom, GameState, Player, 
  Question, AnswerSubmission, GameFinalStats
} from './types';
import { createSocketService } from './services/socketService';

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
      logger.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// Set up periodic saving (every 30 seconds)
const SAVE_INTERVAL_MS = 30 * 1000; // 30 seconds
setInterval(roomService.saveRoomState, SAVE_INTERVAL_MS);

// Load saved rooms on startup
try {
  roomService.loadRoomState();
} catch (error) {
  logger.error('Failed to load room state on startup:', error);
}

// Helper function to get full game state for a room
function getGameState(roomCode: string): GameState | null {
  const room = roomService.getRoom(roomCode);
  if (!room) return null;

  // Create a clean copy of player boards to ensure drawings are preserved
  const playerBoardsForState: Record<string, any> = {};
  
  if (room.playerBoards) {
    // Convert to a consistent format that's serializable and retains all drawing data
    Object.entries(room.playerBoards).forEach(([playerId, boardData]) => {
      // Find player matching this board
      const player = room.players.find(p => p.id === playerId);
      // Always provide a persistentPlayerId for compatibility with older clients
      const persistentPlayerId = player?.persistentPlayerId || `F-${playerId.substring(0, 8)}`;
      
      playerBoardsForState[playerId] = {
        playerId,
        boardData: boardData,
        persistentPlayerId: persistentPlayerId,
        playerName: player?.name || 'Unknown Player',
        roundIndex: room.currentQuestionIndex || 0,
        timestamp: Date.now()
      };
    });
  }

  // Ensure all players have persistentPlayerId to prevent client crashes
  const safePlayersArray = room.players.map(player => ({
    ...player,
    // Always ensure persistentPlayerId exists (for older clients compatibility)
    persistentPlayerId: player.persistentPlayerId || `F-${player.id.substring(0, 8)}`
  }));

  return {
    started: room.started,
    currentQuestion: room.currentQuestion,
    currentQuestionIndex: room.currentQuestionIndex,
    timeLimit: room.timeLimit,
    questionStartTime: room.questionStartTime,
    players: safePlayersArray,
    roundAnswers: room.roundAnswers || {},
    evaluatedAnswers: room.evaluatedAnswers || {},
    submissionPhaseOver: room.submissionPhaseOver || false,
    isConcluded: room.isConcluded || false,
    playerBoards: playerBoardsForState, // Include formatted player boards
  };
}

// Helper function to broadcast game state to all players in a room
function broadcastGameState(roomCode: string): void {
  const state = getGameState(roomCode);
  if (state && io) {
    io.to(roomCode).emit('game_state_update', state);
  }
}

// Helper function to generate game recap data
function generateGameRecap(roomCode: string): any | null {
  const room = roomService.getRoom(roomCode);
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
    const boardsForRound: Record<string, string> = {};
    Object.entries(room.playerBoards || {}).forEach(([playerId, boardData]) => {
      // Try to get the right type based on how the data is stored
      const persistentId = typeof boardData === 'object' && boardData.persistentPlayerId ? 
        boardData.persistentPlayerId : playerId;
      
      if (typeof boardData === 'object' && boardData.roundIndex === index) {
        boardsForRound[persistentId] = typeof boardData === 'object' ? boardData.boardData : boardData;
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
    const submissionsByPersistentId = room.players.reduce((acc: Record<string, any>, player) => {
      if (player.answers && player.answers[index]) {
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
        
        // Check if we have drawing data in player answers first
        let hasDrawing = answer ? answer.hasDrawing : false;
        let drawingData = answer && answer.hasDrawing ? answer.drawingData : null;
        
        // If hasDrawing is true but drawing data is missing, try to get it from boardsForRound
        if (hasDrawing && (!drawingData || drawingData.trim() === '')) {
          logger.log(`Player ${player.persistentPlayerId}, Round ${index + 1}: Drawing data missing in answer. Checking boardsForRound.`, {});
          
          // Try to get drawing data from boardsForRound using persistentPlayerId
          if (boardsForRound[player.persistentPlayerId]) {
            drawingData = boardsForRound[player.persistentPlayerId];
            logger.log(`Player ${player.persistentPlayerId}, Round ${index + 1}: Found drawing data in boardsForRound. Length: ${drawingData?.length || 0}`, {});
          } 
          // Also try to find using player.id as a fallback
          else if (boardsForRound[player.id]) {
            drawingData = boardsForRound[player.id];
            logger.log(`Player ${player.persistentPlayerId}, Round ${index + 1}: Found drawing data in boardsForRound using socket ID. Length: ${drawingData?.length || 0}`, {});
          }
          // If we still don't have drawing data, set hasDrawing to false
          if (!drawingData || drawingData.trim() === '') {
            logger.warn(`Player ${player.persistentPlayerId}, Round ${index + 1}: No drawing data found in boardsForRound. Setting hasDrawing to false.`, {});
            hasDrawing = false;
          }
        }
        
        return {
          playerId: player.id,
          persistentPlayerId: player.persistentPlayerId,
          playerName: player.name,
          answer: answer ? answer.answer : null,
          hasDrawing: hasDrawing,
          drawingData: drawingData,
          isCorrect: answer ? answer.isCorrect : null
        };
      })
    };
  });

  // Sort players for the recap - using persistentPlayerId for stability
  const sortedPlayers = [...room.players].sort((a, b) => {
    // Winners first
    if ((a as any).isWinner && !(b as any).isWinner) return -1;
    if (!(a as any).isWinner && (b as any).isWinner) return 1;

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
    startTime: (room as any).startTime,
    endTime: new Date(),
    players: sortedPlayers.map(player => ({
      id: player.id,
      persistentPlayerId: player.persistentPlayerId,
      name: player.name,
      finalLives: player.lives,
      isSpectator: player.isSpectator,
      isActive: player.isActive,
      isWinner: player.isActive && player.lives > 0 && 
                room.players.filter(p => p.isActive && p.lives > 0).length === 1 && 
                player.persistentPlayerId === room.players.find(p => p.isActive && p.lives > 0)?.persistentPlayerId
    })),
    rounds: playedRounds
  };
}

// Determine the correct build path based on environment
let buildPath = path.join(__dirname, '../../build');
if (process.env.NODE_ENV === 'production') {
  // Check multiple possible locations for build files (for render.com deployment)
  const possibleBuildPaths = [
    path.join(__dirname, '../build'),         // server/build
    path.join(__dirname, '../../build'),      // build in root
    path.join(process.cwd(), 'build'),        // current working directory
    '/opt/render/project/src/build'           // absolute path on render.com
  ];
  
  let buildPathFound = false;
  // Find the first path that exists
  for (const pathToCheck of possibleBuildPaths) {
    if (fs.existsSync(pathToCheck)) {
      buildPath = pathToCheck;
      logger.log(`Using build path: ${buildPath}`, {});
      logger.log(`Build index.html exists: ${fs.existsSync(path.join(buildPath, 'index.html'))}`, {});
      buildPathFound = true;
      break;
    }
  }
  
  if (!buildPathFound) {
    logger.error('No valid build path found. Checked these paths:', {});
    possibleBuildPaths.forEach(p => logger.error(`- ${p} (exists: ${fs.existsSync(p)})`, {}));
    logger.log(`Current directory: ${process.cwd()}`, {});
    logger.log(`Directory listing for current directory: ${fs.readdirSync(process.cwd())}`, {});
    try {
      logger.log(`Directory listing for server directory: ${fs.readdirSync(__dirname)}`, {});
    } catch (err) {
      logger.error('Error reading server directory:', err);
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
io.use((socket: CustomSocket, next) => {
  try {
    // Extract data from socket.handshake
    const auth = socket.handshake.auth || {};
    const query = socket.handshake.query || {};
    
    // Check for Game Master flag in query parameters
    const isGameMasterQuery = query.isGameMaster === "true";
    const roomCodeQuery = query.roomCode as string;
    const isInitialConnection = query.isInitialConnection === "true";

    logger.log(`Socket ${socket.id} authentication check:`, {
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
    
    // Handle persistentPlayerId logic - ensure it's ALWAYS present
    if (auth.persistentPlayerId) {
      // Use existing persistentPlayerId if provided
      socket.data.persistentPlayerId = auth.persistentPlayerId;
    } else if (isGameMasterQuery) {
      // Generate new persistentPlayerId for Game Master
      socket.data.persistentPlayerId = `GM-${uuidv4()}`;
    } else if (auth.playerName) {
      // Generate new persistentPlayerId for regular Player
      socket.data.persistentPlayerId = `P-${uuidv4()}`;
    } else {
      // Always provide a fallback ID for compatibility with older clients
      socket.data.persistentPlayerId = `F-${uuidv4()}`;
    }
    
    // Log the assigned values
    logger.log(`Socket ${socket.id} authenticated:`, {
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
    logger.error('Middleware error:', error);
    next(error as Error);
  }
});

// Debug endpoint to view active rooms
app.get('/debug/rooms', (req, res) => {
  const safeRoomsCopy: Record<string, any> = {};
  
  // Create a safe copy without circular references
  Object.entries(roomService.getAllRooms()).forEach(([roomCode, room]) => {
    safeRoomsCopy[roomCode] = {
      roomCode: room.roomCode,
      gamemasterPersistentId: room.gamemasterPersistentId,
      playerCount: room.players.length,
      started: room.started,
      currentQuestionIndex: room.currentQuestionIndex,
      gamemasterDisconnected: room.gamemasterDisconnected,
      isStreamerMode: room.isStreamerMode,
      isConcluded: room.isConcluded,
      createdAt: room.createdAt || 'unknown',
      lastActivity: room.lastActivity || 'unknown'
    };
  });
  
  res.json({
    serverTime: new Date().toISOString(),
    activeRoomCount: Object.keys(roomService.getAllRooms()).length,
    rooms: safeRoomsCopy
  });
});

// Game recap endpoints
app.get('/api/recaps', (req, res) => {
  // Return list of all recaps with basic info
  const recapsList = Object.values(roomService.getAllRooms()).map(recap => ({
    id: recap.roomCode,
    roomCode: recap.roomCode,
    startTime: (recap as any).startTime,
    endTime: (recap as any).endTime,
    playerCount: recap.players.length,
    roundCount: recap.questions ? recap.questions.length : 0,
    winner: (recap as any).winner
  }));
  res.json(recapsList);
});

app.get('/api/recaps/:recapId', (req, res) => {
  const recap = roomService.getRoom(req.params.recapId);
  if (!recap) {
    res.status(404).json({ error: 'Recap not found' });
    return;
  }
  res.json(recap);
});

app.get('/api/recaps/room/:roomCode', (req, res) => {
  const roomRecaps = Object.values(roomService.getAllRooms())
    .filter(recap => recap.roomCode === req.params.roomCode)
    .sort((a, b) => new Date((b as any).startTime).getTime() - new Date((a as any).startTime).getTime());
  res.json(roomRecaps);
});

app.get('/api/recaps/:recapId/round/:roundNumber', (req, res) => {
  const recap = roomService.getRoom(req.params.recapId);
  if (!recap) {
    res.status(404).json({ error: 'Recap not found' });
    return;
  }
  
  const roundIndex = parseInt(req.params.roundNumber) - 1;
  if (!recap.questions || !recap.questions[roundIndex]) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }
  
  // Format the round data as expected by the client
  const round = {
    roundNumber: roundIndex + 1,
    question: recap.questions[roundIndex],
    submissions: recap.players.map(player => ({
      playerId: player.id,
      persistentPlayerId: player.persistentPlayerId,
      playerName: player.name,
      answer: player.answers && player.answers[roundIndex] ? player.answers[roundIndex].answer : null,
      isCorrect: player.answers && player.answers[roundIndex] ? player.answers[roundIndex].isCorrect : null
    }))
  };
  
  res.json(round);
});

// Constants for timers
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 seconds
const AUTO_SUBMIT_GRACE_PERIOD_MS = 1000; // 1 second

// Timer management
const timers = new Map<string, NodeJS.Timeout>();

// Helper function to finalize round, perform auto-submissions, and broadcast state
function finalizeRoundAndAutoSubmit(roomCode: string): void {
  const room = roomService.getRoom(roomCode);
  if (!room) {
    logger.log(`[FinalizeRound] Room ${roomCode} not found.`, {});
    return;
  }

  logger.log(`[FinalizeRound] Finalizing round for room ${roomCode}. Current question index: ${room.currentQuestionIndex}`, {});
  room.submissionPhaseOver = true;

  if (room.players && room.currentQuestionIndex !== undefined && room.currentQuestionIndex !== null) {
    room.players.forEach(playerInRoom => {
      if (
        playerInRoom.isActive &&
        !playerInRoom.isSpectator &&
        (!playerInRoom.answers || !playerInRoom.answers[room.currentQuestionIndex])
      ) {
        logger.log(`[FinalizeRound] Auto-submitting for player ${playerInRoom.id} in room ${roomCode}`, {});
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

        const autoAnswer: AnswerSubmission = {
          playerId: playerInRoom.id,
          answer: '-', // Explicitly set auto-submitted text answer to "-"
          hasDrawing: autoAnswerHasDrawing,
          drawingData: autoAnswerDrawingData,
          timestamp: Date.now(),
          submissionTime: 0,
          isCorrect: undefined // Evaluation pending
        };
        playerInRoom.answers[room.currentQuestionIndex] = autoAnswer;

        if (room.roundAnswers) {
          room.roundAnswers[playerInRoom.persistentPlayerId] = autoAnswer; // Key by persistentPlayerId
        }
      }
    });
  } else {
    logger.warn(`[FinalizeRound] Could not perform auto-submissions for room ${roomCode}. Conditions not met: players array exists: ${!!room.players}, currentQuestionIndex defined: ${room.currentQuestionIndex !== undefined && room.currentQuestionIndex !== null}`, {});
  }

  broadcastGameState(roomCode);
  logger.log(`[FinalizeRound] Game state broadcasted for room ${roomCode} after finalization.`, {});
}

// Helper function to conclude game and send recap to all
function concludeGameAndSendRecap(roomCode: string, winnerInfo: any = null): void {
  const room = roomService.getRoom(roomCode);
  if (!room) {
    logger.log(`[ConcludeGame] Room ${roomCode} not found. Skipping.`, {});
    return;
  }
  if (room.isConcluded) {
    logger.log(`[ConcludeGame] Room ${roomCode} already concluded. Skipping recap send.`, {});
    return;
  }

  room.isConcluded = true;
  clearRoomTimer(roomCode); // Stop any active timers

  logger.log(`[ConcludeGame] Game concluded in room ${roomCode}. Emitting game_over_pending_recap.`, {});
  io.to(roomCode).emit('game_over_pending_recap', {
    roomCode,
    winner: winnerInfo
  });

  // Generate and send recap immediately
  const recap = generateGameRecap(roomCode);
  if (recap) {
    logger.log(`[ConcludeGame] Automatically broadcasting recap for room ${roomCode} with initialSelectedRoundIndex and initialSelectedTabKey.`, {});
    // Add initialSelectedRoundIndex and initialSelectedTabKey to the recap payload for the client
    const recapWithInitialState = { ...recap, initialSelectedRoundIndex: 0, initialSelectedTabKey: 'overallResults' };
    io.to(roomCode).emit('game_recap', recapWithInitialState);
  } else {
    logger.warn(`[ConcludeGame] Recap data generation failed for room ${roomCode} during auto-send.`, {});
  }
}

// Function to generate a room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Start question timer
function startQuestionTimer(roomCode: string): void {
  // Clear any existing timer for this room
  clearRoomTimer(roomCode);
  
  const room = roomService.getRoom(roomCode);
  if (!room || !room.timeLimit) {
    logger.log(`Cannot start timer for room ${roomCode}: room not found or no time limit.`, {});
    return;
  }
  
  // Get time limit in milliseconds
  const timerDurationMs = room.timeLimit * 1000;
  
  logger.log(`Starting timer for room ${roomCode} with duration ${room.timeLimit} seconds.`, {});
  
  // Set timer
  const timer = setTimeout(() => {
    logger.log(`Timer finished for room ${roomCode}. Auto-finalizing round.`, {});
    
    // Update room
    if (room) {
      // Add a small grace period for any in-flight submissions
      setTimeout(() => {
        // Re-fetch the room in case it was deleted
        const currentRoom = roomService.getRoom(roomCode);
        if (currentRoom) {
          finalizeRoundAndAutoSubmit(roomCode);
        }
      }, AUTO_SUBMIT_GRACE_PERIOD_MS);
    }
  }, timerDurationMs);
  
  // Store timer for future cancellation if needed
  timers.set(roomCode, timer);
}

// Clear room timer if exists
function clearRoomTimer(roomCode: string): void {
  const timer = timers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    timers.delete(roomCode);
    logger.log(`Timer cleared for room ${roomCode}`, {});
  }
}

// Function to get player name
function getPlayerName(roomCode: string, playerId: string): string {
  const room = roomService.getRoom(roomCode);
  if (!room) return 'Unknown Player';
  
  const player = room.players.find(p => p.id === playerId);
  return player ? player.name : 'Unknown Player';
}

// Schedule periodic cleanup of stale rooms
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Every hour
setInterval(roomService.cleanupStaleRooms, CLEANUP_INTERVAL_MS);

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.log(`Server running on port ${PORT}`, {});
});

// Initialize SocketIO service
createSocketService(server, allowedOrigins); 