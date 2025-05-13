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

  const createRoom = useCallback((roomCode: string) => {
    setIsLoading(true);
    socketService.createRoom(roomCode);
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, isSpectator?: boolean) => {
    setIsLoading(true);
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
    socketService.on('room_created', (data: { roomCode: string }) => {
      setRoomCode(data.roomCode);
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('isGameMaster', 'true');
      setIsLoading(false);
      navigate('/gamemaster');
    });

    socketService.on('room_joined', (data: { roomCode: string }) => {
      setRoomCode(data.roomCode);
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('isGameMaster', 'false');
      sessionStorage.setItem('isSpectator', isSpectator.toString());
      setIsLoading(false);
      navigate(isSpectator ? '/spectator' : '/player');
    });

    socketService.on('error', (msg: string) => {
      setErrorMsg(msg);
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