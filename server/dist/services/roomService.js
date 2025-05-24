"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameRooms = void 0;
exports.createGameRoom = createGameRoom;
exports.generateRoomCode = generateRoomCode;
exports.saveRoomState = saveRoomState;
exports.loadRoomState = loadRoomState;
exports.cleanupStaleRooms = cleanupStaleRooms;
exports.logEvent = logEvent;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Store active game rooms
exports.gameRooms = {};
// Persistent storage - file path
const roomStatePath = path_1.default.join(__dirname, '../../room-state.json');
/**
 * Helper function to create a new game room with consistent structure
 */
function createGameRoom(roomCode, gamemasterId, gamemasterPersistentId) {
    // Check if room already exists with this code to prevent duplicates
    if (exports.gameRooms[roomCode]) {
        console.log(`[Server] Room ${roomCode} already exists, updating gamemaster connection`);
        // Update gamemaster connection info if provided
        if (gamemasterId) {
            exports.gameRooms[roomCode].gamemaster = gamemasterId;
            exports.gameRooms[roomCode].gamemasterSocketId = gamemasterId;
            exports.gameRooms[roomCode].gamemasterDisconnected = false;
            // Clear any existing disconnect timer
            if (exports.gameRooms[roomCode].gamemasterDisconnectTimer) {
                clearTimeout(exports.gameRooms[roomCode].gamemasterDisconnectTimer);
                exports.gameRooms[roomCode].gamemasterDisconnectTimer = null;
            }
        }
        // Update last activity timestamp
        exports.gameRooms[roomCode].lastActivity = new Date().toISOString();
        return exports.gameRooms[roomCode];
    }
    // Create a new room
    const newRoom = {
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
        playerBoards: {},
        submissionPhaseOver: false,
        isConcluded: false,
        isStreamerMode: false,
        isPointsMode: false,
        answeredPlayersCorrectly: [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        isCommunityVotingMode: false,
        gameMasterBoardData: null,
        votes: {}
    };
    // Log room creation as a critical event
    logEvent('ROOM_CREATED', {
        roomCode,
        gamemasterPersistentId
    });
    return newRoom;
}
/**
 * Helper function to generate a room code
 */
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
/**
 * Save current game room state to file
 */
function saveRoomState() {
    try {
        // Create a simplified copy of gameRooms to save (without circular references)
        const roomsToSave = {};
        Object.entries(exports.gameRooms).forEach(([roomCode, room]) => {
            // Skip rooms that are marked as concluded
            if (room.isConcluded)
                return;
            // Create a simplified copy without websocket/circular references
            const simplifiedRoom = {
                roomCode: room.roomCode,
                gamemasterPersistentId: room.gamemasterPersistentId,
                players: room.players.map(player => ({
                    persistentPlayerId: player.persistentPlayerId,
                    name: player.name,
                    lives: player.lives,
                    isActive: player.isActive,
                    isSpectator: player.isSpectator,
                    joinedAsSpectator: player.joinedAsSpectator,
                    answers: player.answers
                })),
                started: room.started,
                questions: room.questions,
                currentQuestionIndex: room.currentQuestionIndex,
                timeLimit: room.timeLimit,
                questionStartTime: room.questionStartTime,
                isStreamerMode: room.isStreamerMode,
                isConcluded: room.isConcluded,
                lastSaved: new Date().toISOString()
            };
            roomsToSave[roomCode] = simplifiedRoom;
        });
        // Write to file (pretty-print for debugging)
        fs_1.default.writeFileSync(roomStatePath, JSON.stringify(roomsToSave, null, 2));
        console.log(`[Server] Saved ${Object.keys(roomsToSave).length} rooms to persistent storage`);
    }
    catch (error) {
        console.error('[Server] Error saving room state:', error);
    }
}
/**
 * Load game room state from file
 */
function loadRoomState() {
    try {
        if (!fs_1.default.existsSync(roomStatePath)) {
            console.log('[Server] No room state file found, starting with empty rooms');
            return;
        }
        const savedRooms = JSON.parse(fs_1.default.readFileSync(roomStatePath, 'utf8'));
        console.log(`[Server] Loading ${Object.keys(savedRooms).length} rooms from persistent storage`);
        // Restore rooms to gameRooms
        Object.entries(savedRooms).forEach(([roomCode, savedRoom]) => {
            // Skip too old rooms (more than 24 hours old)
            const lastSaved = new Date(savedRoom.lastSaved);
            const now = new Date();
            const hoursDiff = Math.abs(now.getTime() - lastSaved.getTime()) / 36e5; // 36e5 is the number of milliseconds in an hour
            if (hoursDiff > 24) {
                console.log(`[Server] Skipping room ${roomCode} as it's too old (${hoursDiff.toFixed(1)} hours)`);
                return;
            }
            // Check if room already exists (might happen during hot reload)
            if (exports.gameRooms[roomCode]) {
                console.log(`[Server] Room ${roomCode} already exists in memory, updating with saved data`);
                // Update existing room with saved data, preserving active connections
                const existingRoom = exports.gameRooms[roomCode];
                existingRoom.started = savedRoom.started;
                existingRoom.questions = savedRoom.questions;
                existingRoom.currentQuestionIndex = savedRoom.currentQuestionIndex;
                existingRoom.timeLimit = savedRoom.timeLimit;
                existingRoom.questionStartTime = savedRoom.questionStartTime;
                existingRoom.isStreamerMode = savedRoom.isStreamerMode;
                // Don't overwrite isConcluded if the room is active
                if (existingRoom.isConcluded !== true) {
                    existingRoom.isConcluded = savedRoom.isConcluded;
                }
                // Update player data while preserving connections
                savedRoom.players.forEach(savedPlayer => {
                    const existingPlayerIndex = existingRoom.players.findIndex(p => p.persistentPlayerId === savedPlayer.persistentPlayerId);
                    if (existingPlayerIndex >= 0) {
                        // Update existing player data while preserving connection
                        const existingPlayer = existingRoom.players[existingPlayerIndex];
                        // Preserve connection-related fields
                        const id = existingPlayer.id;
                        const isActive = existingPlayer.isActive;
                        const disconnectTimer = existingPlayer.disconnectTimer;
                        // Update with saved data
                        Object.assign(existingPlayer, savedPlayer, {
                            id, // Keep existing socket ID
                            isActive, // Keep activity status
                            disconnectTimer // Keep disconnect timer
                        });
                    }
                    else {
                        // Add new player from saved data
                        existingRoom.players.push({
                            ...savedPlayer,
                            id: '', // Will be updated when player reconnects
                            isActive: false,
                            disconnectTimer: null,
                            score: 0,
                            streak: 0,
                            position: null,
                            lastPointsEarned: null,
                            lastAnswerTimestamp: null
                        });
                    }
                });
                // Log that we updated an existing room
                console.log(`[Server] Updated existing room ${roomCode} with ${existingRoom.players.length} players`);
                return;
            }
            // Create a new room with the saved data
            const room = createGameRoom(savedRoom.roomCode, null, // will be updated when GM reconnects
            savedRoom.gamemasterPersistentId);
            // Restore room properties
            room.started = savedRoom.started;
            room.questions = savedRoom.questions;
            room.currentQuestionIndex = savedRoom.currentQuestionIndex;
            room.timeLimit = savedRoom.timeLimit;
            room.questionStartTime = savedRoom.questionStartTime;
            room.isStreamerMode = savedRoom.isStreamerMode;
            room.isConcluded = savedRoom.isConcluded;
            // Restore players (but mark them as inactive until they reconnect)
            room.players = savedRoom.players.map(player => ({
                ...player,
                id: '', // will be updated when player reconnects
                isActive: false, // mark as inactive until reconnect
                disconnectTimer: null,
                score: 0,
                streak: 0,
                position: null,
                lastPointsEarned: null,
                lastAnswerTimestamp: null
            }));
            // Add room to gameRooms
            exports.gameRooms[roomCode] = room;
            console.log(`[Server] Restored room ${roomCode} with ${room.players.length} players`);
        });
        // Log loaded rooms for debugging
        console.log(`[Server] Finished loading rooms. Active rooms: ${Object.keys(exports.gameRooms).join(', ')}`);
    }
    catch (error) {
        console.error('[Server] Error loading room state:', error);
    }
}
/**
 * Clean up inactive rooms
 */
function cleanupStaleRooms() {
    console.log('[Server] Starting cleanup of stale rooms');
    const now = new Date();
    let roomsRemoved = 0;
    Object.entries(exports.gameRooms).forEach(([roomCode, room]) => {
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
            delete exports.gameRooms[roomCode];
            roomsRemoved++;
        }
        // If GM is disconnected for over 2 minutes, the room should have been cleaned up already by the GM disconnect handler
        else if (room.gamemasterDisconnected) {
            const disconnectTime = new Date(room.gamemasterDisconnectTime || room.lastActivity);
            const minutesSinceDisconnect = Math.abs(now.getTime() - disconnectTime.getTime()) / 60000;
            if (minutesSinceDisconnect > 3) { // Add a buffer over the 2-minute timeout
                console.log(`[Server] Removing room ${roomCode} with disconnected GM (${minutesSinceDisconnect.toFixed(1)} minutes)`);
                // Delete the room
                delete exports.gameRooms[roomCode];
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
/**
 * Diagnostic logger function for critical events
 */
function logEvent(eventType, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        eventType,
        timestamp,
        details
    };
    console.log(`[SERVER-EVENT] ${eventType}: ${JSON.stringify(details)}`);
    // Optionally: Save critical events to a log file
    try {
        const logPath = path_1.default.join(__dirname, '../../critical-events.log');
        fs_1.default.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    }
    catch (error) {
        console.error('[Server] Failed to write to event log:', error);
    }
    // Automatically save room state after critical events
    saveRoomState();
}
