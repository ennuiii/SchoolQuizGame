import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { Socket } from 'socket.io-client';

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
  currentSocket: Socket | null; // Added for direct access if needed, though primarily internal
  createRoom: (roomCode: string) => void;
  kickPlayer: (playerIdToKick: string) => void;
  
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
  const [currentSocket, setCurrentSocket] = useState<Socket | null>(null); // New state for the socket instance

  const createRoom = useCallback(async (newRoomCode: string) => {
    setIsLoading(true);
    setErrorMsg('');
    setCurrentSocket(null); // Reset previous socket if any
    try {
      console.log('[RoomContext] createRoom: Attempting to connect socket...');
      const socketInstance = await socketService.connect();
      
      if (!socketInstance || !socketInstance.connected) {
        console.error('[RoomContext] createRoom: Socket connection failed.');
        throw new Error('Failed to connect to server for room creation.');
      }
      
      console.log('[RoomContext] createRoom: Socket connected. Socket ID:', socketInstance.id);
      setCurrentSocket(socketInstance); // Set the connected socket instance in state

      const handleRoomCreatedForCreation = (data: any) => {
        console.log('[RoomContext] createRoom temp handler: room_created received:', data);
        socketInstance.off('room_created', handleRoomCreatedForCreation);
        socketInstance.off('error', handleErrorForCreation);
        const code = typeof data === 'string' ? data : data.roomCode;
        sessionStorage.setItem('roomCode', code);
        sessionStorage.setItem('isGameMaster', 'true');
        setRoomCode(code); 
        setIsLoading(false);
      };

      const handleErrorForCreation = (errorResponse: any) => {
        const errorMessage = typeof errorResponse === 'string' ? errorResponse : errorResponse?.message || 'Room creation failed.';
        console.error('[RoomContext] createRoom temp handler: error received:', errorMessage);
        socketInstance.off('room_created', handleRoomCreatedForCreation);
        socketInstance.off('error', handleErrorForCreation);
        setErrorMsg(errorMessage);
        setIsLoading(false);
        setCurrentSocket(null); // Clear socket on error
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('isGameMaster');
      };

      socketInstance.on('room_created', handleRoomCreatedForCreation);
      socketInstance.on('error', handleErrorForCreation); 

      console.log('[RoomContext] createRoom: Emitting create_room for room:', newRoomCode);
      socketInstance.emit('create_room', { roomCode: newRoomCode, timestamp: new Date().toISOString() });

    } catch (error: any) {
      console.error('[RoomContext] createRoom: Outer catch block error:', error);
      setErrorMsg(error.message || 'Unable to connect or create room.');
      setIsLoading(false);
      setCurrentSocket(null); // Ensure socket is cleared on outer error
    }
  }, [setRoomCode, setIsLoading, setErrorMsg, setCurrentSocket]);

  const joinRoom = useCallback(async (roomCodeInput: string, playerNameInput: string, spectatorStatusInput?: boolean) => {
    setIsLoading(true);
    setErrorMsg('');
    setCurrentSocket(null); // Reset previous socket if any

    if (spectatorStatusInput !== undefined) {
      setIsSpectator(spectatorStatusInput);
    }
    setPlayerName(playerNameInput); // Set player name in context state

    sessionStorage.setItem('roomCode', roomCodeInput);
    sessionStorage.setItem('playerName', playerNameInput);
    sessionStorage.setItem('isSpectator', (spectatorStatusInput ?? false).toString());

    try {
      console.log('[RoomContext] joinRoom: Attempting to connect socket...');
      const socketInstance = await socketService.connect();

      if (!socketInstance || !socketInstance.connected) {
        console.error('[RoomContext] joinRoom: Socket connection failed.');
        throw new Error('Failed to connect to server for joining room.');
      }

      console.log('[RoomContext] joinRoom: Socket connected. Socket ID:', socketInstance.id);
      setCurrentSocket(socketInstance); // Set the connected socket instance in state
      
      // Set roomCode state here to trigger main useEffect for listeners
      // Server will confirm with 'room_joined' event which is handled by main useEffect
      setRoomCode(roomCodeInput); 

      console.log('[RoomContext] joinRoom: Emitting join_room for room:', roomCodeInput);
      socketInstance.emit('join_room', { 
        roomCode: roomCodeInput, 
        playerName: playerNameInput, 
        isSpectator: spectatorStatusInput ?? false 
      });
      // setIsLoading(false); // isLoading will be handled by room_joined or error in main useEffect

    } catch (error: any) {
      console.error('[RoomContext] joinRoom: Outer catch block error:', error);
      setErrorMsg(error.message || 'Unable to connect or join room.');
      setIsLoading(false);
      setCurrentSocket(null);
    }
  }, [setIsLoading, setErrorMsg, setCurrentSocket, setIsSpectator, setPlayerName, setRoomCode]);

  const leaveRoom = useCallback(() => {
    if (currentSocket) {
      console.log('[RoomContext] leaveRoom: Disconnecting socket id:', currentSocket.id);
      currentSocket.disconnect();
    }
    socketService.disconnect(); // Ensure service level disconnect too
    setCurrentSocket(null);
    setRoomCode('');
    setPlayerName('');
    setIsSpectator(false);
    setIsLoading(false);
    setErrorMsg('');
    setPlayers([]);
    setCopied(false);
    setCurrentPlayerId(null);
    // Clear session storage related to room
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isGameMaster');
    sessionStorage.removeItem('isSpectator');

  }, [currentSocket]);

  const kickPlayer = useCallback((playerIdToKick: string) => {
    if (!currentSocket || !currentSocket.connected) {
      console.error('[RoomContext] Cannot kick player: Socket not connected.');
      setErrorMsg('Not connected to server. Cannot kick player.');
      return;
    }
    if (!roomCode) {
      console.error('[RoomContext] Cannot kick player: No room code.');
      setErrorMsg('No room active. Cannot kick player.');
      return;
    }
    console.log(`[RoomContext] Emitting kick_player event for player ${playerIdToKick} in room ${roomCode}`);
    currentSocket.emit('kick_player', { roomCode, playerIdToKick });
  }, [currentSocket, roomCode, setErrorMsg]);

  // Main useEffect for setting up persistent socket event listeners
  useEffect(() => {
    console.log('[RoomContext] Main useEffect triggered. RoomCode:', roomCode, 'Socket ID:', currentSocket?.id, 'Connected:', currentSocket?.connected);

    if (roomCode && currentSocket && currentSocket.connected) {
      const socketToUse = currentSocket; // Use the socket from state
      console.log(`[RoomContext] Attaching listeners to socket ${socketToUse.id} for room ${roomCode}`);

      // Define handlers within useEffect to capture current closure state
      // These will be fresh on each run if roomCode or currentSocket changes.

      const onRoomCreated = (data: any) => { // This is likely for GM, confirms room setup
        console.log('[RoomContext] main useEffect: room_created event received:', data);
        const code = typeof data === 'string' ? data : data.roomCode;
        // setRoomCode(code); // roomCode is already set, this might be redundant or for specific sync
        sessionStorage.setItem('roomCode', code); // Ensure session is accurate
        sessionStorage.setItem('isGameMaster', 'true');
        setIsLoading(false);
        if (window.location.pathname !== '/gamemaster') {
          navigate('/gamemaster');
        }
      };

      const onRoomJoined = (data: { roomCode: string, playerId?: string, initialPlayers?: Player[] }) => { // Server might send initial players
        console.log('[RoomContext] main useEffect: room_joined event. Data:', data, 'Current PlayerName:', playerName, 'IsSpectator:', isSpectator);
        setRoomCode(data.roomCode); // Ensure context roomCode is updated from server
        sessionStorage.setItem('roomCode', data.roomCode);
        
        const nameToUse = playerName || sessionStorage.getItem('playerName') || '';
        if (!playerName && nameToUse) setPlayerName(nameToUse); // Restore if not set
        sessionStorage.setItem('playerName', nameToUse);

        sessionStorage.setItem('isGameMaster', 'false');
        sessionStorage.setItem('isSpectator', isSpectator.toString()); // isSpectator state should be correct by now
        
        let idToSet: string | null = null;
        if (data.playerId) {
            idToSet = data.playerId;
        } else if (socketToUse && socketToUse.id) { // Ensure socketToUse and its id exist
            idToSet = socketToUse.id;
        }
        setCurrentPlayerId(idToSet);

        if (data.initialPlayers) {
            console.log('[RoomContext] main useEffect: Setting initial players from room_joined event:', data.initialPlayers);
            setPlayers(data.initialPlayers);
        }

        setIsLoading(false);
        setErrorMsg('');
        console.log('[RoomContext] Navigating to:', isSpectator ? '/spectator' : '/player');
        navigate(isSpectator ? '/spectator' : '/player');
      };

      const onPlayerJoined = (player: Player) => {
        console.log('[RoomContext] main useEffect: player_joined. Player:', JSON.stringify(player, null, 0));
        setPlayers(prev => {
          const existing = prev.find(p => p.id === player.id);
          if (existing) {
            return prev.map(p => p.id === player.id ? player : p);
          }
          return [...prev, player];
        });
      };

      const onPlayersUpdate = (updatedPlayers: Player[]) => {
        console.log('[RoomContext] main useEffect: players_update. Players:', JSON.stringify(updatedPlayers, null, 0));
        setPlayers(updatedPlayers);
      };

      const onBecomeSpectator = () => {
        console.log('[RoomContext] main useEffect: become_spectator event');
        setIsSpectator(true);
        sessionStorage.setItem('isSpectator', 'true');
        if (window.location.pathname === '/player') {
          navigate('/spectator');
        }
      };

      const onGameStateUpdate = (gameState: any) => {
        // console.log('[RoomContext] game_state_update received:', gameState); 
      };

      const onErrorHandler = (errorData: string | { message: string }) => {
        const error = typeof errorData === 'string' ? errorData : errorData.message;
        console.error('[RoomContext] main useEffect: Socket error event:', error);
        setErrorMsg(error);
        // No setIsLoading(false) here, as error might not relate to initial loading
        if (error.includes('Invalid room code') || error.includes('not found') || error.includes('Room does not exist')) {
          console.warn('[RoomContext] Error indicates invalid/non-existent room:', error);
          // Consider navigating away or clearing room state
          // leaveRoom(); // This might be too drastic, but an option
        }
      };
      
      const onDisconnectHandler = (reason: Socket.DisconnectReason) => {
        console.warn('[RoomContext] main useEffect: Socket disconnected. Reason:', reason, 'Socket ID:', socketToUse.id);
        setErrorMsg(`Disconnected: ${reason}. Attempting to reconnect...`);
        // Socket.IO client will attempt to reconnect based on its config.
        // We don't setCurrentSocket(null) here as the instance might reconnect.
        // If reconnect fails permanently, socketService might need to signal that.
      };

      const onConnectHandler = () => { // For re-connections primarily
        console.log('[RoomContext] main useEffect: Socket re-connected. Socket ID:', socketToUse.id, 'RoomCode:', roomCode);
        setErrorMsg(''); // Clear disconnect error
        // Potentially re-sync state if needed, e.g., by re-emitting join or requesting state
        if (roomCode && playerName) { // If we have room and player info, try to re-establish presence
            console.log('[RoomContext] Re-connected. Emitting join_room to re-sync for player:', playerName);
            socketToUse.emit('join_room', { 
                roomCode, 
                playerName, 
                isSpectator,
                isRejoin: true // Add a flag to indicate this is a rejoin after reconnect
            });
        } else if (roomCode && sessionStorage.getItem('isGameMaster') === 'true') {
             console.log('[RoomContext] Re-connected. GM re-joining room:', roomCode);
             // GM might need a specific rejoin event or the server handles it based on session
             socketToUse.emit('gm_rejoin_room', { roomCode, isRejoin: true });
        }
      };

      const onKickedFromRoomHandler = ({ reason }: { reason: string }) => {
        console.warn(`[RoomContext] Kicked from room. Reason: ${reason}`);
        setErrorMsg(`You have been kicked: ${reason}`);
        // Use toast for a more visible notification
        // Make sure toast is imported and available in this scope or pass it down/use a global toast service
        // For now, direct toast call assuming it might be available or you'll adapt this:
        if (typeof window !== 'undefined' && (window as any).toast) {
            (window as any).toast.error(`You have been kicked: ${reason}`);
        } else {
            alert(`You have been kicked: ${reason}`); // Fallback
        }
        leaveRoom(); // This will clear local state and navigate
        navigate('/'); // Explicitly navigate to home after being kicked
      };

      // Attach listeners
      socketToUse.on('room_created', onRoomCreated); // GM specific
      socketToUse.on('room_joined', onRoomJoined);   // Player/Spectator specific
      socketToUse.on('player_joined', onPlayerJoined);
      socketToUse.on('players_update', onPlayersUpdate);
      socketToUse.on('become_spectator', onBecomeSpectator);
      socketToUse.on('game_state_update', onGameStateUpdate);
      socketToUse.on('error', onErrorHandler);
      socketToUse.on('disconnect', onDisconnectHandler);
      socketToUse.on('connect', onConnectHandler); 
      socketToUse.on('kicked_from_room', onKickedFromRoomHandler); // Add new listener

      // Initial state restoration attempt from session if not already set
      if (!playerName) {
        const savedPlayerName = sessionStorage.getItem('playerName');
        if (savedPlayerName) {
          console.log('[RoomContext] Restoring playerName from session in useEffect:', savedPlayerName);
          setPlayerName(savedPlayerName);
        }
      }
      const savedIsSpectator = sessionStorage.getItem('isSpectator');
      if (savedIsSpectator && (savedIsSpectator === 'true') !== isSpectator) {
         console.log('[RoomContext] Restoring isSpectator from session in useEffect:', savedIsSpectator === 'true');
         setIsSpectator(savedIsSpectator === 'true');
      }
      
      return () => {
        console.log(`[RoomContext] useEffect cleanup. Removing listeners from socket ${socketToUse.id} for room ${roomCode}`);
        socketToUse.off('room_created', onRoomCreated);
        socketToUse.off('room_joined', onRoomJoined);
        socketToUse.off('player_joined', onPlayerJoined);
        socketToUse.off('players_update', onPlayersUpdate);
        socketToUse.off('become_spectator', onBecomeSpectator);
        socketToUse.off('game_state_update', onGameStateUpdate);
        socketToUse.off('error', onErrorHandler);
        socketToUse.off('disconnect', onDisconnectHandler);
        socketToUse.off('connect', onConnectHandler);
        socketToUse.off('kicked_from_room', onKickedFromRoomHandler); // Cleanup new listener
      };
    } else {
      console.log('[RoomContext] Main useEffect: No roomCode or socket not connected/present. Listeners not set.');
      return () => {
        console.log('[RoomContext] Main useEffect cleanup (no roomCode or socket path).');
      };
    }
  }, [
    roomCode, currentSocket, navigate, 
    setRoomCode, setPlayerName, setIsLoading, setErrorMsg, setIsSpectator, setCurrentPlayerId, setPlayers,
    playerName, isSpectator // Added playerName and isSpectator because onConnectHandler uses them directly for re-join logic
  ]);

  const value = {
    roomCode,
    playerName,
    isSpectator,
    isLoading,
    errorMsg,
    players,
    copied,
    currentPlayerId,
    currentSocket, // Expose currentSocket if needed by consumers, though not primary API
    createRoom,
    setRoomCode,
    setPlayerName,
    setIsLoading,
    setErrorMsg,
    setCopied,
    setIsSpectator,
    joinRoom,
    leaveRoom,
    kickPlayer
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