"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Last updated: May 2025
// School Quiz Game server file
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
// Import services
const gameAnalytics_1 = require("./services/gameAnalytics");
const roomService_1 = require("./services/roomService");
const socketService_1 = require("./services/socketService");
// These will be defined locally in this file
const socketService_2 = require("./services/socketService");
// Grace period constants
const AUTO_SUBMIT_GRACE_PERIOD_MS = 1000; // 1 second
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 seconds
// Local functions
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
// Timer management
const timers = new Map();
const app = (0, express_1.default)();
// Configure CORS for both development and production
const allowedOrigins = [
    'http://localhost:3000',
    'https://schoolquizgame-1.onrender.com',
    'https://schoolquizgame.onrender.com',
    'https://schoolquizgame-admin.onrender.com'
];
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
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
setInterval(roomService_1.saveRoomState, SAVE_INTERVAL_MS);
// Load saved rooms on startup
try {
    (0, roomService_1.loadRoomState)();
}
catch (error) {
    console.error('[Server] Failed to load room state on startup:', error);
}
// Determine the correct build path based on environment
let buildPath = path_1.default.join(__dirname, '../build');
if (process.env.NODE_ENV === 'production') {
    // Check multiple possible locations for build files (for render.com deployment)
    const possibleBuildPaths = [
        path_1.default.join(__dirname, 'build'), // server/build
        path_1.default.join(__dirname, '../build'), // build in root
        path_1.default.join(process.cwd(), 'build'), // current working directory
        '/opt/render/project/src/build' // absolute path on render.com
    ];
    let buildPathFound = false;
    // Find the first path that exists
    for (const pathToCheck of possibleBuildPaths) {
        if (fs_1.default.existsSync(pathToCheck)) {
            buildPath = pathToCheck;
            console.log('Using build path:', buildPath);
            console.log('Build index.html exists:', fs_1.default.existsSync(path_1.default.join(buildPath, 'index.html')));
            buildPathFound = true;
            break;
        }
    }
    if (!buildPathFound) {
        console.error('No valid build path found. Checked these paths:');
        possibleBuildPaths.forEach(p => console.error(`- ${p} (exists: ${fs_1.default.existsSync(p)})`));
        console.log('Current directory:', process.cwd());
        console.log('Directory listing for current directory:', fs_1.default.readdirSync(process.cwd()));
        try {
            console.log('Directory listing for server directory:', fs_1.default.readdirSync(__dirname));
        }
        catch (err) {
            console.error('Error reading server directory:', err);
        }
    }
    app.use(express_1.default.static(buildPath));
}
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
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
(0, socketService_1.setSocketIOInstance)(io);
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
        // Handle persistentPlayerId logic - ensure it's ALWAYS present
        if (auth.persistentPlayerId) {
            // Use existing persistentPlayerId if provided
            socket.data.persistentPlayerId = auth.persistentPlayerId;
        }
        else if (isGameMasterQuery) {
            // Generate new persistentPlayerId for Game Master
            socket.data.persistentPlayerId = `GM-${(0, uuid_1.v4)()}`;
        }
        else if (auth.playerName) {
            // Generate new persistentPlayerId for regular Player
            socket.data.persistentPlayerId = `P-${(0, uuid_1.v4)()}`;
        }
        else {
            // Always provide a fallback ID for compatibility with older clients
            socket.data.persistentPlayerId = `F-${(0, uuid_1.v4)()}`;
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
    }
    catch (error) {
        console.error('[AUTH] Middleware error:', error);
        next(new Error('Authentication error'));
    }
});
// Debug endpoint to view active rooms
app.get('/debug/rooms', (req, res) => {
    const safeRoomsCopy = {};
    // Create a safe copy without circular references
    Object.entries(roomService_1.gameRooms).forEach(([roomCode, room]) => {
        safeRoomsCopy[roomCode] = {
            roomCode: room.roomCode,
            gamemasterPersistentId: room.gamemasterPersistentId,
            players: room.players.map(p => ({ id: p.id, name: p.name, persistentPlayerId: p.persistentPlayerId })), // Simplified player list
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
        activeRoomCount: Object.keys(roomService_1.gameRooms).length,
        rooms: safeRoomsCopy
    });
});
// Game recap endpoints
app.get('/api/recaps', (req, res) => {
    // Return list of all recaps with basic info
    const recapsList = Object.values(roomService_1.gameRooms).map((room) => ({
        id: room.roomCode,
        roomCode: room.roomCode,
        startTime: room.createdAt,
        endTime: room.isConcluded ? room.lastActivity : new Date().toISOString(),
        playerCount: room.players.length,
        roundCount: room.questions.length
    }));
    res.json(recapsList);
});
app.get('/api/recaps/:recapId', (req, res) => {
    const recap = (0, socketService_1.generateGameRecap)(req.params.recapId);
    if (!recap) {
        res.status(404).json({ error: 'Recap not found' });
        return;
    }
    res.json(recap);
});
app.get('/api/recaps/room/:roomCode', (req, res) => {
    // This endpoint might be redundant if generateGameRecap is used
    const recap = (0, socketService_1.generateGameRecap)(req.params.roomCode);
    if (recap) {
        res.json([recap]); // Return as an array as client might expect multiple
    }
    else {
        res.json([]);
    }
});
app.get('/api/recaps/:recapId/round/:roundNumber', (req, res) => {
    const recap = (0, socketService_1.generateGameRecap)(req.params.recapId);
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
app.post('/api/room/:roomCode/board', express_1.default.json(), (req, res) => {
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
    const room = roomService_1.gameRooms[roomCode];
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
    const currentIO = (0, socketService_1.getIO)();
    currentIO.to(roomCode).emit('board_update', {
        playerId: socketId,
        playerName: player.name,
        boardData
    });
    res.status(200).json({ message: 'Board updated successfully' });
});
// Endpoint to get players (moved from socket event)
app.get('/api/room/:roomCode/players', (req, res) => {
    const { roomCode } = req.params;
    const socketId = req.headers['x-socket-id']; // Assuming socket ID is passed in headers
    if (typeof socketId !== 'string') {
        return res.status(400).json({ error: 'Missing x-socket-id header' });
    }
    const room = roomService_1.gameRooms[roomCode]; // Cast roomCode to string
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    // Retrieve socket.data if the socket exists
    const currentIO = (0, socketService_1.getIO)();
    const requestingSocket = currentIO.sockets.sockets.get(socketId); // Cast to ExtendedSocket
    const socketData = requestingSocket?.data;
    console.log(`[Server /api/room/:roomCode/players] request_players authorization check:`, {
        roomCode,
        socketId,
        isPotentialGameMaster: room.gamemasterPersistentId === socketData?.persistentPlayerId,
        isPlayerInRoom: room.players.some((p) => p.persistentPlayerId === socketData?.persistentPlayerId), // Add type for p
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
                currentIO.to(roomCode).emit('gm_disconnected_status', { disconnected: false }); // Cast roomCode
            }
        }
    }
    res.json({
        roomCode,
        players: room.players.map((p) => ({
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
app.get('/api/analytics/game/:roomCode', (req, res) => {
    const stats = gameAnalytics_1.gameAnalytics.getGameStats(req.params.roomCode);
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
    Object.entries(roomService_1.gameRooms).forEach(([roomCode, room]) => {
        // Skip rooms that are marked as concluded - they're already handled
        if (room.isConcluded)
            return;
        // Check last activity timestamp
        const lastActivity = new Date(room.lastActivity || room.createdAt);
        const hoursSinceLastActivity = Math.abs(now.getTime() - lastActivity.getTime()) / 36e5;
        // If room is inactive for over 24 hours, clean it up
        if (hoursSinceLastActivity > 24) {
            console.log(`[Server] Removing stale room ${roomCode} (inactive for ${hoursSinceLastActivity.toFixed(1)} hours)`);
            // Delete the room
            delete roomService_1.gameRooms[roomCode];
            roomsRemoved++;
        }
        // If GM is disconnected for over 2 minutes, the room should have been cleaned up already by the GM disconnect handler
        else if (room.gamemasterDisconnected) {
            const disconnectTime = new Date(room.gamemasterDisconnectTime || room.lastActivity);
            const minutesSinceDisconnect = Math.abs(now.getTime() - disconnectTime.getTime()) / 60000;
            if (minutesSinceDisconnect > 3) { // Add a buffer over the 2-minute timeout
                console.log(`[Server] Removing room ${roomCode} with disconnected GM (${minutesSinceDisconnect.toFixed(1)} minutes)`);
                // Delete the room
                delete roomService_1.gameRooms[roomCode];
                roomsRemoved++;
            }
        }
    });
    console.log(`[Server] Room cleanup complete. Removed ${roomsRemoved} stale rooms.`);
    // Save the updated room state after cleanup
    if (roomsRemoved > 0) {
        (0, roomService_1.saveRoomState)();
    }
}
// Socket.IO Event Handlers
io.on('connection', (socket) => {
    console.log(`[Server] User connected: ${socket.id}, persistentPlayerId: ${socket.data.persistentPlayerId}, playerName: ${socket.data.playerName}, isGameMaster: ${socket.data.isGameMaster}, recovered: ${socket.recovered}`);
    // Emit persistent_id_assigned back to the client
    socket.emit('persistent_id_assigned', { persistentPlayerId: socket.data.persistentPlayerId || '' });
    // Handle session recovery
    if (socket.recovered === true) {
        console.log(`[Server] Session recovery for socket ${socket.id} with persistentPlayerId ${socket.data.persistentPlayerId}`);
        let recoveredRoomCode = null;
        // let recoveredAsGameMaster = false; // This variable was not used
        for (const roomCode in roomService_1.gameRooms) {
            const room = roomService_1.gameRooms[roomCode];
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
                    const currentIO = (0, socketService_1.getIO)();
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
                    clearTimeout(room.players[playerIndex].disconnectTimer);
                    room.players[playerIndex].disconnectTimer = null;
                }
                console.log(`[Server] Player re-associated: PersistentID ${socket.data.persistentPlayerId} with socket ${socket.id} in room ${roomCode}`);
                const currentIO = (0, socketService_1.getIO)();
                currentIO.to(roomCode).emit('player_reconnected_status', {
                    playerId: socket.id,
                    persistentPlayerId: socket.data.persistentPlayerId || '',
                    isActive: true
                });
                (0, socketService_1.broadcastGameState)(roomCode);
                break;
            }
        }
        if (recoveredRoomCode) {
            socket.roomCode = recoveredRoomCode;
            socket.join(recoveredRoomCode);
            const gameState = (0, socketService_1.getGameState)(recoveredRoomCode);
            if (gameState) {
                socket.emit('game_state_update', gameState);
            }
        }
        else {
            socket.emit('session_not_fully_recovered_join_manually');
            console.log(`[Server] Could not fully recover session for persistentPlayerId ${socket.data.persistentPlayerId}. Manual rejoin may be needed.`);
        }
    }
    else {
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
        const room = (0, roomService_1.createGameRoom)(finalRoomCode, socket.id, socket.data.persistentPlayerId || '');
        room.isStreamerMode = isStreamerMode || false;
        room.lastActivity = new Date().toISOString();
        roomService_1.gameRooms[finalRoomCode] = room;
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
        (0, roomService_1.saveRoomState)();
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
        if (!roomService_1.gameRooms[roomCode]) {
            console.error(`[Server] Join room failed - Invalid room code:`, {
                roomCode,
                playerName,
                playerId: socket.id
            });
            socket.emit('room_not_found', { message: 'Room not found. It may have expired or been deleted. Please join a different room.' });
            socket.emit('error', 'Invalid room code');
            return;
        }
        const room = roomService_1.gameRooms[roomCode];
        room.lastActivity = new Date().toISOString();
        socket.data.isGameMaster = false;
        const persistentPlayerId = socket.data.persistentPlayerId || `F-${socket.id.substring(0, 8)}`;
        const currentPlayerName = playerName || socket.data.playerName || `Player_${persistentPlayerId.substring(0, 5)}`;
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
                const currentIO = (0, socketService_1.getIO)();
                currentIO.to(roomCode).emit('player_reconnected_status', { playerId: socket.id, persistentPlayerId, isActive: true });
                const gameState = (0, socketService_1.getGameState)(roomCode);
                if (gameState)
                    socket.emit('game_state_update', gameState);
                (0, socketService_1.broadcastGameState)(roomCode);
                return;
            }
            else if (existingPlayer.isActive === true && existingPlayer.id !== socket.id) {
                const currentIO = (0, socketService_1.getIO)();
                const existingSocket = currentIO.sockets.sockets.get(existingPlayer.id);
                if (!existingSocket || !existingSocket.connected) {
                    console.log(`[Server] Found stale connection for player. Old socket ${existingPlayer.id} is no longer connected. Updating player record.`);
                    existingPlayer.id = socket.id;
                    existingPlayer.isActive = true;
                    socket.join(roomCode);
                    socket.roomCode = roomCode;
                    socket.emit('room_joined', { roomCode, playerId: persistentPlayerId, isStreamerMode: room.isStreamerMode });
                    const gameState = (0, socketService_1.getGameState)(roomCode);
                    if (gameState)
                        socket.emit('game_state_update', gameState);
                    (0, socketService_1.broadcastGameState)(roomCode);
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
                const gameState = (0, socketService_1.getGameState)(roomCode);
                if (gameState)
                    socket.emit('game_state_update', gameState);
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
        const player = {
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
        const gameState = (0, socketService_1.getGameState)(roomCode);
        if (gameState) {
            socket.emit('game_state_update', gameState);
            console.log(`[Server] Sent initial game state to player:`, { roomCode, playerId: socket.id, gameStarted: gameState.started, currentQuestionIndex: gameState.currentQuestionIndex });
        }
        (0, socketService_1.broadcastGameState)(roomCode);
    });
    // Start the game (Gamemaster only)
    socket.on('start_game', async (data) => {
        console.log('[SERVER] START_GAME EVENT RECEIVED - IMMEDIATE LOG:', {
            socketId: socket.id,
            roomCode: data.roomCode,
            timestamp: new Date().toISOString()
        });
        const { roomCode, questions, timeLimit } = data;
        const room = roomService_1.gameRooms[roomCode];
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
            const currentIO = (0, socketService_1.getIO)();
            // Notify all clients in the room
            currentIO.to(roomCode).emit('game_started', {
                question: room.currentQuestion,
                timeLimit: room.timeLimit
            });
            // Send updated game state
            (0, socketService_1.broadcastGameState)(roomCode);
            // Start timer for the first question if a specific time limit is set
            if (room.timeLimit && room.timeLimit < 99999) {
                console.log(`[SERVER] Starting timer for first question in room ${roomCode} with limit ${room.timeLimit}`);
                (0, socketService_2.startQuestionTimer)(roomCode);
            }
        }
        catch (error) {
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
        const room = roomService_1.gameRooms[roomCode];
        if (!room || room.gamemaster !== socket.id) {
            socket.emit('error', 'Not authorized to restart the game or room not found');
            return;
        }
        // Always set the current socket as gamemaster on restart
        room.gamemaster = socket.id;
        room.isConcluded = false;
        if (gameAnalytics_1.gameAnalytics && gameAnalytics_1.gameAnalytics.games && gameAnalytics_1.gameAnalytics.games[roomCode]) {
            delete gameAnalytics_1.gameAnalytics.games[roomCode];
        }
        console.log(`[Server Restart] Attempting to restart game in room: ${roomCode}`);
        (0, socketService_2.clearRoomTimer)(roomCode);
        room.started = false;
        room.currentQuestionIndex = 0;
        if (room.questions && room.questions.length > 0) {
            room.currentQuestion = room.questions[0];
        }
        else {
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
            }
            else {
                player.lives = 3;
                player.answers = [];
                player.isActive = true;
                player.isSpectator = false;
            }
        });
        if (room.playerBoards) {
            Object.keys(room.playerBoards).forEach(playerId => {
                if (room.playerBoards[playerId]) {
                    room.playerBoards[playerId].boardData = '';
                }
            });
        }
        const currentIO = (0, socketService_1.getIO)();
        currentIO.to(roomCode).emit('game_restarted', { roomCode });
        (0, socketService_1.broadcastGameState)(roomCode);
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
        if (!roomService_1.gameRooms[roomCode]) {
            console.error('[Server Socket] Board update failed - Invalid room:', roomCode);
            return;
        }
        const room = roomService_1.gameRooms[roomCode];
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
        const currentIO = (0, socketService_1.getIO)();
        currentIO.to(roomCode).emit('board_update', { playerId: socket.id, playerName, boardData });
    });
    // Handle request_players event (Socket Event)
    socket.on('request_players', ({ roomCode }) => {
        console.log(`[Server Socket] Received request_players for room:`, { roomCode, socketId: socket.id, persistentPlayerId: socket.data.persistentPlayerId, timestamp: new Date().toISOString() });
        const room = roomService_1.gameRooms[roomCode];
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
                    const currentIO = (0, socketService_1.getIO)();
                    currentIO.to(roomCode).emit('gm_disconnected_status', { disconnected: false });
                }
            }
        }
        // Emitting players_update to the requesting client
        socket.emit('players_update', room.players.map((p) => ({
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
        if (!roomService_1.gameRooms[roomCode]) {
            console.error('[Server Socket] Answer submission failed - Room not found:', roomCode);
            socket.emit('room_not_found', { message: 'Room not found. It may have expired or been deleted.' });
            socket.emit('error', 'Room not found');
            return;
        }
        const room = roomService_1.gameRooms[roomCode];
        const player = room.players.find(p => p.persistentPlayerId === socket.data.persistentPlayerId);
        if (!player || player.isSpectator || !player.isActive) {
            console.warn(`[Server Socket SubmitAnswer] Denied for inactive/spectator player: ${socket.id}, persistentId: ${socket.data.persistentPlayerId}`);
            socket.emit('error', 'Submission denied: you are a spectator or inactive.');
            return;
        }
        if (room.submissionPhaseOver) {
            console.warn(`[Server Socket SubmitAnswer] Denied: submission phase over for room ${roomCode}, player ${socket.id}`);
            socket.emit('error', 'Submission phase is over for this round.');
            return;
        }
        if (answerAttemptId && player.answers[room.currentQuestionIndex]?.answerAttemptId === answerAttemptId) {
            console.log(`[Server Socket SubmitAnswer] Duplicate submission detected with answerAttemptId ${answerAttemptId}`);
            socket.emit('answer_received', { status: 'success', message: 'Answer already received' });
            return;
        }
        if (player.answers && player.answers[room.currentQuestionIndex] && !player.answers[room.currentQuestionIndex].answerAttemptId) {
            console.log(`[Server Socket SubmitAnswer] Player ${socket.id} already submitted an answer for this question.`);
            socket.emit('answer_received', { status: 'success', message: 'Answer already received' });
            return;
        }
        try {
            let drawingDataForStorage = null;
            let finalHasDrawing = false;
            if (hasDrawing) {
                if (drawingData && drawingData.trim() !== '') {
                    drawingDataForStorage = drawingData;
                    finalHasDrawing = true;
                }
                else {
                    if (room.playerBoards && room.playerBoards[socket.id]) {
                        const playerBoardEntry = room.playerBoards[socket.id];
                        if (playerBoardEntry.roundIndex === room.currentQuestionIndex && playerBoardEntry.boardData && playerBoardEntry.boardData.trim() !== '') {
                            drawingDataForStorage = playerBoardEntry.boardData;
                            finalHasDrawing = true;
                        }
                    }
                }
            }
            const answerData = {
                playerId: socket.id,
                persistentPlayerId: player.persistentPlayerId, // Ensured this is player's persistentId
                playerName: player.name,
                answer,
                hasDrawing: finalHasDrawing,
                drawingData: drawingDataForStorage,
                timestamp: Date.now(),
                isCorrect: null,
                answerAttemptId: answerAttemptId || null
            };
            player.answers[room.currentQuestionIndex] = answerData;
            if (!room.roundAnswers)
                room.roundAnswers = {};
            room.roundAnswers[player.persistentPlayerId] = answerData;
            if (finalHasDrawing && drawingDataForStorage) {
                if (!room.playerBoards)
                    room.playerBoards = {};
                room.playerBoards[socket.id] = {
                    boardData: drawingDataForStorage,
                    roundIndex: room.currentQuestionIndex,
                    timestamp: Date.now(),
                    playerId: socket.id,
                    persistentPlayerId: player.persistentPlayerId
                };
            }
            console.log(`[Server Socket] Answer stored successfully:`, { roomCode, playerId: socket.id, persistentPlayerId: player.persistentPlayerId, playerName: player.name, questionIndex: room.currentQuestionIndex, timestamp: new Date().toISOString() });
            socket.emit('answer_received', { status: 'success', message: 'Answer received!' });
            (0, socketService_1.broadcastGameState)(roomCode);
            const responseTime = room.questionStartTime ? Date.now() - room.questionStartTime : 0;
            gameAnalytics_1.gameAnalytics.recordAnswer(roomCode, player.persistentPlayerId, answer, null, responseTime);
        }
        catch (error) {
            console.error('[Server Socket] Error storing answer:', { error: error.message, stack: error.stack, roomCode, playerId: socket.id });
            socket.emit('error', 'Failed to submit answer');
        }
    });
    // Gamemaster evaluates an answer
    socket.on('evaluate_answer', ({ roomCode, playerId, isCorrect }) => {
        const room = roomService_1.gameRooms[roomCode];
        if (!room || room.gamemaster !== socket.id) {
            socket.emit('error', 'Not authorized to evaluate answers');
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
            if (!room.evaluatedAnswers)
                room.evaluatedAnswers = {};
            room.evaluatedAnswers[persistentPlayerIdFromClient] = isCorrect;
            if (playerObjInRoom) {
                const playerSpecificAnswerRecord = playerObjInRoom.answers[room.currentQuestionIndex];
                if (playerSpecificAnswerRecord) {
                    playerSpecificAnswerRecord.isCorrect = isCorrect;
                }
                else {
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
                        const playerSocket = (0, socketService_1.getIO)().sockets.sockets.get(playerObjInRoom.id);
                        if (playerSocket) {
                            playerSocket.emit('become_spectator');
                        }
                    }
                }
            }
            const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
            if (room.started && activePlayers.length <= 1 && room.players.length > 0) {
                if (!room.isConcluded) {
                    const winner = activePlayers.length === 1 ? {
                        id: activePlayers[0].id,
                        persistentPlayerId: activePlayers[0].persistentPlayerId,
                        name: activePlayers[0].name
                    } : null;
                    (0, socketService_2.concludeGameAndSendRecap)(roomCode, winner);
                }
            }
            (0, socketService_1.broadcastGameState)(roomCode);
            const responseTime = room.questionStartTime ? Date.now() - room.questionStartTime : 0;
            gameAnalytics_1.gameAnalytics.recordAnswer(roomCode, persistentPlayerIdFromClient, submittedAnswerData.answer, isCorrect, responseTime);
        }
        catch (error) {
            console.error('Error evaluating answer:', { error: error.message, stack: error.stack, roomCode, persistentPlayerIdFromClient: playerId });
            socket.emit('error', 'Failed to evaluate answer due to server error.');
        }
    });
    // Next question from gamemaster
    socket.on('next_question', ({ roomCode }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id) {
            socket.emit('error', 'Not authorized to move to next question');
            return;
        }
        const room = roomService_1.gameRooms[roomCode];
        if (room.currentQuestionIndex < room.questions.length - 1) {
            room.currentQuestionIndex += 1;
            room.currentQuestion = room.questions[room.currentQuestionIndex];
            room.questionStartTime = Date.now();
            room.submissionPhaseOver = false;
            room.roundAnswers = {};
            room.evaluatedAnswers = {};
            room.players.forEach(player => {
                if (player.answers)
                    player.answers[room.currentQuestionIndex] = undefined; // Reset for new question
            });
            (0, socketService_2.clearRoomTimer)(roomCode);
            if (room.timeLimit && room.timeLimit < 99999) {
                (0, socketService_2.startQuestionTimer)(roomCode);
            }
            (0, socketService_1.broadcastGameState)(roomCode); // Broadcasts full state including new question
            const currentIO = (0, socketService_1.getIO)();
            currentIO.to(roomCode).emit('new_question', { question: room.currentQuestion, timeLimit: room.timeLimit || 0 });
        }
    });
    // Handle end round early request from gamemaster
    socket.on('end_round_early', ({ roomCode }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id) {
            socket.emit('error', 'Not authorized to end round early');
            return;
        }
        const room = roomService_1.gameRooms[roomCode];
        if (!room)
            return;
        (0, socketService_2.clearRoomTimer)(roomCode);
        const currentIO = (0, socketService_1.getIO)();
        currentIO.to(roomCode).emit('time_up');
        console.log(`[EndRoundEarly] Emitted 'time_up' for room ${roomCode}. Starting grace period of ${AUTO_SUBMIT_GRACE_PERIOD_MS}ms.`);
        setTimeout(() => {
            (0, socketService_2.finalizeRoundAndAutoSubmit)(roomCode);
        }, AUTO_SUBMIT_GRACE_PERIOD_MS);
    });
    // Preview Mode handlers
    socket.on('start_preview_mode', ({ roomCode }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id) {
            socket.emit('error', 'Not authorized to start preview mode');
            return;
        }
        const currentIO = (0, socketService_1.getIO)();
        currentIO.to(roomCode).emit('start_preview_mode');
    });
    socket.on('stop_preview_mode', ({ roomCode }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id) {
            socket.emit('error', 'Not authorized to stop preview mode');
            return;
        }
        const currentIO = (0, socketService_1.getIO)();
        currentIO.to(roomCode).emit('stop_preview_mode');
    });
    socket.on('focus_submission', ({ roomCode, playerId }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id) {
            socket.emit('error', 'Not authorized to focus submission');
            return;
        }
        const currentIO = (0, socketService_1.getIO)();
        currentIO.to(roomCode).emit('focus_submission', { playerId });
    });
    // Get current game state for a room (socket event)
    socket.on('get_game_state', ({ roomCode }) => {
        const room = roomService_1.gameRooms[roomCode];
        if (!room) {
            socket.emit('game_state_update', { started: false }); // Cast to any to satisfy type, though it's partial
            return;
        }
        const state = (0, socketService_1.getGameState)(roomCode);
        if (state) {
            socket.emit('game_state_update', state);
        }
        else {
            socket.emit('game_state_update', { started: false });
        }
    });
    socket.on('gm_end_game_request', ({ roomCode }) => {
        const room = roomService_1.gameRooms[roomCode];
        if (!room || room.gamemaster !== socket.id) {
            console.warn(`[Server gm_end_game_request] Unauthorized or room not found by ${socket.id} for ${roomCode}`);
            return;
        }
        if (!room.isConcluded) {
            const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator);
            const winnerPayload = activePlayers.length === 1 ? { id: activePlayers[0].id, name: activePlayers[0].name, persistentPlayerId: activePlayers[0].persistentPlayerId } : null;
            (0, socketService_2.concludeGameAndSendRecap)(roomCode, winnerPayload);
        }
        else {
            console.log(`[Server gm_end_game_request] Game in room ${roomCode} already concluded.`);
        }
    });
    socket.on('gm_show_recap_to_all', ({ roomCode }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id)
            return;
        const recap = (0, socketService_1.generateGameRecap)(roomCode);
        if (recap) {
            const recapWithInitialState = { ...recap, initialSelectedRoundIndex: 0, initialSelectedTabKey: 'overallResults' };
            (0, socketService_1.getIO)().to(roomCode).emit('game_recap', recapWithInitialState);
        }
    });
    socket.on('gm_navigate_recap_round', ({ roomCode, selectedRoundIndex }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id)
            return;
        if (typeof selectedRoundIndex !== 'number')
            return;
        (0, socketService_1.getIO)().to(roomCode).emit('recap_round_changed', { selectedRoundIndex });
    });
    socket.on('gm_navigate_recap_tab', ({ roomCode, selectedTabKey }) => {
        if (!roomService_1.gameRooms[roomCode] || roomService_1.gameRooms[roomCode].gamemaster !== socket.id)
            return;
        if (typeof selectedTabKey !== 'string')
            return;
        (0, socketService_1.getIO)().to(roomCode).emit('recap_tab_changed', { selectedTabKey });
    });
    socket.on('kick_player', ({ roomCode, playerIdToKick }) => {
        try {
            const room = roomService_1.gameRooms[roomCode];
            if (!room || socket.id !== room.gamemaster) {
                socket.emit('error', { message: 'Only the Game Master can kick players or room not found.' });
                return;
            }
            if (playerIdToKick === socket.id || (room.players.find(p => p.id === playerIdToKick)?.persistentPlayerId === room.gamemasterPersistentId)) {
                socket.emit('error', { message: 'Game Master cannot kick themselves.' });
                return;
            }
            let playerIndex = room.players.findIndex(p => p.id === playerIdToKick || p.persistentPlayerId === playerIdToKick);
            if (playerIndex === -1) {
                socket.emit('error', { message: 'Player not found.' });
                return;
            }
            const kickedPlayer = room.players.splice(playerIndex, 1)[0];
            const kickedPlayerSocket = (0, socketService_1.getIO)().sockets.sockets.get(kickedPlayer.id);
            if (kickedPlayerSocket) {
                kickedPlayerSocket.emit('kicked_from_room', { roomCode, reason: 'Kicked by Game Master' });
                kickedPlayerSocket.leave(roomCode);
            }
            if (room.playerBoards && room.playerBoards[kickedPlayer.id])
                delete room.playerBoards[kickedPlayer.id];
            if (room.roundAnswers && room.roundAnswers[kickedPlayer.persistentPlayerId])
                delete room.roundAnswers[kickedPlayer.persistentPlayerId];
            if (room.evaluatedAnswers && room.evaluatedAnswers[kickedPlayer.persistentPlayerId])
                delete room.evaluatedAnswers[kickedPlayer.persistentPlayerId];
            (0, socketService_1.broadcastGameState)(roomCode);
        }
        catch (error) {
            console.error(`[Server Kick] Error:`, error);
            socket.emit('error', { message: 'Internal server error during kick.' });
        }
    });
    socket.on('disconnect', (reason) => {
        const roomCode = socket.roomCode;
        const { persistentPlayerId, playerName, isGameMaster } = socket.data || {};
        console.log(`[Server Disconnect] Socket ${socket.id} (persistent: ${persistentPlayerId}) disconnected. Reason: ${reason}, Room: ${roomCode}`);
        if (roomCode && roomService_1.gameRooms[roomCode] && socket.data.isWebRTCReady) {
            (0, socketService_1.getIO)().to(roomCode).emit('webrtc-user-left', { socketId: socket.id });
        }
        if (!roomCode || !roomService_1.gameRooms[roomCode])
            return;
        const room = roomService_1.gameRooms[roomCode];
        const isTemporaryDisconnect = ['transport close', 'transport error', 'ping timeout', 'client ping timeout'].includes(reason);
        if (isGameMaster && persistentPlayerId === room.gamemasterPersistentId && socket.id === room.gamemasterSocketId) {
            console.log(`[Server Disconnect] GM disconnected from room ${roomCode}`);
            room.gamemasterDisconnected = true;
            (0, socketService_1.getIO)().to(roomCode).emit('gm_disconnected_status', { disconnected: true, temporary: isTemporaryDisconnect });
            if (!isTemporaryDisconnect) {
                (0, roomService_1.saveRoomState)();
                room.gamemasterDisconnectTimer = setTimeout(() => {
                    if (room.gamemasterDisconnected) {
                        console.log(`[Server Disconnect] GM did not reconnect. Ending game in room ${roomCode}`);
                        room.gamemasterDisconnectTime = new Date().toISOString();
                        (0, socketService_1.getIO)().to(roomCode).emit('room_not_found', { message: 'Room expired: GM disconnected too long.' });
                        (0, socketService_1.getIO)().to(roomCode).emit('game_over', { reason: 'GM disconnected too long' });
                        room.isConcluded = true;
                        (0, roomService_1.saveRoomState)();
                        delete roomService_1.gameRooms[roomCode];
                    }
                }, 2 * 60 * 1000 + 10000); // 2 mins + 10s grace
            }
            else {
                (0, roomService_1.saveRoomState)();
            }
        }
        else if (!isGameMaster) {
            const playerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
            if (playerIndex !== -1 && room.players[playerIndex].id === socket.id) {
                const player = room.players[playerIndex];
                if (reason === 'client namespace disconnect' || reason === 'server namespace disconnect') {
                    console.log(`[Server Disconnect] Player ${player.name} gracefully disconnected.`);
                    room.players.splice(playerIndex, 1);
                    if (room.playerBoards && room.playerBoards[player.id])
                        delete room.playerBoards[player.id];
                    if (room.roundAnswers && room.roundAnswers[player.persistentPlayerId])
                        delete room.roundAnswers[player.persistentPlayerId];
                    if (room.evaluatedAnswers && room.evaluatedAnswers[player.persistentPlayerId])
                        delete room.evaluatedAnswers[player.persistentPlayerId];
                    (0, socketService_1.getIO)().to(roomCode).emit('player_left_gracefully', { playerId: player.id, persistentPlayerId: player.persistentPlayerId, playerName: player.name });
                }
                else {
                    console.log(`[Server Disconnect] Player ${player.name} abruptly disconnected. Waiting for re-connection.`);
                    player.isActive = false;
                    (0, socketService_1.getIO)().to(roomCode).emit('player_disconnected_status', { playerId: player.id, persistentPlayerId: player.persistentPlayerId, isActive: false, temporary: isTemporaryDisconnect });
                    if (!isTemporaryDisconnect) {
                        player.disconnectTimer = setTimeout(() => {
                            const currentPIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
                            if (currentPIndex !== -1 && !room.players[currentPIndex].isActive) {
                                console.log(`[Server Disconnect] Player ${player.name} did not reconnect. Removing.`);
                                const removedPlayer = room.players.splice(currentPIndex, 1)[0];
                                if (room.playerBoards && room.playerBoards[removedPlayer.id])
                                    delete room.playerBoards[removedPlayer.id];
                                if (room.roundAnswers && room.roundAnswers[removedPlayer.persistentPlayerId])
                                    delete room.roundAnswers[removedPlayer.persistentPlayerId];
                                if (room.evaluatedAnswers && room.evaluatedAnswers[removedPlayer.persistentPlayerId])
                                    delete room.evaluatedAnswers[removedPlayer.persistentPlayerId];
                                (0, socketService_1.getIO)().to(roomCode).emit('player_removed_after_timeout', { playerId: removedPlayer.id, persistentPlayerId: removedPlayer.persistentPlayerId, playerName: removedPlayer.name });
                            }
                            (0, socketService_1.broadcastGameState)(roomCode);
                        }, 2 * 60 * 1000 + 15000); // 2 mins + 15s grace
                    }
                }
                (0, socketService_1.broadcastGameState)(roomCode);
            }
        }
    });
    socket.on('rejoin_room', ({ roomCode, isGameMaster, persistentPlayerId, avatarSvg }) => {
        console.log(`[Server Rejoin] Received rejoin_room:`, { roomCode, socketId: socket.id, persistentPlayerId: persistentPlayerId || socket.data.persistentPlayerId, isGameMaster, hasAvatar: !!avatarSvg });
        socket.data.persistentPlayerId = persistentPlayerId || socket.data.persistentPlayerId;
        socket.data.isGameMaster = isGameMaster;
        const room = roomService_1.gameRooms[roomCode];
        if (!room) {
            socket.emit('room_not_found', { message: 'Room not found. Please create a new room.' });
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        const actualPersistentId = socket.data.persistentPlayerId || '';
        if (isGameMaster === true && room.gamemasterPersistentId === actualPersistentId) {
            room.gamemaster = socket.id;
            room.gamemasterSocketId = socket.id;
            socket.join(roomCode);
            socket.roomCode = roomCode;
            if (room.gamemasterDisconnected) {
                if (room.gamemasterDisconnectTimer)
                    clearTimeout(room.gamemasterDisconnectTimer);
                room.gamemasterDisconnectTimer = null;
                room.gamemasterDisconnected = false;
                (0, socketService_1.getIO)().to(roomCode).emit('gm_disconnected_status', { disconnected: false });
            }
            socket.data.playerName = 'GameMaster';
            socket.emit('room_created', { roomCode, isStreamerMode: room.isStreamerMode });
            const gameState = (0, socketService_1.getGameState)(roomCode);
            if (gameState)
                socket.emit('game_state_update', gameState);
            socket.emit('players_update', room.players);
            room.lastActivity = new Date().toISOString();
            (0, roomService_1.saveRoomState)();
            return;
        }
        const playerIndex = room.players.findIndex(p => p.persistentPlayerId === actualPersistentId);
        if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            player.id = socket.id;
            player.isActive = true;
            if (avatarSvg)
                player.avatarSvg = avatarSvg;
            if (player.disconnectTimer)
                clearTimeout(player.disconnectTimer);
            player.disconnectTimer = null;
            socket.join(roomCode);
            socket.roomCode = roomCode;
            socket.data.playerName = player.name;
            (0, socketService_1.getIO)().to(roomCode).emit('player_reconnected_status', { playerId: socket.id, persistentPlayerId: actualPersistentId, isActive: true });
            (0, socketService_1.broadcastGameState)(roomCode);
            room.lastActivity = new Date().toISOString();
            socket.emit('room_joined', { roomCode, playerId: actualPersistentId, isStreamerMode: room.isStreamerMode });
            const gameState = (0, socketService_1.getGameState)(roomCode);
            if (gameState)
                socket.emit('game_state_update', gameState);
            socket.emit('players_update', room.players);
            (0, roomService_1.saveRoomState)();
            return;
        }
        if (actualPersistentId && isGameMaster === false) {
            const playerName = socket.data.playerName || `Player_${actualPersistentId.substring(0, 5)}`;
            const newPlayer = { id: socket.id, persistentPlayerId: actualPersistentId, name: playerName, lives: 3, isActive: true, isSpectator: false, joinedAsSpectator: false, answers: [], disconnectTimer: null, avatarSvg: avatarSvg || null };
            room.players.push(newPlayer);
            socket.join(roomCode);
            socket.roomCode = roomCode;
            socket.data.playerName = playerName;
            (0, socketService_1.getIO)().to(roomCode).emit('player_joined', newPlayer); // Cast to any for now
            room.lastActivity = new Date().toISOString();
            socket.emit('room_joined', { roomCode, playerId: actualPersistentId, isStreamerMode: room.isStreamerMode });
            const gameState = (0, socketService_1.getGameState)(roomCode);
            if (gameState)
                socket.emit('game_state_update', gameState);
            socket.emit('players_update', room.players);
            (0, roomService_1.saveRoomState)();
            return;
        }
        socket.emit('error', { message: 'Not authorized to rejoin this room' });
    });
    socket.on('update_avatar', ({ roomCode, persistentPlayerId, avatarSvg }) => {
        if (!roomService_1.gameRooms[roomCode])
            return;
        const room = roomService_1.gameRooms[roomCode];
        const playerIndex = room.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
        if (playerIndex === -1)
            return;
        room.players[playerIndex].avatarSvg = avatarSvg;
        (0, socketService_1.getIO)().to(roomCode).emit('avatar_updated', { persistentPlayerId, avatarSvg });
    });
    // WebRTC Signaling Handlers
    socket.on('webrtc-ready', ({ roomCode }) => {
        if (!roomService_1.gameRooms[roomCode])
            return;
        socket.data.isWebRTCReady = true;
        const room = roomService_1.gameRooms[roomCode];
        const currentIO = (0, socketService_1.getIO)();
        const otherReadyPeers = room.players
            .filter(p => p.id !== socket.id && currentIO.sockets.sockets.get(p.id)?.data.isWebRTCReady)
            .map(p => ({ socketId: p.id, persistentPlayerId: p.persistentPlayerId, playerName: p.name, isGameMaster: p.persistentPlayerId === room.gamemasterPersistentId }));
        const gmSocket = currentIO.sockets.sockets.get(room.gamemasterSocketId || '');
        if (gmSocket?.data.isWebRTCReady && room.gamemasterSocketId !== socket.id) {
            otherReadyPeers.push({ socketId: room.gamemasterSocketId, persistentPlayerId: room.gamemasterPersistentId, playerName: gmSocket.data.playerName || 'GameMaster', isGameMaster: true });
        }
        const uniqueOtherReadyPeers = Array.from(new Set(otherReadyPeers.map(p => p.socketId))).map(id => otherReadyPeers.find(p => p.socketId === id));
        socket.emit('webrtc-existing-peers', { peers: uniqueOtherReadyPeers.filter(Boolean) });
        const newPeerData = { socketId: socket.id, persistentPlayerId: socket.data.persistentPlayerId, playerName: socket.data.playerName, isGameMaster: socket.data.isGameMaster };
        uniqueOtherReadyPeers.filter(Boolean).forEach(peer => {
            currentIO.to(peer.socketId).emit('webrtc-new-peer', { newPeer: newPeerData });
        });
    });
    socket.on('webrtc-offer', ({ offer, to, from }) => { (0, socketService_1.getIO)().to(to).emit('webrtc-offer', { offer, from }); });
    socket.on('webrtc-answer', ({ answer, to, from }) => { (0, socketService_1.getIO)().to(to).emit('webrtc-answer', { answer, from }); });
    socket.on('webrtc-ice-candidate', ({ candidate, to, from }) => { (0, socketService_1.getIO)().to(to).emit('webrtc-ice-candidate', { candidate, from }); });
});
// Add handler for request_players event
app.get('/api/request_players', (req, res) => {
    const roomCode = req.query.roomCode; // Cast to string
    if (!roomCode) {
        return res.status(400).json({ error: 'Missing roomCode' });
    }
    const room = roomService_1.gameRooms[roomCode];
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
        players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            persistentPlayerId: p.persistentPlayerId
        }))
    });
});
