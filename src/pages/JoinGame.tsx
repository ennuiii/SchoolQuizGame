import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socketService from '../services/socketService';
import { useRoom } from '../contexts/RoomContext';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';
import SettingsControl from '../components/shared/SettingsControl';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n';

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
  const [hasJoined, setHasJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { language } = useLanguage();
  
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
        // Add isInitialConnection parameter to socket
        // Mark this as an initial connection to bypass player name requirement
        socketService.setConnectionParams({ isInitialConnection: true });
        
        // Set player details if available from previous session
        const savedPlayerName = sessionStorage.getItem('playerName');
        if (savedPlayerName) {
          socketService.setPlayerDetails(savedPlayerName);
        }
        
        console.log('[JoinGame] Connecting with initial parameters:', { 
          isInitialConnection: true,
          playerName: savedPlayerName || null
        });
        
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
    if (!roomCode || !playerName) {
      setErrorMsg('Please enter both room code and player name!');
      return;
    }

    setIsConnecting(true);
    try {
      // Save player name to sessionStorage for persistence
      sessionStorage.setItem('playerName', playerName);
      
      // Set player details for the actual join attempt
      socketService.setPlayerDetails(playerName);
      
      // Reset connection params (no longer an initial connection)
      socketService.setConnectionParams({ isInitialConnection: false });
      
      console.log('[JoinGame] Attempting to join room with params:', {
        roomCode,
        playerName,
        isInitialConnection: false
      });
      
      const socket = await socketService.connect();
      if (!socket || !socket.connected) {
        setErrorMsg('Not connected to server. Please try again.');
        setIsConnecting(false);
        return;
      }

      joinRoom(roomCode, playerName, isSpectator);
    } catch (error) {
      setErrorMsg('Failed to connect to server. Please try again.');
      setIsConnecting(false);
    }
  }, [roomCode, playerName, isSpectator, joinRoom, setErrorMsg]);

  // Listen for room_joined and error events to set hasJoined correctly
  useEffect(() => {
    const socketPromise = socketService.connect();
    let socket: any = null;
    socketPromise.then(s => {
      socket = s;
      if (!socket) return;
      const handleRoomJoined = () => setHasJoined(true);
      const handleError = () => setHasJoined(false);
      socket.on('room_joined', handleRoomJoined);
      socket.on('error', handleError);
      // Cleanup
      return () => {
        socket.off('room_joined', handleRoomJoined);
        socket.off('error', handleError);
      };
    });
    // No cleanup needed for the promise itself
  }, []);

  // Handle force reconnect to fix "Already connected" errors
  const handleResetConnection = async () => {
    setIsResetting(true);
    setErrorMsg("");
    
    try {
      // Clear any stored player data that might cause reconnection issues
      localStorage.removeItem('roomCode');
      
      // Force reconnect using the new method
      await socketService.forceReconnect();
      
      // Update UI state
      console.log('[JoinGame] Connection reset successful');
      setIsResetting(false);
    } catch (error) {
      console.error('[JoinGame] Error resetting connection:', error);
      setErrorMsg('Failed to reset connection. Please refresh the page.');
      setIsResetting(false);
    }
  };

  return (
    <>
      <SettingsControl />
      <div className="container-fluid px-2 px-md-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
          <div className="dashboard-caption mb-3 mb-md-0" style={{ width: '100%', textAlign: 'center' }}>
            <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
            {t('joinGame.title', language)}
          </div>
        </div>
        
        {!hasJoined ? (
          <div className="row justify-content-center">
            <div className="col-12 col-md-6">
              <div className="card p-4 text-center">
                <h3>{t('joinGame.title', language)}</h3>
                <p>{t('joinGame.subtitle', language)}</p>
                
                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="spectatorCheckbox"
                    checked={isSpectator}
                    onChange={(e) => setIsSpectator(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="spectatorCheckbox">
                    {t('joinGame.joinAsSpectator', language)}
                  </label>
                </div>

                <div className="form-group mb-3">
                  <label htmlFor="roomCodeInput" className="form-label">{t('joinGame.roomCodeLabel', language)}</label>
                  <input
                    type="text"
                    id="roomCodeInput"
                    className="form-control"
                    placeholder={t('joinGame.roomCodePlaceholder', language)}
                    value={roomCode || ''}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                </div>

                <div className="form-group mb-3">
                  <label htmlFor="playerNameInput" className="form-label">{t('joinGame.playerNameLabel', language)}</label>
                  <input
                    type="text"
                    id="playerNameInput"
                    className="form-control"
                    placeholder={t('joinGame.playerNamePlaceholder', language)}
                    value={playerName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setPlayerName(newName);
                      // Update player details in socketService when name is entered
                      if (newName) {
                        socketService.setPlayerDetails(newName);
                      }
                    }}
                  />
                </div>

                {errorMsg && (
                  <div className="alert alert-danger" role="alert">
                    {t(errorMsg, language) || errorMsg}
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
                  disabled={isLoading || isConnecting || isResetting}
                >
                  {isLoading ? t('joinGame.processing', language) : isConnecting ? t('joinGame.connecting', language) : t('joinGame.joinGame', language)}
                </button>
                
                {errorMsg && errorMsg.includes("Already connected") && (
                  <button 
                    className="btn btn-warning mt-3 ms-2"
                    onClick={handleResetConnection}
                    disabled={isResetting}
                  >
                    {isResetting ? "Resetting..." : "Reset Connection"}
                  </button>
                )}
                
                <button 
                  className="btn btn-outline-secondary mt-3"
                  onClick={() => navigate('/')}
                >
                  {t('joinGame.backToHome', language)}
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
                <PlayerList title={t('players', language)} />
              </div>
              <div className="col-12 col-md-8">
                <div className="card">
                  <div className="card-header">
                    <h3 className="mb-0">
                      {t('joinGame.waitingForGM', language)}
                    </h3>
                  </div>
                  <div className="card-body">
                    <p className="mb-4">{t('joinGame.joinedRoom', language)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default JoinGame; 