import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socketService from '../services/socketService';
import { supabaseService } from '../services/supabaseService';
import audioService from '../services/audioService';
import { useGame } from '../context/GameContext';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import QuestionSelector from '../components/game-master/QuestionSelector';
import GameControls from '../components/game-master/GameControls';
import QuestionDisplay from '../components/game-master/QuestionDisplay';
import AnswerList from '../components/game-master/AnswerList';
import Timer from '../components/shared/Timer';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';
import { Player, PlayerBoard, AnswerSubmission, Question } from '../types/game';

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state, dispatch } = useGame();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [playerBoards, setPlayerBoards] = useState<PlayerBoard[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<AnswerSubmission[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const [visibleBoards, setVisibleBoards] = useState<Set<string>>(new Set());
  const [boardTransforms, setBoardTransforms] = useState<{[playerId: string]: {scale: number, x: number, y: number}}>(() => ({}));
  const panState = useRef<{[playerId: string]: {panning: boolean, lastX: number, lastY: number}}>({});
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [enlargedPlayerId, setEnlargedPlayerId] = useState<string | null>(null);
  const [evaluatedAnswers, setEvaluatedAnswers] = useState<{[playerId: string]: boolean | null}>({});
  const [allAnswersThisRound, setAllAnswersThisRound] = useState<{[playerId: string]: AnswerSubmission}>({});
  const [isMuted, setIsMuted] = useState(audioService.isMusicMuted());
  const [volume, setVolume] = useState(audioService.getVolume());
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({
    isActive: false,
    focusedPlayerId: null
  });
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const handleToggleMute = useCallback(() => {
    const newMuteState = audioService.toggleMute();
    setIsMuted(newMuteState);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    audioService.setVolume(newVolume);
    setVolume(newVolume);
  }, []);

  const createRoom = useCallback(() => {
    console.log('Creating new room...');
    setIsLoading(true);
    socketService.createRoom(roomCodeInput);
  }, [roomCodeInput]);

  const startGame = useCallback(() => {
    if (!roomCode) {
      setErrorMsg('Please enter a room code!');
      return;
    }
    
    if (questions.length === 0) {
      setErrorMsg('Please select at least one question!');
      return;
    }

    if (players.length === 0) {
      setErrorMsg('Please wait for at least one player to join before starting the game!');
      return;
    }
    
    // Sort questions by grade before starting the game
    const gradeSortedQuestions = [...questions].sort((a, b) => a.grade - b.grade);
    setQuestions(gradeSortedQuestions);
    setCurrentQuestion(gradeSortedQuestions[0]);
    setCurrentQuestionIndex(0);
    
    // Start the game with the existing room
    setIsLoading(true);
    // If timeLimit is null or blank, set it to 99999 internally but don't show it
    const effectiveTimeLimit = timeLimit === null ? 99999 : timeLimit;
    socketService.startGame(roomCode, gradeSortedQuestions, effectiveTimeLimit);
    setGameStarted(true);
  }, [roomCode, questions, timeLimit, players]);

  const nextQuestion = useCallback(() => {
    if (!roomCode) return;
    
    if (currentQuestionIndex < questions.length - 1) {
      // Do NOT update currentQuestionIndex or currentQuestion here!
      setPendingAnswers([]);
      setTimeRemaining(null);
      setIsTimerRunning(false);
      socketService.nextQuestion(roomCode);
    } else {
      alert('No more questions available!');
    }
  }, [currentQuestionIndex, questions.length, roomCode]);

  const evaluateAnswer = useCallback((playerId: string, isCorrect: boolean) => {
    if (!roomCode) return;
    
    socketService.evaluateAnswer(roomCode, playerId, isCorrect);
    setPendingAnswers(prev => prev.filter(a => a.playerId !== playerId));
    setEvaluatedAnswers(prev => ({ ...prev, [playerId]: isCorrect }));
  }, [roomCode]);

  const restartGame = useCallback(() => {
    if (!roomCode) return;
    
    setIsRestarting(true);
    socketService.restartGame(roomCode);
  }, [roomCode]);

  const handleEndRoundEarly = useCallback(() => {
    setShowEndRoundConfirm(true);
  }, []);

  const confirmEndRoundEarly = useCallback(() => {
    if (!roomCode) return;
    
    socketService.endRoundEarly(roomCode);
    setShowEndRoundConfirm(false);
  }, [roomCode]);

  const cancelEndRoundEarly = useCallback(() => {
    setShowEndRoundConfirm(false);
  }, []);

  const toggleBoardVisibility = useCallback((playerId: string) => {
    setVisibleBoards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
        // Initialize transform for this board if it doesn't exist
        setBoardTransforms(prevTransforms => ({
          ...prevTransforms,
          [playerId]: prevTransforms[playerId] || { scale: 0.4, x: 0, y: 0 }
        }));
      }
      return newSet;
    });
  }, []);

  const updateBoardTransform = useCallback((playerId: string, update: (t: {scale: number, x: number, y: number}) => {scale: number, x: number, y: number}) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: update(prev[playerId] || {scale: 1, x: 0, y: 0})
    }));
  }, []);

  const fitToScreen = useCallback((playerId: string) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: {scale: 1, x: 0, y: 0}
    }));
  }, []);

  const handleStartPreviewMode = useCallback(() => {
    if (!roomCode) return;
    
    socketService.startPreviewMode(roomCode);
    setPreviewMode(prev => ({ ...prev, isActive: true }));
  }, [roomCode]);

  const handleStopPreviewMode = useCallback(() => {
    if (!roomCode) return;
    
    socketService.stopPreviewMode(roomCode);
    setPreviewMode({ isActive: false, focusedPlayerId: null });
  }, [roomCode]);

  const handleFocusSubmission = useCallback((playerId: string) => {
    if (!roomCode) return;
    
    socketService.focusSubmission(roomCode, playerId);
  }, [roomCode]);

  const handleBoardScale = useCallback((playerId: string, scale: number) => {
    updateBoardTransform(playerId, transform => ({
      ...transform,
      scale: scale
    }));
  }, [updateBoardTransform]);

  const handleBoardPan = useCallback((playerId: string, dx: number, dy: number) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        x: (prev[playerId]?.x || 0) + dx,
        y: (prev[playerId]?.y || 0) + dy
      }
    }));
  }, []);

  const handleBoardReset = useCallback((playerId: string) => {
    setBoardTransforms(prev => ({
      ...prev,
      [playerId]: { scale: 1, x: 0, y: 0 }
    }));
  }, []);

  const handlePlayerSelect = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    toggleBoardVisibility(playerId);
  }, [toggleBoardVisibility]);

  // Add state for show/hide all
  const showAllBoards = useCallback(() => {
    setVisibleBoards(new Set(players.filter(p => !p.isSpectator).map(p => p.id)));
  }, [players]);
  
  const hideAllBoards = useCallback(() => {
    setVisibleBoards(new Set());
  }, []);

  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }

    // Join room as game master
    socketService.joinRoom(roomCode, 'Game Master');

    // Set up socket listeners
    socketService.on('player_update', (players: Player[]) => {
      dispatch({ type: 'SET_PLAYERS', payload: players });
    });

    socketService.on('board_update', (playerBoards: PlayerBoard[]) => {
      dispatch({ type: 'SET_PLAYER_BOARDS', payload: playerBoards });
    });

    socketService.on('answer_submitted', (submission: AnswerSubmission) => {
      dispatch({ type: 'ADD_ANSWER_SUBMISSION', payload: submission });
    });

    socketService.on('timer_update', (timeLeft: number) => {
      dispatch({ type: 'SET_TIME_LEFT', payload: timeLeft });
    });

    socketService.on('game_started', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: true });
    });

    socketService.on('game_ended', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: false });
    });

    socketService.on('preview_mode_started', () => {
      dispatch({ type: 'SET_PREVIEW_MODE', payload: true });
    });

    socketService.on('preview_mode_ended', () => {
      dispatch({ type: 'SET_PREVIEW_MODE', payload: false });
    });

    socketService.on('submission_focused', (playerId: string) => {
      dispatch({ type: 'SET_FOCUSED_SUBMISSION', payload: playerId });
    });

    return () => {
      socketService.disconnect();
    };
  }, [roomCode, navigate, dispatch]);

  useEffect(() => {
    // Start playing background music when component mounts
    audioService.playBackgroundMusic();

    // Cleanup when component unmounts
    return () => {
      audioService.pauseBackgroundMusic();
    };
  }, []);

  // Format time remaining with smooth transitions
  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add a function to check if all answers are in
  const allAnswersIn = players.length > 0 && pendingAnswers.length === 0 && gameStarted;

  // Set initial scale to 1 for each board
  useEffect(() => {
    const initialTransforms: {[playerId: string]: {scale: number, x: number, y: number}} = {};
    players.forEach(player => {
      initialTransforms[player.id] = { scale: 1, x: 0, y: 0 };
    });
    setBoardTransforms(initialTransforms);
  }, [players]);

  // Add toggle scale on click
  const toggleBoardScale = useCallback((playerId: string) => {
    setBoardTransforms(prev => {
      const current = prev[playerId] || { scale: 0.4, x: 0, y: 0 };
      const newScale = current.scale === 0.4 ? 1.0 : 0.4;
      return {
        ...prev,
        [playerId]: { ...current, scale: newScale }
      };
    });
  }, []);

  // Initialize visibleBoards when players join
  useEffect(() => {
    const newVisibleBoards = new Set<string>();
    players.forEach(player => {
      if (visibleBoards.has(player.id)) {
        newVisibleBoards.add(player.id);
      }
    });
    setVisibleBoards(newVisibleBoards);
  }, [players]);

  // Reset visibleBoards when game restarts
  useEffect(() => {
    if (isRestarting) {
      setVisibleBoards(new Set());
    }
  }, [isRestarting]);

  // Add a function to check if preview can be started
  const canStartPreview = gameStarted && (
    (players.length > 0 && pendingAnswers.length === 0) ||
    (timeLimit !== null && timeRemaining === 0 && pendingAnswers.length > 0)
  );

  useEffect(() => {
    if (gameStarted) {
      // Show all boards of active players (non-spectators) when game starts
      setVisibleBoards(new Set(players.filter(p => !p.isSpectator).map(p => p.id)));
    }
  }, [gameStarted, players]);

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
          Game Master Dashboard
        </div>
        <div className="d-flex align-items-center gap-2">
          <input
            type="range"
            className="form-range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            style={{ width: '100px' }}
            title="Volume"
          />
          <button
            className="btn btn-outline-secondary"
            onClick={handleToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <i className="bi bi-volume-mute-fill"></i>
            ) : (
              <i className="bi bi-volume-up-fill"></i>
            )}
          </button>
        </div>
      </div>
      
      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          {errorMsg}
          <button 
            type="button" 
            className="btn-close float-end" 
            onClick={() => setErrorMsg('')}
            aria-label="Close"
          ></button>
        </div>
      )}
      
      {showEndRoundConfirm && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">End Round Early?</h5>
                <button type="button" className="btn-close" onClick={cancelEndRoundEarly}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to end this round early? All players' current answers will be submitted automatically.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cancelEndRoundEarly}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmEndRoundEarly}>End Round</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!roomCode ? (
        <div className="row justify-content-center">
          <div className="col-12 col-md-6">
            <div className="card p-4 text-center">
              <h3>Create a New Game Room</h3>
              <p>As the Game Master, you'll manage questions and evaluate answers.</p>
              <div className="form-group mb-3">
                <label htmlFor="roomCodeInput" className="form-label">Room Code (optional):</label>
                <input
                  type="text"
                  id="roomCodeInput"
                  className="form-control"
                  placeholder="Leave blank for random code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                />
                <small className="text-muted">You can specify a custom room code or leave it blank for a random one.</small>
              </div>
              <button 
                className="btn btn-primary btn-lg mt-3"
                onClick={createRoom}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Room'}
              </button>
              <button 
                className="btn btn-outline-secondary mt-3"
                onClick={() => navigate('/')}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="game-master-container" style={{ 
          backgroundImage: 'linear-gradient(to bottom right, #8B4513, #A0522D)', 
          padding: '15px', 
          borderRadius: '12px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat'
        }}>
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <RoomCode roomCode={roomCode} />
              {!previewMode.isActive && (
                <div className="mb-3">
                  <button
                    className="btn btn-primary w-100"
                    onClick={handleStartPreviewMode}
                    disabled={!canStartPreview}
                  >
                    Start Preview Mode
                  </button>
                </div>
              )}
              <PlayerList 
                players={players}
                onPlayerClick={handlePlayerSelect}
                selectedPlayerId={selectedPlayerId}
                title="Players"
              />
            </div>
            
            <div className="col-12 col-md-8">
              <GameControls
                gameStarted={gameStarted}
                currentQuestionIndex={currentQuestionIndex}
                totalQuestions={questions.length}
                onStartGame={startGame}
                onNextQuestion={nextQuestion}
                onRestartGame={restartGame}
                onEndRoundEarly={handleEndRoundEarly}
                isRestarting={isRestarting}
                showEndRoundConfirm={showEndRoundConfirm}
                onConfirmEndRound={confirmEndRoundEarly}
                onCancelEndRound={cancelEndRoundEarly}
                hasPendingAnswers={pendingAnswers.length > 0}
              />
              
              {gameStarted ? (
                <>
                  {currentQuestion && (
                    <div className="card mb-4">
                      <div className="card-body">
                        <QuestionDisplay
                          question={currentQuestion}
                        />
                        <Timer
                          timeLimit={timeLimit}
                          timeRemaining={timeRemaining}
                          isActive={isTimerRunning}
                        />
                      </div>
                    </div>
                  )}

                  <div className="card mb-4">
                    <div className="card-header bg-light d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">Player Boards</h5>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-primary" onClick={showAllBoards}>Show All</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={hideAllBoards}>Hide All</button>
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
                        {playerBoards.map(board => (
                          <PlayerBoardDisplay
                            key={board.playerId}
                            board={board}
                            isVisible={visibleBoards.has(board.playerId)}
                            onToggleVisibility={() => toggleBoardVisibility(board.playerId)}
                            transform={boardTransforms[board.playerId] || { scale: 1, x: 0, y: 0 }}
                            onScale={(scale) => handleBoardScale(board.playerId, scale)}
                            onPan={(dx, dy) => handleBoardPan(board.playerId, dx, dy)}
                            onReset={() => handleBoardReset(board.playerId)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <AnswerList
                    answers={pendingAnswers}
                    onEvaluate={evaluateAnswer}
                    evaluatedAnswers={evaluatedAnswers}
                  />
                </>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <h3 className="mb-0">Getting Started</h3>
                  </div>
                  <div className="card-body">
                    <p className="mb-4">
                      Welcome to the Game Master dashboard! Share the room code with your players and prepare your questions. When everyone is ready, start the game!
                    </p>
                    
                    <div className="mb-4">
                      <h5>Current Players:</h5>
                      {players.length === 0 ? (
                        <p className="text-center text-muted">No players have joined yet</p>
                      ) : (
                        <ul className="list-group">
                          {players.map(player => (
                            <li key={player.id} className="list-group-item">
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <h5>Room Settings:</h5>
                      <div className="mb-3">
                        <label htmlFor="timeLimitInput" className="form-label">Time Limit per Question (seconds):</label>
                        <input
                          type="number"
                          id="timeLimitInput"
                          className="form-control"
                          placeholder="No time limit"
                          min="5"
                          max="300"
                          value={timeLimit === null ? '' : timeLimit}
                          onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </div>
                    </div>
                    
                    <QuestionSelector
                      onQuestionsSelected={setQuestions}
                      selectedQuestions={questions}
                      onSelectedQuestionsChange={setQuestions}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewMode.isActive && (
        <div className="preview-mode-controls mt-3" style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 20px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          width: '90%',
          maxWidth: '500px'
        }}>
          <button
            className="btn btn-secondary w-100"
            onClick={handleStopPreviewMode}
          >
            Stop Preview Mode
          </button>
          {previewMode.focusedPlayerId && (
            <button
              className="btn btn-outline-primary w-100"
              onClick={() => handleFocusSubmission('')}
            >
              Back to Gallery
            </button>
          )}
        </div>
      )}

      {/* Preview Mode Overlay */}
      <PreviewOverlay
        players={players}
        playerBoards={playerBoards}
        allAnswersThisRound={allAnswersThisRound}
        evaluatedAnswers={evaluatedAnswers}
        previewMode={previewMode}
        onFocus={handleFocusSubmission}
        onClose={handleStopPreviewMode}
        isGameMaster={true}
      />
    </div>
  );
};

export default GameMaster; 