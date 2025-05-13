import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { useRoom } from '../contexts/RoomContext';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

const JoinGame: React.FC = () => {
  const navigate = useNavigate();
  const [isSpectator, setIsSpectator] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Get context values
  const {
    roomCode,
    playerName,
    isLoading,
    errorMsg,
    setRoomCode,
    setPlayerName,
    setErrorMsg,
    joinRoom,
    players
  } = useRoom();

  // Ensure socket is connected when component mounts
  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) {
      console.error('Failed to connect to socket server');
      return;
    }
    
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      setIsConnecting(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setErrorMsg('Failed to connect to server. Please try again.');
      setIsConnecting(false);
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
    };
  }, [setErrorMsg]);

  const handleJoinGame = useCallback(() => {
    if (!roomCode || !playerName) {
      setErrorMsg('Please enter both room code and player name!');
      return;
    }

    setIsConnecting(true);
    const socket = socketService.connect();
    if (!socket) {
      setErrorMsg('Failed to connect to server. Please try again.');
      setIsConnecting(false);
      return;
    }
    
    if (!socket.connected) {
      setErrorMsg('Not connected to server. Please try again.');
      setIsConnecting(false);
      return;
    }

    joinRoom(roomCode, playerName, isSpectator);
    setHasJoined(true);
  }, [roomCode, playerName, isSpectator, joinRoom, setErrorMsg]);

  // Reset hasJoined when roomCode or playerName changes
  useEffect(() => {
    setHasJoined(false);
  }, [roomCode, playerName]);

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
          Join Game
        </div>
      </div>
      
      {!hasJoined ? (
        <div className="row justify-content-center">
          <div className="col-12 col-md-6">
            <div className="card p-4 text-center">
              <h3>Join a Game</h3>
              <p>Enter the room code and your name to join the game.</p>
              <div className="form-group mb-3">
                <label htmlFor="roomCodeInput" className="form-label">Room Code:</label>
                <input
                  type="text"
                  id="roomCodeInput"
                  className="form-control"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="form-group mb-3">
                <label htmlFor="playerNameInput" className="form-label">Your Name:</label>
                <input
                  type="text"
                  id="playerNameInput"
                  className="form-control"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="spectatorCheckbox"
                  checked={isSpectator}
                  onChange={(e) => setIsSpectator(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="spectatorCheckbox">
                  Join as Spectator
                </label>
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
              <button 
                className="btn btn-primary btn-lg mt-3"
                onClick={handleJoinGame}
                disabled={isLoading || isConnecting}
              >
                {isLoading ? 'Joining...' : isConnecting ? 'Connecting...' : 'Join Game'}
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
              <RoomCode />
              <PlayerList 
                title="Players"
              />
            </div>
            <div className="col-12 col-md-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="mb-0">Waiting for Game Master</h3>
                </div>
                <div className="card-body">
                  <p className="mb-4">
                    You have joined the room. Please wait for the Game Master to start the game.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoinGame; 