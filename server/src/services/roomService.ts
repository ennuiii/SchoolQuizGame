import fs from 'fs';
import path from 'path';
import { logger, logEvent } from './logService';
import { GameRoom, Player, Question, RoomState } from '../types';

// Store active game rooms
const gameRooms: Record<string, GameRoom> = {};

// Persistent storage - file path
const roomStatePath = path.join(__dirname, '../../room-state.json');

// Helper function to create a new game room with consistent structure
export function createGameRoom(roomCode: string, gamemasterId: string | null, gamemasterPersistentId: string): GameRoom {
  // Check if room already exists with this code to prevent duplicates
  if (gameRooms[roomCode]) {
    logger.log(`Room ${roomCode} already exists, updating gamemaster connection`);
    
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
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };
  
  // Log room creation as a critical event
  logEvent('ROOM_CREATED', {
    roomCode,
    gamemasterPersistentId
  });
  
  return newRoom;
}

// Function to save game room state to file
export function saveRoomState(): void {
  try {
    // Create a simplified copy of gameRooms to save (without circular references)
    const roomsToSave: Record<string, RoomState> = {};
    
    Object.entries(gameRooms).forEach(([roomCode, room]) => {
      // Skip rooms that are marked as concluded
      if (room.isConcluded) return;
      
      // Create a simplified copy without websocket/circular references
      const simplifiedRoom: RoomState = {
        roomCode: room.roomCode,
        gamemasterPersistentId: room.gamemasterPersistentId,
        players: room.players.map(player => ({
          persistentPlayerId: player.persistentPlayerId,
          name: player.name,
          lives: player.lives,
          isActive: player.isActive,
          isSpectator: player.isSpectator || false,
          joinedAsSpectator: player.joinedAsSpectator || false,
          answers: player.answers,
          id: player.id,
          disconnectTimer: null // Don't save timers
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
    logger.log(`Saved ${Object.keys(roomsToSave).length} rooms to persistent storage`);
  } catch (error) {
    logger.error('Error saving room state:', error);
  }
}

// Function to load game room state from file
export function loadRoomState(): void {
  try {
    if (!fs.existsSync(roomStatePath)) {
      logger.log('No room state file found, starting with empty rooms');
      return;
    }
    
    const savedRooms = JSON.parse(fs.readFileSync(roomStatePath, 'utf8')) as Record<string, RoomState>;
    logger.log(`Loading ${Object.keys(savedRooms).length} rooms from persistent storage`);
    
    // Restore rooms to gameRooms
    Object.entries(savedRooms).forEach(([roomCode, savedRoom]) => {
      // Skip too old rooms (more than 24 hours old)
      const lastSaved = new Date(savedRoom.lastSaved);
      const now = new Date();
      const hoursDiff = Math.abs(now.getTime() - lastSaved.getTime()) / 36e5; // 36e5 is the number of milliseconds in an hour
      
      if (hoursDiff > 24) {
        logger.log(`Skipping room ${roomCode} as it's too old (${hoursDiff.toFixed(1)} hours)`);
        return;
      }
      
      // Check if room already exists (might happen during hot reload)
      if (gameRooms[roomCode]) {
        logger.log(`Room ${roomCode} already exists in memory, updating with saved data`);
        
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
              id: savedPlayer.id,
              isActive: false,
              disconnectTimer: null
            });
          }
        });
        
        // Log that we updated an existing room
        logger.log(`Updated existing room ${roomCode} with ${existingRoom.players.length} players`);
        
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
        id: player.id,
        isActive: false, // mark as inactive until reconnect
        disconnectTimer: null
      }));
      
      // Add room to gameRooms
      gameRooms[roomCode] = room;
      logger.log(`Restored room ${roomCode} with ${room.players.length} players`);
    });
    
    // Log loaded rooms for debugging
    logger.log(`Finished loading rooms. Active rooms: ${Object.keys(gameRooms).join(', ')}`);
  } catch (error) {
    logger.error('Error loading room state:', error);
  }
}

// Function to clean up stale rooms
export function cleanupStaleRooms(): void {
  logger.log('Starting cleanup of stale rooms');
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
      logger.log(`Removing stale room ${roomCode} (inactive for ${hoursSinceLastActivity.toFixed(1)} hours)`);
      
      // Delete the room
      delete gameRooms[roomCode];
      roomsRemoved++;
    }
    // If GM is disconnected for over 2 minutes, the room should have been cleaned up already by the GM disconnect handler
    else if (room.gamemasterDisconnected) {
      const disconnectTime = new Date(room.gamemasterDisconnectTime || room.lastActivity);
      const minutesSinceDisconnect = Math.abs(now.getTime() - disconnectTime.getTime()) / 60000;
      
      if (minutesSinceDisconnect > 3) { // Add a buffer over the 2-minute timeout
        logger.log(`Removing room ${roomCode} with disconnected GM (${minutesSinceDisconnect.toFixed(1)} minutes)`);
        
        // Delete the room
        delete gameRooms[roomCode];
        roomsRemoved++;
      }
    }
  });
  
  logger.log(`Room cleanup complete. Removed ${roomsRemoved} stale rooms.`);
  
  // Save the updated room state after cleanup
  if (roomsRemoved > 0) {
    saveRoomState();
  }
}

// Get room by code
export function getRoom(roomCode: string): GameRoom | undefined {
  return gameRooms[roomCode];
}

// Check if room exists
export function roomExists(roomCode: string): boolean {
  return !!gameRooms[roomCode];
}

// Get all rooms
export function getAllRooms(): Record<string, GameRoom> {
  return gameRooms;
}

// Add room to collection
export function addRoom(roomCode: string, room: GameRoom): void {
  gameRooms[roomCode] = room;
}

// Remove room
export function removeRoom(roomCode: string): void {
  delete gameRooms[roomCode];
} 