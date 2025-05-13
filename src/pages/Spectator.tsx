import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import socketService from '../services/socketService';
import PlayerBoardDisplay from '../components/shared/PlayerBoardDisplay';
import PlayerList from '../components/shared/PlayerList';
import { Player, PlayerBoard } from '../types/game';

const Spectator: React.FC = () => {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();
  const { state, dispatch } = useGame();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }

    // Join room as spectator
    socketService.joinRoom(roomCode, 'Spectator');

    // Set up socket listeners
    socketService.on('player_update', (players: Player[]) => {
      dispatch({ type: 'SET_PLAYERS', payload: players });
    });

    socketService.on('board_update', (playerBoards: PlayerBoard[]) => {
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

  const handleJoinAsPlayer = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!roomCode) return;

    socketService.joinAsPlayer(roomCode, playerName);
    setShowJoinModal(false);
    navigate(`/player/${roomCode}`);
  };

  const handlePlayerSelect = (playerId: string) => {
    if (!roomCode) return;
    socketService.focusSubmission(roomCode, playerId);
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-md-9">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Room: {roomCode}</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowJoinModal(true)}
            >
              Join as Player
            </button>
          </div>

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

        <div className="col-md-3">
          <PlayerList
            players={state.players}
            onPlayerClick={handlePlayerSelect}
            selectedPlayerId={state.focusedSubmission}
            title="Players"
          />
        </div>
      </div>

      {/* Join as Player Modal */}
      {showJoinModal && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Join as Player</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowJoinModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="mb-3">
                  <label htmlFor="playerName" className="form-label">
                    Your Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="playerName"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleJoinAsPlayer}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Spectator; 