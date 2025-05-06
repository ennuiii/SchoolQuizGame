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
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card p-4">
            <h2 className="text-center mb-4">Join a Game</h2>
            
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
                  className="form-control"
                  id="roomCode"
                  placeholder="Enter 6-digit room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  maxLength={6}
                />
              </div>
              
              <div className="mb-3">
                <label htmlFor="playerName" className="form-label">Your Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="playerName"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={15}
                />
              </div>
              
              <div className="d-grid gap-2">
                <button type="submit" className="btn btn-success btn-lg">
                  Join Game
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary"
                  onClick={() => navigate('/')}
                >
                  Back to Home
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinGame; 