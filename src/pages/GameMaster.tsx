import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlayV2 from '../components/shared/PreviewOverlayV2';
import QuestionSelector from '../components/game-master/QuestionSelector';
import QuestionDisplay from '../components/game-master/QuestionDisplay';
import GameControls from '../components/game-master/GameControls';
import AnswerList from '../components/game-master/AnswerList';
import Timer from '../components/shared/Timer';
import RoomCode from '../components/shared/RoomCode';
import { useGame } from '../contexts/GameContext';
import { useRoom } from '../contexts/RoomContext';
import { useAudio } from '../contexts/AudioContext';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n';
import RoomSettings from '../components/game-master/RoomSettings';
import RecapModal from '../components/shared/RecapModal';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '../components/shared/LoadingOverlay';
import { ConnectionStatus } from '../components/shared/ConnectionStatus';
import type { Question } from '../contexts/GameContext';
import type { Player } from '../types/game';
import SettingsControl from '../components/shared/SettingsControl';
import { useWebRTC } from '../contexts/WebRTCContext';
import WebcamDisplay from '../components/shared/WebcamDisplay';
import DrawingBoard from '../components/player/DrawingBoard';
import AnswerInput from '../components/player/AnswerInput';
import AvatarCreator from '../components/shared/AvatarCreator';
import GameMasterQuestionHistoryModal from '../components/shared/GameMasterQuestionHistoryModal';

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);
  const [showNextQuestionConfirm, setShowNextQuestionConfirm] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined);
  const [boardTransforms, setBoardTransforms] = useState<{[playerId: string]: {scale: number, x: number, y: number}}>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [customTimeLimit, setCustomTimeLimit] = useState<number | null>(null);
  const [timeLimit, setTimeLimit] = useState(99999);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [hasRestoredVisibilityOnConnect, setHasRestoredVisibilityOnConnect] = useState(false);
  const [isStreamerMode, setIsStreamerMode] = useState(false);
  const {
    localStream,
    remoteStreams,
    isWebcamActive,
    isMicrophoneActive,
    toggleWebcam,
    toggleMicrophone,
    startLocalStream,
    stopLocalStream,
    initializeWebRTC,
    startWebcamWithRetry,
    peerNames,
    remotePeerStates,
    availableCameras,
    selectedCameraId,
    refreshDeviceList,
    selectCamera,
    availableMicrophones,
    selectedMicrophoneId,
    selectMicrophone,
    connectionStates,
    errors,
    clearErrors,
    getConnectionStats
  } = useWebRTC();
  const [isWebcamSidebarVisible, setIsWebcamSidebarVisible] = useState(false);
  const [webcamPosition, setWebcamPosition] = useState({ x: 20, y: 50 });
  const [webcamSize, setWebcamSize] = useState({ width: 450, height: 400 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const isResizingRef = useRef(false);
  const [isCommunityVotingMode, setIsCommunityVotingMode] = useState(false);
  const [gmTextAnswer, setGmTextAnswer] = useState('');
  const [gmSubmittedCommunityAnswerForRound, setGmSubmittedCommunityAnswerForRound] = useState(false);
  const [gmOverlayLocallyClosed, setGmOverlayLocallyClosed] = useState(false);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  const {
    roomCode,
    isLoading: isRoomLoading,
    setIsLoading: setIsRoomLoading,
    createRoom,
    players,
    setRoomCode,
    kickPlayer,
    connectionStatus,
    isGameMaster,
    persistentPlayerId
  } = useRoom();

  const {
    gameStarted,
    currentQuestion,
    playerBoards,
    visibleBoards,
    previewMode,
    questions,
    setQuestions,
    startGame,
    nextQuestion,
    evaluateAnswer,
    restartGame,
    endRoundEarly,
    toggleBoardVisibility,
    focusSubmission,
    timeLimit: gameTimeLimit,
    timeRemaining,
    isTimerRunning,
    isGameConcluded,
    gmShowRecapToAll,
    gmEndGameRequest,
    gameRecapData,
    recapSelectedRoundIndex,
    recapSelectedTabKey,
    gmNavigateRecapRound,
    gmNavigateRecapTab,
    hideRecap,
    allAnswersThisRound,
    evaluatedAnswers,
    previewOverlayVersion,
    setPreviewOverlayVersion,
    players: gamePlayers,
    currentVotes: gameContextCurrentVotes
  } = useGame();

  const {
    playBackgroundMusic
  } = useAudio();

  // Determine if GM submitted their answer for the current round in community mode
  const { currentQuestionIndex: gameCurrentQuestionIndex, allAnswersThisRound: gameAllAnswersThisRound } = useGame();
  const gmHasSubmittedCommunityAnswer = useMemo(() => {
    if (!isCommunityVotingMode || !persistentPlayerId || !gameAllAnswersThisRound) return false;
    return !!gameAllAnswersThisRound[persistentPlayerId];
  }, [isCommunityVotingMode, persistentPlayerId, gameAllAnswersThisRound, gameCurrentQuestionIndex]);

  // Reset gmSubmittedCommunityAnswerForRound when the question changes or mode toggles
  // Also reset GM text answer and overlay closed state when question changes
  useEffect(() => {
    if (gameStarted) { // Only reset if game has started and question truly changes
      setGmTextAnswer('');
      setGmSubmittedCommunityAnswerForRound(false);
      setGmOverlayLocallyClosed(false);
      // Clear the GM's board data on the server
      if (roomCode && connectionStatus === 'connected') {
        socketService.emit('clear_game_master_board', { roomCode });
      }
      // The DrawingBoard will be reset by its key prop changing
    }
  }, [gameCurrentQuestionIndex, gameStarted, roomCode, connectionStatus]);

  // Also reset when game restarts
  useEffect(() => {
    if (!gameStarted) {
      setGmTextAnswer('');
      setGmSubmittedCommunityAnswerForRound(false);
      setGmOverlayLocallyClosed(false);
      // Clear the GM's board data on the server when game restarts
      if (roomCode && connectionStatus === 'connected') {
        socketService.emit('clear_game_master_board', { roomCode });
      }
    }
  }, [gameStarted, roomCode, connectionStatus]);

  // This effect for syncing with server state for GM submission might be redundant if we set locally and trust the submission went through,
  // OR it acts as a confirmation. Let's keep it for now.
  useEffect(() => {
    if (isCommunityVotingMode && persistentPlayerId && gameAllAnswersThisRound?.[persistentPlayerId]) {
      setGmSubmittedCommunityAnswerForRound(true);
    }
  }, [isCommunityVotingMode, persistentPlayerId, gameAllAnswersThisRound]);

  // Listen for server ack of GM's community answer submission
  useEffect(() => {
    if (!isCommunityVotingMode || !currentQuestion) return;

    const handleGmAnswerAccepted = (data: { questionId: string }) => {
      if (data.questionId === currentQuestion.id) {
        console.log("[GameMaster] Received gm_community_answer_accepted from server for current question. Disabling further input.");
        setGmSubmittedCommunityAnswerForRound(true);
      }
    };

    socketService.on('gm_community_answer_accepted', handleGmAnswerAccepted);
    return () => {
      socketService.off('gm_community_answer_accepted', handleGmAnswerAccepted);
    };
  }, [isCommunityVotingMode, currentQuestion, setGmSubmittedCommunityAnswerForRound]);

  useEffect(() => {
    // Listen for kick errors
    socketService.on('kick_error', (error: any) => {
      console.log('[GameMaster] Received kick error:', error);
      toast.error(error.message || 'Failed to kick player');
    });

    return () => {
      socketService.off('kick_error');
    };
  }, []);

  const handleToggleCommunityVotingMode = useCallback(() => {
    setIsCommunityVotingMode(prev => {
      const newMode = !prev;
      if (roomCode && connectionStatus === 'connected') {
        socketService.emit('toggle_community_voting', { roomCode, isCommunityVotingMode: newMode });
      }
      setGmTextAnswer('');
      return newMode;
    });
  }, [roomCode, connectionStatus]);

  const handleGmAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGmTextAnswer(e.target.value);
  };

  const handleGmSubmitAnswer = useCallback(async () => {
    if (!roomCode || !currentQuestion || !isCommunityVotingMode || !persistentPlayerId) return;

    // In community voting mode, GM submits answer (text part).
    // Drawing part is handled by DrawingBoard emitting `update_game_master_board`.
    // The server will combine these.

    // For `hasDrawing`, we can infer it if the GM has a drawing board active.
    // However, the actual drawing data resides on the server via `gameMasterBoardData`.
    // So, we can optimistically say `hasDrawing: true` if GM *could* have drawn.
    // The server can verify against `gameMasterBoardData`.
    const gmHasDrawing = true; // Assume GM's board is active and might contain a drawing.

    try {
      // Send GM's text answer. Server will associate it with GM's drawing for the round.
      await socketService.submitAnswer(roomCode, gmTextAnswer || '-', gmHasDrawing, null);
      toast.success('Your answer submitted!');
      setGmSubmittedCommunityAnswerForRound(true); // Set local submission state for GM immediately
    } catch (error) {
      toast.error('Failed to submit your answer.');
      console.error('[GameMaster] Error submitting GM answer:', error);
    }
  }, [roomCode, currentQuestion, isCommunityVotingMode, gmTextAnswer, persistentPlayerId]);

  const handleKickPlayer = useCallback((playerId: string) => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot kick player: No room code');
      toast.error("Room code not found. Cannot kick player.");
      return;
    }
    if (!kickPlayer) {
      console.error('[GameMaster] Cannot kick player: No kick function');
      toast.error("Kick player function not available.");
      return;
    }
    
    // Log the player being kicked and the game master's ID
    console.log(`[GameMaster] Kick request details:`, {
      playerIdToKick: playerId,
      gameMasterId: persistentPlayerId,
      roomCode
    });
    
    // Find player by socket ID (not persistentPlayerId)
    const playerToKick = gamePlayers.find(p => p.id === playerId);
    
    if (!playerToKick) {
      console.error(`[GameMaster] Cannot find player with ID ${playerId}`);
      toast.error("Player not found. They may have already left the game.");
      return;
    }
    
    console.log(`[GameMaster] Kicking player ${playerToKick.name} (${playerId}) from room ${roomCode}`);
    
    try {
      // Send the kick request - the server will handle validation
      kickPlayer(playerId);
      toast.info(`Kicking ${playerToKick.name}...`);
    } catch (error) {
      console.error('[GameMaster] Error kicking player:', error);
      toast.error(`Failed to kick ${playerToKick.name}. Please try again.`);
    }
  }, [roomCode, kickPlayer, gamePlayers, persistentPlayerId]);

  const activePlayerCount = useMemo(() => 
    gamePlayers.filter(p => p.isActive && !p.isSpectator).length,
  [gamePlayers]);

  const allAnswersSubmitted = useMemo(() => 
    activePlayerCount > 0 && Object.keys(allAnswersThisRound).length === activePlayerCount,
  [allAnswersThisRound, activePlayerCount]);

  const allSubmittedAnswersEvaluated = useMemo(() => 
    Object.keys(allAnswersThisRound).length > 0 && 
    Object.keys(allAnswersThisRound).every(playerId => evaluatedAnswers.hasOwnProperty(playerId)),
  [allAnswersThisRound, evaluatedAnswers]);

  const canProceedToNextQuestion = useMemo(() => 
    allAnswersSubmitted && allSubmittedAnswersEvaluated,
  [allAnswersSubmitted, allSubmittedAnswersEvaluated]);

  // Always attempt to connect to socket server on component mount
  useEffect(() => {
    console.log('[GameMaster] Attempting to establish socket connection...');
    
    // Set GameMaster authentication details
    socketService.setPlayerDetails('GameMaster');
    socketService.setGMConnectionDetails(true);
    
    // Always attempt to connect, even if getConnectionState reports a connection
    // This ensures we have a fresh connection attempt whenever this component mounts
    socketService.connect()
      .then(socket => {
        console.log('[GameMaster] Socket connection successful:', socket?.id);
      })
      .catch(error => {
        console.error('[GameMaster] Socket connection failed:', error);
        toast.error('Failed to connect to game server. Please refresh and try again.');
      });
    
    // Set up error handler
    socketService.on('connect_error', (error: Error) => {
      console.error('[GameMaster] Socket connection error:', error);
      toast.error(`Connection error: ${error.message}`);
    });
    
    return () => {
      socketService.off('connect_error');
      // We don't disconnect here as other components might still need the connection
    };
  }, [navigate]);

  // Reset local overlay closed state when previewMode becomes inactive or mode changes
  useEffect(() => {
    if (!previewMode.isActive || !isCommunityVotingMode) {
      setGmOverlayLocallyClosed(false);
    }
  }, [previewMode.isActive, isCommunityVotingMode]);

  useEffect(() => {
    playBackgroundMusic();
  }, [playBackgroundMusic]);

  // Request game state update upon reconnection if we already have a roomCode
  useEffect(() => {
    if (connectionStatus === 'connected' && roomCode) {
      console.log('[GameMaster] Connected with room code, requesting game state update...');
      
      // Join the room first if reconnecting
      if (socketService.getConnectionState() === 'connected' && !isRoomLoading) {
        console.log('[GameMaster] Attempting to rejoin room after reconnection:', roomCode);
        socketService.rejoinRoom(roomCode, true); // true = isGameMaster
      }
      
      // Request game state
      socketService.requestGameState(roomCode);
      
      // Also explicitly request current player list
      socketService.requestPlayers(roomCode);
    }
  }, [connectionStatus, roomCode, isRoomLoading]);

  // Add a special effect to handle player board visibility after reconnection
  useEffect(() => {
    if (connectionStatus === 'connected') {
      if (!hasRestoredVisibilityOnConnect && roomCode && playerBoards.length > 0 && gamePlayers.length > 0) {
        // Only attempt to restore if visibleBoards is currently empty,
        // indicating a possible state loss or initial load after reconnect.
        if (visibleBoards.size === 0) {
          const activeBoardIds = playerBoards
            .filter(board => {
              const player = gamePlayers.find(p => p.id === board.playerId);
              // Ensure player is active and not a spectator
              return player && player.isActive && !player.isSpectator;
            })
            .map(board => board.playerId);

          if (activeBoardIds.length > 0) {
            console.log('[GameMaster] Connection established: Restoring visibility for active boards as visibleBoards was empty.');
            toggleBoardVisibility(new Set(activeBoardIds));
          }
        }
        setHasRestoredVisibilityOnConnect(true);
      }
    } else {
      // Reset the flag if we disconnect, so it can run again on next connection
      setHasRestoredVisibilityOnConnect(false);
    }
  }, [
    connectionStatus, 
    roomCode, 
    playerBoards, 
    gamePlayers, 
    visibleBoards, 
    toggleBoardVisibility, 
    hasRestoredVisibilityOnConnect,
    // Note: setHasRestoredVisibilityOnConnect is not needed in deps as it's a setter
  ]);

  // Explicitly listen for player updates
  useEffect(() => {
    const handlePlayersUpdate = (updatedPlayers: Player[]) => {
      console.log('[GameMaster] Received players_update with', updatedPlayers.length, 'players');
    };

    if (connectionStatus === 'connected') {
      socketService.on('players_update', handlePlayersUpdate);
    }

    return () => {
      socketService.off('players_update', handlePlayersUpdate);
    };
  }, [connectionStatus]);

  const handleCreateRoom = useCallback(() => {
    // Check connection state before trying to create a room
    if (connectionStatus !== 'connected') {
      toast.error('Cannot create room: You are disconnected from the server. Please wait for reconnection.');
      return;
    }

    const newRoomCode = inputRoomCode.trim() || Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log('[GameMaster] Attempting to create room:', newRoomCode);
    
    setIsRoomLoading(true);
    createRoom(newRoomCode, isStreamerMode);
  }, [createRoom, inputRoomCode, setIsRoomLoading, connectionStatus, isStreamerMode]);

  useEffect(() => {
    console.log('[GameMaster] Game state changed:', {
      started: gameStarted,
      hasCurrentQuestion: !!currentQuestion,
      questionIndex: currentQuestion?.id,
      timeRemaining,
      playerCount: players.length,
      gameRecapAvailable: !!gameRecapData,
      timestamp: new Date().toISOString()
    });
  }, [gameStarted, currentQuestion, timeRemaining, players, gameRecapData]);

  const handleStartGame = async () => {
    if (!roomCode) {
      console.error('[GameMaster] Cannot start game - No room code found');
      toast.error('Room not found. Please create a room first.');
      return;
    }
    if (!questions || questions.length === 0) {
      console.error('[GameMaster] Cannot start game - No questions selected');
      toast.error('Please select questions before starting the game');
      return;
    }
    if (connectionStatus !== 'connected') {
      toast.error('Cannot start game: You are disconnected from the server. Please wait for reconnection.');
      return;
    }
    try {
      const effectiveTimeLimit = customTimeLimit === null || customTimeLimit === 0 ? 99999 : customTimeLimit;
      console.log('[GameMaster] Starting game:', {
        roomCode,
        questionCount: questions.length,
        timeLimit: effectiveTimeLimit,
        socketId: socketService.getSocketId()
      });
      await startGame(roomCode, questions, effectiveTimeLimit);
      console.log('[GameMaster] Game start request sent successfully');
    } catch (error) {
      console.error('[GameMaster] Failed to start game:', error);
      toast.error('Failed to start game. Please try again.');
    }
  };

  const handleNextQuestion = async () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot proceed: You are disconnected from the server. Please wait for reconnection.');
    }
    setShowNextQuestionConfirm(true);
  };

  const confirmNextQuestion = async () => {
    try {
      await nextQuestion(roomCode);
      setShowNextQuestionConfirm(false);
    } catch (error) {
      console.error('[GameMaster] Failed to move to next question:', error);
      toast.error('Failed to proceed to next question.');
    }
  };

  const cancelNextQuestion = () => {
    setShowNextQuestionConfirm(false);
  };

  const handleStartPreview = () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot start preview: You are disconnected from the server. Please wait for reconnection.');
    }
    socketService.startPreviewMode(roomCode);
  };

  const handleStopPreview = () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot stop preview: You are disconnected from the server. Please wait for reconnection.');
    }
    socketService.stopPreviewMode(roomCode);
  };

  const handleEvaluateAnswer = async (playerId: string, isCorrect: boolean) => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot evaluate answer: You are disconnected from the server. Please wait for reconnection.');
    }
    try {
      await evaluateAnswer(roomCode, playerId, isCorrect);
    } catch (error) {
      console.error('[GameMaster] Failed to evaluate answer:', error);
      toast.error('Failed to evaluate answer.');
    }
  };

  const handleEndGameRequest = async () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot end game: You are disconnected from the server. Please wait for reconnection.');
    }
    try {
      gmEndGameRequest(roomCode);
    } catch (error) {
      console.error('[GameMaster] Failed to request end game:', error);
      toast.error('Failed to request end game.');
    }
  };

  const handleShowRecapButtonClick = () => {
    if (!roomCode) return toast.error('Room code not found.');
    if (!isGameConcluded) {
      toast.warn('Game must be concluded before showing recap.');
      return;
    }
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot show recap: You are disconnected from the server. Please wait for reconnection.');
    }
    gmShowRecapToAll(roomCode);
    toast.info('Broadcasting game recap to all players.');
  };

  const handleRestartGame = async () => {
    if (!roomCode) return toast.error("No room code found to restart the game.");
    if (connectionStatus !== 'connected') {
      return toast.error('Cannot restart game: You are disconnected from the server. Please wait for reconnection.');
    }
    setIsRestarting(true);
    try {
      await restartGame(roomCode);
      toast.success("Game is restarting!");
    } catch (error) {
      console.error("[GameMaster] Failed to restart game:", error);
      toast.error("Failed to restart game. Please try again.");
    } finally {
      setIsRestarting(false);
    }
  };

  const handleEndRoundEarlyAction = useCallback(() => {
    if (connectionStatus !== 'connected') {
      toast.error('Cannot end round: You are disconnected from the server. Please wait for reconnection.');
      return;
    }
    setShowEndRoundConfirm(true);
  }, [connectionStatus]);

  const confirmEndRoundEarly = useCallback(() => {
    if (!roomCode) return;
    endRoundEarly(roomCode);
    setShowEndRoundConfirm(false);
  }, [roomCode, endRoundEarly]);

  const handleFocusSubmissionInternal = useCallback((playerId: string) => {
    if (!roomCode) return;
    focusSubmission(roomCode, playerId);
  }, [roomCode, focusSubmission]);

  const handlePlayerSelect = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    toggleBoardVisibility(playerId);
  }, [toggleBoardVisibility]);

  const handleBoardScale = useCallback((playerId: string, scale: number) => {
    setBoardTransforms(prev => ({ ...prev, [playerId]: { ...(prev[playerId] || { scale: 1, x: 0, y: 0 }), scale } }));
  }, []);

  const handleBoardPan = useCallback((playerId: string, dx: number, dy: number) => {
    setBoardTransforms(prev => ({ ...prev, [playerId]: { scale: prev[playerId]?.scale || 1, x: (prev[playerId]?.x || 0) + dx, y: (prev[playerId]?.y || 0) + dy } }));
  }, []);

  const handleBoardReset = useCallback((playerId: string) => {
    setBoardTransforms(prev => ({ ...prev, [playerId]: { scale: 1, x: 0, y: 0 } }));
  }, []);

  const showAllBoards = useCallback(() => {
    const activePlayerBoardIds = gamePlayers
      .filter(p => p.isActive && !p.isSpectator)
      .map(b => b.id);
    toggleBoardVisibility(new Set(activePlayerBoardIds));
  }, [gamePlayers, toggleBoardVisibility]);

  const hideAllBoards = useCallback(() => {
    toggleBoardVisibility(new Set());
  }, [toggleBoardVisibility]);

  useEffect(() => {
    const initialTransforms: {[playerId: string]: {scale: number, x: number, y: number}} = {};
    players.forEach(player => {
      initialTransforms[player.id] = { scale: 1, x: 0, y: 0 };
    });
    setBoardTransforms(initialTransforms);
  }, [players]);

  useEffect(() => {
    if (!roomCode) {
      const storedRoomCode = sessionStorage.getItem('roomCode');
      if (storedRoomCode) {
        setRoomCode(storedRoomCode);
      }
    }
  }, [roomCode, setRoomCode]);

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

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    if (dragRef.current) {
      dragRef.current.classList.remove('resizing');
    }
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
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

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleToggleWebcamSidebar = async () => {
    if (!isWebcamSidebarVisible) {
      try {
        console.log('[GameMaster] Starting webcam...');
        await startWebcamWithRetry();
        setIsWebcamSidebarVisible(true);
        console.log('[GameMaster] Webcam started successfully');
      } catch (error) {
        console.error('[GameMaster] Failed to start webcam:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Provide specific error messages based on the error type
        if (errorMessage.includes('Room code is required')) {
          toast.error(t('webcam.errorNoRoom', language) || 'Room code is required to start webcam');
        } else if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
          toast.error(t('webcam.errorPermission', language) || 'Camera/microphone permission denied. Please allow access in your browser settings and refresh the page.');
        } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('DevicesNotFoundError')) {
          toast.error(t('webcam.errorNoDevices', language) || 'No camera or microphone found. Please check your devices and try again.');
        } else if (errorMessage.includes('Starting videoinput failed') || errorMessage.includes('Camera and microphone access failed')) {
          toast.warn('Camera access failed, but you may still join with audio only. Check if another application is using your camera.');
        } else if (errorMessage.includes('OverconstrainedError') || errorMessage.includes('NotReadableError')) {
          toast.warn('Camera settings incompatible. Trying with basic settings - you may have reduced video quality.');
        } else {
          toast.error(t('webcam.errorGeneric', language) || `Failed to start webcam: ${errorMessage}`);
        }
        
        // Don't show the sidebar if webcam failed to start
        setIsWebcamSidebarVisible(false);
      }
    } else {
      console.log('[GameMaster] Stopping webcam...');
      stopLocalStream();
      setIsWebcamSidebarVisible(false);
      console.log('[GameMaster] Webcam stopped');
    }
  };

  const handleForceEndVoting = useCallback(() => {
    if (!roomCode || !isCommunityVotingMode || connectionStatus !== 'connected') {
      toast.error('Cannot force end voting: Connection issue or not in community voting mode.');
      return;
    }

    try {
      // Emit event to server to force end voting and evaluate based on current votes
      socketService.emit('force_end_voting', { roomCode });
      toast.info('Forcing end of voting phase. Evaluating answers based on current votes...');
    } catch (error) {
      console.error('[GameMaster] Error forcing end of voting:', error);
      toast.error('Failed to force end voting.');
    }
  }, [roomCode, isCommunityVotingMode, connectionStatus]);

  const handleAvatarUpdate = useCallback(async (avatarSvg: string, pidToUse: string) => {
    console.log('[GameMaster] handleAvatarUpdate called:', {
      hasRoomCode: !!roomCode,
      pidToUse: pidToUse,
      avatarLength: avatarSvg?.length,
      timestamp: new Date().toISOString()
    });

    if (!roomCode || !pidToUse) {
      console.error('[GameMaster] Cannot update avatar - missing required data:', {
        roomCode,
        pidToUse,
        timestamp: new Date().toISOString()
      });
      toast.error(t('avatar.updateErrorMissingData', language)); // Ensure this translation key exists or use a generic one
      return;
    }
    
    try {
      console.log('[GameMaster] Updating avatar in localStorage for ID:', {
        persistentId: pidToUse,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(`avatar_${pidToUse}`, avatarSvg);
      
      let retries = 0;
      const maxRetries = 3;
      let lastError: any = null;

      while (retries < maxRetries) {
        try {
          console.log(`[GameMaster] Attempting avatar update to server (attempt ${retries + 1}):`, {
            roomCode,
            persistentPlayerIdToUpdate: pidToUse,
            avatarLength: avatarSvg?.length,
            timestamp: new Date().toISOString()
          });
          
          await socketService.updateAvatar(roomCode, pidToUse, avatarSvg);
          
          console.log('[GameMaster] Avatar update successful:', {
            roomCode,
            updatedPersistentPlayerId: pidToUse,
            timestamp: new Date().toISOString()
          });
          
          // Removed direct mutation of 'players' array.
          // Rely on server broadcasting 'avatar_updated' event, which Avatar.tsx handles.
          
          toast.success(t('avatar.updated', language));
          setShowAvatarCreator(false);
          return; 
        } catch (error) {
          lastError = error;
          retries++;
          if (retries < maxRetries) {
            console.warn('[GameMaster] Avatar update attempt failed, retrying...', {
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
      console.error('[GameMaster] Error updating avatar:', {
        error,
        roomCode,
        persistentPlayerIdAttempted: pidToUse,
        avatarLength: avatarSvg?.length,
        timestamp: new Date().toISOString()
      });
      toast.error(t('avatar.updateError', language));
    }
  }, [roomCode, language, t, setShowAvatarCreator]);

  // Prepare question history for modal
  const gmQuestionHistory = useMemo(() => {
    // Each question in order, with all player answers for that question
    return questions.map((q, qIdx) => {
      // For each player, find their answer for this question index
      const answers = gamePlayers.map(player => {
        const answerObj = player.answers?.[qIdx];
        return {
          playerName: player.name,
          answer: answerObj?.answer ?? '-',
          isCorrect: answerObj?.isCorrect ?? null,
          submissionOrder: answerObj?.submissionOrder,
          submissionTime: answerObj?.submissionTime,
          submissionTimestamp: answerObj?.timestamp
        };
      });
      return {
        question: q.text,
        subject: q.subject,
        grade: q.grade,
        answers,
      };
    });
  }, [questions, gamePlayers]);

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
          <h4>{t('connection.connectionError', language)}</h4>
          <p>{t('connection.connectionCheckInternet', language)}</p>
          <button className="btn btn-primary mt-3" onClick={() => window.location.reload()}>
            {t('connection.connectionRetry', language)}
          </button>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-6">
            <div className="card p-4 text-center">
              <h3>{t('roomSettings.title', language)}</h3>
              <p>{t('roomSettings.description', language)}</p>
              <div className="form-group mb-3">
                <label htmlFor="roomCodeInput" className="form-label">{t('roomSettings.roomCodeLabel', language)}</label>
                <input
                  type={(document.getElementById('streamerModeCheckbox') as HTMLInputElement)?.checked ? "password" : "text"}
                  id="roomCodeInput"
                  className="form-control"
                  placeholder={t('roomSettings.roomCodePlaceholder', language)}
                  value={inputRoomCode}
                  onChange={e => setInputRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <small className="text-muted">
                  {t('roomSettings.roomCodeHelp', language)}
                </small>
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="streamerModeCheckbox"
                  checked={isStreamerMode}
                  onChange={(e) => {
                    setIsStreamerMode(e.target.checked);
                    // Force input type update when checkbox changes
                    const input = document.getElementById('roomCodeInput') as HTMLInputElement;
                    if (input) {
                      input.type = e.target.checked ? "password" : "text";
                    }
                  }}
                />
                <label className="form-check-label" htmlFor="streamerModeCheckbox">
                  {t('roomSettings.streamerMode', language)}
                </label>
                <small className="d-block text-muted">
                  {t('roomSettings.streamerModeHelp', language)}
                </small>
              </div>
              <button
                className="btn btn-primary btn-lg mt-3"
                onClick={handleCreateRoom}
                disabled={isRoomLoading || connectionStatus !== 'connected'}
              >
                {isRoomLoading ? t('roomSettings.creating', language) : 
                 connectionStatus !== 'connected' ? t('connection.connecting', language) : 
                 t('roomSettings.createRoom', language)}
              </button>
              <button
                className="btn btn-outline-secondary mt-3"
                onClick={() => navigate('/')}
              >
                {t('navigation.home', language)}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!socketService.getConnectionState() || socketService.getConnectionState() === 'connecting') {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <h2>{t('connection.connecting', language)}</h2>
          <div className="spinner-border text-primary mt-3" role="status">
            <span className="visually-hidden">{t('loading', language)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Main component return
  return (
    <div className="vh-100 gamemaster-page-layout position-relative">
      {/* Main Content Area - Full Width */}
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
            title={isWebcamSidebarVisible ? 'Hide Webcams' : 'Show Webcams'}
          >
            <i className={`bi ${isWebcamSidebarVisible ? 'bi-camera-video-off' : 'bi-camera-video'}`}></i>
          </button>

          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => setShowAvatarCreator(true)}
            title={t('avatar.change', language)}
          >
            <i className="bi bi-person-circle"></i>
          </button>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowHistoryModal(true)}
            title="View Question History"
          >
            <i className="bi bi-clock-history"></i>
          </button>
        </div>

        <div className="container-fluid py-4">
          <LoadingOverlay isVisible={isRoomLoading} />
          <ConnectionStatus showDetails={true} />
          
          {showEndRoundConfirm && (
            <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{t('gameControls.endRoundConfirm', language)}</h5>
                    <button type="button" className="btn-close" onClick={() => setShowEndRoundConfirm(false)}></button>
                  </div>
                  <div className="modal-body">
                    <p>{t('gameControls.endRoundWarning', language)}</p>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowEndRoundConfirm(false)}>
                      {t('gameControls.cancel', language)}
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => { roomCode && endRoundEarly(roomCode); setShowEndRoundConfirm(false); }}>
                      {t('gameControls.confirmEndRound', language)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {showNextQuestionConfirm && (
            <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{t('gameControls.nextQuestionConfirm', language) || 'Proceed to Next Question?'}</h5>
                    <button type="button" className="btn-close" onClick={cancelNextQuestion}></button>
                  </div>
                  <div className="modal-body">
                    <p>{t('gameControls.nextQuestionWarning', language) || 'Are you sure you want to proceed to the next question? This will end the current round.'}</p>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={cancelNextQuestion}>
                      {t('gameControls.cancel', language)}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={confirmNextQuestion}>
                      {t('gameControls.confirmNextQuestion', language) || 'Yes, Next Question'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {connectionStatus === 'disconnected' && (
            <div className="alert alert-warning">
              <strong>{t('connection.disconnected', language)}</strong> {t('connection.attempting', language)}
            </div>
          )}
          
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <RoomSettings 
                timeLimit={customTimeLimit} 
                onTimeLimitChange={setCustomTimeLimit} 
                isCommunityVotingMode={isCommunityVotingMode}
                onToggleCommunityVotingMode={handleToggleCommunityVotingMode}
                gameStarted={gameStarted}
              />
              <RoomCode />
              
              {/* Preview button, shown if game started, not in preview, and NOT community voting mode */}
              {gameStarted && !previewMode.isActive && !isCommunityVotingMode && (
                <div className="mb-3">
                  <button 
                    className="btn btn-primary w-100" 
                    onClick={handleStartPreview}
                    disabled={connectionStatus !== 'connected'}
                  >
                    {t('gameControls.startPreview', language)}
                  </button>
                </div>
              )}
              
              {/* PlayerList is always shown for the GM */}
              <PlayerList 
                title={t('players', language)}
                onPlayerSelect={handlePlayerSelect}
                selectedPlayerId={selectedPlayerId}
                isGameMasterView={true}
                onKickPlayer={handleKickPlayer}
                persistentPlayerId={persistentPlayerId || undefined}
              />
              
              <div className="d-grid gap-2 mt-3">
                <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>
                  {t('navigation.leaveGame', language)}
                </button>
                
                {!gameStarted ? (
                  <button 
                    className="btn btn-success" 
                    onClick={handleStartGame}
                    disabled={isConnecting || questions.length === 0 || gamePlayers.filter(p => !p.isSpectator).length < 1 || connectionStatus !== 'connected'}
                    title={
                      isConnecting ? t('connection.connecting', language) :
                      connectionStatus !== 'connected' ? t('connection.disconnected', language) :
                      gamePlayers.filter(p => !p.isSpectator).length < 1 ? t('gameControls.needPlayers', language) :
                      questions.length === 0 ? t('gameControls.needQuestions', language) : ""
                    }
                  >
                    {isConnecting ? t('connection.connecting', language) : 
                     connectionStatus !== 'connected' ? t('connection.connecting', language) :
                     t('gameControls.startGame', language, {
                       players: gamePlayers.filter(p => !p.isSpectator).length,
                       questions: questions.length
                     })}
                  </button>
                ) : (
                  <>
                    <GameControls
                      onStartGame={handleStartGame}
                      onNextQuestion={handleNextQuestion}
                      onRestartGame={handleRestartGame}
                      onEndRoundEarly={handleEndRoundEarlyAction}
                      isRestarting={isRestarting}
                      showEndRoundConfirm={showEndRoundConfirm}
                      onConfirmEndRound={confirmEndRoundEarly}
                      onCancelEndRound={() => setShowEndRoundConfirm(false)}
                    />
                  </>
                )}
              </div>
            </div>
            
            <div className="col-12 col-md-8">
              {!gameStarted ? (
                <QuestionSelector
                  onQuestionsSelected={setQuestions}
                  selectedQuestions={questions}
                  onSelectedQuestionsChange={setQuestions}
                />
              ) : (
                <>
                  <div className="card mb-3">
                    <div className="card-body">
                      <QuestionDisplay question={currentQuestion} isCommunityVotingMode={isCommunityVotingMode} />
                      {gameTimeLimit !== null && gameTimeLimit < 99999 && (
                        <div className="mt-3">
                          <Timer isActive={isTimerRunning} showSeconds={true} />
                        </div>
                      )}
                    </div>
                  </div>

                  {isCommunityVotingMode ? (
                    <div className="card mb-3">
                      <div className="card-header bg-light d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">{t('gameControls.yourBoard', language)}</h5>
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setShowAvatarCreator(true)}
                          title={t('avatar.change', language)}
                        >
                          <i className="bi bi-person-circle me-1"></i>
                          {t('avatar.change', language)}
                        </button>
                      </div>
                      <div className="card-body">
                        <DrawingBoard
                          key={`gm-board-${gameCurrentQuestionIndex}`}
                          onUpdate={(data) => {
                            if (roomCode && connectionStatus === 'connected') {
                              socketService.emit('update_game_master_board', { roomCode, boardData: data.data });
                            }
                          }}
                          disabled={gmSubmittedCommunityAnswerForRound}
                        />
                        {!gmSubmittedCommunityAnswerForRound ? (
                          <div className="mt-3">
                            <AnswerInput 
                              answer={gmTextAnswer} 
                              onAnswerChange={handleGmAnswerChange} 
                              onSubmitAnswer={handleGmSubmitAnswer}
                              controlledDisable={gmSubmittedCommunityAnswerForRound || !gameStarted || !currentQuestion || connectionStatus !== 'connected'}
                            />
                          </div>
                        ) : (
                          <div className="alert alert-info mt-3">
                            {t('playerPage.answerSubmitted', language)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {gameStarted && !isCommunityVotingMode && (
                        <>
                          <AnswerList onEvaluate={handleEvaluateAnswer} />
                          <div className="card mb-3">
                            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                              <h5 className="mb-0">{t('gameControls.playerBoards', language)}</h5>
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={showAllBoards}
                                  disabled={connectionStatus !== 'connected'}
                                >
                                  {t('gameControls.showAll', language)}
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={hideAllBoards}
                                  disabled={connectionStatus !== 'connected'}
                                >
                                  {t('gameControls.hideAll', language)}
                                </button>
                              </div>
                            </div>
                            <div className="card-body">
                              <div
                                className="board-row"
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                                  gap: '20px',
                                  width: '100%',
                                  overflowX: 'auto',
                                  alignItems: 'stretch',
                                }}
                              >
                                {gamePlayers.filter(player => !player.isSpectator).map(player => {
                                  const boardEntry = playerBoards.find(b => b.playerId === player.id);
                                  const boardForDisplay = {
                                    playerId: player.id,
                                    persistentPlayerId: player.persistentPlayerId,
                                    playerName: player.name,
                                    boardData: boardEntry ? boardEntry.boardData : ''
                                  };
                                  return (
                                    <PlayerBoardDisplay
                                      key={player.id}
                                      board={boardForDisplay}
                                      isVisible={visibleBoards.has(player.id)}
                                      onToggleVisibility={toggleBoardVisibility}
                                      transform={boardTransforms[player.id] || { scale: 1, x: 0, y: 0 }}
                                      onScale={handleBoardScale}
                                      onPan={handleBoardPan}
                                      onReset={handleBoardReset}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Button to re-open preview if locally closed by GM during community voting */}
          {gameStarted && isCommunityVotingMode && previewMode.isActive && gmOverlayLocallyClosed && (
            <div className="mt-3 mb-3">
              <button 
                className="btn btn-info w-100"
                onClick={() => setGmOverlayLocallyClosed(false)}
              >
                {t('gameControls.reopenVoting', language) || 'Re-open Voting Screen'}
              </button>
            </div>
          )}

          {previewMode.isActive && !gmOverlayLocallyClosed && (
            <PreviewOverlayV2
              onFocus={handleFocusSubmissionInternal}
              onClose={() => {
                if (isCommunityVotingMode) {
                  setGmOverlayLocallyClosed(true);
                } else {
                  handleStopPreview();
                }
              }}
              isGameMaster={true} 
              onEvaluate={!isCommunityVotingMode ? handleEvaluateAnswer : undefined} 
              isCommunityVotingMode={isCommunityVotingMode} 
              onVote={(answerPersistentPlayerId, vote) => {
                if (roomCode && currentQuestion)
                  socketService.emit('submit_vote', { roomCode, answerId: answerPersistentPlayerId, vote });
              }}
              onShowAnswer={() => {
                if (roomCode && currentQuestion)
                  socketService.emit('show_answer', { roomCode, questionId: currentQuestion.id });
              }}
              onForceEndVoting={handleForceEndVoting}
            />
          )}

          {gameRecapData && roomCode && (
            <RecapModal 
              show={!!gameRecapData} 
              onHide={hideRecap} 
              recap={gameRecapData} 
              selectedRoundIndex={recapSelectedRoundIndex ?? 0} 
              onRoundChange={(idx) => roomCode && gmNavigateRecapRound(roomCode, idx)} 
              isControllable={true} 
              activeTabKey={recapSelectedTabKey ?? "overallResults"} 
              onTabChange={(key) => roomCode && gmNavigateRecapTab(roomCode, key as string)}
            />
          )}
        </div>
      </div>

      {/* Floating Webcam Sidebar - Now Draggable and Resizable */}
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

      {/* Add AvatarCreator modal */}
      {showAvatarCreator && (
        <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('avatar.create', language)}</h5>
                <button type="button" className="btn-close" onClick={() => setShowAvatarCreator(false)}></button>
              </div>
              <div className="modal-body">
                <AvatarCreator
                  onSave={(avatarSvgFromCreator) => {
                    if (persistentPlayerId) {
                        handleAvatarUpdate(avatarSvgFromCreator, persistentPlayerId);
                    } else {
                        console.error("[GameMaster] Cannot call handleAvatarUpdate from AvatarCreator: persistentPlayerId is missing.");
                        toast.error(t('avatar.updateErrorMissingData', language));
                    }
                  }}
                  onCancel={() => setShowAvatarCreator(false)}
                  persistentPlayerId={persistentPlayerId || ''}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <GameMasterQuestionHistoryModal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        history={gmQuestionHistory}
        language={language}
      />
    </div>
  );
};

export default GameMaster; 