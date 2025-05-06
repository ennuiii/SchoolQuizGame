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
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card mt-5">
            <div className="card-header">
              <h2 className="text-center">Join Game</h2>
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
                  />
                </div>
                
                <div className="d-grid">
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-lg"
                    disabled={isJoining}
                  >
                    {isJoining ? 'Joining...' : 'Join Game'}
                  </button>
                </div>
              </form>
            </div>
            <div className="card-footer text-center">
              <button 
                className="btn btn-link"
                onClick={() => navigate('/')}
                disabled={isJoining}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Join;
