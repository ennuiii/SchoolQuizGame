import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

interface RoomContextType {
  // Room State
  roomCode: string;
  playerName: string;
  isSpectator: boolean;
  isLoading: boolean;
  errorMsg: string;
  players: Player[];
  copied: boolean;
  currentPlayerId: string | null;
  createRoom: (roomCode: string) => void;
  
  // Actions
  setRoomCode: (code: string) => void;
  setPlayerName: (name: string) => void;
  setErrorMsg: (msg: string) => void;
  setCopied: (copied: boolean) => void;
  joinRoom: (roomCode: string, playerName: string, isSpectator?: boolean) => void;
  leaveRoom: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const createRoom = useCallback((roomCode: string) => {
    setIsLoading(true);
    // Ensure socket is connected before creating room
    const socket = socketService.connect();
    if (!socket) {
      setErrorMsg('Unable to connect to game server');
      setIsLoading(false);
      return;
    }
    socketService.createRoom(roomCode);
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, isSpectator?: boolean) => {
    setIsLoading(true);
    // Ensure socket is connected before joining room
    const socket = socketService.connect();
    if (!socket) {
      setErrorMsg('Unable to connect to game server');
      setIsLoading(false);
      return;
    }
    socketService.joinRoom(roomCode, playerName, isSpectator);
  }, []);

  const leaveRoom = useCallback(() => {
    socketService.disconnect();
    setRoomCode('');
    setPlayerName('');
    setIsSpectator(false);
    setIsLoading(false);
    setErrorMsg('');
    setPlayers([]);
    setCopied(false);
  }, []);

  // Socket event handlers
  useEffect(() => {
    socketService.on('room_created', (data: any) => {
      console.log('[RoomContext] room_created event received:', data);
      // Support both { roomCode: 'ABC123' } and 'ABC123'
      const code = typeof data === 'string' ? data : data.roomCode;
      setRoomCode(code);
      sessionStorage.setItem('roomCode', code);
      sessionStorage.setItem('isGameMaster', 'true');
      setIsLoading(false);
      if (window.location.pathname !== '/gamemaster') {
        navigate('/gamemaster');
      }
    });

    socketService.on('room_joined', (data: { roomCode: string }) => {
      console.log('Received room_joined event:', { roomCode: data.roomCode, playerName, isSpectator });
      setRoomCode(data.roomCode);
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('isGameMaster', 'false');
      sessionStorage.setItem('isSpectator', isSpectator.toString());
      setIsLoading(false);
      setErrorMsg('');
      // Set the current player ID when joining a room
      const socket = socketService.connect();
      if (socket && socket.id) {
        setCurrentPlayerId(socket.id);
      }
      console.log('Navigating to:', isSpectator ? '/spectator' : '/player');
      navigate(isSpectator ? '/spectator' : '/player');
    });

    socketService.on('player_joined', (player: Player) => {
      setPlayers(prev => [...prev, player]);
    });

    socketService.on('players_update', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    socketService.on('error', (error: string) => {
      setErrorMsg(error);
      setIsLoading(false);
    });

    // Check for existing room session
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const savedPlayerName = sessionStorage.getItem('playerName');
    const isGameMaster = sessionStorage.getItem('isGameMaster') === 'true';
    const savedIsSpectator = sessionStorage.getItem('isSpectator') === 'true';

    if (savedRoomCode) {
      setRoomCode(savedRoomCode);
      if (savedPlayerName) {
        setPlayerName(savedPlayerName);
      }
      setIsSpectator(savedIsSpectator);

      if (isGameMaster) {
        socketService.emit('rejoin_gamemaster', { roomCode: savedRoomCode });
      } else {
        socketService.emit('rejoin_player', {
          roomCode: savedRoomCode,
          playerName: savedPlayerName,
          isSpectator: savedIsSpectator
        });
      }
    }

    return () => {
      socketService.off('room_created');
      socketService.off('room_joined');
      socketService.off('player_joined');
      socketService.off('players_update');
      socketService.off('error');
    };
  }, [navigate, playerName, isSpectator]);

  const value = {
    roomCode,
    playerName,
    isSpectator,
    isLoading,
    errorMsg,
    players,
    copied,
    currentPlayerId,
    createRoom,
    setRoomCode,
    setPlayerName,
    setErrorMsg,
    setCopied,
    joinRoom,
    leaveRoom
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}; 