import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { useGame } from '../context/GameContext';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';
import type { PreviewModeState, Player, PlayerBoard, AnswerSubmission } from '../types/game';

const Spectator: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useGame();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [visibleBoards, setVisibleBoards] = useState<Set<string>>(new Set());
  const [boardTransforms, setBoardTransforms] = useState<{[playerId: string]: {scale: number, x: number, y: number}}>(() => ({}));
  const panState = useRef<{[playerId: string]: {panning: boolean, lastX: number, lastY: number}}>({});
  const [enlargedPlayerId, setEnlargedPlayerId] = useState<string | null>(null);
  const [evaluatedAnswers, setEvaluatedAnswers] = useState<{[playerId: string]: boolean | null}>({});
  const [allAnswersThisRound, setAllAnswersThisRound] = useState<Record<string, AnswerSubmission>>({});
  const [isRestarting, setIsRestarting] = useState(false);
  const [showEndRoundConfirm, setShowEndRoundConfirm] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }

    // Connect to socket first
    const socket = socketService.connect();
    
    // Set up error handler
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setErrorMsg('Connection error. Please try again.');
    });

    // Join room as spectator
    socketService.joinRoom(roomCode, 'Spectator', true);

    // Set up socket listeners
    socketService.on('players_update', (players: Player[]) => {
      console.log('Players update received:', players);
      dispatch({ type: 'SET_PLAYERS', payload: players });
    });

    socketService.on('player_joined', (player: Player) => {
      console.log('Player joined:', player);
      dispatch({ type: 'ADD_PLAYER', payload: player });
    });

    socketService.on('board_update', (playerBoards: PlayerBoard[]) => {
      console.log('Board update received:', playerBoards);
      dispatch({ type: 'SET_PLAYER_BOARDS', payload: playerBoards });
    });

    socketService.on('question_update', (question: string) => {
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: question });
    });

    socketService.on('timer_update', (timeLeft: number) => {
      dispatch({ type: 'SET_TIME_LEFT', payload: timeLeft });
    });

    socketService.on('game_started', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: true });
      // Ensure preview mode is off when game starts
      dispatch({ type: 'SET_PREVIEW_MODE', payload: { isActive: false, focusedPlayerId: null } });
    });

    socketService.on('game_ended', () => {
      dispatch({ type: 'SET_GAME_STARTED', payload: false });
      // Ensure preview mode is off when game ends
      dispatch({ type: 'SET_PREVIEW_MODE', payload: { isActive: false, focusedPlayerId: null } });
    });

    socketService.on('preview_mode_started', () => {
      dispatch({ type: 'SET_PREVIEW_MODE', payload: { isActive: true, focusedPlayerId: null } });
    });

    socketService.on('preview_mode_ended', () => {
      dispatch({ type: 'SET_PREVIEW_MODE', payload: { isActive: false, focusedPlayerId: null } });
    });

    socketService.on('submission_focused', (playerId: string) => {
      dispatch({ type: 'SET_FOCUSED_SUBMISSION', payload: playerId });
      setSelectedPlayerId(playerId);
    });

    // Request current game state
    socketService.getGameState(roomCode);

    return () => {
      socketService.disconnect();
      socketService.off('players_update');
      socketService.off('player_joined');
      socketService.off('board_update');
      socketService.off('timer_update');
      socketService.off('game_started');
      socketService.off('game_ended');
      socketService.off('preview_mode_started');
      socketService.off('preview_mode_ended');
      socketService.off('submission_focused');
    };
  }, [roomCode, navigate, dispatch]);

  const handlePlayerSelect = (playerId: string) => {
    if (!roomCode) return;
    socketService.focusSubmission(roomCode, playerId);
  };

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="row">
        <div className="col-md-9">
          <div className="card mb-4">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h2 className="mb-0">Room: {roomCode}</h2>
              </div>
            </div>
            <div className="card-body">
              {state.currentQuestion && (
                <div className="alert alert-info mb-4">
                  Current Question: {state.currentQuestion}
                </div>
              )}

              {state.timeLeft !== null && (
                <div className="alert alert-warning mb-4">
                  Time Left: {state.timeLeft} seconds
                </div>
              )}

              <div className="row">
                {state.playerBoards.map((board) => (
                  <div key={board.playerId} className="col-md-6 mb-4">
                    <PlayerBoardDisplay
                      board={board}
                      isFocused={state.focusedSubmission === board.playerId}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-header">
              <h3 className="mb-0">Players</h3>
            </div>
            <div className="card-body">
              <PlayerList
                players={state.players}
                onPlayerClick={handlePlayerSelect}
                selectedPlayerId={selectedPlayerId}
                title="Players"
              />
            </div>
          </div>
        </div>
      </div>

      <PreviewOverlay
        players={state.players}
        playerBoards={state.playerBoards}
        allAnswersThisRound={allAnswersThisRound}
        evaluatedAnswers={evaluatedAnswers}
        previewMode={state.previewMode}
        onFocus={handlePlayerSelect}
        onClose={() => setSelectedPlayerId(null)}
        isGameMaster={false}
      />
    </div>
  );
};

export default Spectator; 