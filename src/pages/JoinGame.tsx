import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import socketService from '../services/socketService';
import audioService from '../services/audioService';
import { useGame } from '../context/GameContext';
import PlayerList from '../components/shared/PlayerList';
import RoomCode from '../components/shared/RoomCode';

const JoinGame: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useGame();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Clean up socket listeners
  useEffect(() => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('error');
    }
  }, []);

  const handleCreateRoom = useCallback(async () => {
    if (!playerNameInput.trim()) {
      setErrorMsg('Please enter a name');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // Connect to socket first
      const socket = socketService.connect();
      
      // Clean up any existing listeners
      socket.off('room_created');
      socket.off('error');
      
      // Set up room creation handler
      socket.on('room_created', ({ roomCode }) => {
        console.log('Room created:', roomCode);
        dispatch({ type: 'SET_ROOM_CODE', payload: roomCode });
        dispatch({ type: 'SET_PLAYER_NAME', payload: playerNameInput.trim() });
        sessionStorage.setItem('roomCode', roomCode);
        sessionStorage.setItem('playerName', playerNameInput.trim());
        sessionStorage.setItem('isGameMaster', 'true');
        navigate('/gamemaster');
        setIsLoading(false);
      });

      // Set up error handler
      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setErrorMsg('Failed to create room. Please try again.');
        setIsLoading(false);
      });

      // Create the room
      socketService.createRoom();
    } catch (error) {
      console.error('Error creating room:', error);
      setErrorMsg('Failed to create room. Please try again.');
      setIsLoading(false);
    }
  }, [playerNameInput, navigate, dispatch]);

  const handleJoinRoom = useCallback(async () => {
    if (!roomCodeInput.trim() || !playerNameInput.trim()) {
      setErrorMsg('Please enter both room code and name');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // Connect to socket first
      const socket = socketService.connect();
      
      // Clean up any existing listeners
      socket.off('room_joined');
      socket.off('error');
      
      // Set up room joined handler
      socket.on('room_joined', ({ roomCode }) => {
        console.log('Joined room:', roomCode);
        dispatch({ type: 'SET_ROOM_CODE', payload: roomCode });
        dispatch({ type: 'SET_PLAYER_NAME', payload: playerNameInput.trim() });
        sessionStorage.setItem('roomCode', roomCode);
        sessionStorage.setItem('playerName', playerNameInput.trim());
        sessionStorage.setItem('isGameMaster', 'false');
        navigate('/player');
        setIsLoading(false);
      });

      // Set up error handler
      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setErrorMsg('Failed to join room. Please try again.');
        setIsLoading(false);
      });

      // Join the room
      socketService.joinRoom(roomCodeInput.trim(), playerNameInput.trim(), false);
    } catch (error) {
      console.error('Error joining room:', error);
      setErrorMsg('Failed to join room. Please try again.');
      setIsLoading(false);
    }
  }, [roomCodeInput, playerNameInput, navigate, dispatch]);

  const handleJoinAsSpectator = useCallback(async () => {
    if (!roomCodeInput.trim()) {
      setErrorMsg('Please enter a room code');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // Connect to socket first
      const socket = socketService.connect();
      
      // Clean up any existing listeners
      socket.off('room_joined');
      socket.off('error');
      
      // Set up room joined handler
      socket.on('room_joined', ({ roomCode }) => {
        console.log('Joined room as spectator:', roomCode);
        dispatch({ type: 'SET_ROOM_CODE', payload: roomCode });
        dispatch({ type: 'SET_SPECTATOR', payload: true });
        sessionStorage.setItem('roomCode', roomCode);
        sessionStorage.setItem('isSpectator', 'true');
        navigate('/spectator');
        setIsLoading(false);
      });

      // Set up error handler
      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setErrorMsg('Failed to join as spectator. Please try again.');
        setIsLoading(false);
      });

      // Join the room as spectator
      socketService.joinRoom(roomCodeInput.trim(), 'Spectator', true);
    } catch (error) {
      console.error('Error joining as spectator:', error);
      setErrorMsg('Failed to join as spectator. Please try again.');
      setIsLoading(false);
    }
  }, [roomCodeInput, navigate, dispatch]);

  useEffect(() => {
    // Start playing background music when component mounts
    audioService.playBackgroundMusic();

    // Cleanup when component unmounts
    return () => {
      audioService.pauseBackgroundMusic();
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('room_created');
        socket.off('room_joined');
        socket.off('error');
      }
    };
  }, []);

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h1 className="text-center mb-4">Join a Game</h1>
              <div className="mb-3">
                <label htmlFor="roomCode" className="form-label">Room Code</label>
                <input
                  type="text"
                  className="form-control"
                  id="roomCode"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  placeholder="Enter room code"
                />
              </div>
              <div className="mb-3">
                <label htmlFor="playerName" className="form-label">Your Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="playerName"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary"
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create New Room'}
                </button>
                <button
                  className="btn btn-success"
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                >
                  {isLoading ? 'Joining...' : 'Join Room'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleJoinAsSpectator}
                  disabled={isLoading}
                >
                  {isLoading ? 'Joining...' : 'Join as Spectator'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinGame; 