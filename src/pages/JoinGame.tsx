import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import socketService from '../services/socketService';
import { supabaseService } from '../services/supabaseService';
import audioService from '../services/audioService';
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
  const location = useLocation();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMuted, setIsMuted] = useState(audioService.isMusicMuted());
  const [volume, setVolume] = useState(audioService.getVolume());

  // Read room query parameter from URL and pre-fill room code input
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setRoomCodeInput(roomParam);
    }
  }, [location]);

  const handleToggleMute = () => {
    const newMuteState = audioService.toggleMute();
    setIsMuted(newMuteState);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    audioService.setVolume(newVolume);
    setVolume(newVolume);
  };

  const joinRoom = () => {
    if (!roomCodeInput) {
      setErrorMsg('Please enter a room code!');
      return;
    }
    if (!playerName.trim()) {
      setErrorMsg('Please enter your name!');
      return;
    }
    setIsLoading(true);
    if (isSpectator) {
      socketService.joinAsSpectator(roomCodeInput, playerName);
    } else {
      socketService.joinRoom(roomCodeInput, playerName);
    }
  };

  useEffect(() => {
    socketService.connect();

    socketService.on('room_joined', (data: { roomCode: string }) => {
      console.log('Room joined:', data.roomCode);
      setRoomCode(data.roomCode);
      // Store player info in sessionStorage
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('isGameMaster', 'false');
      sessionStorage.setItem('isSpectator', isSpectator.toString());
      
      // Navigate to appropriate view
      navigate(isSpectator ? '/spectator' : '/player');
    });

    socketService.on('player_joined', (player: Player) => {
      console.log('Player joined:', player);
      setPlayers(prevPlayers => {
        const existingIndex = prevPlayers.findIndex(p => p.id === player.id);
        if (existingIndex >= 0) {
          const updatedPlayers = [...prevPlayers];
          updatedPlayers[existingIndex] = player;
          return updatedPlayers;
        } else {
          return [...prevPlayers, player];
        }
      });
    });

    socketService.on('players_update', (updatedPlayers: Player[]) => {
      console.log('Players updated:', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    socketService.on('error', (msg: string) => {
      setErrorMsg(msg);
      setIsLoading(false);
    });

    const savedRoomCode = sessionStorage.getItem('roomCode');
    const isGameMaster = sessionStorage.getItem('isGameMaster') === 'true';
    if (savedRoomCode && !isGameMaster) {
      console.log('Rejoining as player for room:', savedRoomCode);
      setRoomCode(savedRoomCode);
      socketService.emit('rejoin_player', { roomCode: savedRoomCode });
    }

    return () => {
      socketService.off('room_joined');
      socketService.off('player_joined');
      socketService.off('players_update');
      socketService.off('error');
    };
  }, [navigate, playerName, isSpectator]);

  useEffect(() => {
    audioService.playBackgroundMusic();
    return () => {
      audioService.pauseBackgroundMusic();
    };
  }, []);

  return (
    <div className="container-fluid px-2 px-md-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
          <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
          Join Game
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
      
      {!roomCode ? (
        <div className="row justify-content-center">
          <div className="col-12 col-md-6">
            <div className="card p-4 text-center">
              <h3>Join a Game Room</h3>
              <p>Enter the room code provided by the Game Master.</p>
              <div className="form-group mb-3">
                <label htmlFor="roomCodeInput" className="form-label">Room Code:</label>
                <input
                  type="text"
                  id="roomCodeInput"
                  className="form-control"
                  placeholder="Enter room code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                />
              </div>
              <div className="form-group mb-3">
                <label htmlFor="playerName" className="form-label">Your Name:</label>
                <input
                  type="text"
                  id="playerName"
                  className="form-control"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={15}
                />
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="spectatorCheck"
                  checked={isSpectator}
                  onChange={(e) => setIsSpectator(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="spectatorCheck">
                  Join as Spectator
                </label>
                <small className="form-text text-muted d-block mt-1">
                  Spectators can watch the game without participating. You'll be able to see all players' answers and drawings.
                </small>
              </div>
              <button 
                className="btn btn-primary btn-lg mt-3"
                onClick={joinRoom}
                disabled={isLoading}
              >
                {isLoading ? 'Joining...' : 'Join Room'}
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
              <PlayerList 
                players={players}
                onPlayerSelect={() => {}}
                selectedPlayerId={null}
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