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
  setIsLoading: (loading: boolean) => void;
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

  const createRoom = useCallback(async (roomCode: string) => {
    setIsLoading(true);
    try {
      await socketService.createRoom(roomCode);
    } catch (error) {
      console.error('[RoomContext] Failed to create room:', error);
      setErrorMsg('Unable to connect to game server');
      setIsLoading(false);
    }
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, spectatorStatus?: boolean) => {
    setIsLoading(true);
    if (spectatorStatus !== undefined) {
      setIsSpectator(spectatorStatus);
    }
    // Ensure socket is connected before joining room
    const socket = socketService.connect();
    if (!socket) {
      setErrorMsg('Unable to connect to game server');
      setIsLoading(false);
      return;
    }
    socketService.joinRoom(roomCode, playerName, spectatorStatus);
  }, [setIsSpectator]);

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
    console.log('[RoomContext] Setting up socket event listeners');
    
    const setupSocketListeners = async () => {
      try {
        const socket = await socketService.connect();
        if (!socket) {
          console.log('[RoomContext] No socket available after connection attempt');
          return;
        }

        console.log('[RoomContext] Socket connected, registering event handlers');
        
        socket.on('room_created', (data: any) => {
          console.log('[RoomContext] room_created event received:', data);
          const code = typeof data === 'string' ? data : data.roomCode;
          console.log('[RoomContext] Setting room code to:', code);
          setRoomCode(code);
          sessionStorage.setItem('roomCode', code);
          sessionStorage.setItem('isGameMaster', 'true');
          setIsLoading(false);
          if (window.location.pathname !== '/gamemaster') {
            navigate('/gamemaster');
          }
        });

        socket.on('room_joined', (data: { roomCode: string }) => {
          console.log('Received room_joined event:', { roomCode: data.roomCode, playerName, isSpectator });
          setRoomCode(data.roomCode);
          sessionStorage.setItem('roomCode', data.roomCode);
          sessionStorage.setItem('playerName', playerName);
          sessionStorage.setItem('isGameMaster', 'false');
          sessionStorage.setItem('isSpectator', isSpectator.toString());
          setIsLoading(false);
          setErrorMsg('');
          // Set the current player ID when joining a room
          if (socket && socket.id) {
            setCurrentPlayerId(socket.id);
          }
          console.log('Navigating to:', isSpectator ? '/spectator' : '/player');
          navigate(isSpectator ? '/spectator' : '/player');
        });

        socket.on('player_joined', (player: Player) => {
          setPlayers(prev => [...prev, player]);
        });

        socket.on('players_update', (updatedPlayers: Player[]) => {
          setPlayers(updatedPlayers);
        });

        socket.on('error', (error: string) => {
          setErrorMsg(error);
          setIsLoading(false);
        });

        socket.on('become_spectator', () => {
          console.log('[RoomContext] Received become_spectator event');
          setIsSpectator(true);
          sessionStorage.setItem('isSpectator', 'true');
          // Optional: navigate to spectator view if not already there or if current page is Player page
          if (window.location.pathname === '/player') {
            navigate('/spectator');
          }
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
            socket.emit('rejoin_gamemaster', { roomCode: savedRoomCode });
          } else {
            socket.emit('rejoin_player', {
              roomCode: savedRoomCode,
              playerName: savedPlayerName,
              isSpectator: savedIsSpectator
            });
          }
        }
      } catch (error) {
        console.error('[RoomContext] Failed to setup socket listeners:', error);
        setErrorMsg('Failed to connect to game server');
        setIsLoading(false);
      }
    };

    setupSocketListeners();

    return () => {
      console.log('[RoomContext] Cleaning up socket event listeners');
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('room_created');
        socket.off('room_joined');
        socket.off('player_joined');
        socket.off('players_update');
        socket.off('error');
        socket.off('become_spectator');
      }
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
    setIsLoading,
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