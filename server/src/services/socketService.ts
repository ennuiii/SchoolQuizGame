import { Server } from 'socket.io';
import { GameRoom, GameState, GameRecap, PlayerBoardEntry, RecapRound, Player } from '../types';
import { gameRooms } from './roomService';
import { gameAnalytics } from './gameAnalytics';

// Timer management
export const timers = new Map<string, NodeJS.Timeout>();

// Grace period for auto-submit after round ends
export const AUTO_SUBMIT_GRACE_PERIOD_MS = 1000; // 1 second

// Reference to Socket.IO server instance (set in index.ts)
let io: Server | null = null;

/**
 * Set the Socket.IO server instance reference
 */
export function setSocketIOInstance(ioServer: Server): void {
  io = ioServer;
}

/**
 * Get the Socket.IO server instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO server not initialized');
  }
  return io;
}

/**
 * Helper function to get full game state for a room
 */
export function getGameState(roomCode: string): GameState | null {
  const room = gameRooms[roomCode];
  if (!room) return null;

  // Create a clean copy of player boards to ensure drawings are preserved
  const playerBoardsForState: Record<string, PlayerBoardEntry> = {};
  
  if (room.playerBoards) {
    // Convert to a consistent format that's serializable and retains all drawing data
    Object.entries(room.playerBoards).forEach(([playerId, boardData]) => {
      // Find player matching this board
      const player = room.players.find(p => p.id === playerId);
      // Always provide a persistentPlayerId for compatibility with older clients
      const persistentPlayerId = player?.persistentPlayerId || `F-${playerId.substring(0, 8)}`;
      
      playerBoardsForState[playerId] = {
        playerId,
        boardData: boardData.boardData || '',
        persistentPlayerId,
        roundIndex: boardData.roundIndex !== undefined ? boardData.roundIndex : room.currentQuestionIndex || 0,
        timestamp: boardData.timestamp || Date.now()
      };
    });
  }

  // Ensure all players have persistentPlayerId to prevent client crashes
  const safePlayersArray = room.players.map(player => ({
    ...player,
    // Always ensure persistentPlayerId exists (for older clients compatibility)
    persistentPlayerId: player.persistentPlayerId || `F-${player.id.substring(0, 8)}`
  }));

  let finalPlayersArray = safePlayersArray;
  let finalPlayerBoards = { ...playerBoardsForState }; // Start with a copy

  if (room.isCommunityVotingMode && room.gamemasterPersistentId) {
    const gmAsPlayerExistsInPlayerArray = safePlayersArray.some(p => p.persistentPlayerId === room.gamemasterPersistentId);
    if (!gmAsPlayerExistsInPlayerArray) {
      finalPlayersArray = [
        ...safePlayersArray,
        {
          id: room.gamemasterSocketId || 'gamemaster-socket',
          persistentPlayerId: room.gamemasterPersistentId,
          name: 'GameMaster (Playing)',
          lives: 3, 
          answers: room.roundAnswers[room.gamemasterPersistentId] ? [room.roundAnswers[room.gamemasterPersistentId]] : [],
          isActive: true,
          isSpectator: false,
          joinedAsSpectator: false,
          disconnectTimer: null,
          avatarSvg: null 
        }
      ];
    }
    // Ensure GM's board data is in the playerBoards sent to clients if they have one
    if (room.gameMasterBoardData && room.gamemasterSocketId) { // Use gamemasterSocketId as key for consistency if available
      finalPlayerBoards[room.gamemasterSocketId] = {
        playerId: room.gamemasterSocketId,
        persistentPlayerId: room.gamemasterPersistentId,
        boardData: room.gameMasterBoardData,
        roundIndex: room.currentQuestionIndex,
        timestamp: Date.now() // Or a more accurate timestamp if available
      };
    }
  }

  return {
    started: room.started,
    currentQuestion: room.currentQuestion,
    currentQuestionIndex: room.currentQuestionIndex,
    timeLimit: room.timeLimit,
    questionStartTime: room.questionStartTime,
    players: finalPlayersArray,
    roundAnswers: room.roundAnswers || {},
    evaluatedAnswers: room.evaluatedAnswers || {},
    submissionPhaseOver: room.submissionPhaseOver || false,
    isConcluded: room.isConcluded || false,
    playerBoards: finalPlayerBoards, // Use the potentially augmented player boards
    isCommunityVotingMode: room.isCommunityVotingMode || false,
    gameMasterBoardData: room.gameMasterBoardData || null, 
    currentVotes: room.votes || {}
  };
}

