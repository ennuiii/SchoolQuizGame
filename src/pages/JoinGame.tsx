import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const [isSpectator, setIsSpectator] = useState(false);
  const [isGameMaster, setIsGameMaster] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const {
    roomCode,
    playerName,
    isLoading,
    errorMsg,
    setRoomCode,
    setPlayerName,
    setErrorMsg,
    joinRoom,
    createRoom,
    players
  } = useRoom();

  // Read room code from URL when component mounts
  useEffect(() => {
    const roomFromUrl = searchParams.get('room');
    if (roomFromUrl && !roomCode) {
      setRoomCode(roomFromUrl.toUpperCase());
    }
  }, [searchParams, roomCode, setRoomCode]);

  // Ensure socket is connected when component mounts
  useEffect(() => {
    const connectSocket = async () => {
      try {
        const socket = await socketService.connect();
        if (!socket) {
          console.error('Failed to connect to socket server');
          return;
        }
        
        socket.on('connect', () => {
          console.log('Socket connected successfully');
          setIsConnecting(false);
        });

        socket.on('connect_error', (error: Error) => {
          console.error('Socket connection error:', error);
          setErrorMsg('Failed to connect to server. Please try again.');
          setIsConnecting(false);
        });

        return () => {
          socket.off('connect');
          socket.off('connect_error');
        };
      } catch (error) {
        console.error('Socket connection error:', error);
        setErrorMsg('Failed to connect to server. Please try again.');
        setIsConnecting(false);
      }
    };

    connectSocket();
  }, [setErrorMsg]);

  const handleJoinGame = useCallback(async () => {
    if (isGameMaster && !roomCode) {
      // Generate room code for game master if not provided
      const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(generatedCode);
    } else if (!roomCode || (!isGameMaster && !playerName)) {
      setErrorMsg(isGameMaster ? 'Please enter a room code!' : 'Please enter both room code and player name!');
      return;
    }

    setIsConnecting(true);
    try {
      const socket = await socketService.connect();
      if (!socket || !socket.connected) {
        setErrorMsg('Not connected to server. Please try again.');
        setIsConnecting(false);
        return;
      }

      if (isGameMaster) {
        createRoom(roomCode);
      } else {
        joinRoom(roomCode, playerName, isSpectator);
      }
      setHasJoined(true);
    } catch (error) {
      setErrorMsg('Failed to connect to server. Please try again.');
      setIsConnecting(false);
    }
  }, [roomCode, playerName, isGameMaster, isSpectator, createRoom, joinRoom, setErrorMsg, setRoomCode]);

  // Reset hasJoined when roomCode or playerName changes
  useEffect(() => {
    setHasJoined(false);
  }, [roomCode, playerName]);

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
          {isGameMaster ? 'Create Game' : 'Join Game'}
        </div>
      </div>
      
      {!hasJoined ? (
        <div className="row justify-content-center">
          <div className="col-12 col-md-6">
            {isGameMaster ? (
              // GameMaster join UI with previous design
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
                    value={roomCode || ''}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <small className="text-muted">
                    You can specify a custom room code or leave it blank for a random one.
                  </small>
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
                  {isLoading ? 'Creating...' : isConnecting ? 'Connecting...' : 'Create Room'}
                </button>
                <button
                  className="btn btn-outline-secondary mt-3"
                  onClick={() => {
                    setIsGameMaster(false);
                    setRoomCode('');
                  }}
                >
                  Back to Role Selection
                </button>
              </div>
            ) : (
              // Player join UI with role selection
              <div className="card p-4 text-center">
                <h3>Join a Game</h3>
                <p>Enter the room code and your name to join the game.</p>
                
                <div className="btn-group mb-4" role="group" aria-label="Select Role">
                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="playerRole"
                    checked={!isGameMaster}
                    onChange={() => {
                      setIsGameMaster(false);
                      setIsSpectator(false);
                    }}
                  />
                  <label className="btn btn-outline-primary" htmlFor="playerRole">Player</label>

                  <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="gameMasterRole"
                    checked={isGameMaster}
                    onChange={() => {
                      setIsGameMaster(true);
                      setIsSpectator(false);
                    }}
                  />
                  <label className="btn btn-outline-primary" htmlFor="gameMasterRole">Game Master</label>
                </div>

                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="spectatorCheckbox"
                    checked={isSpectator}
                    onChange={(e) => setIsSpectator(e.target.checked)}
                    disabled={isGameMaster}
                  />
                  <label className="form-check-label" htmlFor="spectatorCheckbox">
                    Join as Spectator
                  </label>
                </div>

                <div className="form-group mb-3">
                  <label htmlFor="roomCodeInput" className="form-label">Room Code:</label>
                  <input
                    type="text"
                    id="roomCodeInput"
                    className="form-control"
                    placeholder="Enter room code"
                    value={roomCode || ''}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
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
                  {isLoading ? 'Processing...' : isConnecting ? 'Connecting...' : 'Join Game'}
                </button>
                <button 
                  className="btn btn-outline-secondary mt-3"
                  onClick={() => navigate('/')}
                >
                  Back to Home
                </button>
              </div>
            )}
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
              <PlayerList title="Players" />
            </div>
            <div className="col-12 col-md-8">
              <div className="card">
                <div className="card-header">
                  <h3 className="mb-0">
                    {isGameMaster ? 'Room Created Successfully!' : 'Waiting for Game Master'}
                  </h3>
                </div>
                <div className="card-body">
                  {isGameMaster ? (
                    <>
                      <p className="mb-4">Your game room has been created. You will be redirected to the Game Master dashboard shortly.</p>
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </>
                  ) : (
                    <p className="mb-4">You have joined the room. Please wait for the Game Master to start the game.</p>
                  )}
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