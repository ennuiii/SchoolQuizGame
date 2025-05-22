import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PreviewOverlayV2 from '../components/shared/PreviewOverlayV2';
import QuestionCard from '../components/shared/QuestionCard';
import Timer from '../components/shared/Timer';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';
import { useGame } from '../contexts/GameContext';
import { useAudio } from '../contexts/AudioContext';
import { useRoom } from '../contexts/RoomContext';
import { useCanvas } from '../contexts/CanvasContext';
import DrawingBoard from '../components/player/DrawingBoard';
import RecapModal from '../components/shared/RecapModal';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import { ConnectionStatus } from '../components/shared/ConnectionStatus';
import ReviewNotification from '../components/player/ReviewNotification';
import SettingsControl from '../components/shared/SettingsControl';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n';
import { useWebRTC } from '../contexts/WebRTCContext';
import WebcamDisplay from '../components/shared/WebcamDisplay';
import AvatarCreator from '../components/shared/AvatarCreator';

// Import Question and PlayerBoard types from GameContext
import type { PlayerBoard } from '../contexts/GameContext';

// TODO: Move BoardData to a shared types file if used elsewhere or becomes complex.
interface BoardData {
  data: string;
  timestamp: number;
}

const Player: React.FC = () => {
  const navigate = useNavigate();
  const [submittedAnswerLocal, setSubmittedAnswerLocal] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [receivedGameState, setReceivedGameState] = useState(false);
  const [playerOverlayLocallyClosed, setPlayerOverlayLocallyClosed] = useState(false);
  const [showAvatarCreatorPlayer, setShowAvatarCreatorPlayer] = useState(false);
  const [hideLobbyCode, setHideLobbyCode] = useState(() => sessionStorage.getItem('hideLobbyCode') === 'true');
  
  // Get context values
  const {
    gameStarted,
    currentQuestion,
    timeLimit,
    timeRemaining,
    isTimerRunning,
    previewMode,
    previewOverlayVersion,
    toggleBoardVisibility,
    currentQuestionIndex,
    submittedAnswer,
    isGameConcluded,
    gameRecapData,
    recapSelectedRoundIndex,
    recapSelectedTabKey,
    hideRecap,
    allAnswersThisRound,
    evaluatedAnswers,
    currentVotes,
    players,
    playerBoards,
    isCommunityVotingMode
  } = useGame();

  const {
    playBackgroundMusic,
    pauseBackgroundMusic
  } = useAudio();

  const {
    roomCode,
    playerName,
    isSpectator: amISpectator,
    isLoading: isRoomLoading,
    errorMsg,
    connectionStatus,
    persistentPlayerId,
    isGameMaster,
    currentSocket,
    isKickedModalOpen,
    kickReason,
    isStreamerMode
  } = useRoom();

  const { getCurrentCanvasSVG, clear, canvas } = useCanvas();

  const { language } = useLanguage();

  const { localStream, startLocalStream, initializeWebRTC, stopLocalStream, remoteStreams } = useWebRTC();
  const [isWebcamSidebarVisible, setIsWebcamSidebarVisible] = useState<boolean>(false);
  const [webcamPosition, setWebcamPosition] = useState({ x: 20, y: 50 });
  const [webcamSize, setWebcamSize] = useState({ width: 450, height: 400 });
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Add a ref to track if we've already logged the player match
  const playerMatchLoggedRef = useRef(false);

  // Determine if player has already submitted answer from server state
  // This solves the issue where player can submit again after page refresh
  const hasSubmittedToServer = useMemo(() => {
    if (!persistentPlayerId || !allAnswersThisRound) {
      console.log('[Player] hasSubmittedToServer: Missing persistentPlayerId or allAnswersThisRound', {
        hasPersistentId: !!persistentPlayerId,
        answersThisRound: allAnswersThisRound ? Object.keys(allAnswersThisRound).length : 0
      });
      return false;
    }
    
    // Check if this player has an answer in the current round
    const hasSubmitted = Object.entries(allAnswersThisRound).some(([pid, _]) => 
      pid === persistentPlayerId
    );
    
    console.log('[Player] hasSubmittedToServer calculated:', {
      persistentPlayerId,
      hasSubmitted,
      answerKeys: Object.keys(allAnswersThisRound),
      currentQuestionIndex
    });
    
    return hasSubmitted;
  }, [persistentPlayerId, allAnswersThisRound, currentQuestionIndex]);

  // Sync local submission state with server state
  useEffect(() => {
    if (hasSubmittedToServer) {
      console.log('[Player] Setting submittedAnswerLocal=true because hasSubmittedToServer=true');
      setSubmittedAnswerLocal(true);
    }
  }, [hasSubmittedToServer]);

  // Clear canvas and reset state when new question starts
  useEffect(() => {
    if (currentQuestion) {
      // Always reset submission state when the question ID or index changes
      console.log(`[Player.tsx] New question (ID: ${currentQuestion.id}, Index: ${currentQuestionIndex}). Resetting local submission state.`, {
        oldSubmittedAnswerLocal: submittedAnswerLocal,
        hasSubmittedToServer,
        answerKeysInRound: allAnswersThisRound ? Object.keys(allAnswersThisRound) : []
      });
      
      // Force reset the submission state for this component, regardless of server state
      // This is critical to ensure drawing is enabled for new questions
      setSubmittedAnswerLocal(false);
      
      // Increment canvas key to force remount of the DrawingBoard component
      console.log(`[Player.tsx] Incrementing canvasKey from ${canvasKey} to ${canvasKey + 1} to force DrawingBoard remount`);
      setCanvasKey(prev => prev + 1);
      
      setAnswer(''); // Clear text answer field on new question
    }
  }, [currentQuestionIndex, currentQuestion?.id]);

  // Effect for handling game state changes
  useEffect(() => {
    console.log('[Player] Game state changed:', {
      started: gameStarted,
      questionIndex: currentQuestionIndex,
      timeRemaining,
      contextSubmittedAnswer: submittedAnswer,
      localPlayerSubmissionLock: submittedAnswerLocal,
      hasSubmittedToServer,
      gameRecapAvailable: !!gameRecapData,
      isCommunityVotingMode,
      previewModeActive: previewMode.isActive,
      timestamp: new Date().toISOString()
    });
  }, [gameStarted, currentQuestionIndex, timeRemaining, submittedAnswer, submittedAnswerLocal, gameRecapData, hasSubmittedToServer, isCommunityVotingMode, previewMode.isActive]);

  // Reset local overlay closed state when previewMode becomes inactive or mode changes
  useEffect(() => {
    if (!previewMode.isActive || !isCommunityVotingMode) {
      setPlayerOverlayLocallyClosed(false);
    }
  }, [previewMode.isActive, isCommunityVotingMode]);

  // Reset local overlay closed state when the question changes
  useEffect(() => {
    if (gameStarted) { // Only reset if game has started and question truly changes
        setPlayerOverlayLocallyClosed(false);
    }
  }, [currentQuestionIndex, gameStarted]);

  // Handle answer submission
  const handleAnswerSubmit = useCallback(async (textAnswer: string) => {
    if (!roomCode || !currentQuestion || submittedAnswerLocal || hasSubmittedToServer) {
      console.error('[Player] Cannot submit answer:', {
        hasRoomCode: !!roomCode,
        hasQuestion: !!currentQuestion,
        alreadySubmitted: submittedAnswerLocal || hasSubmittedToServer
      });
      return;
    }

    // Check connection before submitting
    if (connectionStatus !== 'connected') {
      toast.error('Cannot submit answer: You are disconnected from the server. Please wait for reconnection.');
      return;
    }

    try {
      // Log the canvas object from context at the moment of submission
      console.log('[Player.tsx] handleAnswerSubmit: canvas object before calling getCurrentCanvasSVG():', canvas);

      let finalAnswer = textAnswer.trim();
      let drawingData: string | null = null;
      let finalHasDrawing = false;

      // First try to get the SVG data from the canvas context
      const rawSvgData = getCurrentCanvasSVG();
      console.log('[Player.tsx] handleAnswerSubmit: rawSvgData from getCurrentCanvasSVG():', rawSvgData ? rawSvgData.substring(0, 100) + "..." : "NULL or EMPTY");

      // If we got valid SVG data from the canvas
      if (rawSvgData && rawSvgData.trim() !== '' && rawSvgData.includes('<svg') && rawSvgData.includes('path')) {
        drawingData = rawSvgData;
        finalHasDrawing = true;
        console.log('[Player.tsx] handleAnswerSubmit: Using SVG data from getCurrentCanvasSVG()');
      } 
      // If the canvas method failed, check if we have drawing data in playerBoards
      else {
        console.log('[Player.tsx] handleAnswerSubmit: SVG data not available from canvas, checking playerBoards');
        
        // Check if there's a board for this player in the current question
        const myBoardData = playerBoards.find(board => 
          board.playerId === socketService.getSocketId() || 
          (board.playerId === persistentPlayerId) && 
          (board.roundIndex === undefined || board.roundIndex === currentQuestionIndex)
        );
        
        if (myBoardData && myBoardData.boardData && myBoardData.boardData.trim() !== '') {
          // If we have a valid board with data, use it
          drawingData = myBoardData.boardData;
          // Check if it's valid JSON with objects
          try {
            const parsedData = JSON.parse(drawingData);
            finalHasDrawing = !!(parsedData && parsedData.objects && parsedData.objects.length > 0);
            console.log('[Player.tsx] handleAnswerSubmit: Found drawing data in playerBoards. Contains', 
              parsedData.objects?.length || 0, 'objects. Setting hasDrawing =', finalHasDrawing);
          } catch (e) {
            console.error('[Player.tsx] handleAnswerSubmit: Error parsing board data:', e);
            finalHasDrawing = false;
            drawingData = null;
          }
        } else {
          console.log('[Player.tsx] handleAnswerSubmit: No valid drawing data found in playerBoards');
          finalHasDrawing = false;
          drawingData = null;
        }
      }
      
      console.log('[Player.tsx] handleAnswerSubmit: finalHasDrawing based on all checks:', finalHasDrawing);

      // If text answer is empty, default to "-". This allows submitting drawings without text,
      // or submitting an intentionally blank text answer.
      if (finalAnswer.trim() === '') {
        finalAnswer = '-';
      }

      console.log('[Player] Submitting answer:', {
        roomCode,
        answer: finalAnswer,
        hasDrawing: finalHasDrawing,
        drawingDataLength: drawingData?.length || 0,
        timestamp: new Date().toISOString()
      });

      await socketService.submitAnswer(roomCode, finalAnswer, finalHasDrawing, drawingData);
      setSubmittedAnswerLocal(true);
      toast.success('Answer submitted!');
    } catch (error) {
      console.error('[Player] Failed to submit answer:', error);
      toast.error('Failed to submit answer. Please try again.');
    }
  }, [roomCode, currentQuestion, submittedAnswerLocal, hasSubmittedToServer, getCurrentCanvasSVG, connectionStatus, canvas, playerBoards, persistentPlayerId, currentQuestionIndex]);

  // Handle board updates
  const handleBoardUpdate = async (boardData: BoardData) => {
    if (!roomCode) {
      console.error('[Player] Cannot update board - No room code found');
      return;
    }
    
    // Skip updates if player has already submitted their answer
    if (submittedAnswerLocal || hasSubmittedToServer) {
      return;
    }
    
    // For board updates, we'll use the updateBoard method which uses volatile emissions
    // If not connected, these will be silently dropped
    try {
      socketService.updateBoard(roomCode, boardData.data);
    } catch (error) {
      // This should rarely happen as updateBoard uses volatile.emit
      console.error('[Player] Failed to update board:', error);
    }
  };

  // Auto-submit when time runs out
  useEffect(() => {
    if (
      gameStarted &&
      currentQuestion &&
      timeLimit !== null &&
      timeRemaining !== null &&
      timeRemaining <= 0 &&
      !submittedAnswerLocal &&
      !hasSubmittedToServer &&
      connectionStatus === 'connected' // Only try to submit if connected
    ) {
      console.log(`[Player.tsx] Auto-submitting due to TIMER.`);
      console.log(`[Player.tsx] Auto-submit Conditions: questionId: ${currentQuestion.id}, questionIndex: ${currentQuestionIndex}, timeRemaining: ${timeRemaining}, submittedLocal: ${submittedAnswerLocal}, submittedServer: ${hasSubmittedToServer}, answer: "${answer}"`);
      handleAnswerSubmit(answer);
    }
  }, [
    gameStarted,
    currentQuestion,
    timeLimit,
    timeRemaining,
    submittedAnswerLocal,
    hasSubmittedToServer,
    answer,
    handleAnswerSubmit,
    connectionStatus
  ]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    if (amISpectator) return; // Do nothing if spectator

    if (
      document.visibilityState === 'visible' &&
      gameStarted &&
      currentQuestion &&
      timeLimit !== null &&
      timeRemaining !== null &&
      timeRemaining <= 0 &&
      !submittedAnswerLocal &&
      !hasSubmittedToServer &&
      connectionStatus === 'connected' // Only try to submit if connected
    ) {
      console.log(`[Player.tsx] Auto-submitting due to VISIBILITY CHANGE + TIMER.`);
      console.log(`[Player.tsx] Auto-submit Conditions (Visibility): questionId: ${currentQuestion.id}, questionIndex: ${currentQuestionIndex}, timeRemaining: ${timeRemaining}, submittedLocal: ${submittedAnswerLocal}, submittedServer: ${hasSubmittedToServer}, answer: "${answer}"`);
      handleAnswerSubmit(answer); // Submit current text answer
    }
  }, [
    amISpectator,
    gameStarted,
    currentQuestion,
    timeLimit,
    timeRemaining,
    submittedAnswerLocal,
    hasSubmittedToServer,
    answer,
    handleAnswerSubmit,
    connectionStatus
  ]);

  // Handle answer change
  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (submittedAnswerLocal || hasSubmittedToServer) return;
    setAnswer(e.target.value);
  };

  // Handle visibility change
  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  // Handle background music
  useEffect(() => {
    playBackgroundMusic();
    return () => {
      pauseBackgroundMusic();
    };
  }, [playBackgroundMusic, pauseBackgroundMusic]);

  useEffect(() => {
    if (amISpectator) {
      toast.info("You are a spectator. Redirecting to spectator view.");
      navigate('/spectator');
    }
  }, [amISpectator, navigate]);

  // If we have a stored roomCode but connection is lost, request game state update upon reconnection
  useEffect(() => {
    if (connectionStatus === 'connected' && roomCode) {
      // Attempt to rejoin the room - but don't log every time
      if (!isRoomLoading) {
        socketService.rejoinRoom(roomCode, false); // false = not GM
      }
      
      // Request the latest state
      socketService.requestGameState(roomCode);
      socketService.requestPlayers(roomCode);
      
      // Set a timeout to retry getting players if the list is empty
      const retryTimeout = setTimeout(() => {
        if (players.length === 0) {
          // Don't log this every time
          socketService.requestPlayers(roomCode);
        }
      }, 2000);
      
      // Set a timeout to force proceed if still loading after some time
      const forceLoadTimeout = setTimeout(() => {
        if (connectionStatus === 'connected' && roomCode && players.length > 0) {
          // Only log this once when it actually happens
          console.log('[Player] Force proceeding after timeout - connection is established and player list exists');
          // This will trigger a re-render which should show the game screen
          setIsLoading(false); 
        }
      }, 5000);
      
      return () => {
        clearTimeout(retryTimeout);
        clearTimeout(forceLoadTimeout);
      };
    }
  }, [connectionStatus, roomCode, isRoomLoading, players.length]);

  // Add a connection effect that initializes when component mounts
  useEffect(() => {
    if (playerName) {
      console.log('[Player] Attempting to establish socket connection with player name:', playerName);
      
      // Set Player authentication details
      socketService.setPlayerDetails(playerName);
      socketService.setGMConnectionDetails(false);
      
      // Always attempt to connect
      socketService.connect()
        .then(socket => {
          console.log('[Player] Socket connection successful:', socket?.id);
        })
        .catch(error => {
          console.error('[Player] Socket connection failed:', error);
          toast.error('Failed to connect to game server. Please refresh and try again.');
        });
      
      // Set up error handler
      socketService.on('connect_error', (error: Error) => {
        console.error('[Player] Socket connection error:', error);
        toast.error(`Connection error: ${error.message}`);
      });
      
      return () => {
        socketService.off('connect_error');
      };
    } else {
      console.log('[Player] No player name available yet for socket connection.');
    }
  }, [playerName, navigate]);

  // Debug drawing board state
  useEffect(() => {
    console.log('[Player] Drawing board state:', {
      submittedAnswerLocal,
      hasSubmittedToServer,
      amISpectator,
      connectionStatus,
      disabled: submittedAnswerLocal || hasSubmittedToServer || amISpectator || connectionStatus !== 'connected',
      canvasKey
    });
  }, [submittedAnswerLocal, hasSubmittedToServer, amISpectator, connectionStatus, canvasKey]);

  // Add comprehensive debug info about player state
  useEffect(() => {
    console.log('[Player] Player state debug:', {
      roomCode,
      playerName,
      socketId: socketService.getSocketId(),
      persistentPlayerId,
      amISpectator,
      connectionStatus,
      playersInRoom: players ? players.length : 0,
      currentPlayerDetails: players?.find(p => p.id === socketService.getSocketId() || p.persistentPlayerId === persistentPlayerId),
      isGameStarted: gameStarted,
      timestamp: new Date().toISOString()
    });
  }, [roomCode, playerName, persistentPlayerId, amISpectator, connectionStatus, players, gameStarted]);

  // Sync our internal loading state with the room loading state
  useEffect(() => {
    setIsLoading(isRoomLoading);
  }, [isRoomLoading]);

  // Safety timeout to prevent getting stuck on loading screen
  useEffect(() => {
    // Force exit loading screen after 10 seconds if connected
    const forceExitTimeout = setTimeout(() => {
      if (connectionStatus === 'connected' && roomCode && isLoading) {
        console.log('[Player] Force exiting loading state after timeout - we are connected with a room code');
        setIsLoading(false);
      }
    }, 10000);
    
    return () => clearTimeout(forceExitTimeout);
  }, [connectionStatus, roomCode, isLoading]);

  // Listen for game state updates to know when we've successfully reconnected
  useEffect(() => {
    const handleGameStateUpdate = () => {
      console.log('[Player] Received game state update, marking as reconnected');
      setReceivedGameState(true);
      
      // Force exit loading screen when we get game state
      setIsLoading(false);
    };
    
    socketService.on('game_state_update', handleGameStateUpdate);
    
    return () => {
      socketService.off('game_state_update', handleGameStateUpdate);
    };
  }, []);

  // Monitor for player data to exit loading screen - reduce logging
  useEffect(() => {
    // If we have connection, players data, and room code, we should exit loading state directly
    if (connectionStatus === 'connected' && players.length > 0 && roomCode) {
      // Don't log this repeatedly
      setIsLoading(false);
    }
  }, [connectionStatus, players, roomCode]);

  // Override isRoomLoading in some cases - reduce logging
  useEffect(() => {
    if (isRoomLoading && receivedGameState && connectionStatus === 'connected' && players.length > 0) {
      // Don't log this repeatedly
      setIsLoading(false);
    }
  }, [isRoomLoading, receivedGameState, connectionStatus, players.length]);

  // Add drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (dragRef.current && (e.target as Element).closest('.webcam-handle')) {
      isDraggingRef.current = true;
      offsetRef.current = {
        x: e.clientX - webcamPosition.x,
        y: e.clientY - webcamPosition.y
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingRef.current) {
      setWebcamPosition({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y
      });
    } else if (isResizingRef.current) {
      // Calculate new dimensions
      const newWidth = Math.max(300, resizeStartSize.width + (e.clientX - resizeStartPos.x));
      const newHeight = Math.max(200, resizeStartSize.height + (e.clientY - resizeStartPos.y));
      
      setWebcamSize({
        width: newWidth,
        height: newHeight
      });
    }
  };

  // Start resize operation
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ width: webcamSize.width, height: webcamSize.height });
    if (dragRef.current) {
      dragRef.current.classList.add('resizing');
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    if (dragRef.current) {
      dragRef.current.classList.remove('resizing');
    }
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleToggleWebcamSidebar = async () => {
    if (!isWebcamSidebarVisible) {
      await startLocalStream(); 
      setIsWebcamSidebarVisible(true);
    } else {
      stopLocalStream(); // This will also close peer connections via WebRTCContext
      setIsWebcamSidebarVisible(false);
    }
  };

  // Initialize WebRTC once local stream is available and feature is enabled
  useEffect(() => {
    if (isWebcamSidebarVisible && localStream) {
      console.log('[PlayerPage] Webcam sidebar visible and local stream active, initializing WebRTC.');
      initializeWebRTC();
    }
  }, [isWebcamSidebarVisible, localStream, initializeWebRTC]);

  // Avatar Update Handler for Player
  const handleAvatarUpdatePlayer = useCallback(async (avatarSvg: string, pidToUse: string) => {
    console.log('[PlayerPage] handleAvatarUpdatePlayer called:', {
      hasRoomCode: !!roomCode,
      pidToUse: pidToUse,
      avatarLength: avatarSvg?.length,
      timestamp: new Date().toISOString()
    });

    if (!roomCode || !pidToUse) {
      console.error('[PlayerPage] Cannot update avatar - missing required data:', {
        roomCode,
        pidToUse,
        timestamp: new Date().toISOString()
      });
      toast.error(t('avatar.updateErrorMissingData', language));
      return;
    }
    
    try {
      console.log('[PlayerPage] Updating avatar in localStorage for ID:', {
        persistentId: pidToUse,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(`avatar_${pidToUse}`, avatarSvg);
      
      let retries = 0;
      const maxRetries = 3;
      let lastError: any = null;

      while (retries < maxRetries) {
        try {
          console.log(`[PlayerPage] Attempting avatar update to server (attempt ${retries + 1}):`, {
            roomCode,
            persistentPlayerIdToUpdate: pidToUse,
            avatarLength: avatarSvg?.length,
            timestamp: new Date().toISOString()
          });
          
          await socketService.updateAvatar(roomCode, pidToUse, avatarSvg);
          
          console.log('[PlayerPage] Avatar update successful:', {
            roomCode,
            updatedPersistentPlayerId: pidToUse,
            timestamp: new Date().toISOString()
          });
          
          toast.success(t('avatar.updated', language));
          setShowAvatarCreatorPlayer(false); // Close modal
          return; 
        } catch (error) {
          lastError = error;
          retries++;
          if (retries < maxRetries) {
            console.warn('[PlayerPage] Avatar update attempt failed, retrying...', {
              attempt: retries,
              error,
              timestamp: new Date().toISOString()
            });
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          }
        }
      }
      throw lastError;
    } catch (error) {
      console.error('[PlayerPage] Error updating avatar:', {
        error,
        roomCode,
        persistentPlayerIdAttempted: pidToUse,
        avatarLength: avatarSvg?.length,
        timestamp: new Date().toISOString()
      });
      toast.error(t('avatar.updateError', language));
    }
  }, [roomCode, language, t]);

  if (!roomCode) {
    console.log('[Player] No room code found, redirecting to home');
    navigate('/');
    return null;
  }

  // Show loading overlay if trying to connect or reconnect
  if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
    return (
      <LoadingOverlay 
        isVisible={true} 
        message={connectionStatus === 'connecting' ? t('connection.connecting', language) : t('connection.reconnecting', language)} 
      />
    );
  }

  // Show error if connection failed completely
  if (connectionStatus === 'reconnect_failed' || connectionStatus === 'error') {
    return (
      <div className="container text-center mt-5">
        <div className="alert alert-danger">
          <h4>{t('playerPage.connectionError', language)}</h4>
          <p>{t('playerPage.couldNotConnect', language)}</p>
          <button className="btn btn-primary mt-3" onClick={() => window.location.reload()}>
            {t('playerPage.refreshPage', language)}
          </button>
        </div>
      </div>
    );
  }

  if (isRoomLoading && (players.length === 0 || connectionStatus !== 'connected')) 
    return <LoadingOverlay isVisible={true} />;
  
  if (errorMsg) 
    return <div className="alert alert-danger">{errorMsg}</div>;
  
  // If game is concluded AND recap data is NOT YET available, show waiting message.
  // This covers the brief period after game_over_pending_recap and before game_recap is received.
  if (isGameConcluded && !gameRecapData) {
    return (
      <div className="container text-center mt-5">
        <div className="card p-5">
          <h2 className="h4 mb-3">{t('playerPage.gameOver', language)}</h2>
          <p>{t('playerPage.waitingForRecap', language)}</p>
          <div className="spinner-border text-primary mx-auto mt-3" role="status">
            <span className="visually-hidden">{t('loading', language)}</span>
          </div>
          <button className="btn btn-outline-secondary mt-4" onClick={() => navigate('/')}>{t('playerPage.backToHome', language)}</button>
        </div>
      </div>
    );
  }
  
  // Enhanced player detection with multiple checks but minimal logging
  const currentPlayerInRoom = players.some(p => {
    const socketMatch = p.id === socketService.getSocketId();
    const persistentIdMatch = p.persistentPlayerId === persistentPlayerId;
    const nameMatch = p.name === playerName; // Add name match as a fallback
    const isMatch = socketMatch || persistentIdMatch || (nameMatch && connectionStatus === 'connected');
    
    // We don't need to log this every time, as it happens repeatedly in polling
    // Only log the first match we find and nothing after that
    if (isMatch && !playerMatchLoggedRef.current) {
      playerMatchLoggedRef.current = true;
      console.log('[Player] Player found in room with matches:', {
        playerName,
        playerInRoom: p.name,
        socketMatch,
        persistentIdMatch,
        nameMatch
      });
    }
    
    return isMatch;
  }) || (receivedGameState && connectionStatus === 'connected' && !!roomCode && !!playerName);
  
  // Enhanced player detection with comprehensive logging
  if (!currentPlayerInRoom) {
    // Add additional debug information to help diagnose player detection issues
    console.log('[Player] DEBUG - Player detection failed. Current players list:', players);
    console.log('[Player] DEBUG - Looking for socket ID:', socketService.getSocketId());
    console.log('[Player] DEBUG - Looking for persistent ID:', persistentPlayerId);
    console.log('[Player] DEBUG - Player IDs in room:', players.map(p => ({ socketId: p.id, persistentId: p.persistentPlayerId, name: p.name })));
    
    // Temporary workaround: If we have connection, roomCode, and players list is not empty,
    // proceed anyway to avoid the loading screen issue
    if (connectionStatus === 'connected' && roomCode && playerName && players.length > 0) {
      console.log('[Player] Connected with valid session data but not found in player list. Proceeding anyway.');
      // Continue rendering the player view instead of showing loading screen
    } else {
      console.log('[Player] Current player not found in room. Details:', {
        socketId: socketService.getSocketId(),
        persistentPlayerId,
        playerName,
        playersInRoom: players.map(p => ({ id: p.id, name: p.name, persistentId: p.persistentPlayerId })),
        connectionStatus
      });
      
      // If we're connected but player isn't found, try rejoining
      if (connectionStatus === 'connected' && roomCode && playerName) {
        console.log('[Player] Connected but not in player list. Attempting to rejoin room:', roomCode);
        socketService.rejoinRoom(roomCode, false);
        socketService.requestPlayers(roomCode);
      }
      
      return (
        <div className="container text-center mt-5">
          <h2>{t('playerPage.loadingPlayerView', language)}</h2>
          <p>{t('playerPage.waitingToJoinRoom', language)}</p>
          
          <div className="alert alert-info mb-3">
            <p><strong>{t('playerPage.connectionIssue', language)}</strong></p>
            <p className="mb-0">
              <small>Socket ID: {socketService.getSocketId() || 'None'}</small><br/>
              <small>Player ID: {persistentPlayerId?.substring(0, 12) || 'None'}...</small><br/>
              <small>Connection: {connectionStatus}</small>
            </p>
          </div>
          
          <div className="spinner-border text-primary mx-auto mt-2 mb-3" role="status">
            <span className="visually-hidden">{t('loading', language)}</span>
          </div>
          
          <div className="d-grid gap-2 col-md-6 mx-auto">
            <button className="btn btn-primary" onClick={() => {
              if (roomCode) {
                console.log('[Player] Manual rejoin attempt for room:', roomCode);
                socketService.rejoinRoom(roomCode, false);
                socketService.requestPlayers(roomCode);
                setTimeout(() => window.location.reload(), 1000);
              } else {
                window.location.reload();
              }
            }}>
              {t('playerPage.tryReconnecting', language)}
            </button>
            <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>
              {t('playerPage.backToHome', language)}
            </button>
          </div>
        </div>
      );
    }
  }
  
  // Special case for spectators
  if (amISpectator) {
    console.log('[Player] User is a spectator, should redirect to spectator view');
    navigate('/spectator');
    return <LoadingOverlay isVisible={true} message={t('playerPage.redirectingToSpectator', language)} />;
  }

  // If preview mode is active, show the PreviewOverlayV2, respecting local close state for community voting
  if (previewMode.isActive && !(isCommunityVotingMode && playerOverlayLocallyClosed)) {
    return (
      <PreviewOverlayV2
        onFocus={() => {}}
        onClose={() => {
          if (isCommunityVotingMode) {
            setPlayerOverlayLocallyClosed(true);
          } else {
            console.log('[PlayerPage] onClose called for PreviewOverlay in non-community mode.');
          }
        }}
        isGameMaster={false}
        isCommunityVotingMode={isCommunityVotingMode}
        onVote={(answerPersistentPlayerId, vote) => {
          if (roomCode && currentQuestion) {
            socketService.emit('submit_vote', { roomCode, answerId: answerPersistentPlayerId, vote });
          }
        }}
        onShowAnswer={() => {
          if (roomCode && currentQuestion) {
            socketService.emit('show_answer', { roomCode, questionId: currentQuestion.id });
          }
        }}
      />
    );
  }

  // If recap data is available, show recap modal. This takes precedence over game view.
  if (gameRecapData && roomCode && hideRecap) {
    return (
      <RecapModal
        show={!!gameRecapData}
        onHide={() => hideRecap()}
        recap={gameRecapData}
        selectedRoundIndex={recapSelectedRoundIndex ?? 0}
        isControllable={false}
        activeTabKey={recapSelectedTabKey}
      />
    );
  }

  // Helper: render controls for DrawingBoard
  const renderDrawingBoardControls = () => {
    const handleClearCanvas = () => {
      if (clear) {
        clear(); // Clear the canvas locally
      }
      // Send update to server that canvas is cleared
      if (roomCode && connectionStatus === 'connected' && !submittedAnswerLocal && !hasSubmittedToServer) {
        const emptyState = '{"objects":[]}';
        socketService.updateBoard(roomCode, emptyState);
      }
      setCanvasKey(prev => prev + 1); // Reinstate to remount DrawingBoard and reset its internal state
    };

    return (
      <div className="d-flex align-items-center justify-content-end gap-3 w-100">
        <button
          className="btn btn-outline-light"
          onClick={handleClearCanvas}
          disabled={submittedAnswerLocal || hasSubmittedToServer || amISpectator || connectionStatus !== 'connected'}
          style={{ backgroundColor: '#8B4513', borderColor: '#8B4513', color: 'white', minWidth: 120 }}
        >
          {t('playerPage.clearCanvas', language)}
        </button>
        {(submittedAnswerLocal || hasSubmittedToServer) && socketService.getSocketId() && (
          <div style={{ minWidth: 180 }}>
            <ReviewNotification playerId={socketService.getSocketId()!} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="vh-100 player-page-layout position-relative">
      <div 
        className="main-content-area p-0" 
        style={{ 
          height: '100vh', 
          overflowY: 'auto',
          width: '100%'
        }}
      >
        <SettingsControl />
        <div className="d-flex gap-2 position-fixed top-0 start-0 m-2" style={{zIndex: 2000}}>
          <button 
            className={`btn btn-sm ${isWebcamSidebarVisible ? 'btn-info' : 'btn-outline-info'}`}
            onClick={handleToggleWebcamSidebar}
            title={isWebcamSidebarVisible ? t('webcam.hide', language) : t('webcam.show', language)}
          >
            <i className={`bi ${isWebcamSidebarVisible ? 'bi-camera-video-off' : 'bi-camera-video'}`}></i>
          </button>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => setShowAvatarCreatorPlayer(true)}
            title={t('avatar.change', language)}
            disabled={!persistentPlayerId}
          >
            <i className="bi bi-person-circle"></i>
          </button>
        </div>

        <div className="container py-4">
          <LoadingOverlay isVisible={isLoading && (players.length === 0 || !receivedGameState)} />
          <ConnectionStatus showDetails={true} />
          {errorMsg && (
            <div className="alert alert-danger">{errorMsg}</div>
          )}
          {connectionStatus === 'disconnected' && (
            <div className="alert alert-warning">
              <strong>{t('playerPage.disconnectedFromServer', language)}</strong> {t('playerPage.attemptingReconnect', language)}
            </div>
          )}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="hideLobbyCodeCheckbox"
              checked={hideLobbyCode}
              onChange={e => {
                setHideLobbyCode(e.target.checked);
                sessionStorage.setItem('hideLobbyCode', e.target.checked ? 'true' : 'false');
              }}
            />
            <label className="form-check-label" htmlFor="hideLobbyCodeCheckbox">
              {t('joinGame.hideLobbyCode', language) || 'Hide Lobby Code'}
            </label>
          </div>
          <div className="row g-3">
            <div className="col-12 col-md-8">
              {!gameStarted ? (
                <div className="card p-4 text-center">
                  <h2 className="h4 mb-3">{t('playerPage.waitingForGM', language)}</h2>
                  <p>{t('playerPage.getReady', language)}</p>
                  <div className="spinner-border text-primary mx-auto mt-3" role="status">
                    <span className="visually-hidden">{t('loading', language)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div style={{ flexGrow: 1, marginRight: '1rem' }}>
                      <QuestionCard
                        question={currentQuestion}
                        timeRemaining={timeRemaining}
                        onSubmit={handleAnswerSubmit}
                        submitted={submittedAnswerLocal || hasSubmittedToServer}
                      />
                    </div>
                    {timeLimit !== null && timeLimit < 99999 && (
                      <Timer isActive={isTimerRunning} showSeconds={true} />
                    )}
                  </div>
                  
                  <DrawingBoard
                    key={canvasKey}
                    onUpdate={handleBoardUpdate}
                    disabled={submittedAnswerLocal || hasSubmittedToServer || amISpectator || connectionStatus !== 'connected'}
                  />
                  
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder={t('answerInput.placeholder', language)}
                      value={answer}
                      onChange={handleAnswerChange}
                      disabled={submittedAnswerLocal || hasSubmittedToServer || !gameStarted || !currentQuestion || amISpectator || connectionStatus !== 'connected'}
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => handleAnswerSubmit(answer)}
                      disabled={submittedAnswerLocal || hasSubmittedToServer || !gameStarted || !currentQuestion || amISpectator || connectionStatus !== 'connected'}
                    >
                      {t('playerPage.submitAnswer', language)}
                    </button>
                  </div>
                  
                  {(submittedAnswerLocal || hasSubmittedToServer) && !currentQuestion?.answer && (
                    <div className="alert alert-info mt-3">
                      {t('playerPage.answerSubmitted', language)}
                    </div>
                  )}
                  {connectionStatus !== 'connected' && (
                    <div className="alert alert-warning mt-3">
                      {t('playerPage.disconnected', language)}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="col-12 col-md-4">
              <RoomCode hideLobbyCode={hideLobbyCode} />
              <PlayerList title={t('playerPage.otherPlayers', language)} />
            </div>
          </div>
        </div>
      </div>

      {isWebcamSidebarVisible && (
        <div 
          ref={dragRef}
          className="webcam-sidebar text-light p-0 draggable-webcam-container" 
          style={{ 
            position: 'absolute',
            top: `${webcamPosition.y}px`,
            left: `${webcamPosition.x}px`,
            width: `${webcamSize.width}px`,
            height: `${webcamSize.height}px`,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'none',
            zIndex: 1500,
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            resize: 'both',
            overflow: 'hidden'
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="webcam-handle" title="Drag to move"></div>
          <div className="p-2" style={{ flex: 1, overflow: 'hidden' }}>
            <WebcamDisplay />
          </div>
          <div 
            className="resize-handle"
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '20px',
              height: '20px',
              cursor: 'nwse-resize',
              background: 'transparent',
              zIndex: 1600,
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{
              position: 'absolute',
              right: '5px',
              bottom: '5px',
              width: '10px',
              height: '10px',
              borderRight: '2px solid rgba(255,255,255,0.7)',
              borderBottom: '2px solid rgba(255,255,255,0.7)',
              transition: 'all 0.2s ease'
            }}></div>
          </div>
        </div>
      )}
      {showAvatarCreatorPlayer && persistentPlayerId && (
        <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('avatar.create', language)}</h5>
                <button type="button" className="btn-close" onClick={() => setShowAvatarCreatorPlayer(false)}></button>
              </div>
              <div className="modal-body">
                <AvatarCreator
                  onSave={(avatarSvgFromCreator) => {
                    if (persistentPlayerId) {
                      handleAvatarUpdatePlayer(avatarSvgFromCreator, persistentPlayerId);
                    } else {
                      console.error("[PlayerPage] Cannot call handleAvatarUpdatePlayer: persistentPlayerId is missing.");
                      toast.error(t('avatar.updateErrorMissingData', language));
                    }
                  }}
                  onCancel={() => setShowAvatarCreatorPlayer(false)}
                  persistentPlayerId={persistentPlayerId}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player; 