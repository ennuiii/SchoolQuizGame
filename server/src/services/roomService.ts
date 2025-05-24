import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import { GameRoom, GameRooms, SavedRoomsState, SimplifiedRoom } from '../types';
import { gameAnalytics } from './gameAnalytics';

// Store active game rooms
export const gameRooms: GameRooms = {};

// Persistent storage - file path
const roomStatePath = path.join(__dirname, '../../room-state.json');

/**
 * Helper function to create a new game room with consistent structure
 */
export function createGameRoom(
  roomCode: string, 
  gamemasterId: string | null, 
  gamemasterPersistentId: string
): GameRoom {
  // Check if room already exists with this code to prevent duplicates
  if (gameRooms[roomCode]) {
    console.log(`[Server] Room ${roomCode} already exists, updating gamemaster connection`);
    
    // Update gamemaster connection info if provided
    if (gamemasterId) {
      gameRooms[roomCode].gamemaster = gamemasterId;
      gameRooms[roomCode].gamemasterSocketId = gamemasterId;
      gameRooms[roomCode].gamemasterDisconnected = false;
      
      // Clear any existing disconnect timer
      if (gameRooms[roomCode].gamemasterDisconnectTimer) {
        clearTimeout(gameRooms[roomCode].gamemasterDisconnectTimer);
        gameRooms[roomCode].gamemasterDisconnectTimer = null;
      }
    }
    
    // Update last activity timestamp
    gameRooms[roomCode].lastActivity = new Date().toISOString();
    
    return gameRooms[roomCode];
  }
  
  // Create a new room
  const newRoom: GameRoom = {
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
export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Save current game room state to file
 */
export function saveRoomState(): void {
  try {
    // Create a simplified copy of gameRooms to save (without circular references)
    const roomsToSave: SavedRoomsState = {};
    Object.entries(gameRooms).forEach(([roomCode, room]) => {
      // Skip rooms that are marked as concluded
      if (room.isConcluded) return;
      
      // Create a simplified copy without websocket/circular references
      const simplifiedRoom: SimplifiedRoom = {
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
    fs.writeFileSync(roomStatePath, JSON.stringify(roomsToSave, null, 2));
    console.log(`[Server] Saved ${Object.keys(roomsToSave).length} rooms to persistent storage`);
  } catch (error) {
    console.error('[Server] Error saving room state:', error);
  }
}

/**
 * Load game room state from file
 */
export function loadRoomState(): void {
  try {
    if (!fs.existsSync(roomStatePath)) {
      console.log('[Server] No room state file found, starting with empty rooms');
      return;
    }
    
    const savedRooms = JSON.parse(fs.readFileSync(roomStatePath, 'utf8')) as SavedRoomsState;
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
      if (gameRooms[roomCode]) {
        console.log(`[Server] Room ${roomCode} already exists in memory, updating with saved data`);
        
        // Update existing room with saved data, preserving active connections
        const existingRoom = gameRooms[roomCode];
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
          const existingPlayerIndex = existingRoom.players.findIndex(p => 
            p.persistentPlayerId === savedPlayer.persistentPlayerId);
          
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
          } else {
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
      const room = createGameRoom(
        savedRoom.roomCode, 
        null, // will be updated when GM reconnects
        savedRoom.gamemasterPersistentId
      );
      
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
      gameRooms[roomCode] = room;
      console.log(`[Server] Restored room ${roomCode} with ${room.players.length} players`);
    });
    
    // Log loaded rooms for debugging
    console.log(`[Server] Finished loading rooms. Active rooms: ${Object.keys(gameRooms).join(', ')}`);
  } catch (error) {
    console.error('[Server] Error loading room state:', error);
  }
}

/**
 * Clean up inactive rooms
 */
export function cleanupStaleRooms(): void {
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

/**
 * Diagnostic logger function for critical events
 */
export function logEvent(eventType: string, details: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    eventType,
    timestamp,
    details
  };
  
  console.log(`[SERVER-EVENT] ${eventType}: ${JSON.stringify(details)}`);
  
  // Optionally: Save critical events to a log file
  try {
    const logPath = path.join(__dirname, '../../critical-events.log');
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('[Server] Failed to write to event log:', error);
  }
  
  // Automatically save room state after critical events
  saveRoomState();
} 