/**
 * Helper function to broadcast game state to all players in a room
 */
export function broadcastGameState(roomCode: string): void {
  if (!io) return;
  const state = getGameState(roomCode);
  if (state) {
    io.to(roomCode).emit('game_state_update', state);
  }
}

/**
 * Helper function to generate game recap data
 */
export function generateGameRecap(roomCode: string): GameRecap | null {
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
  const playedRounds: RecapRound[] = room.questions.slice(0, lastPlayedRoundIndex + 1).map((question, index) => {
    // Get all boards for this round
    const boardsForRound: Record<string, string> = {};
    Object.entries(room.playerBoards || {}).forEach(([playerId, boardData]) => {
      // Check if this board entry has a persistentPlayerId, if so, use that
      const persistentId = boardData.persistentPlayerId || playerId;
      
      if (boardData.roundIndex === index) {
        boardsForRound[persistentId] = boardData.boardData;
      }
    });

    // Prepare question data for recap
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
    const submissionsByPersistentId = room.players.reduce<Record<string, any>>((acc, player) => {
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
        
        // Check if we have drawing data in player answers first
        let hasDrawing = answer ? answer.hasDrawing : false;
        let drawingData: string | null = null;
        
        if (answer && answer.hasDrawing) {
          drawingData = answer.drawingData || null;
        }
        
        // If hasDrawing is true but drawing data is missing, try to get it from boardsForRound
        if (hasDrawing && (!drawingData || drawingData.trim() === '')) {
          // Try to get drawing data from boardsForRound using persistentPlayerId
          if (boardsForRound[player.persistentPlayerId]) {
            drawingData = boardsForRound[player.persistentPlayerId];
          } 
          // Also try to find using player.id as a fallback
          else if (player.id && boardsForRound[player.id]) {
            drawingData = boardsForRound[player.id];
          }
          // If we still don't have drawing data, set hasDrawing to false
          if (!drawingData || drawingData.trim() === '') {
            hasDrawing = false;
          }
        }
        
        return {
          playerId: player.id,
          persistentPlayerId: player.persistentPlayerId,
          playerName: player.name,
          answer: answer ? answer.answer : null,
          hasDrawing,
          drawingData,
          isCorrect: answer ? answer.isCorrect : null
        };
      })
    };
  });

  // Sort players for the recap - using persistentPlayerId for stability
  const sortedPlayers = [...room.players].sort((a, b) => {
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

  // Calculate who is the winner based on active players with lives
  const activePlayers = room.players.filter(p => p.isActive && !p.isSpectator && p.lives > 0);
  const hasWinner = activePlayers.length === 1;
  const winnerPersistentId = hasWinner ? activePlayers[0].persistentPlayerId : undefined;

  return {
    roomCode,
    startTime: room.createdAt,
    endTime: new Date().toISOString(),
    players: sortedPlayers.map(player => ({
      id: player.id,
      persistentPlayerId: player.persistentPlayerId,
      name: player.name,
      finalLives: player.lives,
      isSpectator: player.isSpectator,
      isActive: player.isActive,
      isWinner: player.isActive && player.lives > 0 && hasWinner && player.persistentPlayerId === winnerPersistentId
    })),
    rounds: playedRounds
  };
}

/**
 * Helper function to finalize round, perform auto-submissions, and broadcast state
 */
export function finalizeRoundAndAutoSubmit(roomCode: string): void {
  if (!io) return;

  const room = gameRooms[roomCode];
  if (!room) {
    console.log(`[FinalizeRound] Room ${roomCode} not found.`);
    return;
  }

  console.log(`[FinalizeRound] Finalizing round for room ${roomCode}. Current question index: ${room.currentQuestionIndex}`);
  room.submissionPhaseOver = true;

  // Clear voting data for the current round
  if (room.isCommunityVotingMode) {
    console.log(`[FinalizeRound] Clearing community voting data for room ${roomCode}`);
    room.votes = {};
    
    // Also clear GM's drawing board in community voting mode
    if (room.gameMasterBoardData) {
      console.log(`[FinalizeRound] Clearing game master's drawing board in community voting mode`);
      room.gameMasterBoardData = null;
    }
  }

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
          persistentPlayerId: playerInRoom.persistentPlayerId, // Ensure this is included
          playerName: playerInRoom.name,
          answer: '-', // Explicitly set auto-submitted text answer to "-"
          hasDrawing: autoAnswerHasDrawing,
          drawingData: autoAnswerDrawingData,
          timestamp: Date.now(),
          isCorrect: null // Evaluation pending
        };
        
        playerInRoom.answers[room.currentQuestionIndex] = autoAnswer;

        if (room.roundAnswers) {
          room.roundAnswers[playerInRoom.persistentPlayerId] = autoAnswer; // Key by persistentPlayerId
        }
      }
    });
  } else {
    console.warn(`[FinalizeRound] Could not perform auto-submissions for room ${roomCode}. Conditions not met: players array exists: ${!!room.players}, currentQuestionIndex defined: ${room.currentQuestionIndex !== undefined && room.currentQuestionIndex !== null}`);
  }

  broadcastGameState(roomCode);
  console.log(`[FinalizeRound] Game state broadcasted for room ${roomCode} after finalization.`);
}

