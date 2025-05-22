// Last updated: May 2025
// School Quiz Game server file
import express, { Request, Response, NextFunction, Application } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

import {
  GameRoom,
  Player,
  Question,
  PlayerAnswer,
  GameState,
  GameRecap,
  ExtendedSocket, 
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  WinnerInfo
} from './types';

// Import services
import { gameAnalytics } from './services/gameAnalytics';
import { 
  gameRooms, 
  createGameRoom, 
  saveRoomState, 
  loadRoomState,
  logEvent
} from './services/roomService';
import { 
  setSocketIOInstance, 
  getGameState, 
  broadcastGameState, 
  generateGameRecap,
  getIO
} from './services/socketService';

// These will be defined locally in this file
import { 
  finalizeRoundAndAutoSubmit, 
  concludeGameAndSendRecap, 
  startQuestionTimer, 
  clearRoomTimer
} from './services/socketService';

// Grace period constants
const AUTO_SUBMIT_GRACE_PERIOD_MS = 1000; // 1 second
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 seconds

// Local functions
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Timer management
const timers = new Map<string, NodeJS.Timeout>();

const app: Application = express();

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

// Set up periodic saving (every 30 seconds)
const SAVE_INTERVAL_MS = 30 * 1000; // 30 seconds
setInterval(saveRoomState, SAVE_INTERVAL_MS);

