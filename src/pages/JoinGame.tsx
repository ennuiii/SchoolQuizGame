import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';

const JoinGame: React.FC = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Connect to socket server
    socketService.connect();

    // Set up listeners
    socketService.on('joined_room', (roomCode: string) => {
      // Store player info in sessionStorage
      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('isGameMaster', 'false');
      
      // Navigate to player screen
      navigate('/player');
    });

    socketService.on('error', (errorMsg: string) => {
      setError(errorMsg);
    });

    return () => {
      // Clean up listeners
      socketService.off('joined_room');
      socketService.off('error');
    };
  }, [navigate, playerName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomCode.trim()) {
      setError('Room code is required');
      return;
    }
    
    if (!playerName.trim()) {
      setError('Player name is required');
      return;
    }
    
    setError('');
    socketService.joinRoom(roomCode, playerName);
  };

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="card p-4" style={{ maxWidth: 420, width: '100%' }}>
        <div className="card-header d-flex align-items-center gap-2 justify-content-center">
          <span className="bi bi-pencil section-icon" aria-label="Pencil"></span>
          <h2 className="mb-0">Join a Game</h2>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="roomCode" className="form-label">Room Code</label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="roomCode"
                placeholder="Enter 6-digit room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                maxLength={6}
                style={{ fontFamily: 'Schoolbell, Patrick Hand, cursive' }}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="playerName" className="form-label">Your Name</label>
              <input
                type="text"
                className="form-control form-control-lg"
                id="playerName"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                style={{ fontFamily: 'Schoolbell, Patrick Hand, cursive' }}
              />
            </div>
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-success btn-lg d-flex align-items-center gap-2 justify-content-center">
                <span className="bi bi-door-open"></span>
                Join Game
              </button>
              <button 
                type="button" 
                className="btn btn-outline-secondary d-flex align-items-center gap-2 justify-content-center"
                onClick={() => navigate('/')}
              >
                <span className="bi bi-arrow-left"></span>
                Back to Home
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JoinGame; 