/**
 * Helper function to conclude game and send recap to all
 */
export function concludeGameAndSendRecap(roomCode: string, winnerInfo: { id: string, persistentPlayerId: string, name: string } | null = null): void {
  if (!io) return;
  
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
  
  // Clear any remaining voting data when game concludes
  if (room.votes) {
    console.log(`[ConcludeGame] Clearing community voting data for room ${roomCode} on game conclusion`);
    room.votes = {};
  }

  console.log(`[ConcludeGame] Game concluded in room ${roomCode}. Emitting game_over_pending_recap.`);
  if (io) {
    io.to(roomCode).emit('game_over_pending_recap', {
      roomCode,
      winner: winnerInfo
    });

    // Generate and send recap immediately
    const recap = generateGameRecap(roomCode);
    if (recap) {
      console.log(`[ConcludeGame] Automatically broadcasting recap for room ${roomCode} with initialSelectedRoundIndex and initialSelectedTabKey.`);
      // Add initialSelectedRoundIndex and initialSelectedTabKey to the recap payload for the client
      const recapWithInitialState = { 
        ...recap, 
        initialSelectedRoundIndex: 0, 
        initialSelectedTabKey: 'overallResults' 
      };
      io.to(roomCode).emit('game_recap', recapWithInitialState);
    } else {
      console.warn(`[ConcludeGame] Recap data generation failed for room ${roomCode} during auto-send.`);
    }
  }
}

/**
 * Helper function to start question timer
 */
export function startQuestionTimer(roomCode: string): void {
  if (!io) return;
  
  const room = gameRooms[roomCode];
  if (!room || !room.timeLimit || room.timeLimit === 99999) {
    console.log(`[TIMER] Timer not started for room ${roomCode}: ${!room ? 'room not found' : !room.timeLimit ? 'no time limit set' : 'infinite time limit (99999)'}`);
    return;
  }

  // Clear any existing timer for this room
  clearRoomTimer(roomCode);

  // Clear any existing votes when starting a new question
  if (room.isCommunityVotingMode && room.votes) {
    console.log(`[TIMER] Clearing community voting data for room ${roomCode} at start of new question`);
    room.votes = {};
  }

  let timeRemaining = room.timeLimit;
  const startTime = Date.now();
  
  console.log(`[TIMER] Starting timer for room ${roomCode} with ${timeRemaining} seconds`);
  
  // Create a new timer that uses absolute time
  const timer = setInterval(() => {
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    timeRemaining = Math.max(0, room.timeLimit !== null ? room.timeLimit - elapsedTime : 0);
    
    // Broadcast the remaining time to all clients
    const currentIO = getIO(); // Use getIO to ensure io is not null
    currentIO.to(roomCode).emit('timer_update', { timeRemaining });
    console.log(`[TIMER] Room ${roomCode}: ${timeRemaining} seconds remaining`);
    
    if (timeRemaining <= 0) {
      console.log(`[TIMER] Time's up for room ${roomCode}`);
      clearInterval(timer);
      timers.delete(roomCode);
      currentIO.to(roomCode).emit('time_up');
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

/**
 * Clear a room timer
 */
export function clearRoomTimer(roomCode: string): void {
  const timer = timers.get(roomCode);
  if (timer) {
    console.log(`[TIMER] Clearing timer for room ${roomCode}`);
    clearInterval(timer);
    timers.delete(roomCode);
  } else {
    console.log(`[TIMER] No timer found to clear for room ${roomCode}`);
  }
} 