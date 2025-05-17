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
  setIsSpectator: (isSpectator: boolean) => void;
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
      // Set sessionStorage immediately for robust reload/rejoin
      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('isGameMaster', 'true');
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
    // Always save session info for robust reload/rejoin
    sessionStorage.setItem('roomCode', roomCode);
    sessionStorage.setItem('playerName', playerName);
    sessionStorage.setItem('isSpectator', (spectatorStatus ?? false).toString());
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
          throw new Error('Failed to connect to socket server');
        }

        // Handle disconnection
        socket.on('disconnect', () => {
          console.log('[RoomContext] Socket disconnected');
        });

        // Handle reconnection - simplified, no auto-rejoin logic from here
        socket.on('connect', () => {
          console.log('[RoomContext] Socket reconnected');
          
          const savedRoomCode = sessionStorage.getItem('roomCode');

          if (savedRoomCode) {
            console.log('[RoomContext] Reconnected. Room code from session:', savedRoomCode);
          }
        });

        // Handle reconnection errors (generic error handling)
        socket.on('error', (error: string) => {
          console.error('[RoomContext] Socket error:', error);
          setErrorMsg(error);
          setIsLoading(false);
          
          if (error.includes('Invalid room code') || error.includes('not found')) {
            console.error('[RoomContext] Error indicates invalid room:', error);
          }
        });

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
          if (socket && socket.id) {
            setCurrentPlayerId(socket.id);
          }
          console.log('Navigating to:', isSpectator ? '/spectator' : '/player');
          navigate(isSpectator ? '/spectator' : '/player');
        });

        console.log('[RoomContext] Attempting to attach player_joined listener');
        socket.on('player_joined', (player: Player) => {
          console.log('[RoomContext] player_joined event received. Player:', JSON.stringify(player, null, 2));
          setPlayers(prev => {
            const existingPlayerIndex = prev.findIndex(p => p.id === player.id);
            let newPlayersState;
            if (existingPlayerIndex !== -1) {
              newPlayersState = [...prev];
              newPlayersState[existingPlayerIndex] = player;
            } else {
              newPlayersState = [...prev, player];
            }
            console.log('[RoomContext] Updated players state after player_joined:', JSON.stringify(newPlayersState, null, 2));
            return newPlayersState;
          });
        });

        console.log('[RoomContext] Attempting to attach players_update listener');
        socket.on('players_update', (updatedPlayers: Player[]) => {
          console.log('[RoomContext] players_update event received. All players:', JSON.stringify(updatedPlayers, null, 2));
          setPlayers(updatedPlayers);
        });

        console.log('[RoomContext] Attempting to attach become_spectator listener');
        socket.on('become_spectator', () => {
          console.log('[RoomContext] Received become_spectator event');
          setIsSpectator(true);
          sessionStorage.setItem('isSpectator', 'true');
          if (window.location.pathname === '/player') {
            navigate('/spectator');
          }
        });

        console.log('[RoomContext] Attempting to attach game_state_update listener');
        socket.on('game_state_update', (gameState: any) => {
          if (!roomCode) {
            const storedRoomCode = sessionStorage.getItem('roomCode');
            if (storedRoomCode) {
              setRoomCode(storedRoomCode);
            }
          }
          // ... existing code for handling game state ...
        });

        // Check for existing room session - simplified, no auto-rejoin emit
        const savedRoomCode = sessionStorage.getItem('roomCode');
        const savedPlayerName = sessionStorage.getItem('playerName');

        if (!playerName && savedPlayerName) {
          setPlayerName(savedPlayerName);
        }

        if (savedRoomCode) {
          console.log('[RoomContext] Found saved session for room:', savedRoomCode);
        } else {
          // No session to restore
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
        socket.off('game_state_update');
      }
    };
  }, [navigate]);

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
    setIsSpectator,
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