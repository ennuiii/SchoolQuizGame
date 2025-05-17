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
    console.log('[RoomContext] useEffect triggered. Current roomCode:', roomCode, 'PlayerName:', playerName);

    const socket = socketService.getSocket();

    if (socket && socket.connected && roomCode) {
      console.log(`[RoomContext] Socket connected and roomCode (${roomCode}) present. Setting up listeners.`);

      const onRoomCreated = (data: any) => {
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
      };

      const onRoomJoined = (data: { roomCode: string }) => {
        console.log('Received room_joined event:', { roomCode: data.roomCode, playerName, isSpectator });
        setRoomCode(data.roomCode);
        sessionStorage.setItem('roomCode', data.roomCode);
        // Ensure playerName from state is saved if it was set (e.g., by input field)
        // If playerName from state is empty, try session storage (though joinRoom should have set it)
        const nameToSave = playerName || sessionStorage.getItem('playerName') || '';
        sessionStorage.setItem('playerName', nameToSave);
        if(playerName !== nameToSave && nameToSave) setPlayerName(nameToSave);


        sessionStorage.setItem('isGameMaster', 'false');
        sessionStorage.setItem('isSpectator', isSpectator.toString());
        setIsLoading(false);
        setErrorMsg('');
        if (socket && socket.id) {
          setCurrentPlayerId(socket.id);
        }
        console.log('Navigating to:', isSpectator ? '/spectator' : '/player');
        navigate(isSpectator ? '/spectator' : '/player');
      };

      const onPlayerJoined = (player: Player) => {
        console.log('[RoomContext] player_joined event received. Player:', JSON.stringify(player, null, 2));
        setPlayers(prev => {
          console.log('[RoomContext] setPlayers (player_joined) - PREV state:', JSON.stringify(prev, null, 2));
          const existingPlayerIndex = prev.findIndex(p => p.id === player.id);
          let newPlayersState;
          if (existingPlayerIndex !== -1) {
            newPlayersState = [...prev];
            newPlayersState[existingPlayerIndex] = player;
          } else {
            newPlayersState = [...prev, player];
          }
          console.log('[RoomContext] setPlayers (player_joined) - NEW state:', JSON.stringify(newPlayersState, null, 2));
          return newPlayersState;
        });
      };

      const onPlayersUpdate = (updatedPlayers: Player[]) => {
        console.log('[RoomContext] players_update event received. All players:', JSON.stringify(updatedPlayers, null, 2));
        setPlayers(prev => {
          console.log('[RoomContext] setPlayers (players_update) - PREV state:', JSON.stringify(prev, null, 2));
          console.log('[RoomContext] setPlayers (players_update) - Setting NEW state based on received updatedPlayers.');
          return updatedPlayers; // Directly use the authoritative list from the server
        });
      };

      const onBecomeSpectator = () => {
        console.log('[RoomContext] Received become_spectator event');
        setIsSpectator(true);
        sessionStorage.setItem('isSpectator', 'true');
        if (window.location.pathname === '/player') {
          navigate('/spectator');
        }
      };

      const onGameStateUpdate = (gameState: any) => {
        // This handler in RoomContext might be redundant if GameContext handles game_state_update for players
        // For now, ensure roomCode is set if available in gameState, though this effect depends on roomCode
        if (!roomCode && gameState.roomCode) {
          // This condition is unlikely to be met if the outer if (socket && roomCode) is true
          console.log('[RoomContext] game_state_update trying to set roomCode (unlikely path):', gameState.roomCode);
          setRoomCode(gameState.roomCode);
        }
        // console.log('[RoomContext] game_state_update received:', gameState); // Potentially noisy
      };

      const onErrorHandler = (error: string) => { // Renamed to avoid conflict with onError prop
        console.error('[RoomContext] Socket error event:', error);
        setErrorMsg(error);
        setIsLoading(false);
        if (error.includes('Invalid room code') || error.includes('not found')) {
          console.error('[RoomContext] Error indicates invalid room:', error);
        }
      };
      
      const onDisconnectHandler = () => { // Renamed
        console.log('[RoomContext] Socket disconnected event received by listener');
      };

      const onConnectHandler = () => { // Renamed
        console.log('[RoomContext] Socket connect event received by listener. Current roomCode:', roomCode);
        // Potentially re-verify session or re-join logic if needed here,
        // but joinRoom/createRoom should handle initial connection.
        // This is more for recovery scenarios managed by socket.io's reconnect.
        const savedRoomCode = sessionStorage.getItem('roomCode');
        if (savedRoomCode && roomCode && savedRoomCode === roomCode) {
            console.log('[RoomContext] Reconnected to the same room:', roomCode);
            // May need to emit a "client_reconnected" event to server to get fresh state
            // For now, rely on server to resend state or next game_state_update
        } else if (savedRoomCode) {
            console.log('[RoomContext] Reconnected, session has roomCode but context might differ or be unset:', savedRoomCode);
        }
      };

      // Attach listeners
      console.log('[RoomContext] Attaching listeners for room:', roomCode);
      socket.on('room_created', onRoomCreated);
      socket.on('room_joined', onRoomJoined);
      socket.on('player_joined', onPlayerJoined);
      socket.on('players_update', onPlayersUpdate);
      socket.on('become_spectator', onBecomeSpectator);
      socket.on('game_state_update', onGameStateUpdate); // RoomContext might not need this if GameContext handles player list via game_state_update
      socket.on('error', onErrorHandler);
      socket.on('disconnect', onDisconnectHandler);
      socket.on('connect', onConnectHandler);

      // Initial load from session if playerName is not set (e.g., direct navigation to /gamemaster or /player with session)
      // This part is tricky because of the dependency array and when this effect runs.
      // It's better to handle session restoration more explicitly in page components or on initial app load.
      if (!playerName) {
        const savedPlayerNameFromSession = sessionStorage.getItem('playerName');
        if (savedPlayerNameFromSession) {
          console.log('[RoomContext] Restoring playerName from session in useEffect:', savedPlayerNameFromSession);
          setPlayerName(savedPlayerNameFromSession); // This will cause a re-render and effect re-run
        }
      }
      
      return () => {
        console.log('[RoomContext] useEffect cleanup. Removing listeners for roomCode:', roomCode);
        socket.off('room_created', onRoomCreated);
        socket.off('room_joined', onRoomJoined);
        socket.off('player_joined', onPlayerJoined);
        socket.off('players_update', onPlayersUpdate);
        socket.off('become_spectator', onBecomeSpectator);
        socket.off('game_state_update', onGameStateUpdate);
        socket.off('error', onErrorHandler);
        socket.off('disconnect', onDisconnectHandler);
        socket.off('connect', onConnectHandler);
      };
    } else {
      console.log('[RoomContext] useEffect triggered. Socket not connected or no roomCode. Listeners not set/cleaned.', {
        socketPresent: !!socket,
        socketConnected: socket?.connected,
        roomCode
      });
      return () => {
        console.log('[RoomContext] useEffect cleanup (no roomCode or disconnected socket path).');
      };
    }
  }, [navigate, roomCode, playerName, isSpectator, setRoomCode, setPlayerName, setIsLoading, setErrorMsg, setIsSpectator, setCurrentPlayerId]); // Added all state setters and relevant state to dep array

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