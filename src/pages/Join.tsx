import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';

const Join: React.FC = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Connect to socket and listen for events
    socketService.connect();

    socketService.on('joined_room', (joinedRoomCode: string) => {
      console.log('Successfully joined room:', joinedRoomCode);
      // Save data to session
      sessionStorage.setItem('roomCode', joinedRoomCode);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('isGameMaster', 'false');
      
      // Navigate to player screen
      setIsJoining(false);
      navigate('/player');
    });

    socketService.on('error', (msg: string) => {
      console.error('Socket error:', msg);
      setErrorMsg(msg);
      setIsJoining(false);
    });

    return () => {
      socketService.off('joined_room');
      socketService.off('error');
    };
  }, [navigate, playerName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomCode.trim()) {
      setErrorMsg('Please enter a room code');
      return;
    }

    if (!playerName.trim()) {
      setErrorMsg('Please enter your name');
      return;
    }

    setErrorMsg('');
    setIsJoining(true);
    
    // Join room
    socketService.joinRoom(roomCode, playerName);
  };

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="card p-4" style={{ maxWidth: 420, width: '100%' }}>
        <div className="card-header d-flex align-items-center gap-2 justify-content-center">
          <span className="bi bi-pencil section-icon" aria-label="Pencil"></span>
          <h2 className="mb-0">Join Game</h2>
        </div>
        <div className="card-body">
          {errorMsg && (
            <div className="alert alert-danger" role="alert">
              {errorMsg}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="roomCode" className="form-label">Room Code</label>
              <input 
                type="text" 
                className="form-control form-control-lg" 
                id="roomCode"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter 6-digit code"
                disabled={isJoining}
                maxLength={6}
                style={{ fontFamily: 'Schoolbell, Patrick Hand, cursive' }}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="playerName" className="form-label">Your Name</label>
              <input 
                type="text" 
                className="form-control form-control-lg" 
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                disabled={isJoining}
                style={{ fontFamily: 'Schoolbell, Patrick Hand, cursive' }}
              />
            </div>
            <div className="d-grid gap-2">
              <button 
                type="submit" 
                className="btn btn-primary btn-lg d-flex align-items-center gap-2 justify-content-center"
                disabled={isJoining}
              >
                <span className="bi bi-door-open"></span>
                {isJoining ? 'Joining...' : 'Join Game'}
              </button>
              <button 
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center gap-2 justify-content-center"
                onClick={() => navigate('/')}
                disabled={isJoining}
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

export default Join;
