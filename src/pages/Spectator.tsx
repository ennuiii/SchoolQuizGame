import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import PlayerList from '../components/shared/PlayerList';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PreviewOverlay from '../components/shared/PreviewOverlay';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
}

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

const Spectator: React.FC = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerBoards, setPlayerBoards] = useState<PlayerBoard[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [visibleBoards, setVisibleBoards] = useState<Set<string>>(new Set());
  const [allAnswersThisRound, setAllAnswersThisRound] = useState<Record<string, AnswerSubmission>>({});
  const [evaluatedAnswers, setEvaluatedAnswers] = useState<Record<string, boolean | null>>({});
  const [previewMode, setPreviewMode] = useState<PreviewModeState>({ isActive: false, focusedPlayerId: null });
  const [gameStarted, setGameStarted] = useState(false);
  const [showJoinAsPlayer, setShowJoinAsPlayer] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    socketService.connect();
    socketService.on('players_update', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });
    socketService.on('board_update', (data: PlayerBoard) => {
      setPlayerBoards(prevBoards => {
        const index = prevBoards.findIndex(b => b.playerId === data.playerId);
        if (index >= 0) {
          const newBoards = [...prevBoards];
          newBoards[index] = data;
          return newBoards;
        }
        return [...prevBoards, data];
      });
    });
    socketService.on('question', (question: { text: string }) => {
      setCurrentQuestion(question.text);
    });
    socketService.on('answer_submitted', (submission: AnswerSubmission) => {
      setAllAnswersThisRound(prev => ({ ...prev, [submission.playerId]: submission }));
    });
    socketService.on('answer_evaluation', (data: { isCorrect: boolean, playerId: string }) => {
      setEvaluatedAnswers(prev => ({ ...prev, [data.playerId]: data.isCorrect }));
    });
    socketService.on('start_preview_mode', () => setPreviewMode(prev => ({ ...prev, isActive: true })));
    socketService.on('stop_preview_mode', () => setPreviewMode({ isActive: false, focusedPlayerId: null }));
    socketService.on('focus_submission', (data: { playerId: string }) => setPreviewMode(prev => ({ ...prev, focusedPlayerId: data.playerId })));
    socketService.on('game_started', () => setGameStarted(true));
    socketService.on('game_restarted', () => {
      setCurrentQuestion('');
      setPlayerBoards([]);
      setAllAnswersThisRound({});
      setEvaluatedAnswers({});
      setVisibleBoards(new Set());
      setGameStarted(false);
    });
    socketService.on('game_over', () => setGameStarted(false));
    socketService.on('become_spectator', () => {
      // Request current game state from the server
      const roomCode = sessionStorage.getItem('roomCode');
      if (roomCode) {
        socketService.emit('get_game_state', { roomCode });
      }
    });
    socketService.on('game_state', (data: { started: boolean }) => {
      setGameStarted(data.started);
    });
    return () => {
      socketService.off('players_update');
      socketService.off('board_update');
      socketService.off('question');
      socketService.off('answer_submitted');
      socketService.off('answer_evaluation');
      socketService.off('start_preview_mode');
      socketService.off('stop_preview_mode');
      socketService.off('focus_submission');
      socketService.off('game_started');
      socketService.off('game_restarted');
      socketService.off('game_over');
      socketService.off('become_spectator');
      socketService.off('game_state');
    };
  }, []);

  const showAllBoards = useCallback(() => {
    setVisibleBoards(new Set(playerBoards.filter(b => {
      const player = players.find(p => p.id === b.playerId);
      return player && !player.isSpectator;
    }).map(b => b.playerId)));
  }, [playerBoards, players]);

  const hideAllBoards = useCallback(() => {
    setVisibleBoards(new Set());
  }, []);

  const handleJoinAsPlayer = () => {
    const roomCode = sessionStorage.getItem('roomCode');
    const playerName = sessionStorage.getItem('playerName');
    if (!roomCode || !playerName) return;
    sessionStorage.setItem('isSpectator', 'false');
    socketService.switchToPlayer(roomCode, playerName);
    navigate('/player');
  };

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-eye section-icon" aria-label="Spectator"></span>
          Spectator View
        </div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <PlayerList players={players} title="Players" />
          <div className="d-grid gap-2 mt-3">
            <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>Leave Game</button>
            <button
              className="btn btn-success"
              onClick={handleJoinAsPlayer}
              disabled={gameStarted}
              title={gameStarted ? "You can only join as a player when a round is not in progress." : ""}
            >
              Join as Player
            </button>
            {gameStarted && (
              <div className="text-muted small mt-1">
                You can only join as a player when a round is not in progress.
              </div>
            )}
          </div>
        </div>
        <div className="col-12 col-md-8">
          {currentQuestion && (
            <div className="card mb-4">
              <div className="card-body">
                <h3>Current Question:</h3>
                <p className="lead">{currentQuestion}</p>
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
                {playerBoards.filter(board => {
                  const player = players.find(p => p.id === board.playerId);
                  return player && !player.isSpectator;
                }).map(board => (
                  <PlayerBoardDisplay
                    key={board.playerId}
                    board={board}
                    isVisible={visibleBoards.has(board.playerId)}
                    onToggleVisibility={id => setVisibleBoards(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                      return newSet;
                    })}
                    transform={{ scale: 1, x: 0, y: 0 }}
                    onScale={() => {}}
                    onPan={() => {}}
                    onReset={() => {}}
                  />
                ))}
              </div>
            </div>
          </div>
          <PreviewOverlay
            players={players}
            playerBoards={playerBoards}
            allAnswersThisRound={allAnswersThisRound}
            evaluatedAnswers={evaluatedAnswers}
            previewMode={previewMode}
            onFocus={() => {}}
            onClose={() => {}}
            isGameMaster={false}
          />
        </div>
      </div>
    </div>
  );
};

export default Spectator; 