// Load saved rooms on startup
try {
  loadRoomState();
} catch (error) {
  console.error('[Server] Failed to load room state on startup:', error);
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
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
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

// Set IO instance in socketService
setSocketIOInstance(io);

// Add roomCode property to socket type
declare module 'socket.io' {
  interface Socket {
    roomCode?: string;
  }
}

// Authentication Middleware for persistentPlayerId management
io.use((socket: ExtendedSocket, next) => {
  try {
    // Extract data from socket.handshake
    const auth: any = socket.handshake.auth || {};
    const query: any = socket.handshake.query || {};
    
    // Check for Game Master flag in query parameters
    const isGameMasterQuery = query.isGameMaster === "true";
    // const roomCodeQuery = query.roomCode; // Not used in this block
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
    
    // Handle persistentPlayerId logic
    if (isGameMasterQuery) {
      // If connecting as GameMaster, always assign a new GM-prefixed ID.
      // This ensures a distinct ID for GM sessions, even if localStorage had a non-GM ID.
      socket.data.persistentPlayerId = `GM-${uuidv4()}`;
      // GM name is typically 'GameMaster' or set from auth if provided
      // If auth.playerName is provided by a GM connection, use it, otherwise default to 'GameMaster'
      socket.data.playerName = auth.playerName || 'GameMaster';
    } else if (auth.persistentPlayerId) {
      // For players, use existing persistentPlayerId if provided
      socket.data.persistentPlayerId = auth.persistentPlayerId;
      socket.data.playerName = auth.playerName; // Use player name from auth
    } else if (auth.playerName) {
      // Generate new persistentPlayerId for a new Player with a name
      socket.data.persistentPlayerId = `P-${uuidv4()}`;
      socket.data.playerName = auth.playerName;
    } else {
      // Fallback for initial connections without name or persistentId (e.g., join screen before name entry)
      socket.data.persistentPlayerId = `F-${uuidv4()}`;
      // Player name will be undefined here, set upon joining a room.
      socket.data.playerName = undefined;
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
    next(new Error('Authentication error'));
  }
});

// Debug endpoint to view active rooms
app.get('/debug/rooms', (req: Request, res: Response) => {
  const safeRoomsCopy: Record<string, Partial<GameRoom>> = {};
  
  // Create a safe copy without circular references
  Object.entries(gameRooms).forEach(([roomCode, room]) => {
    safeRoomsCopy[roomCode] = {
      roomCode: room.roomCode,
      gamemasterPersistentId: room.gamemasterPersistentId,
      players: room.players.map(p => ({ id: p.id, name: p.name, persistentPlayerId: p.persistentPlayerId })) as any, // Simplified player list
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
    activeRoomCount: Object.keys(gameRooms).length,
    rooms: safeRoomsCopy
  });
});

// Game recap endpoints
app.get('/api/recaps', (req: Request, res: Response) => {
  // Return list of all recaps with basic info
  const recapsList = Object.values(gameRooms).map((room: GameRoom) => ({
    id: room.roomCode,
    roomCode: room.roomCode,
    startTime: room.createdAt,
    endTime: room.isConcluded ? room.lastActivity : new Date().toISOString(),
    playerCount: room.players.length,
    roundCount: room.questions.length
  }));
  res.json(recapsList);
});

app.get('/api/recaps/:recapId', (req: Request, res: Response) => {
  const recap: GameRecap | null = generateGameRecap(req.params.recapId);
  if (!recap) {
    res.status(404).json({ error: 'Recap not found' });
    return;
  }
  res.json(recap);
});

app.get('/api/recaps/room/:roomCode', (req: Request, res: Response) => {
  // This endpoint might be redundant if generateGameRecap is used
  const recap = generateGameRecap(req.params.roomCode);
  if (recap) {
    res.json([recap]); // Return as an array as client might expect multiple
  } else {
    res.json([]);
  }
});

app.get('/api/recaps/:recapId/round/:roundNumber', (req: Request, res: Response) => {
  const recap: GameRecap | null = generateGameRecap(req.params.recapId);
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

// Endpoint to handle board updates (moved from socket event for potential RESTful usage)
app.post('/api/room/:roomCode/board', express.json(), (req: Request, res: Response) => {
  const { roomCode } = req.params;
  const { boardData } = req.body; // Assuming boardData is in the request body
  const socketId = req.headers['x-socket-id']; // Assuming socket ID is passed in headers

  if (typeof socketId !== 'string') {
    return res.status(400).json({ error: 'Missing x-socket-id header' });
  }

  console.log(`[Server /api/room/:roomCode/board] Received board update:`, {
    roomCode,
    socketId: socketId,
    dataSize: boardData?.length || 0,
    timestamp: new Date().toISOString()
  });

  const room = gameRooms[roomCode];
  if (!room) {
    console.error('[Server /api/room/:roomCode/board] Board update failed - Invalid room:', roomCode);
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const player = room.players.find(p => p.id === socketId);
  if (!player || player.isSpectator || !player.isActive) {
    console.warn(`[Server /api/room/:roomCode/board] Denied for inactive/spectator player: ${socketId}`);
    return res.status(403).json({ error: 'Player not allowed to update board' });
  }

  if (room.submissionPhaseOver) {
    console.warn(`[Server /api/room/:roomCode/board] Denied: submission phase over for room ${roomCode}, player ${socketId}`);
    return res.status(403).json({ error: 'Submission phase is over' });
  }

  if (!room.playerBoards) {
    room.playerBoards = {};
  }
  
  room.playerBoards[socketId] = {
    boardData,
    roundIndex: room.currentQuestionIndex,
    timestamp: Date.now(),
    playerId: socketId, // Added playerId
    persistentPlayerId: player.persistentPlayerId // Added persistentPlayerId
  };

  console.log(`[Server /api/room/:roomCode/board] Broadcasting board update:`, {
    roomCode,
    playerId: socketId,
    playerName: player.name,
    roundIndex: room.currentQuestionIndex,
    timestamp: new Date().toISOString()
  });
  
  const currentIO = getIO();
  currentIO.to(roomCode).emit('board_update', {
    playerId: socketId,
    playerName: player.name,
    boardData
  });

  res.status(200).json({ message: 'Board updated successfully' });
});

// Endpoint to get players (moved from socket event)
app.get('/api/room/:roomCode/players', (req: Request, res: Response) => {
  const { roomCode } = req.params;
  const socketId = req.headers['x-socket-id']; // Assuming socket ID is passed in headers

  if (typeof socketId !== 'string') {
    return res.status(400).json({ error: 'Missing x-socket-id header' });
  }

  const room = gameRooms[roomCode as string]; // Cast roomCode to string
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Retrieve socket.data if the socket exists
  const currentIO = getIO();
  const requestingSocket = currentIO.sockets.sockets.get(socketId) as ExtendedSocket | undefined; // Cast to ExtendedSocket
  const socketData = requestingSocket?.data;

  console.log(`[Server /api/room/:roomCode/players] request_players authorization check:`, {
    roomCode,
    socketId,
    isPotentialGameMaster: room.gamemasterPersistentId === socketData?.persistentPlayerId,
    isPlayerInRoom: room.players.some((p: Player) => p.persistentPlayerId === socketData?.persistentPlayerId), // Add type for p
    persistentPlayerId: socketData?.persistentPlayerId,
    gmPersistentId: room.gamemasterPersistentId,
    isGameMasterFromSocketData: socketData?.isGameMaster,
    timestamp: new Date().toISOString()
  });
  
  // Only authenticate as GM if: has same persistentId as GM AND declared isGameMaster: true in connection
  if (room.gamemasterPersistentId === socketData?.persistentPlayerId && socketData?.isGameMaster === true) {
    // This is a GM reconnection - update the socket ID reference
    if (room.gamemaster !== socketId) {
      console.log(`[Server /api/room/:roomCode/players] Game master re-authenticated:`, {
        roomCode, 
        socketId: socketId,
        persistentPlayerId: socketData?.persistentPlayerId
      });
      room.gamemaster = socketId;
      room.gamemasterSocketId = socketId;
      
      if (room.gamemasterDisconnected) {
        if (room.gamemasterDisconnectTimer) {
          clearTimeout(room.gamemasterDisconnectTimer);
          room.gamemasterDisconnectTimer = null;
        }
        room.gamemasterDisconnected = false;
        currentIO.to(roomCode as string).emit('gm_disconnected_status', { disconnected: false }); // Cast roomCode
      }
    }
  }

  res.json({
    roomCode,
    players: room.players.map((p: Player) => ({ // Add type for p
      id: p.id,
      name: p.name,
      persistentPlayerId: p.persistentPlayerId,
      lives: p.lives,
      isActive: p.isActive,
      isSpectator: p.isSpectator,
      avatarSvg: p.avatarSvg
    }))
  });
});

// Add analytics endpoints
app.get('/api/analytics/game/:roomCode', (req: Request, res: Response) => {
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

// Set up periodic room cleanup (every 30 minutes)
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
setInterval(cleanupStaleRooms, CLEANUP_INTERVAL_MS);

// Function to clean up stale rooms
function cleanupStaleRooms() {
  console.log('[Server] Starting cleanup of stale rooms');
  const now = new Date();
  let roomsRemoved = 0;
  
  Object.entries(gameRooms).forEach(([roomCode, room]) => {
    // Skip rooms that are marked as concluded - they're already handled
    if (room.isConcluded) return;
    
    // Check last activity timestamp
    const lastActivity = new Date(room.lastActivity || room.createdAt);
    const hoursSinceLastActivity = Math.abs(now.getTime() - lastActivity.getTime()) / 36e5;
    
    // If room is inactive for over 24 hours, clean it up
    if (hoursSinceLastActivity > 24) {
      console.log(`[Server] Removing stale room ${roomCode} (inactive for ${hoursSinceLastActivity.toFixed(1)} hours)`);
      
      // Delete the room
      delete gameRooms[roomCode];
      roomsRemoved++;
    }
    // If GM is disconnected for over 2 minutes, the room should have been cleaned up already by the GM disconnect handler
    else if (room.gamemasterDisconnected) {
      const disconnectTime = new Date(room.gamemasterDisconnectTime || room.lastActivity);
      const minutesSinceDisconnect = Math.abs(now.getTime() - disconnectTime.getTime()) / 60000;
      
      if (minutesSinceDisconnect > 3) { // Add a buffer over the 2-minute timeout
        console.log(`[Server] Removing room ${roomCode} with disconnected GM (${minutesSinceDisconnect.toFixed(1)} minutes)`);
        
        // Delete the room
        delete gameRooms[roomCode];
        roomsRemoved++;
      }
    }
  });
  
  console.log(`[Server] Room cleanup complete. Removed ${roomsRemoved} stale rooms.`);
  
  // Save the updated room state after cleanup
  if (roomsRemoved > 0) {
    saveRoomState();
  }
}

// Socket.IO Event Handlers
io.on('connection', (socket: ExtendedSocket) => {
  console.log(`[Server] User connected: ${socket.id}, persistentPlayerId: ${socket.data.persistentPlayerId}, playerName: ${socket.data.playerName}, isGameMaster: ${socket.data.isGameMaster}, recovered: ${socket.recovered}`);
  
  // Emit persistent_id_assigned back to the client
  socket.emit('persistent_id_assigned', { persistentPlayerId: socket.data.persistentPlayerId || '' });

  // Handle session recovery
  if (socket.recovered === true) {
    console.log(`[Server] Session recovery for socket ${socket.id} with persistentPlayerId ${socket.data.persistentPlayerId}`);
    
    let recoveredRoomCode: string | null = null;
    // let recoveredAsGameMaster = false; // This variable was not used
    
    for (const roomCode in gameRooms) {
      const room = gameRooms[roomCode];
      
      if (room.gamemasterPersistentId === socket.data.persistentPlayerId) {
        recoveredRoomCode = roomCode;
        // recoveredAsGameMaster = true; // Not used
        
        room.gamemasterSocketId = socket.id;
        room.gamemaster = socket.id;
        
        if (room.gamemasterDisconnected === true) {
          if (room.gamemasterDisconnectTimer) {
            clearTimeout(room.gamemasterDisconnectTimer);
            room.gamemasterDisconnectTimer = null;
          }
          room.gamemasterDisconnected = false;
          const currentIO = getIO();
          currentIO.to(roomCode).emit('gm_disconnected_status', { disconnected: false });
        }
        
        console.log(`[Server] GM re-associated: PersistentID ${socket.data.persistentPlayerId} with socket ${socket.id} in room ${roomCode}`);
        break;
      }
      
      const playerIndex = room.players.findIndex(p => p.persistentPlayerId === socket.data.persistentPlayerId);
      if (playerIndex !== -1) {
        recoveredRoomCode = roomCode;
        
        room.players[playerIndex].id = socket.id;
        room.players[playerIndex].isActive = true;
        
        if (room.players[playerIndex].disconnectTimer) {
          clearTimeout(room.players[playerIndex].disconnectTimer!);
          room.players[playerIndex].disconnectTimer = null;
        }
        
        console.log(`[Server] Player re-associated: PersistentID ${socket.data.persistentPlayerId} with socket ${socket.id} in room ${roomCode}`);
        const currentIO = getIO();
        currentIO.to(roomCode).emit('player_reconnected_status', { 
          playerId: socket.id,
          persistentPlayerId: socket.data.persistentPlayerId || '',
          isActive: true
        });
        
        broadcastGameState(roomCode);
        break;
      }
    }
    
    if (recoveredRoomCode) {
      socket.roomCode = recoveredRoomCode;
      socket.join(recoveredRoomCode);
      
      const gameState = getGameState(recoveredRoomCode);
      if (gameState) {
        socket.emit('game_state_update', gameState);
      }
    } else {
      socket.emit('session_not_fully_recovered_join_manually');
      console.log(`[Server] Could not fully recover session for persistentPlayerId ${socket.data.persistentPlayerId}. Manual rejoin may be needed.`);
    }
  } else {
    console.log(`[Server] New connection or CSR failed: ${socket.id}. Client will need to send create_room or join_room.`);
  }

  // Create a new game room (Gamemaster)
  socket.on('create_room', ({ roomCode, isStreamerMode } = {}) => {
    const finalRoomCode = roomCode || generateRoomCode();
    console.log(`[Server] Creating room:`, {
      roomCode: finalRoomCode,
      gamemaster: socket.id,
      persistentGamemasterId: socket.data.persistentPlayerId,
      isStreamerMode,
      timestamp: new Date().toISOString()
    });
    
    if (!socket.data.isGameMaster) {
      console.error(`[Server] Create room failed - Socket ${socket.id} not identified as GM`);
      socket.emit('error', { message: 'Only game masters can create rooms' });
      return;
    }
    
    const room = createGameRoom(finalRoomCode, socket.id, socket.data.persistentPlayerId || '');
    room.isStreamerMode = isStreamerMode || false;
    room.lastActivity = new Date().toISOString();
    gameRooms[finalRoomCode] = room;

    socket.join(finalRoomCode);
    socket.roomCode = finalRoomCode;
    socket.emit('room_created', { roomCode: finalRoomCode, isStreamerMode: room.isStreamerMode });
    
    console.log(`[Server] Room created successfully:`, {
      roomCode: finalRoomCode,
      gamemaster: socket.id,
      persistentGamemasterId: socket.data.persistentPlayerId,
      isStreamerMode: room.isStreamerMode,
      timestamp: new Date().toISOString()
    });
    
    saveRoomState();
  });

  // Handle player joining
  socket.on('join_room', ({ roomCode, playerName, isSpectator, avatarSvg }) => {
    console.log(`[Server] Player joining room:`, {
      roomCode,
      playerName,
      playerId: socket.id,
      persistentPlayerId: socket.data.persistentPlayerId,
      isSpectator,
      hasAvatar: !!avatarSvg,
      timestamp: new Date().toISOString()
    });
    
    if (!gameRooms[roomCode]) {
      console.error(`[Server] Join room failed - Invalid room code:`, {
        roomCode,
        playerName,
        playerId: socket.id
      });
      socket.emit('room_not_found', { message: 'Room not found. It may have expired or been deleted. Please join a different room.' });
      socket.emit('error', 'Invalid room code');
      return;
    }

    const room = gameRooms[roomCode];
    room.lastActivity = new Date().toISOString();
    socket.data.isGameMaster = false;

    const persistentPlayerId = socket.data.persistentPlayerId || `F-${socket.id.substring(0,8)}`;
    const currentPlayerName = playerName || socket.data.playerName || `Player_${persistentPlayerId.substring(0,5)}`;

    const existingPlayerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
    
    if (existingPlayerIndex !== -1) {
      const existingPlayer = room.players[existingPlayerIndex];
      
      if (existingPlayer.isActive === false) {
        console.log(`[Server] Player ${persistentPlayerId} rejoining room ${roomCode}`);
        existingPlayer.id = socket.id;
        existingPlayer.isActive = true;
        if (currentPlayerName && currentPlayerName !== existingPlayer.name) {
          existingPlayer.name = currentPlayerName;
        }
        if (avatarSvg) {
          existingPlayer.avatarSvg = avatarSvg;
        }
        if (existingPlayer.disconnectTimer) {
          clearTimeout(existingPlayer.disconnectTimer);
          existingPlayer.disconnectTimer = null;
        }
        socket.join(roomCode);
        socket.roomCode = roomCode;
        console.log(`[Server] Player rejoined successfully:`, { roomCode, playerName: existingPlayer.name, playerId: socket.id, persistentPlayerId, timestamp: new Date().toISOString() });
        socket.emit('room_joined', { roomCode, playerId: persistentPlayerId, isStreamerMode: room.isStreamerMode });
        const currentIO = getIO();
        currentIO.to(roomCode).emit('player_reconnected_status', { playerId: socket.id, persistentPlayerId, isActive: true });
        const gameState = getGameState(roomCode);
        if (gameState) socket.emit('game_state_update', gameState);
        broadcastGameState(roomCode);
        return;
      } 
      else if (existingPlayer.isActive === true && existingPlayer.id !== socket.id) {
        const currentIO = getIO();
        const existingSocket = currentIO.sockets.sockets.get(existingPlayer.id);
        if (!existingSocket || !existingSocket.connected) {
          console.log(`[Server] Found stale connection for player. Old socket ${existingPlayer.id} is no longer connected. Updating player record.`);
          existingPlayer.id = socket.id;
          existingPlayer.isActive = true;
          socket.join(roomCode);
          socket.roomCode = roomCode;
          socket.emit('room_joined', { roomCode, playerId: persistentPlayerId, isStreamerMode: room.isStreamerMode });
          const gameState = getGameState(roomCode);
          if (gameState) socket.emit('game_state_update', gameState);
          broadcastGameState(roomCode);
          return;
        }
        console.error(`[Server] Join room failed - Already connected from another tab/device:`, { roomCode, persistentPlayerId, existingSocketId: existingPlayer.id, newSocketId: socket.id });
        socket.emit('error', 'Already connected from another tab/device');
        return;
      }
      else if (existingPlayer.isActive === true && existingPlayer.id === socket.id) {
        console.log(`[Server] Redundant join request from ${socket.id} for room ${roomCode}. Ensuring state consistency.`);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.emit('room_joined', { roomCode, playerId: persistentPlayerId, isStreamerMode: room.isStreamerMode });
        const gameState = getGameState(roomCode);
        if (gameState) socket.emit('game_state_update', gameState);
        return;
      }
    }
    
    const isDuplicateName = room.players.some(player => player.name.toLowerCase() === currentPlayerName.toLowerCase());
    if (isDuplicateName) {
      console.error(`[Server] Join room failed - Name already taken:`, { roomCode, playerName: currentPlayerName, playerId: socket.id });
      socket.emit('error', 'This name is already taken in the room. Please choose a different name.');
      return;
    }
    
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    const player: Player = {
      id: socket.id,
      persistentPlayerId: persistentPlayerId,
      name: currentPlayerName,
      lives: 3,
      answers: [],
      isActive: true,
      isSpectator: !!isSpectator, // Ensure boolean
      joinedAsSpectator: !!isSpectator,
      disconnectTimer: null,
      avatarSvg: avatarSvg || null
    };
    room.players.push(player);

    console.log(`[Server] Player joined successfully:`, { roomCode, playerName: currentPlayerName, playerId: socket.id, persistentPlayerId, totalPlayers: room.players.length, timestamp: new Date().toISOString() });
    socket.emit('room_joined', { roomCode, playerId: persistentPlayerId, isStreamerMode: room.isStreamerMode });
    console.log(`[Server] Sent room_joined event to player:`, { roomCode, playerId: socket.id, persistentPlayerId, isStreamerMode: room.isStreamerMode, timestamp: new Date().toISOString() });
    const gameState = getGameState(roomCode);
    if (gameState) {
      socket.emit('game_state_update', gameState);
      console.log(`[Server] Sent initial game state to player:`, { roomCode, playerId: socket.id, gameStarted: gameState.started, currentQuestionIndex: gameState.currentQuestionIndex });
    }
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
        playerCount: room.players.length,
        currentQuestion: room.currentQuestion ? room.currentQuestion.text : null,
        roundAnswers: Object.keys(room.roundAnswers || {}).length
      } : null
    });

    if (!room) {
      console.log('[SERVER] Start game failed - Room not found:', { roomCode, timestamp: new Date().toISOString() });
      socket.emit('room_not_found', { message: 'Room not found. It may have expired or been deleted.' });
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
        playerCount: room.players.length,
        timestamp: new Date().toISOString()
      });
      const currentIO = getIO();
      // Notify all clients in the room
      currentIO.to(roomCode).emit('game_started', {
        question: room.currentQuestion,
        timeLimit: room.timeLimit
      });

      // Send updated game state
      broadcastGameState(roomCode);

      // Start timer for the first question if a specific time limit is set
      if (room.timeLimit && room.timeLimit < 99999) {
        console.log(`[SERVER] Starting timer for first question in room ${roomCode} with limit ${room.timeLimit}`);
        startQuestionTimer(roomCode);
      }

    } catch (error: any) {
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
    room.isConcluded = false;

    if (gameAnalytics && gameAnalytics.games && gameAnalytics.games[roomCode]) {
      delete gameAnalytics.games[roomCode];
    }

    console.log(`[Server Restart] Attempting to restart game in room: ${roomCode}`);
    clearRoomTimer(roomCode);
    room.started = false;
    room.currentQuestionIndex = 0;
    if (room.questions && room.questions.length > 0) {
      room.currentQuestion = room.questions[0];
    } else {
      room.currentQuestion = null;
    }
    room.questionStartTime = null;
    room.roundAnswers = {};
    room.evaluatedAnswers = {};
    room.submissionPhaseOver = false;
    room.players.forEach(player => {
      if (player.joinedAsSpectator) {
        player.lives = 0;
        player.isActive = true;
        player.isSpectator = true;
        player.answers = [];
      } else {
        player.lives = 3;
        player.answers = [];
        player.isActive = true;
        player.isSpectator = false;
      }
    });
    if (room.playerBoards) {
      Object.keys(room.playerBoards).forEach(playerId => {
        if(room.playerBoards[playerId]){
          room.playerBoards[playerId].boardData = ''; 
        }
      });
    }
    const currentIO = getIO();
    currentIO.to(roomCode).emit('game_restarted', { roomCode }); 
    broadcastGameState(roomCode);
    console.log(`[Server Restart] Game restarted successfully in room: ${roomCode}. New state broadcasted.`);
  });

  // Handle board updates (Socket Event)
  socket.on('update_board', ({ roomCode, boardData }) => {
    console.log(`[Server Socket] Received board update:`, {
      roomCode,
      playerId: socket.id,
      dataSize: boardData?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    if (!gameRooms[roomCode]) {
      console.error('[Server Socket] Board update failed - Invalid room:', roomCode);
      return;
    }

    const room = gameRooms[roomCode];
    if (!socket.rooms.has(roomCode)) {
      console.error('[Server Socket] Board update failed - Socket not in room:', { roomCode, playerId: socket.id });
      return;
    }
    
    if (room.submissionPhaseOver) {
      console.warn(`[Server Socket UpdateBoard] Denied: submission phase over for room ${roomCode}, player ${socket.id}`);
      return; // Silently ignore
    }
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.isSpectator || !player.isActive) {
      console.warn(`[Server Socket UpdateBoard] Denied for inactive/spectator player: ${socket.id}`);
      return;
    }
    
    if (!room.playerBoards) {
      room.playerBoards = {};
    }

    room.playerBoards[socket.id] = {
      boardData,
      roundIndex: room.currentQuestionIndex,
      timestamp: Date.now(),
      playerId: socket.id,
      persistentPlayerId: player.persistentPlayerId
    };

    const playerName = player ? player.name : 'Unknown Player';
    console.log(`[Server Socket] Broadcasting board update:`, { roomCode, playerId: socket.id, playerName, roundIndex: room.currentQuestionIndex, timestamp: new Date().toISOString() });
    const currentIO = getIO();
    currentIO.to(roomCode).emit('board_update', { playerId: socket.id, playerName, boardData });
  });

  // Handle request_players event (Socket Event)
  socket.on('request_players', ({ roomCode }) => {
    console.log(`[Server Socket] Received request_players for room:`, { roomCode, socketId: socket.id, persistentPlayerId: socket.data.persistentPlayerId, timestamp: new Date().toISOString() });
    
    const room = gameRooms[roomCode];
    if (!room) {
      console.error('[Server Socket] request_players failed - Room not found:', roomCode);
      socket.emit('room_not_found', { message: 'Room not found. It may have expired or been deleted.' });
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const isPotentialGameMaster = room.gamemasterPersistentId === socket.data.persistentPlayerId;
    console.log(`[Server Socket] request_players authorization check:`, { roomCode, socketId: socket.id, isPotentialGameMaster, persistentPlayerId: socket.data.persistentPlayerId, gmPersistentId: room.gamemasterPersistentId, isGameMaster: socket.data.isGameMaster, timestamp: new Date().toISOString() });
    
    if (isPotentialGameMaster && socket.data.isGameMaster === true) {
      if (room.gamemaster !== socket.id) {
        console.log(`[Server Socket] Game master re-authenticated:`, { roomCode, socketId: socket.id, persistentPlayerId: socket.data.persistentPlayerId });
        room.gamemaster = socket.id;
        room.gamemasterSocketId = socket.id;
        if (room.gamemasterDisconnected) {
          if (room.gamemasterDisconnectTimer) {
            clearTimeout(room.gamemasterDisconnectTimer);
            room.gamemasterDisconnectTimer = null;
          }
          room.gamemasterDisconnected = false;
          const currentIO = getIO();
          currentIO.to(roomCode).emit('gm_disconnected_status', { disconnected: false });
        }
      }
    }
    // Emitting players_update to the requesting client
    socket.emit('players_update', room.players.map((p: Player) => ({
      id: p.id,
      name: p.name,
      persistentPlayerId: p.persistentPlayerId,
      lives: p.lives,
      isActive: p.isActive,
      isSpectator: p.isSpectator,
      joinedAsSpectator: p.joinedAsSpectator,
      disconnectTimer: null,
      answers: p.answers,
      avatarSvg: p.avatarSvg
    })));
  });

  // Handle answer submission
  socket.on('submit_answer', ({ roomCode, answer, hasDrawing, drawingData, answerAttemptId }) => {
    console.log(`[Server Socket] Received answer:`, { roomCode, playerId: socket.id, answerLength: answer.length, hasDrawing, drawingDataLength: drawingData?.length || 0, attemptId: answerAttemptId || 'none', timestamp: new Date().toISOString() });
    
    if (!gameRooms[roomCode]) {
      console.error('[Server Socket] Answer submission failed - Room not found:', roomCode);
      socket.emit('room_not_found', { message: 'Room not found. It may have expired or been deleted.' });
      socket.emit('error', 'Room not found');
      return;
    }

    const room = gameRooms[roomCode];
    const isGMSubmittingInCommunityMode = room.isCommunityVotingMode && socket.id === room.gamemaster;
    
    const effectivePersistentPlayerId = isGMSubmittingInCommunityMode 
      ? room.gamemasterPersistentId 
      : socket.data.persistentPlayerId;

    // For GM in community mode, create a temporary player-like object for answer processing.
    // For actual players, find them in the room.players array.
    const playerEntryForAnswer = isGMSubmittingInCommunityMode
      ? { 
          id: socket.id, 
          name: 'GameMaster (Player)', // Special name for GM when playing
          persistentPlayerId: room.gamemasterPersistentId, 
          answers: room.roundAnswers[room.gamemasterPersistentId] ? [room.roundAnswers[room.gamemasterPersistentId]] : [], // Use existing answer if GM re-submits, else empty
          lives: 3, // Not strictly needed for GM answer logic but good for consistency
          isActive: true, 
          isSpectator: false 
        }
      : room.players.find(p => p.persistentPlayerId === effectivePersistentPlayerId);

    if (!playerEntryForAnswer || (!isGMSubmittingInCommunityMode && (playerEntryForAnswer.isSpectator || !playerEntryForAnswer.isActive))) {
      console.warn(`[Server Socket SubmitAnswer] Denied: Invalid player or GM submission context. Socket: ${socket.id}, PersistentID: ${effectivePersistentPlayerId}, IsGMCommMode: ${isGMSubmittingInCommunityMode}`);
      socket.emit('error', 'Submission denied: Invalid player context.');
      return;
    }

    // Standard players cannot submit if submission phase is over.
    // GM in community mode might submit slightly later if their UI allows, but generally should also adhere.
    if (room.submissionPhaseOver && !isGMSubmittingInCommunityMode) { 
      console.warn(`[Server Socket SubmitAnswer] Denied for player: Submission phase over. Room: ${roomCode}, Player: ${socket.id}`);
      socket.emit('error', 'Submission phase is over for this round.');
      return;
    }

    // Check for duplicate submission with same answerAttemptId
    const currentAnswerForPlayer = room.roundAnswers[effectivePersistentPlayerId!]; // Assert non-null, as effectivePersistentPlayerId should be set
    if (answerAttemptId && currentAnswerForPlayer && currentAnswerForPlayer.answerAttemptId === answerAttemptId) {
      console.log(`[Server Socket SubmitAnswer] Duplicate submission with ID ${answerAttemptId} for ${effectivePersistentPlayerId}`);
      socket.emit('answer_received', { status: 'success', message: 'Answer already received' });
      return;
    }
    
    // If not a duplicate by attemptId, but an answer already exists for this player/round (without an attemptId, or different attemptId)
    // this typically means a resubmission is being attempted. For now, we allow overwriting if not a direct duplicate by attemptId.
    // More complex logic could be added here to prevent overwriting if desired.

    try {
      let drawingDataForStorage: string | null = null;
      let finalHasDrawing = false;

      if (isGMSubmittingInCommunityMode && hasDrawing) {
        // GM's drawing comes from room.gameMasterBoardData
        drawingDataForStorage = room.gameMasterBoardData || null;
        finalHasDrawing = !!drawingDataForStorage;
        console.log(`[Server Socket SubmitAnswer] GM in community mode: using gameMasterBoardData. HasDrawing: ${finalHasDrawing}`);
      } else if (hasDrawing) { // Regular player submission with drawing
        if (drawingData && drawingData.trim() !== '') {
          drawingDataForStorage = drawingData;
          finalHasDrawing = true;
        } else {
          // Fallback to playerBoards if client sends hasDrawing but no data
          if (room.playerBoards && room.playerBoards[socket.id]) {
            const playerBoardEntry = room.playerBoards[socket.id];
            if (playerBoardEntry.roundIndex === room.currentQuestionIndex && playerBoardEntry.boardData && playerBoardEntry.boardData.trim() !== '') {
              drawingDataForStorage = playerBoardEntry.boardData;
              finalHasDrawing = true;
            }
          }
        }
      }

      const answerData: PlayerAnswer = {
        playerId: socket.id,
        persistentPlayerId: effectivePersistentPlayerId!,
        playerName: playerEntryForAnswer.name,
        answer,
        hasDrawing: finalHasDrawing,
        drawingData: drawingDataForStorage,
        timestamp: Date.now(),
        isCorrect: null, // Evaluation pending
        answerAttemptId: answerAttemptId || null
      };
      
      // Store answer in room.roundAnswers, keyed by persistentPlayerId (for both players and GM in community mode)
      if (!room.roundAnswers) room.roundAnswers = {};
      room.roundAnswers[effectivePersistentPlayerId!] = answerData;

      // If it's a regular player, also update their individual answers array
      if (!isGMSubmittingInCommunityMode && playerEntryForAnswer.answers) {
         // Ensure player.answers is an array of correct length if needed, though usually handled by game start/next question
        if (playerEntryForAnswer.answers.length <= room.currentQuestionIndex) {
            // Fill with undefined if necessary to reach currentQuestionIndex
            for (let i = playerEntryForAnswer.answers.length; i <= room.currentQuestionIndex; i++) {
                playerEntryForAnswer.answers[i] = undefined as any; 
            }
        }
        playerEntryForAnswer.answers[room.currentQuestionIndex] = answerData;
      }
      
      // If GM is submitting in community mode, update their entry in room.players as well
      else if (isGMSubmittingInCommunityMode) {
        const gmPlayerRecord = room.players.find(p => p.persistentPlayerId === room.gamemasterPersistentId && p.name === 'GameMaster (Playing)');
        if (gmPlayerRecord) {
          if (!gmPlayerRecord.answers) gmPlayerRecord.answers = [];
          // Ensure answers array is long enough
          while(gmPlayerRecord.answers.length <= room.currentQuestionIndex) {
            gmPlayerRecord.answers.push(undefined as any);
          }
          gmPlayerRecord.answers[room.currentQuestionIndex] = answerData;
          console.log(`[Server Socket SubmitAnswer] Updated GM's player record answers array.`);
        }
      }
      
      // Player boards for regular players (GM's drawing is already in room.gameMasterBoardData)
      if (!isGMSubmittingInCommunityMode && finalHasDrawing && drawingDataForStorage) {
        if (!room.playerBoards) room.playerBoards = {};
        room.playerBoards[socket.id] = {
          boardData: drawingDataForStorage,
          roundIndex: room.currentQuestionIndex,
          timestamp: Date.now(),
          playerId: socket.id,
          persistentPlayerId: effectivePersistentPlayerId!
        };
      }

      console.log(`[Server Socket] Answer stored for ${effectivePersistentPlayerId}:`, { answer: answerData.answer, hasDrawing: answerData.hasDrawing, drawingLength: answerData.drawingData?.length });
      socket.emit('answer_received', { status: 'success', message: 'Answer received!' });
      
      // If GM submitted in community mode, send specific ack
      if (isGMSubmittingInCommunityMode && room.currentQuestion) {
        socket.emit('gm_community_answer_accepted', { questionId: room.currentQuestion.id });
      }

      broadcastGameState(roomCode);
      const responseTime = room.questionStartTime ? Date.now() - room.questionStartTime : 0;
      gameAnalytics.recordAnswer(roomCode, effectivePersistentPlayerId!, answer, null, responseTime);
      
      // Check if all answers are in to start preview/voting phase automatically
      // This check should run after every answer submission (player or GM in community mode)
      const activePlayersInRoom = room.players.filter(p => p.isActive && !p.isSpectator);
      let expectedParticipantPIds = activePlayersInRoom.map(p => p.persistentPlayerId);
      
      if (room.isCommunityVotingMode && room.gamemasterPersistentId) {
        if (!expectedParticipantPIds.includes(room.gamemasterPersistentId)) {
          expectedParticipantPIds.push(room.gamemasterPersistentId);
        }
      }

      const allHaveSubmitted = expectedParticipantPIds.length > 0 && expectedParticipantPIds.every(pid => room.roundAnswers[pid]);

      // Detailed log before checking allHaveSubmitted
      console.log(`[Server Socket SubmitAnswer Check] Room: ${roomCode}, Submitter: ${effectivePersistentPlayerId}, IsGMPlaying: ${isGMSubmittingInCommunityMode}`);
      console.log(`[Server Socket SubmitAnswer Check] Expected PIDs (${expectedParticipantPIds.length}): ${JSON.stringify(expectedParticipantPIds)}`);
      console.log(`[Server Socket SubmitAnswer Check] roundAnswers Keys (${Object.keys(room.roundAnswers).length}): ${JSON.stringify(Object.keys(room.roundAnswers))}`);
      console.log(`[Server Socket SubmitAnswer Check] allHaveSubmitted: ${allHaveSubmitted}`);

      if (allHaveSubmitted) {
        console.log(`[Server Socket SubmitAnswer] All ${expectedParticipantPIds.length} expected participants have submitted for room ${roomCode}.`);
        if (!room.submissionPhaseOver) { // Only trigger if not already triggered by timer/manual end
            console.log(`[Server Socket SubmitAnswer] Automatically starting preview mode.`);
            room.submissionPhaseOver = true; 
            clearRoomTimer(roomCode); 
            broadcastGameState(roomCode); // Broadcast updated submissionPhaseOver
            
            const currentIO = getIO();
            currentIO.to(roomCode).emit('start_preview_mode');
        }
      } else {
        console.log(`[Server Socket SubmitAnswer] Still waiting for ${expectedParticipantPIds.length - Object.keys(room.roundAnswers).length} answers.`);
      }
      
    } catch (error: any) {
      console.error('[Server Socket] Error storing answer:', { error: error.message, stack: error.stack, roomCode, playerId: socket.id });
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

    // Prevent GM evaluation if community voting is active for the room
    if (room.isCommunityVotingMode) {
      socket.emit('error', 'Direct evaluation is disabled when community voting is active.');
      return;
    }

    try {
      const persistentPlayerIdFromClient = playerId;
      const playerObjInRoom = room.players.find(p => p.persistentPlayerId === persistentPlayerIdFromClient);
      const submittedAnswerData = room.roundAnswers[persistentPlayerIdFromClient];

      if (!submittedAnswerData) {
        console.warn(`[Server Socket EVal] No answer submission found for persistentPlayerId: ${persistentPlayerIdFromClient}`);
        socket.emit('error', { message: 'No answer found for player to evaluate.' }); // Changed to error event
        return;
      }

      submittedAnswerData.isCorrect = isCorrect;
      if(!room.evaluatedAnswers) room.evaluatedAnswers = {};
      room.evaluatedAnswers[persistentPlayerIdFromClient] = isCorrect;

      if (playerObjInRoom) {
        const playerSpecificAnswerRecord = playerObjInRoom.answers[room.currentQuestionIndex];
        if (playerSpecificAnswerRecord) {
            playerSpecificAnswerRecord.isCorrect = isCorrect;
        } else {
            if (playerObjInRoom.answers && room.currentQuestionIndex !== undefined) {
                 playerObjInRoom.answers[room.currentQuestionIndex] = { 
                    ...submittedAnswerData,
                    isCorrect: isCorrect 
                };
            }
        }

        if (!isCorrect) {
          playerObjInRoom.lives = Math.max(0, (playerObjInRoom.lives || 0) - 1);
          if (playerObjInRoom.lives <= 0) {
            playerObjInRoom.isActive = false;
            playerObjInRoom.isSpectator = true;
            const playerSocket = getIO().sockets.sockets.get(playerObjInRoom.id);
            if (playerSocket) {
                playerSocket.emit('become_spectator');
            }
          }
        }
      }

      const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
      if (room.started && activePlayers.length <= 1 && room.players.length > 0) {
        if (!room.isConcluded) {
            const winner: WinnerInfo | null = activePlayers.length === 1 ? { 
                id: activePlayers[0].id, 
                persistentPlayerId: activePlayers[0].persistentPlayerId,
                name: activePlayers[0].name 
            } : null;
            concludeGameAndSendRecap(roomCode, winner);
        }
      }

      broadcastGameState(roomCode);
      const responseTime = room.questionStartTime ? Date.now() - room.questionStartTime : 0;
      gameAnalytics.recordAnswer(roomCode, persistentPlayerIdFromClient, submittedAnswerData.answer, isCorrect, responseTime);

    } catch (error: any) {
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
    if (room.currentQuestionIndex < room.questions.length - 1) {
      room.currentQuestionIndex += 1;
      room.currentQuestion = room.questions[room.currentQuestionIndex];
      room.questionStartTime = Date.now();
      room.submissionPhaseOver = false;
      room.roundAnswers = {};
      room.evaluatedAnswers = {};
      room.players.forEach(player => {
        if(player.answers) player.answers[room.currentQuestionIndex] = undefined as any; // Reset for new question
      });
      clearRoomTimer(roomCode);
      if (room.timeLimit && room.timeLimit < 99999) {
        startQuestionTimer(roomCode);
      }
      broadcastGameState(roomCode); // Broadcasts full state including new question
      const currentIO = getIO();
      currentIO.to(roomCode).emit('new_question', { question: room.currentQuestion, timeLimit: room.timeLimit || 0 });
    }
  });

  // Handle end round early request from gamemaster
  socket.on('end_round_early', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to end round early');
      return;
    }
    const room = gameRooms[roomCode];
    if (!room) return;
    clearRoomTimer(roomCode);
    const currentIO = getIO();
    currentIO.to(roomCode).emit('time_up');
    console.log(`[EndRoundEarly] Emitted 'time_up' for room ${roomCode}. Starting grace period of ${AUTO_SUBMIT_GRACE_PERIOD_MS}ms.`);
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
    const currentIO = getIO();
    currentIO.to(roomCode).emit('start_preview_mode');
  });

  socket.on('stop_preview_mode', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to stop preview mode');
      return;
    }
    const currentIO = getIO();
    currentIO.to(roomCode).emit('stop_preview_mode');
  });

  socket.on('focus_submission', ({ roomCode, playerId }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) {
      socket.emit('error', 'Not authorized to focus submission');
      return;
    }
    const currentIO = getIO();
    currentIO.to(roomCode).emit('focus_submission', { playerId });
  });

  // Get current game state for a room (socket event)
  socket.on('get_game_state', ({ roomCode }) => {
    const room = gameRooms[roomCode];
    if (!room) {
      socket.emit('game_state_update', { started: false } as any); // Cast to any to satisfy type, though it's partial
      return;
    }
    const state = getGameState(roomCode);
    if (state) {
        socket.emit('game_state_update', state);
    } else {
        socket.emit('game_state_update', { started: false } as any);
    }
  });

  socket.on('gm_end_game_request', ({ roomCode }) => {
    const room = gameRooms[roomCode];
    if (!room || room.gamemaster !== socket.id) {
      console.warn(`[Server gm_end_game_request] Unauthorized or room not found by ${socket.id} for ${roomCode}`);
      return;
    }
    if (!room.isConcluded) {
      const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
      const winnerPayload: WinnerInfo | null = activePlayers.length === 1 ? { id: activePlayers[0].id, name: activePlayers[0].name, persistentPlayerId: activePlayers[0].persistentPlayerId } : null;
      concludeGameAndSendRecap(roomCode, winnerPayload);
    } else {
      console.log(`[Server gm_end_game_request] Game in room ${roomCode} already concluded.`);
    }
  });

  socket.on('gm_show_recap_to_all', ({ roomCode }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) return;
    const recap = generateGameRecap(roomCode);
    if (recap) {
      const recapWithInitialState = { ...recap, initialSelectedRoundIndex: 0, initialSelectedTabKey: 'overallResults' };
      getIO().to(roomCode).emit('game_recap', recapWithInitialState);
    }
  });

  socket.on('gm_navigate_recap_round', ({ roomCode, selectedRoundIndex }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) return;
    if (typeof selectedRoundIndex !== 'number') return;
    getIO().to(roomCode).emit('recap_round_changed', { selectedRoundIndex });
  });

  socket.on('gm_navigate_recap_tab', ({ roomCode, selectedTabKey }) => {
    if (!gameRooms[roomCode] || gameRooms[roomCode].gamemaster !== socket.id) return;
    if (typeof selectedTabKey !== 'string') return;
    getIO().to(roomCode).emit('recap_tab_changed', { selectedTabKey });
  });

  socket.on('kick_player', ({ roomCode, playerIdToKick }) => {
    try {
      const room = gameRooms[roomCode];
      if (!room || socket.id !== room.gamemaster) {
        socket.emit('error', { message: 'Only the Game Master can kick players or room not found.' });
        return;
      }
      if (playerIdToKick === socket.id || (room.players.find(p=>p.id === playerIdToKick)?.persistentPlayerId === room.gamemasterPersistentId) ) {
         socket.emit('error', { message: 'Game Master cannot kick themselves.' });
        return;
      }
      let playerIndex = room.players.findIndex(p => p.id === playerIdToKick || p.persistentPlayerId === playerIdToKick);
      if (playerIndex === -1) {
        socket.emit('error', { message: 'Player not found.' });
        return;
      }
      const kickedPlayer = room.players.splice(playerIndex, 1)[0];
      const kickedPlayerSocket = getIO().sockets.sockets.get(kickedPlayer.id);
      if (kickedPlayerSocket) {
        kickedPlayerSocket.emit('kicked_from_room', { roomCode, reason: 'Kicked by Game Master' });
        kickedPlayerSocket.leave(roomCode);
      }
      if (room.playerBoards && room.playerBoards[kickedPlayer.id]) delete room.playerBoards[kickedPlayer.id];
      if (room.roundAnswers && room.roundAnswers[kickedPlayer.persistentPlayerId]) delete room.roundAnswers[kickedPlayer.persistentPlayerId];
      if (room.evaluatedAnswers && room.evaluatedAnswers[kickedPlayer.persistentPlayerId]) delete room.evaluatedAnswers[kickedPlayer.persistentPlayerId];
      broadcastGameState(roomCode);
    } catch (error: any) {
      console.error(`[Server Kick] Error:`, error);
      socket.emit('error', { message: 'Internal server error during kick.' });
    }
  });

  socket.on('disconnect', (reason: string) => {
    const roomCode = socket.roomCode;
    const { persistentPlayerId, playerName, isGameMaster } = socket.data || {};
    console.log(`[Server Disconnect] Socket ${socket.id} (persistent: ${persistentPlayerId}) disconnected. Reason: ${reason}, Room: ${roomCode}`);

    if (roomCode && gameRooms[roomCode] && socket.data.isWebRTCReady) {
        getIO().to(roomCode).emit('webrtc-user-left', { socketId: socket.id });
    }

    if (!roomCode || !gameRooms[roomCode]) return;
    const room = gameRooms[roomCode]!;
    const isTemporaryDisconnect = ['transport close', 'transport error', 'ping timeout', 'client ping timeout'].includes(reason);

    if (isGameMaster && persistentPlayerId === room.gamemasterPersistentId && socket.id === room.gamemasterSocketId) {
      console.log(`[Server Disconnect] GM disconnected from room ${roomCode}`);
      room.gamemasterDisconnected = true;
      getIO().to(roomCode).emit('gm_disconnected_status', { disconnected: true, temporary: isTemporaryDisconnect });
      if (!isTemporaryDisconnect) {
        saveRoomState();
        room.gamemasterDisconnectTimer = setTimeout(() => {
          if (room.gamemasterDisconnected) {
            console.log(`[Server Disconnect] GM did not reconnect. Ending game in room ${roomCode}`);
            room.gamemasterDisconnectTime = new Date().toISOString();
            getIO().to(roomCode).emit('room_not_found', { message: 'Room expired: GM disconnected too long.' });
            getIO().to(roomCode).emit('game_over', { reason: 'GM disconnected too long' });
            room.isConcluded = true;
            saveRoomState();
            delete gameRooms[roomCode];
          }
        }, 2 * 60 * 1000 + 10000); // 2 mins + 10s grace
      } else {
        saveRoomState();
      }
    } else if (!isGameMaster) {
      const playerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
      if (playerIndex !== -1 && room.players[playerIndex].id === socket.id) {
        const player = room.players[playerIndex];
        if (reason === 'client namespace disconnect' || reason === 'server namespace disconnect') {
          console.log(`[Server Disconnect] Player ${player.name} gracefully disconnected.`);
          room.players.splice(playerIndex, 1);
          if (room.playerBoards && room.playerBoards[player.id]) delete room.playerBoards[player.id];
          if (room.roundAnswers && room.roundAnswers[player.persistentPlayerId]) delete room.roundAnswers[player.persistentPlayerId];
          if (room.evaluatedAnswers && room.evaluatedAnswers[player.persistentPlayerId]) delete room.evaluatedAnswers[player.persistentPlayerId];
          getIO().to(roomCode).emit('player_left_gracefully', { playerId: player.id, persistentPlayerId: player.persistentPlayerId, playerName: player.name });
        } else {
          console.log(`[Server Disconnect] Player ${player.name} abruptly disconnected. Waiting for re-connection.`);
          player.isActive = false;
          getIO().to(roomCode).emit('player_disconnected_status', { playerId: player.id, persistentPlayerId: player.persistentPlayerId, isActive: false, temporary: isTemporaryDisconnect });
          if (!isTemporaryDisconnect) {
            player.disconnectTimer = setTimeout(() => {
              const currentPIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
              if (currentPIndex !== -1 && !room.players[currentPIndex].isActive) {
                console.log(`[Server Disconnect] Player ${player.name} did not reconnect. Removing.`);
                const removedPlayer = room.players.splice(currentPIndex, 1)[0];
                if (room.playerBoards && room.playerBoards[removedPlayer.id]) delete room.playerBoards[removedPlayer.id];
                if (room.roundAnswers && room.roundAnswers[removedPlayer.persistentPlayerId]) delete room.roundAnswers[removedPlayer.persistentPlayerId];
                if (room.evaluatedAnswers && room.evaluatedAnswers[removedPlayer.persistentPlayerId]) delete room.evaluatedAnswers[removedPlayer.persistentPlayerId];
                getIO().to(roomCode).emit('player_removed_after_timeout', { playerId: removedPlayer.id, persistentPlayerId: removedPlayer.persistentPlayerId, playerName: removedPlayer.name });
              }
              broadcastGameState(roomCode);
            }, 2 * 60 * 1000 + 15000); // 2 mins + 15s grace
          }
        }
        broadcastGameState(roomCode);
      }
    }
  });

  socket.on('rejoin_room', ({ roomCode, isGameMaster, persistentPlayerId, avatarSvg }) => {
    console.log(`[Server Rejoin] Received rejoin_room:`, { roomCode, socketId: socket.id, persistentPlayerId: persistentPlayerId || socket.data.persistentPlayerId, isGameMaster, hasAvatar: !!avatarSvg });
    socket.data.persistentPlayerId = persistentPlayerId || socket.data.persistentPlayerId;
    socket.data.isGameMaster = isGameMaster;
    const room = gameRooms[roomCode];
    if (!room) {
      socket.emit('room_not_found', { message: 'Room not found. Please create a new room.' });
      socket.emit('error', { message: 'Room not found'});
      return;
    }
    const actualPersistentId = socket.data.persistentPlayerId || '';
    if (isGameMaster === true && room.gamemasterPersistentId === actualPersistentId) {
      room.gamemaster = socket.id;
      room.gamemasterSocketId = socket.id;
      socket.join(roomCode);
      socket.roomCode = roomCode;
      if (room.gamemasterDisconnected) {
        if (room.gamemasterDisconnectTimer) clearTimeout(room.gamemasterDisconnectTimer);
        room.gamemasterDisconnectTimer = null;
        room.gamemasterDisconnected = false;
        getIO().to(roomCode).emit('gm_disconnected_status', { disconnected: false });
      }
      socket.data.playerName = 'GameMaster';
      socket.emit('room_created', { roomCode, isStreamerMode: room.isStreamerMode });
      const gameState = getGameState(roomCode);
      if (gameState) socket.emit('game_state_update', gameState);
      socket.emit('players_update', room.players);
      room.lastActivity = new Date().toISOString();
      saveRoomState();
      return;
    }
    const playerIndex = room.players.findIndex(p => p.persistentPlayerId === actualPersistentId);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      player.id = socket.id;
      player.isActive = true;
      if (avatarSvg) player.avatarSvg = avatarSvg;
      if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.data.playerName = player.name;
      getIO().to(roomCode).emit('player_reconnected_status', { playerId: socket.id, persistentPlayerId: actualPersistentId, isActive: true });
      broadcastGameState(roomCode);
      room.lastActivity = new Date().toISOString();
      socket.emit('room_joined', { roomCode, playerId: actualPersistentId, isStreamerMode: room.isStreamerMode });
      const gameState = getGameState(roomCode);
      if (gameState) socket.emit('game_state_update', gameState);
      socket.emit('players_update', room.players);
      saveRoomState();
      return;
    }
    if (actualPersistentId && isGameMaster === false) {
      const playerName = socket.data.playerName || `Player_${actualPersistentId.substring(0, 5)}`;
      const newPlayer: Player = { id: socket.id, persistentPlayerId: actualPersistentId, name: playerName, lives: 3, isActive: true, isSpectator: false, joinedAsSpectator: false, answers: [], disconnectTimer: null, avatarSvg: avatarSvg || null };
      room.players.push(newPlayer);
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.data.playerName = playerName;
      getIO().to(roomCode).emit('player_joined' as any, newPlayer); // Cast to any for now
      room.lastActivity = new Date().toISOString();
      socket.emit('room_joined', { roomCode, playerId: actualPersistentId, isStreamerMode: room.isStreamerMode });
      const gameState = getGameState(roomCode);
      if (gameState) socket.emit('game_state_update', gameState);
      socket.emit('players_update', room.players);
      saveRoomState();
      return;
    }
    socket.emit('error', { message: 'Not authorized to rejoin this room' });
  });

  socket.on('update_avatar', ({ roomCode, persistentPlayerId, avatarSvg }) => {
    if (!gameRooms[roomCode]) return;
    const room = gameRooms[roomCode];
    const playerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
    if (playerIndex === -1) return;
    room.players[playerIndex].avatarSvg = avatarSvg;
    getIO().to(roomCode).emit('avatar_updated', { persistentPlayerId, avatarSvg });
  });

  // WebRTC Signaling Handlers
  socket.on('webrtc-ready', ({ roomCode }) => {
    if (!gameRooms[roomCode]) return;
    socket.data.isWebRTCReady = true;
    const room = gameRooms[roomCode];
    const currentIO = getIO();
    
    console.log(`[WebRTC] Socket ${socket.id} is ready for WebRTC in room ${roomCode}.`);
    
    // Get all WebRTC-ready peers in the room, including GM and players
    const otherReadyPeers = [];
    
    // Add GameMaster if they're ready
    const gmSocket = currentIO.sockets.sockets.get(room.gamemasterSocketId || '');
    if (gmSocket?.data.isWebRTCReady && room.gamemasterSocketId !== socket.id) {
      otherReadyPeers.push({ 
        socketId: room.gamemasterSocketId!, 
        persistentPlayerId: room.gamemasterPersistentId, 
        playerName: gmSocket.data.playerName || 'GameMaster', 
        isGameMaster: true 
      });
    }
    
    // Add all ready players
    room.players.forEach(player => {
      const playerSocket = currentIO.sockets.sockets.get(player.id);
      if (player.id !== socket.id && playerSocket?.data.isWebRTCReady) {
        otherReadyPeers.push({
          socketId: player.id,
          persistentPlayerId: player.persistentPlayerId,
          playerName: player.name,
          isGameMaster: false
        });
      }
    });
    
    // Send existing peers to the new peer
    socket.emit('webrtc-existing-peers', { peers: otherReadyPeers });
    
    // Send new peer to all existing peers
    const newPeerData = { 
      socketId: socket.id, 
      persistentPlayerId: socket.data.persistentPlayerId, 
      playerName: socket.data.playerName, 
      isGameMaster: socket.data.isGameMaster 
    };
    
    otherReadyPeers.forEach(peer => {
      currentIO.to(peer.socketId).emit('webrtc-new-peer', { newPeer: newPeerData });
    });
    
    // Force a broadcast of camera states to ensure everyone sees each other's state
    currentIO.to(roomCode).emit('webrtc-refresh-states', { timestamp: Date.now() });
  });

  socket.on('webrtc-offer', ({ offer, to, from }) => { 
    console.log(`[WebRTC] Relaying offer from ${from} to ${to}`);
    getIO().to(to).emit('webrtc-offer', { offer, from }); 
  });
  
  socket.on('webrtc-answer', ({ answer, to, from }) => { 
    console.log(`[WebRTC] Relaying answer from ${from} to ${to}`);
    getIO().to(to).emit('webrtc-answer', { answer, from }); 
  });
  
  socket.on('webrtc-ice-candidate', ({ candidate, to, from }) => { 
    // No need to log every ICE candidate as it can be very verbose
    getIO().to(to).emit('webrtc-ice-candidate', { candidate, from }); 
  });
  
  // New events for webcam and microphone state broadcasting
  socket.on('webcam-state-change', ({ roomCode, enabled, fromSocketId }: { roomCode: string, enabled: boolean, fromSocketId: string }) => {
    if (!roomCode || !gameRooms[roomCode]) return;
    
    console.log(`[WebRTC] Broadcasting webcam state change from ${fromSocketId}: ${enabled ? 'enabled' : 'disabled'}`);
    socket.to(roomCode).emit('webcam-state-change', { fromSocketId, enabled });
  });
  
  socket.on('microphone-state-change', ({ roomCode, enabled, fromSocketId }: { roomCode: string, enabled: boolean, fromSocketId: string }) => {
    if (!roomCode || !gameRooms[roomCode]) return;
    
    console.log(`[WebRTC] Broadcasting microphone state change from ${fromSocketId}: ${enabled ? 'enabled' : 'disabled'}`);
    socket.to(roomCode).emit('microphone-state-change', { fromSocketId, enabled });
  });

  // Handle community voting status change
  socket.on('toggle_community_voting', ({ roomCode, isCommunityVotingMode }) => {
    if (!gameRooms[roomCode] || socket.id !== gameRooms[roomCode].gamemaster) {
      socket.emit('error', 'Not authorized to toggle community voting');
      return;
    }
    const room = gameRooms[roomCode];
    if (room.started && room.isCommunityVotingMode !== isCommunityVotingMode) {
      socket.emit('error', 'Cannot change community voting mode after game has started.');
      return;
    }

    room.isCommunityVotingMode = isCommunityVotingMode;

    if (isCommunityVotingMode) {
      const gmAsPlayer = room.players.find(p => p.persistentPlayerId === room.gamemasterPersistentId);
      if (!gmAsPlayer) {
        // Ensure answers array is initialized for GM when added as a player
        const gmPlayerAnswers: PlayerAnswer[] = []; 
        for (let i = 0; i < room.questions.length; i++) {
            // Check if GM already has an answer for this round in roundAnswers (e.g. from a previous session or if logic changes)
            const existingAnswer = room.roundAnswers?.[room.gamemasterPersistentId];
            if (existingAnswer && i === room.currentQuestionIndex) { // Simple check for current round, more robust needed for all past rounds
                gmPlayerAnswers[i] = existingAnswer;
            } else {
                gmPlayerAnswers[i] = undefined as any; // Placeholder for past/future rounds
            }
        }

        room.players.push({
          id: room.gamemasterSocketId || `gm-${room.roomCode}`,
          persistentPlayerId: room.gamemasterPersistentId,
          name: 'GameMaster (Playing)',
          lives: 3, 
          answers: gmPlayerAnswers, // Use initialized/populated answers array
          isActive: true,
          isSpectator: false,
          joinedAsSpectator: false,
          disconnectTimer: null,
          avatarSvg: null
        });
        console.log(`[Server] GM ${room.gamemasterPersistentId} added to players list for community voting mode in room ${roomCode}`);
      } else {
        // If GM already exists as a player (e.g. rejoining), ensure their isActive/isSpectator is correct for playing
        gmAsPlayer.isActive = true;
        gmAsPlayer.isSpectator = false;
      }
    } else {
      const gmPlayerIndex = room.players.findIndex(p => p.persistentPlayerId === room.gamemasterPersistentId && p.name === 'GameMaster (Playing)');
      if (gmPlayerIndex !== -1) {
        room.players.splice(gmPlayerIndex, 1);
        console.log(`[Server] GM ${room.gamemasterPersistentId} removed from players list as community voting mode is OFF in room ${roomCode}`);
      }
    }

    const currentIO = getIO();
    currentIO.to(roomCode).emit('community_voting_status_changed', { isCommunityVotingMode: room.isCommunityVotingMode });
    broadcastGameState(roomCode); // Also broadcast full game state
  });

  // Handle Game Master's board update in community voting mode
  socket.on('update_game_master_board', ({ roomCode, boardData }) => {
    const room = gameRooms[roomCode];
    if (!room || socket.id !== room.gamemaster || !room.isCommunityVotingMode) {
      // Optional: emit error if not authorized or not in community voting mode
      return;
    }
    room.gameMasterBoardData = boardData;
    // Potentially broadcast this to players if they need to see GM's board live during this mode,
    // or store it to be revealed during voting.
    // For now, just storing it. A new event might be needed if live update is desired.
    console.log(`[Server] GM board updated in community voting mode for room ${roomCode}`);
  });

  // Handle GM board clear
  socket.on('clear_game_master_board', ({ roomCode }) => {
    const room = gameRooms[roomCode];
    if (room && socket.id === room.gamemaster) {
      room.gameMasterBoardData = null;
      broadcastGameState(roomCode);
    }
  });

  // Handle player vote submission in community voting mode
  socket.on('submit_vote', ({ roomCode, answerId, vote }) => {
    const room = gameRooms[roomCode];
    const voterPersistentId = socket.data.persistentPlayerId;

    if (!room || !room.isCommunityVotingMode || !voterPersistentId) {
      socket.emit('error', 'Voting not allowed or invalid request.');
      return;
    }

    if (!room.votes) {
      room.votes = {};
    }
    if (!room.votes[answerId]) {
      room.votes[answerId] = {};
    }

    // Check if player already voted for this answer
    if (room.votes[answerId][voterPersistentId]) {
      socket.emit('error', 'You have already voted for this answer.');
      return;
    }

    room.votes[answerId][voterPersistentId] = vote;

    // Calculate current vote counts for this answerId
    const currentAnswerVotes = room.votes[answerId];
    const voteCounts = {
      correct: 0,
      incorrect: 0
    };
    Object.values(currentAnswerVotes).forEach(v => {
      if (v === 'correct') voteCounts.correct++;
      else if (v === 'incorrect') voteCounts.incorrect++;
    });

    const currentIO = getIO();
    currentIO.to(roomCode).emit('answer_voted', {
      answerId, // persistentPlayerId of the answer author
      voterId: voterPersistentId, // persistentPlayerId of the voter
      vote,
      voteCounts
    });

    console.log(`[Server] Vote received for answer ${answerId} by ${voterPersistentId}: ${vote}. Counts: C:${voteCounts.correct}, I:${voteCounts.incorrect}`);
    
    // Check if all voting is complete for the round

    // Get PIDs of players whose answers were submitted for this round
    const submittedAnswerPIds = Object.keys(room.roundAnswers || {});

    // Get PIDs of players who are eligible to VOTE in this round
    const eligibleVoterPIds = room.players
        .filter(p => p.isActive && !p.isSpectator) 
        .map(p => p.persistentPlayerId);
    
    // If GM is playing, ensure their persistentPlayerId is in eligibleVoterPIds if not already
    if (room.isCommunityVotingMode && room.gamemasterPersistentId && !eligibleVoterPIds.includes(room.gamemasterPersistentId)) {
        const gmPlayer = room.players.find(p => p.persistentPlayerId === room.gamemasterPersistentId);
        if (gmPlayer && gmPlayer.isActive && !gmPlayer.isSpectator) {
            // This case should ideally not happen if GM is properly added to players list when community mode starts
        } else if (!gmPlayer) {
             // If GM is not in players list but isCommunityVotingMode is on, consider them an eligible voter.
            // This is a safeguard, primary logic should ensure GM is in players list.
            // eligibleVoterPIds.push(room.gamemasterPersistentId); // Potentially re-add if GM is a voter but not in players[]
        }
    }

    const numberOfEligibleVoters = eligibleVoterPIds.length;
    
    // Calculate maximum possible votes for each answer (excluding self-votes)
    let allPossibleVotesCast = true;
    
    // Check if all possible votes have been cast
    for (const ansId of submittedAnswerPIds) {
      const votesForThisAnswer = room.votes?.[ansId] || {};
      const numberOfVotesCasted = Object.keys(votesForThisAnswer).length;
      
      // Calculate how many people CAN vote for this answer (everyone except the answer author)
      const maxPossibleVotesForThisAnswer = eligibleVoterPIds.filter(pid => pid !== ansId).length;
      
      // If fewer votes than possible, voting is not complete
      if (numberOfVotesCasted < maxPossibleVotesForThisAnswer) {
        allPossibleVotesCast = false;
        break;
      }
    }

    console.log(`[Server Vote Check] Room: ${roomCode}, All possible votes cast: ${allPossibleVotesCast}, Submitted Answer PIDs: ${JSON.stringify(submittedAnswerPIds)}, Eligible Voter PIDs: ${JSON.stringify(eligibleVoterPIds)}`);

    if (allPossibleVotesCast && submittedAnswerPIds.length > 0) {
      console.log(`[Server] All possible votes have been cast for room ${roomCode}. Processing evaluations.`);
      
      // 1. Iterate through each answerId in submittedAnswerIds.
      for (const answerId of submittedAnswerPIds) {
        const votesForThisAnswer = room.votes?.[answerId] || {};
        const currentVoteCounts = { correct: 0, incorrect: 0 };
        Object.values(votesForThisAnswer).forEach(v => {
          if (v === 'correct') currentVoteCounts.correct++;
          else if (v === 'incorrect') currentVoteCounts.incorrect++;
        });

        // Special case: If there are no votes (which can happen with few players who can't vote for themselves),
        // default to marking the answer as correct to avoid unfairly penalizing players
        if (currentVoteCounts.correct === 0 && currentVoteCounts.incorrect === 0) {
          console.log(`[Server] No votes for answer ${answerId}. Defaulting to CORRECT.`);
          room.evaluatedAnswers[answerId] = true;
          continue;
        }

        // 2. Determine final evaluation: majority wins. Tie or more incorrect = incorrect.
        const isCorrectByVote = currentVoteCounts.correct > currentVoteCounts.incorrect;
        // 3. Update room.evaluatedAnswers[answerId] with true/false.
        room.evaluatedAnswers[answerId] = isCorrectByVote;
        console.log(`[Server] Answer ${answerId} evaluated by community vote: ${isCorrectByVote ? 'CORRECT' : 'INCORRECT'} (Votes: C:${currentVoteCounts.correct}, I:${currentVoteCounts.incorrect})`);

        // Update player lives if their answer was incorrect.
        // In community mode, this applies to the GM as well if it's their answer.
        const playerWhoseAnswerIsBeingEvaluated = room.players.find(p => p.persistentPlayerId === answerId);
        
        if (playerWhoseAnswerIsBeingEvaluated) { // This player could be a regular player or the GM (if GM is in room.players)
          if (!isCorrectByVote) {
            playerWhoseAnswerIsBeingEvaluated.lives = Math.max(0, (playerWhoseAnswerIsBeingEvaluated.lives || 0) - 1);
            console.log(`[Server] Player ${playerWhoseAnswerIsBeingEvaluated.name} (${answerId}) lives updated to: ${playerWhoseAnswerIsBeingEvaluated.lives}`);
            if (playerWhoseAnswerIsBeingEvaluated.lives <= 0) {
              playerWhoseAnswerIsBeingEvaluated.isActive = false;
              playerWhoseAnswerIsBeingEvaluated.isSpectator = true;
              const playerSocket = getIO().sockets.sockets.get(playerWhoseAnswerIsBeingEvaluated.id);
              if (playerSocket) playerSocket.emit('become_spectator');
              console.log(`[Server] Player ${playerWhoseAnswerIsBeingEvaluated.name} (${answerId}) eliminated.`);
            }
          }
        }
      }
      
      // 5. After all evaluations are done for this round by community vote
      console.log(`[Server] Community vote evaluations complete for room ${roomCode}.`);
      room.submissionPhaseOver = true; // Ensure this is set before next question or concluding
      broadcastGameState(roomCode); // Broadcast updated lives and evaluations

      // 6. Check for game over conditions
      const activePlayersPostVoting = room.players.filter(p => p.isActive && !p.isSpectator);
      let gameShouldEnd = false;
      let winnerInfo: WinnerInfo | null = null;

      // Game over logic for community voting mode
      if (room.isCommunityVotingMode) {
        const activeNonGMPlayers = activePlayersPostVoting.filter(p => p.persistentPlayerId !== room.gamemasterPersistentId);
        const gmIsActivePlayer = activePlayersPostVoting.some(p => p.persistentPlayerId === room.gamemasterPersistentId);

        if (activeNonGMPlayers.length === 0 && gmIsActivePlayer) {
          gameShouldEnd = true;
          winnerInfo = { id: room.gamemaster!, persistentPlayerId: room.gamemasterPersistentId, name: 'GameMaster' };
        } else if (activeNonGMPlayers.length === 1 && (!gmIsActivePlayer || activePlayersPostVoting.length === 1) ) {
          gameShouldEnd = true;
          winnerInfo = { id: activeNonGMPlayers[0].id, persistentPlayerId: activeNonGMPlayers[0].persistentPlayerId, name: activeNonGMPlayers[0].name };
        } else if (activePlayersPostVoting.length === 0) { // All players (including potentially playing GM) are out
           gameShouldEnd = true; 
        }
      } else { // This case should ideally not be hit if this logic is only for community voting
          // Standard game over logic (should ideally not be reached if this is only for community voting)
          if (activePlayersPostVoting.length <= 1) {
            gameShouldEnd = true;
            if (activePlayersPostVoting.length === 1) {
              winnerInfo = { id: activePlayersPostVoting[0].id, persistentPlayerId: activePlayersPostVoting[0].persistentPlayerId, name: activePlayersPostVoting[0].name };
            }
          }
      }

      // 7. If game over, conclude.
      if (gameShouldEnd && !room.isConcluded) {
        console.log(`[Server] Game ending after community voting. Winner: ${winnerInfo ? winnerInfo.name : 'None'}`);
        concludeGameAndSendRecap(roomCode, winnerInfo);
      } 
      // 8. Else if more questions, proceed to next question.
      else if (room.currentQuestionIndex < room.questions.length - 1 && !room.isConcluded) {
        console.log('[Server] Proceeding to next question after community voting.');
        
        // Explicitly stop preview mode for clients before sending new question
        getIO().to(roomCode).emit('stop_preview_mode');

        room.votes = {}; // Reset votes for the next round
        room.gameMasterBoardData = null; // Clear GM's board for next round
        
        // Core next_question logic (refactor if this becomes duplicated elsewhere)
        room.currentQuestionIndex++;
        room.currentQuestion = room.questions[room.currentQuestionIndex];
        room.questionStartTime = Date.now();
        room.submissionPhaseOver = false;
        room.roundAnswers = {}; // Clear answers for the new round
        room.evaluatedAnswers = {}; // Clear evaluations for the new round
        room.players.forEach(p => { 
          if(p.answers && p.answers.length > room.currentQuestionIndex) { 
            p.answers[room.currentQuestionIndex] = undefined as any; 
          }
        });
        clearRoomTimer(roomCode);
        if (room.timeLimit && room.timeLimit < 99999) startQuestionTimer(roomCode);
        broadcastGameState(roomCode); 
        getIO().to(roomCode).emit('new_question', { question: room.currentQuestion, timeLimit: room.timeLimit || 0 });
      } 
      // 9. Else (last question and game not over yet), conclude.
      else if (!room.isConcluded) {
        console.log('[Server] Last question. Ending game after community voting.');
        concludeGameAndSendRecap(roomCode, winnerInfo); 
      }

    } else {
      console.log(`[Server] Voting not yet complete for room ${roomCode}. Voters: ${numberOfEligibleVoters}, Answers: ${submittedAnswerPIds.length}`);
    }
  });

  // Handle request to show answer in community voting mode
  socket.on('show_answer', ({ roomCode, questionId }) => {
    const room = gameRooms[roomCode];
    if (!room || !room.isCommunityVotingMode) {
      socket.emit('error', 'Cannot show answer in this mode or room not found.');
      return;
    }

    const question = room.questions.find(q => q.id === questionId);
    if (!question || !question.answer) {
      socket.emit('error', 'Question or answer not found.');
      return;
    }

    const currentIO = getIO();
    currentIO.to(roomCode).emit('correct_answer_revealed', { 
      questionId: question.id,
      correctAnswer: question.answer
    });
    console.log(`[Server] Revealed answer for question ${questionId} in room ${roomCode}`);
  });

  // Handle force end voting request from GameMaster in community voting mode
  socket.on('force_end_voting', ({ roomCode }) => {
    const room = gameRooms[roomCode];
    if (!room || !room.isCommunityVotingMode || socket.id !== room.gamemaster) {
      socket.emit('error', 'Not authorized to force end voting or room not found.');
      return;
    }

    console.log(`[Server] GameMaster forcing end of voting in room ${roomCode}`);

    try {
      // Process all votes and determine final evaluations
      const submittedAnswerPIds = Object.keys(room.roundAnswers || {});
      
      // For each answer, tally votes and determine evaluation
      for (const answerId of submittedAnswerPIds) {
        const votesForThisAnswer = room.votes?.[answerId] || {};
        const currentVoteCounts = { correct: 0, incorrect: 0 };
        
        Object.values(votesForThisAnswer).forEach(v => {
          if (v === 'correct') currentVoteCounts.correct++;
          else if (v === 'incorrect') currentVoteCounts.incorrect++;
        });

        // Special case: If there are no votes (which can happen with few players who can't vote for themselves),
        // default to marking the answer as correct to avoid unfairly penalizing players
        if (currentVoteCounts.correct === 0 && currentVoteCounts.incorrect === 0) {
          console.log(`[Server] No votes for answer ${answerId}. Defaulting to CORRECT.`);
          room.evaluatedAnswers[answerId] = true;
          continue;
        }

        // Determine if answer is correct based on majority vote
        // If votes are tied or more incorrect votes, mark as incorrect
        const isCorrectByVote = currentVoteCounts.correct > currentVoteCounts.incorrect;
        room.evaluatedAnswers[answerId] = isCorrectByVote;
        
        console.log(`[Server] Force evaluating answer ${answerId}: ${isCorrectByVote ? 'CORRECT' : 'INCORRECT'} (Votes: C:${currentVoteCounts.correct}, I:${currentVoteCounts.incorrect})`);

        // Update player lives if their answer was incorrect
        const playerWhoseAnswerIsBeingEvaluated = room.players.find(p => p.persistentPlayerId === answerId);
        
        if (playerWhoseAnswerIsBeingEvaluated) {
          if (!isCorrectByVote) {
            playerWhoseAnswerIsBeingEvaluated.lives = Math.max(0, (playerWhoseAnswerIsBeingEvaluated.lives || 0) - 1);
            console.log(`[Server] Player ${playerWhoseAnswerIsBeingEvaluated.name} (${answerId}) lives updated to: ${playerWhoseAnswerIsBeingEvaluated.lives}`);
            
            if (playerWhoseAnswerIsBeingEvaluated.lives <= 0) {
              playerWhoseAnswerIsBeingEvaluated.isActive = false;
              playerWhoseAnswerIsBeingEvaluated.isSpectator = true;
              const playerSocket = getIO().sockets.sockets.get(playerWhoseAnswerIsBeingEvaluated.id);
              if (playerSocket) playerSocket.emit('become_spectator');
              console.log(`[Server] Player ${playerWhoseAnswerIsBeingEvaluated.name} (${answerId}) eliminated.`);
            }
          }
        }
      }

      // Mark submission phase as over
      room.submissionPhaseOver = true;
      
      // Broadcast updated game state with evaluations
      broadcastGameState(roomCode);
      
      // Check for game over conditions
      const activePlayersPostVoting = room.players.filter(p => p.isActive && !p.isSpectator);
      let gameShouldEnd = false;
      let winnerInfo: WinnerInfo | null = null;

      // Game over logic for community voting mode
      if (room.isCommunityVotingMode) {
        const activeNonGMPlayers = activePlayersPostVoting.filter(p => p.persistentPlayerId !== room.gamemasterPersistentId);
        const gmIsActivePlayer = activePlayersPostVoting.some(p => p.persistentPlayerId === room.gamemasterPersistentId);

        if (activeNonGMPlayers.length === 0 && gmIsActivePlayer) {
          gameShouldEnd = true;
          winnerInfo = { id: room.gamemaster!, persistentPlayerId: room.gamemasterPersistentId, name: 'GameMaster' };
        } else if (activeNonGMPlayers.length === 1 && (!gmIsActivePlayer || activePlayersPostVoting.length === 1)) {
          gameShouldEnd = true;
          winnerInfo = { id: activeNonGMPlayers[0].id, persistentPlayerId: activeNonGMPlayers[0].persistentPlayerId, name: activeNonGMPlayers[0].name };
        } else if (activePlayersPostVoting.length === 0) {
          gameShouldEnd = true;
        }
      }

      // If game should end, conclude; otherwise proceed to next question
      if (gameShouldEnd && !room.isConcluded) {
        console.log(`[Server] Game ending after forced voting end. Winner: ${winnerInfo ? winnerInfo.name : 'None'}`);
        concludeGameAndSendRecap(roomCode, winnerInfo);
      } else if (room.currentQuestionIndex < room.questions.length - 1 && !room.isConcluded) {
        console.log('[Server] Proceeding to next question after forced voting end.');
        
        // Stop preview mode
        getIO().to(roomCode).emit('stop_preview_mode');

        // Reset for next question
        room.votes = {};
        room.gameMasterBoardData = null;
        
        // Move to next question
        room.currentQuestionIndex++;
        room.currentQuestion = room.questions[room.currentQuestionIndex];
        room.questionStartTime = Date.now();
        room.submissionPhaseOver = false;
        room.roundAnswers = {};
        room.evaluatedAnswers = {};
        
        // Reset player answers for new question
        room.players.forEach(p => { 
          if(p.answers && p.answers.length > room.currentQuestionIndex) { 
            p.answers[room.currentQuestionIndex] = undefined as any; 
          }
        });
        
        // Handle timer if needed
        clearRoomTimer(roomCode);
        if (room.timeLimit && room.timeLimit < 99999) startQuestionTimer(roomCode);
        
        // Broadcast updates
        broadcastGameState(roomCode);
        getIO().to(roomCode).emit('new_question', { question: room.currentQuestion, timeLimit: room.timeLimit || 0 });
      } else if (!room.isConcluded) {
        console.log('[Server] Last question. Ending game after forced voting end.');
        concludeGameAndSendRecap(roomCode, winnerInfo);
      }

    } catch (error: any) {
      console.error('[Server] Error processing force end voting:', error);
      socket.emit('error', 'Failed to process voting results.');
    }
  });

});

// Add handler for request_players event
app.get('/api/request_players', (req: Request, res: Response) => {
  const roomCode = req.query.roomCode as string; // Cast to string
  if (!roomCode) {
    return res.status(400).json({ error: 'Missing roomCode' });
  }

  const room = gameRooms[roomCode];
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Assuming socket information would be passed differently here, e.g., via headers or auth token
  // For now, this endpoint will just return player data without GM re-authentication logic from the original JS
  // If GM re-auth is needed here, the mechanism to get socket.data needs to be defined for this HTTP request context.

  console.log(`[Server /api/request_players] Fetching players for room:`, {
    roomCode,
    timestamp: new Date().toISOString()
  });

  res.json({
    roomCode,
    players: room.players.map((p: Player) => ({ // Add type for p
      id: p.id,
      name: p.name,
      persistentPlayerId: p.persistentPlayerId
    }))
  });
}); 