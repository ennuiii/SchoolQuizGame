import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService, { ConnectionStatusType } from '../services/socketService';
import { Socket } from 'socket.io-client';
import KickedNotificationModal from '../components/shared/KickedNotificationModal';

interface Player {
  id: string;
  persistentPlayerId: string;
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
  persistentPlayerId: string | null;
  isGameMaster: boolean;
  connectionStatus: ConnectionStatusType;
  isKickedModalOpen: boolean;
  kickReason: string;

  // Actions
  createRoom: (roomCode?: string) => Promise<void>;
  joinRoom: (roomCode: string, playerName: string, isSpectator?: boolean) => Promise<void>;
  leaveRoom: () => void;
  kickPlayer: (playerPersistentIdToKick: string) => void;
  acknowledgeKick: () => void;
  attemptRejoin: () => Promise<void>;
  setRoomCode: (code: string) => void;
  setPlayerName: (name: string) => void;
  setIsLoading: (loading: boolean) => void;
  setErrorMsg: (msg: string) => void;
  setCopied: (copied: boolean) => void;
  setIsSpectator: (isSpectator: boolean) => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCodeState] = useState('');
  const [playerName, setPlayerNameState] = useState('');
  const [isSpectator, setIsSpectatorState] = useState(false);
  const [isLoading, setIsLoadingState] = useState(false);
  const [errorMsg, setErrorMsgState] = useState('');
  const [players, setPlayersState] = useState<Player[]>([]);
  const [copied, setCopiedState] = useState(false);
  
  // New/Updated State
  const [persistentPlayerId, setPersistentPlayerIdState] = useState<string | null>(() => socketService.getPersistentPlayerId());
  const [isGameMaster, setIsGameMasterState] = useState<boolean>(() => sessionStorage.getItem('isGameMaster') === 'true');
  const [connectionStatus, setConnectionStatusState] = useState<ConnectionStatusType>(socketService.getConnectionState());
  
  const [isKickedModalOpen, setIsKickedModalOpenState] = useState(false);
  const [kickReason, setKickReasonState] = useState('');

  // Propagate state changes to sessionStorage and internal state
  const setRoomCode = useCallback((code: string) => {
    setRoomCodeState(code);
    if (code) sessionStorage.setItem('roomCode', code);
    else sessionStorage.removeItem('roomCode');
  }, []);

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    if (name) sessionStorage.setItem('playerName', name);
    else sessionStorage.removeItem('playerName');
  }, []);

  const setIsSpectator = useCallback((spectator: boolean) => {
    setIsSpectatorState(spectator);
    sessionStorage.setItem('isSpectator', spectator.toString());
  }, []);

  const setIsLoading = useCallback((loading: boolean) => setIsLoadingState(loading), []);
  const setErrorMsg = useCallback((msg: string) => setErrorMsgState(msg), []);
  const setCopied = useCallback((val: boolean) => setCopiedState(val), []);

  // Effect for Socket Connection Status
  useEffect(() => {
    const cleanup = socketService.onConnectionStateChange((status, details) => {
      console.log('[RoomContext] Connection state changed:', status, details);
      setConnectionStatusState(status);
      if (status === 'connected') {
        const currentPId = socketService.getPersistentPlayerId();
        setPersistentPlayerIdState(currentPId);
        setErrorMsgState(''); // Clear previous errors on successful connection
      } else if (status === 'error' && details?.message) {
        setErrorMsgState(details.message);
      } else if (status === 'reconnect_failed'){
        setErrorMsgState('Failed to reconnect to the server. Please check your connection and try again.');
      }
    });
    return cleanup;
  }, []);

  const createRoom = useCallback(async (newRoomCode?: string) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Player name for GM can be a default or from input if we add it
      const gmPlayerName = playerName || 'GameMaster'; 
      socketService.setPlayerDetails(gmPlayerName); // Server uses this for GM's player name
      socketService.setGMConnectionDetails(true, newRoomCode); // Pass roomCode if provided
      
      await socketService.createRoom(newRoomCode); // socketService.createRoom will ensure connection
      // 'room_created' event will be handled by the main useEffect below
      // No need to set isLoading(false) here, main useEffect's room_created will do it.
      // No need to set currentSocket, socketService manages it.
    } catch (error: any) {
      console.error('[RoomContext] createRoom error:', error);
      setErrorMsg(error.message || 'Unable to create room.');
      setIsLoading(false);
    }
  }, [setIsLoading, setErrorMsg, playerName]);

  const joinRoom = useCallback(async (roomCodeInput: string, playerNameInput: string, spectatorStatusInput: boolean = false) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      setPlayerName(playerNameInput);
      setIsSpectator(spectatorStatusInput);
      
      socketService.setPlayerDetails(playerNameInput);
      socketService.setGMConnectionDetails(false);

      await socketService.joinRoom(roomCodeInput, playerNameInput, spectatorStatusInput);
      // 'room_joined' event will be handled by main useEffect.
      // setRoomCode(roomCodeInput) can happen here or in onRoomJoined handler to be robust
      // No need to set isLoading(false) here, main useEffect's room_joined or error will.
    } catch (error: any) {
      console.error('[RoomContext] joinRoom error:', error);
      setErrorMsg(error.message || 'Unable to join room.');
      setIsLoading(false);
      // Clear potentially stale session items if join fails badly
      sessionStorage.removeItem('roomCode');
      sessionStorage.removeItem('playerName');
    }
  }, [setIsLoading, setErrorMsg, setPlayerName, setIsSpectator]);

  const attemptRejoin = useCallback(async () => {
    const storedRoomCode = sessionStorage.getItem('roomCode');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedIsGM = sessionStorage.getItem('isGameMaster') === 'true';
    const storedIsSpectator = sessionStorage.getItem('isSpectator') === 'true';

    if (storedRoomCode && (storedPlayerName || storedIsGM) && connectionStatus === 'connected') {
      console.log('[RoomContext] Attempting rejoining with session data:', 
                  { storedRoomCode, storedPlayerName, storedIsGM, storedIsSpectator });
      setIsLoading(true);
      try {
        if (storedIsGM) {
          // For GM, simply setting details and calling createRoom (which server handles as rejoin if room exists)
          // Or a dedicated 'rejoin_gm' event if server supports it.
          // For now, let's assume server's CSR handles GM recovery, client just needs to connect.
          // If createRoom needs a name:
          socketService.setPlayerDetails(storedPlayerName || 'GameMaster');
          socketService.setGMConnectionDetails(true, storedRoomCode);
          // We might not need to explicitly emit create_room again if CSR worked and server re-associates.
          // If CSR means socket auto-rejoins, server might send game_state_update.
          // Let's ensure the roomCode is set in context if we have it from session.
          setRoomCode(storedRoomCode);
          setIsGameMasterState(true);
          // The main useEffect should pick up events if socket recovered state.
          // If not, maybe emit a specific rejoin event.
          console.log('[RoomContext] GM Rejoin: Connected. Trusting CSR or waiting for server events.');
          // await socketService.robustEmit('gm_rejoin_check', { roomCode: storedRoomCode }); // Example if needed
        } else if (storedPlayerName) {
          await joinRoom(storedRoomCode, storedPlayerName, storedIsSpectator);
        }
      } catch (error: any) {
        console.error('[RoomContext] Error during attemptRejoin:', error);
        setErrorMsg('Failed to rejoin: ' + error.message);
      }
      setIsLoading(false);
    } else {
      console.log('[RoomContext] No session data or not connected, skipping auto-rejoin.');
    }
  }, [connectionStatus, setIsLoading, setErrorMsg, joinRoom, setRoomCode]);
  
  // Main useEffect for Socket Event Listeners (Players, Game State, etc.)
  useEffect(() => {
    let isMounted = true;
    const socket = socketService.getSocket(); // Get current socket instance

    // Only setup listeners if socket is available and connected, or if status implies it will connect.
    // This effect should re-run when connectionStatus changes or roomCode changes.
    if (!socket || connectionStatus !== 'connected') {
        if (connectionStatus === 'disconnected' || connectionStatus === 'reconnect_failed') {
            // Potentially clear players list if fully disconnected and failed to reconnect
            // setPlayersState([]);
        }
        return; // Don't setup listeners if not connected
    }
    console.log('[RoomContext] main useEffect: Setting up listeners. Socket ID:', socket.id, 'RoomCode:', roomCode);

    // --- Event Handlers ---
    const onRoomCreated = (data: { roomCode: string, gamemasterPersistentId?: string }) => {
      if (!isMounted) return;
      console.log('[RoomContext] main useEffect: room_created event. Data:', data);
      setRoomCode(data.roomCode);
      setIsGameMasterState(true); // GM created the room
      setPersistentPlayerIdState(data.gamemasterPersistentId || socketService.getPersistentPlayerId());
      setIsLoading(false);
      navigate(`/gamemaster/${data.roomCode}`);
    };

    const onRoomJoined = (data: { roomCode: string, playerId: string, initialPlayers?: Player[] }) => {
      if (!isMounted) return;
      console.log('[RoomContext] main useEffect: room_joined event. Data:', data, 'Current PlayerName:', playerName, 'IsSpectator:', isSpectator);
      setRoomCode(data.roomCode); 
      setPersistentPlayerIdState(data.playerId || socketService.getPersistentPlayerId());
      setIsGameMasterState(false); // Player joined, not GM
      if (data.initialPlayers) setPlayersState(data.initialPlayers);
      setIsLoading(false);
      if (isSpectator) {
        navigate(`/spectator/${data.roomCode}`);
      } else {
        navigate(`/player/${data.roomCode}`);
      }
    };

    const onPlayersUpdate = (updatedPlayers: Player[]) => {
      if (!isMounted) return;
      console.log('[RoomContext] players_update:', updatedPlayers);
      setPlayersState(updatedPlayers);
    };
    
    const onPlayerReconnected = (data: { roomCode: string, playerId: string, playerName: string, newSocketId: string, isActive: boolean }) => {
      if (!isMounted) return;
      console.log('[RoomContext] player_reconnected_status:', data);
      setPlayersState(prev => prev.map(p => p.persistentPlayerId === data.playerId ? { ...p, id: data.newSocketId, isActive: true, name: data.playerName } : p));
      // If this client is the one who reconnected:
      if (data.playerId === persistentPlayerId) {
        // (window as any).toast?.success(`${data.playerName}, you have reconnected!`);
      }
    };

    const onPlayerDisconnected = (data: { roomCode: string, playerId: string, playerName: string, isActive: boolean }) => {
      if (!isMounted) return;
      console.log('[RoomContext] player_disconnected_status:', data);
      setPlayersState(prev => prev.map(p => p.persistentPlayerId === data.playerId ? { ...p, isActive: false } : p));
      // (window as any).toast?.info(`${data.playerName} disconnected.`);
    };

    const onPlayerRemoved = (data: { roomCode: string, playerId: string, playerName: string }) => {
      if (!isMounted) return;
      console.log('[RoomContext] player_removed_after_timeout:', data);
      setPlayersState(prev => prev.filter(p => p.persistentPlayerId !== data.playerId));
      // (window as any).toast?.warn(`${data.playerName} was removed due to inactivity.`);
    };

    const onGmDisconnectedStatus = (data: { roomCode: string, isDisconnected: boolean, gmName: string }) => {
        if (!isMounted) return;
        console.log('[RoomContext] gm_disconnected_status:', data);
        // (window as any).toast?.warn(data.isDisconnected ? `${data.gmName} (GM) disconnected.` : `${data.gmName} (GM) reconnected.`);
        // UI could show a banner or something based on this
    };

    const onSessionNotFullyRecovered = () => {
        if (!isMounted) return;
        console.warn('[RoomContext] Received session_not_fully_recovered_join_manually from server.');
        // (window as any).toast?.info('Session recovery incomplete. Please try rejoining the room if needed.');
        // Consider triggering attemptRejoin or guiding user.
        // For now, just log. Context state changes might trigger UI updates.
    };

    const onKickedFromRoomHandler = ({ reason }: { reason: string }) => {
      if (!isMounted) return;
      console.log('[RoomContext] Kicked from room:', reason);
      setKickReasonState(reason || 'You have been removed from the room.');
      setIsKickedModalOpenState(true);
      // Actual navigation will happen in acknowledgeKick after modal interaction
    };

    const onErrorHandler = (errorData: string | { message: string }) => {
      if (!isMounted) return;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'An unknown error occurred.';
      console.error('[RoomContext] main useEffect: Error from socket:', message);
      setErrorMsg(message);
      setIsLoading(false); // Stop loading on error
    };

    // Register listeners
    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('players_update', onPlayersUpdate);
    socket.on('player_reconnected_status', onPlayerReconnected);
    socket.on('player_disconnected_status', onPlayerDisconnected);
    socket.on('player_removed_after_timeout', onPlayerRemoved);
    socket.on('gm_disconnected_status', onGmDisconnectedStatus);
    socket.on('session_not_fully_recovered_join_manually', onSessionNotFullyRecovered);
    socket.on('kicked_from_room', onKickedFromRoomHandler);
    socket.on('error', onErrorHandler);
    // socket.on('connect', onConnectHandler); // Handled by socketService
    // socket.on('disconnect', onDisconnectHandler); // Handled by socketService

    return () => {
      isMounted = false;
      console.log('[RoomContext] main useEffect: Cleaning up listeners for Socket ID:', socket.id);
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('players_update', onPlayersUpdate);
      socket.off('player_reconnected_status', onPlayerReconnected);
      socket.off('player_disconnected_status', onPlayerDisconnected);
      socket.off('player_removed_after_timeout', onPlayerRemoved);
      socket.off('gm_disconnected_status', onGmDisconnectedStatus);
      socket.off('session_not_fully_recovered_join_manually', onSessionNotFullyRecovered);
      socket.off('kicked_from_room', onKickedFromRoomHandler);
      socket.off('error', onErrorHandler);
    };
  // Dependencies: connectionStatus (from socketService), roomCode (local to context, affects navigation)
  // playerName, isSpectator used in onRoomJoined for navigation logic
  // persistentPlayerId used in onPlayerReconnected to check if current client reconnected
  }, [connectionStatus, roomCode, navigate, playerName, isSpectator, persistentPlayerId, setErrorMsg, setIsLoading, setRoomCode]);

  const leaveRoom = useCallback(() => {
    socketService.disconnect(); // Use service's disconnect method
    setRoomCodeState('');
    setPlayerNameState('');
    setIsSpectatorState(false);
    setIsLoadingState(false);
    setErrorMsgState('');
    setPlayersState([]);
    setCopiedState(false);
    // setPersistentPlayerIdState(null); // This will be updated by socketService on disconnect / new connection
    setIsKickedModalOpenState(false);
    setKickReasonState('');
    setIsGameMasterState(false);
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isGameMaster');
    sessionStorage.removeItem('isSpectator');
    // socketService.setPersistentPlayerId(null); // Clear it in service too, so next connect gets new one if not recovered
    navigate('/');
  }, [navigate]);

  const kickPlayer = useCallback(async (playerPersistentIdToKick: string) => {
    if (connectionStatus !== 'connected') {
      setErrorMsg('Not connected to server. Cannot kick player.');
      return;
    }
    if (!roomCode) {
      setErrorMsg('No room active. Cannot kick player.');
      return;
    }
    console.log(`[RoomContext] Emitting kick_player event for player P_ID ${playerPersistentIdToKick} in room ${roomCode}`);
    try {
      await socketService.kickPlayer(roomCode, playerPersistentIdToKick);
    } catch (err: any) { // Catch errors from robustEmit
      setErrorMsg(err.message || 'Failed to send kick command.');
    }
  }, [roomCode, connectionStatus, setErrorMsg]);

  const acknowledgeKick = useCallback(() => {
    setIsKickedModalOpenState(false);
    setKickReasonState('');
    leaveRoom(); // Use the existing leaveRoom logic for cleanup and navigation
  }, [leaveRoom]);

  const contextValue = {
    roomCode,
    playerName,
    isSpectator,
    isLoading,
    errorMsg,
    players,
    copied,
    persistentPlayerId,
    isGameMaster,
    connectionStatus,
    isKickedModalOpen,
    kickReason,
    createRoom,
    joinRoom,
    leaveRoom,
    kickPlayer,
    acknowledgeKick,
    attemptRejoin,
    setRoomCode,
    setPlayerName,
    setIsLoading,
    setErrorMsg,
    setCopied,
    setIsSpectator,
  };

  return (
    <RoomContext.Provider value={contextValue}>
      {children}
      <KickedNotificationModal 
        isOpen={isKickedModalOpen}
        reason={kickReason}
        onAcknowledge={acknowledgeKick}
      />
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