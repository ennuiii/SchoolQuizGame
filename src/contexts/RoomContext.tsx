import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService, { ConnectionStatusType } from '../services/socketService';
import { Socket } from 'socket.io-client';
import KickedNotificationModal from '../components/shared/KickedNotificationModal';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
  persistentPlayerId: string; // Added persistentPlayerId
  avatarSvg?: string; // Added for avatar synchronization
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
  persistentPlayerId: string | null; // Changed from currentPlayerId to persistentPlayerId
  connectionStatus: ConnectionStatusType; // Added connectionStatus
  isGameMaster: boolean; // Added isGameMaster flag
  currentSocket: Socket | null;
  isKickedModalOpen: boolean;
  kickReason: string;
  isStreamerMode: boolean;
  createRoom: (roomCode: string, isStreamerMode?: boolean) => void;
  kickPlayer: (playerSocketId: string) => void;
  
  // Actions
  setRoomCode: (code: string) => void;
  setPlayerName: (name: string) => void;
  setIsLoading: (loading: boolean) => void;
  setErrorMsg: (msg: string) => void;
  setCopied: (copied: boolean) => void;
  setIsSpectator: (isSpectator: boolean) => void;
  setIsStreamerMode: (isStreamerMode: boolean) => void;
  joinRoom: (roomCode: string, playerName: string, isSpectator?: boolean) => void;
  leaveRoom: () => void;
  acknowledgeKick: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState<string>(() => {
    const stored = sessionStorage.getItem('roomCode');
    return stored || '';
  });
  const [playerName, setPlayerName] = useState<string>(() => {
    const stored = sessionStorage.getItem('playerName');
    return stored || '';
  });
  const [isSpectator, setIsSpectator] = useState<boolean>(() => {
    const stored = sessionStorage.getItem('isSpectator');
    return stored === 'true';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [persistentPlayerId, setPersistentPlayerId] = useState<string | null>(socketService.getPersistentPlayerId());
  const [currentSocket, setCurrentSocket] = useState<Socket | null>(null);
  const [isKickedModalOpen, setIsKickedModalOpen] = useState(false);
  const [kickReason, setKickReason] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>(socketService.getConnectionState());
  const [isStreamerMode, setIsStreamerMode] = useState<boolean>(() => {
    const stored = sessionStorage.getItem('isStreamerMode');
    console.log('[RoomContext] Initializing streamer mode state:', {
      storedValue: stored,
      parsedValue: stored === 'true',
      timestamp: new Date().toISOString()
    });
    return stored === 'true';
  });
  const [isGameMaster, setIsGameMaster] = useState<boolean>(() => {
    const storedValue = sessionStorage.getItem('isGameMaster');
    return storedValue ? storedValue === 'true' : false;
  });

  // Subscribe to persistent ID updates directly from socketService
  useEffect(() => {
    const handlePersistentIdUpdate = (newId: string | null) => {
      console.log('[RoomContext] Received persistent_id_updated from socketService:', newId);
      setPersistentPlayerId(newId);
      // Optionally, update sessionStorage if still needed, but localStorage via socketService is primary
      if (newId) {
        sessionStorage.setItem('persistentPlayerId', newId); 
      } else {
        sessionStorage.removeItem('persistentPlayerId');
      }
    };
    const unsubscribe = socketService.onPersistentIdUpdate(handlePersistentIdUpdate);
    // Set initial value one more time in case it was set by socketService constructor after RoomContext init
    const currentIdFromService = socketService.getPersistentPlayerId();
    if (persistentPlayerId !== currentIdFromService) {
        setPersistentPlayerId(currentIdFromService);
    }

    return () => {
      unsubscribe();
    };
  }, [persistentPlayerId]); // persistentPlayerId in dependency array to re-sync if initial state was different from service

  // Subscribe to connection state changes
  useEffect(() => {
    const handleConnectionChange = (state: string, detailInfo?: any) => {
      console.log('[RoomContext] Socket connection state changed:', state, detailInfo);
      setConnectionStatus(state as ConnectionStatusType);
      
      // If connection is established, update persistentPlayerId
      if (state === 'connected') {
        const currentId = socketService.getPersistentPlayerId();
        if (currentId) {
          setPersistentPlayerId(currentId);
        }
        
        // If this is a recovered connection, log it
        if (detailInfo?.recovered) {
          console.log('[RoomContext] Connection recovered with session data. Socket recovered:', detailInfo.recovered);
        }
      }
    };
    
    socketService.onConnectionStateChange(handleConnectionChange);
    
    return () => {
      // No specific cleanup needed here, listener stays active
    };
  }, []);

  const createRoom = useCallback(async (roomCode: string, isStreamerMode: boolean = false) => {
    console.log('[RoomContext] createRoom: Setting player details');
    setIsLoading(true);
    setErrorMsg('');
    socketService.setPlayerDetails('GameMaster');
    console.log('[RoomContext] createRoom: Setting GM connection details');
    socketService.setGMConnectionDetails(true);
    
    console.log('[RoomContext] createRoom: Attempting to connect socket...');
    let socket: Socket | null;
    try {
      socket = await socketService.connect();
      if (!socket) {
        throw new Error('Failed to get socket connection');
      }
      console.log('[RoomContext] createRoom: Socket connected. Socket ID:', socket.id);
      
      setCurrentSocket(socket);
      setRoomCode(roomCode);
      setIsStreamerMode(isStreamerMode);
      
      console.log('[RoomContext] createRoom: Creating room:', roomCode);
      socketService.createRoom(roomCode, isStreamerMode);
      console.log('[RoomContext] createRoom: Room creation request sent, waiting for confirmation...');
      
      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('isGameMaster', 'true');
      sessionStorage.setItem('isStreamerMode', isStreamerMode.toString());
      setIsGameMaster(true);
      
    } catch (error) {
      console.error('[RoomContext] createRoom: Connection failed:', error);
      setErrorMsg('Connection failed. Please try again.');
      setIsLoading(false);
    }
  }, []);

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
    sessionStorage.setItem('isGameMaster', 'false');

    try {
      console.log('[RoomContext] joinRoom: Setting player details');
      socketService.setPlayerDetails(playerNameInput);
      
      console.log('[RoomContext] joinRoom: Setting connection details (not GM)');
      socketService.setGMConnectionDetails(false);
      
      console.log('[RoomContext] joinRoom: Attempting to connect socket...');
      const socketInstance = await socketService.connect();

      if (!socketInstance || !socketInstance.connected) {
        console.error('[RoomContext] joinRoom: Socket connection failed.');
        throw new Error('Failed to connect to server for joining room.');
      }

      console.log('[RoomContext] joinRoom: Socket connected. Socket ID:', socketInstance.id);
      setCurrentSocket(socketInstance); // Set the connected socket instance in state
      
      // Set isGameMaster to false
      setIsGameMaster(false);
      
      // Set roomCode state here to trigger main useEffect for listeners
      // Server will confirm with 'room_joined' event which is handled by main useEffect
      setRoomCode(roomCodeInput); 

      console.log('[RoomContext] joinRoom: Emitting join_room for room:', roomCodeInput);
      await socketService.joinRoom(roomCodeInput, playerNameInput, spectatorStatusInput ?? false);
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
    setPersistentPlayerId(null);
    setIsKickedModalOpen(false); // Ensure modal is closed if leaving room for other reasons
    setKickReason('');
    setIsGameMaster(false);
    // Clear session storage related to room
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isGameMaster');
    sessionStorage.removeItem('isSpectator');

  }, [currentSocket]);

  const kickPlayer = useCallback((playerSocketId: string) => {
    if (socketService.getConnectionState() !== 'connected') {
      console.error('[RoomContext] Cannot kick player: Socket not connected.');
      setErrorMsg('Not connected to server. Cannot kick player.');
      return;
    }
    if (!roomCode) {
      console.error('[RoomContext] Cannot kick player: No room code.');
      setErrorMsg('No room active. Cannot kick player.');
      return;
    }
    
    // Check if this context is a GameMaster - only GMs should be able to kick
    if (!isGameMaster) {
      console.error('[RoomContext] Cannot kick player: Only GameMasters can kick players');
      setErrorMsg('Only GameMasters can kick players');
      return;
    }
    
    // No longer need to check if player exists - just directly call the API
    // The server will handle validating if the player exists and if the GM can kick them
    console.log(`[RoomContext] Sending kick request for player with socket ID ${playerSocketId} from room ${roomCode}`);
    
    // Pass the socket ID directly to the kick function
    socketService.kickPlayerBySocketId(roomCode, playerSocketId)
      .then(() => {
        console.log(`[RoomContext] Successfully sent kick request for player with socket ID: ${playerSocketId}`);
      })
      .catch((error: Error) => {
        console.error(`[RoomContext] Failed to kick player: ${error}`);
        setErrorMsg(`Failed to kick player: ${error.message || 'Unknown error'}`);
      });
  }, [roomCode, isGameMaster, setErrorMsg]);

  const acknowledgeKick = useCallback(() => {
    setIsKickedModalOpen(false);
    setKickReason('');
    leaveRoom(); // Calls all cleanup including socket disconnect
    navigate('/'); // Navigate to home after acknowledging
  }, [leaveRoom, navigate]);

  // Attempt to rejoin if session data exists and we're connected
  const attemptRejoin = useCallback(async () => {
    const storedRoomCode = sessionStorage.getItem('roomCode');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedIsSpectator = sessionStorage.getItem('isSpectator') === 'true';
    const storedIsGameMaster = sessionStorage.getItem('isGameMaster') === 'true';
    
    if (!storedRoomCode || (storedIsGameMaster ? true : !storedPlayerName)) {
      console.log('[RoomContext] No stored session data for rejoin');
      return false;
    }
    
    console.log('[RoomContext] Attempting to rejoin with stored session data:', {
      roomCode: storedRoomCode,
      playerName: storedPlayerName,
      isSpectator: storedIsSpectator,
      isGameMaster: storedIsGameMaster,
      connectionStatus,
      persistentPlayerId: socketService.getPersistentPlayerId()
    });
    
    // If we're not connected, try to establish connection first
    if (connectionStatus !== 'connected') {
      console.log('[RoomContext] Not connected, attempting to connect first...');
      try {
        await socketService.connect();
        // Give a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('[RoomContext] Failed to establish connection for rejoin:', error);
        setErrorMsg('Failed to connect to the server. Please try again.');
        return false;
      }
    }
    
    try {
      // Set up retry logic
      const maxRetries = 3;
      let retryCount = 0;
      let success = false;
      
      while (retryCount < maxRetries && !success) {
        try {
          console.log(`[RoomContext] Rejoin attempt ${retryCount + 1}/${maxRetries}`);
          
          if (storedIsGameMaster) {
            // Rejoin as GM
            setIsGameMaster(true);
            await socketService.rejoinRoom(storedRoomCode, true);
          } else {
            // Rejoin as player/spectator
            setIsGameMaster(false);
            setPlayerName(storedPlayerName || '');
            setIsSpectator(storedIsSpectator);
            await socketService.rejoinRoom(storedRoomCode, false);
          }
          
          success = true;
          console.log('[RoomContext] Rejoin successful');
          
          // Clear any error messages on successful rejoin
          setErrorMsg('');
        } catch (error) {
          retryCount++;
          const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
          
          console.error(`[RoomContext] Rejoin attempt ${retryCount} failed:`, error);
          
          if (retryCount < maxRetries) {
            console.log(`[RoomContext] Retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            console.error('[RoomContext] All rejoin attempts failed');
            setErrorMsg('Failed to rejoin the room. The room may no longer exist or the server may be unavailable.');
            // Don't return false yet, let the navigation code run
          }
        }
      }
      
      // Navigate to the appropriate page even on failure, to show the error message
      if (success) {
        // Navigate to appropriate page based on role
        if (storedIsGameMaster) {
          navigate('/gamemaster');
        } else if (storedIsSpectator) {
          navigate('/spectator');
        } else {
          navigate('/player');
        }
      }
      
      return success;
    } catch (error) {
      console.error('[RoomContext] Unexpected error during rejoin:', error);
      setErrorMsg('An unexpected error occurred. Please try again.');
      return false;
    }
  }, [connectionStatus, navigate, setErrorMsg, setIsGameMaster, setIsSpectator, setPlayerName]);

  // Main useEffect for setting up persistent socket event listeners
  useEffect(() => {
    console.log('[RoomContext] Main useEffect triggered. RoomCode:', roomCode, 'Socket ID:', currentSocket?.id, 'Connected:', currentSocket?.connected);

    if (currentSocket && currentSocket.connected) {
      const socketToUse = currentSocket; // Use the socket from state
      console.log(`[RoomContext] Attaching listeners to socket ${socketToUse.id}${roomCode ? ` for room ${roomCode}` : ''}`);

      // Define handlers within useEffect to capture current closure state
      // These will be fresh on each run if roomCode or currentSocket changes.

      const onRoomCreated = (data: any) => { // This is likely for GM, confirms room setup
        console.log('[RoomContext] main useEffect: room_created event received:', data);
        const code = typeof data === 'string' ? data : data.roomCode;
        setRoomCode(code); // Make sure roomCode is set, even if redundant
        sessionStorage.setItem('roomCode', code); // Ensure session is accurate
        sessionStorage.setItem('isGameMaster', 'true');
        setIsGameMaster(true);
        setIsLoading(false);
        if (window.location.pathname !== '/gamemaster') {
          navigate('/gamemaster');
        }
      };

      const onRoomJoined = (data: { roomCode: string, playerId?: string, initialPlayers?: Player[], isStreamerMode?: boolean }) => {
        console.log('[RoomContext] main useEffect: room_joined event. Data:', data, 'Current PlayerName:', playerName, 'IsSpectator:', isSpectator);
        
        setRoomCode(data.roomCode);
        // persistentPlayerId is now primarily updated by onPersistentIdUpdate from socketService
        // However, room_joined might still provide the *confirmed* ID for this room session.
        // We can log it or ensure it matches what socketService provided.
        if (data.playerId) {
          console.log('[RoomContext] room_joined event provided playerId (persistentId):', data.playerId);
          if (persistentPlayerId !== data.playerId) {
            console.warn('[RoomContext] room_joined playerId mismatch with current persistentPlayerId. Service ID:', persistentPlayerId, 'Event ID:', data.playerId);
            // Potentially trust the room_joined event's ID for this session if there's a discrepancy, though socketService should be the source of truth.
            // setPersistentPlayerId(data.playerId);
            // sessionStorage.setItem('persistentPlayerId', data.playerId);
          }
        }
        
        // Set streamer mode if provided
        if (data.isStreamerMode !== undefined) {
          console.log('[RoomContext] Setting streamer mode from server:', {
            isStreamerMode: data.isStreamerMode,
            previousValue: isStreamerMode,
            timestamp: new Date().toISOString()
          });
          setIsStreamerMode(data.isStreamerMode);
          sessionStorage.setItem('isStreamerMode', data.isStreamerMode.toString());
        } else {
          console.log('[RoomContext] No streamer mode value provided in room_joined event');
        }
        
        // Set initial players if provided
        if (data.initialPlayers) {
          setPlayers(data.initialPlayers);
        }
        
        // Navigate to appropriate page
        if (isSpectator) {
          navigate('/spectator');
        } else {
          navigate('/player');
        }
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

      const onPlayerReconnected = (data: { playerId: string, persistentPlayerId: string, isActive: boolean }) => {
        console.log('[RoomContext] main useEffect: player_reconnected_status. Data:', data);
        setPlayers(prev => {
          return prev.map(player => {
            if (player.persistentPlayerId === data.persistentPlayerId) {
              return { ...player, id: data.playerId, isActive: data.isActive };
            }
            return player;
          });
        });
      };

      const onPlayerDisconnected = (data: { playerId: string, persistentPlayerId: string, isActive: boolean }) => {
        console.log('[RoomContext] main useEffect: player_disconnected_status. Data:', data);
        setPlayers(prev => {
          return prev.map(player => {
            if (player.persistentPlayerId === data.persistentPlayerId) {
              return { ...player, isActive: data.isActive };
            }
            return player;
          });
        });
      };

      const onAvatarUpdated = (data: { persistentPlayerId: string, avatarSvg: string }) => {
        console.log('[RoomContext] main useEffect: avatar_updated. PlayerId:', data.persistentPlayerId);
        
        // Update players state
        setPlayers(prev => {
          return prev.map(player => {
            if (player.persistentPlayerId === data.persistentPlayerId) {
              // Also update localStorage for this player
              try {
                localStorage.setItem(`avatar_${data.persistentPlayerId}`, data.avatarSvg);
              } catch (error) {
                console.error('[RoomContext] Error updating avatar in localStorage:', error);
              }
              return { ...player, avatarSvg: data.avatarSvg };
            }
            return player;
          });
        });
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

      const onSessionNotFullyRecovered = () => {
        console.log('[RoomContext] Session not fully recovered. Attempting rejoin with stored session data.');
        attemptRejoin();
      };

      const onErrorHandler = (errorData: string | { message: string }) => {
        const error = typeof errorData === 'string' ? errorData : errorData.message;
        console.error('[RoomContext] main useEffect: Socket error event:', error);
        
        // More specific error handling for "Already connected"
        if (error.includes('Already connected from another tab/device')) {
          const helpfulMessage = 'Already connected from another tab/device. Try using the "Reset Connection" button below to fix this issue.';
          setErrorMsg(helpfulMessage);
          setIsLoading(false);
          return;
        }
        
        setErrorMsg(error);
        // No setIsLoading(false) here, as error might not relate to initial loading
        
        // Check for room not found errors and handle them by redirecting to home
        if (error.includes('Room not found') || 
            error.includes('room not found') || 
            error.includes('does not exist') || 
            error.includes('Invalid room code') || 
            error.includes('expired') || 
            error.includes('been deleted')) {
          
          console.warn('[RoomContext] Room not found error detected:', error);
          setErrorMsg(error || 'Room not found. You will be redirected to the home screen.');
          
          // Clean up session and navigate to home
          leaveRoom();
          
          // Add a small delay before navigation to ensure the error message is displayed
          setTimeout(() => {
            navigate('/');
          }, 1500);
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
        } else if (roomCode && isGameMaster) {
             console.log('[RoomContext] Re-connected. GM re-joining room:', roomCode);
             // GM might need a specific rejoin event or the server handles it based on session
             socketToUse.emit('gm_rejoin_room', { roomCode, isRejoin: true });
        }
      };

      const onKickedFromRoomHandler = ({ reason }: { reason: string }) => {
        console.warn(`[RoomContext] Kicked from room. Reason: ${reason}`);
        setKickReason(reason);
        setIsKickedModalOpen(true);
        // Do not call leaveRoom() or navigate('/') here anymore. acknowledgeKick will handle it.
      };

      // onReconnectHandler is defined above, handle room_expired event
      const onRoomExpiredHandler = ({ message }: { message: string }) => {
        console.warn(`[RoomContext] Room expired. Message: ${message}`);
        setErrorMsg(message || 'This room has expired. Please create a new room.');
        leaveRoom();
        navigate('/');
      };

      // Handle specific room_not_found event
      const onRoomNotFoundHandler = ({ message }: { message: string }) => {
        console.warn(`[RoomContext] Room not found. Message: ${message}`);
        setErrorMsg(message || 'This room no longer exists. You will be redirected to the home screen.');
        leaveRoom();
        
        // Navigate to home screen
        setTimeout(() => {
          navigate('/');
        }, 1500);
      };

      // Attach listeners
      socketToUse.on('room_created', onRoomCreated); // GM specific
      socketToUse.on('room_joined', onRoomJoined);   // Player/Spectator specific
      socketToUse.on('player_joined', onPlayerJoined);
      socketToUse.on('players_update', onPlayersUpdate);
      socketToUse.on('player_reconnected_status', onPlayerReconnected);
      socketToUse.on('player_disconnected_status', onPlayerDisconnected);
      socketToUse.on('avatar_updated', onAvatarUpdated);
      socketToUse.on('become_spectator', onBecomeSpectator);
      socketToUse.on('game_state_update', onGameStateUpdate); // Handled at game context
      socketToUse.on('session_not_fully_recovered_join_manually', onSessionNotFullyRecovered);
      socketToUse.on('kicked_from_room', onKickedFromRoomHandler);
      socketToUse.on('room_expired', onRoomExpiredHandler);
      socketToUse.on('room_not_found', onRoomNotFoundHandler);
      socketToUse.on('error', onErrorHandler);
      socketToUse.on('disconnect', onDisconnectHandler);
      socketToUse.on('connect', onConnectHandler);

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
      
      // Clean up event listeners
      return () => {
        console.log(`[RoomContext] Cleaning up event listeners for socket ${socketToUse.id}`);
        socketToUse.off('room_created', onRoomCreated);
        socketToUse.off('room_joined', onRoomJoined);
        socketToUse.off('player_joined', onPlayerJoined);
        socketToUse.off('players_update', onPlayersUpdate);
        socketToUse.off('player_reconnected_status', onPlayerReconnected);
        socketToUse.off('player_disconnected_status', onPlayerDisconnected);
        socketToUse.off('avatar_updated', onAvatarUpdated);
        socketToUse.off('become_spectator', onBecomeSpectator);
        socketToUse.off('game_state_update', onGameStateUpdate);
        socketToUse.off('session_not_fully_recovered_join_manually', onSessionNotFullyRecovered);
        socketToUse.off('kicked_from_room', onKickedFromRoomHandler);
        socketToUse.off('room_expired', onRoomExpiredHandler);
        socketToUse.off('room_not_found', onRoomNotFoundHandler);
        socketToUse.off('error', onErrorHandler);
        socketToUse.off('disconnect', onDisconnectHandler);
        socketToUse.off('connect', onConnectHandler);
      };
    } else {
      console.log('[RoomContext] Main useEffect: No socket connection available. Listeners not set.');
      return () => {
        console.log('[RoomContext] Main useEffect cleanup (no socket or socket path).');
      };
    }
  }, [
    roomCode, currentSocket, navigate, 
    setRoomCode, setPlayerName, setIsLoading, setErrorMsg, setIsSpectator, setPersistentPlayerId, setPlayers,
    playerName, isSpectator, isGameMaster, attemptRejoin
  ]);

  // Attempt to restore session on initial load if we're connected
  useEffect(() => {
    if (connectionStatus === 'connected' && !roomCode) {
      const hasSession = sessionStorage.getItem('roomCode') !== null;
      if (hasSession) {
        console.log('[RoomContext] Connected and session exists but no active room. Attempting rejoin.');
        attemptRejoin();
      }
    }
  }, [connectionStatus, roomCode, attemptRejoin]);

  // Handle reconnection
  useEffect(() => {
    if (connectionStatus === 'connected' && roomCode) {
      // If we have a room code but were previously disconnected, request updated state
      console.log('[RoomContext] Connected with room code, requesting latest state:', roomCode);
      
      // Request current game state
      socketService.requestGameState(roomCode);
      
      // Also request current player list
      socketService.requestPlayers(roomCode);
    }
  }, [connectionStatus, roomCode]);

  // Add debug logging for streamer mode state changes
  useEffect(() => {
    console.log('[RoomContext] Streamer mode state changed:', {
      isStreamerMode,
      timestamp: new Date().toISOString()
    });
  }, [isStreamerMode]);

  // Add debug logging for state changes
  useEffect(() => {
    console.log('[RoomContext] State updated:', {
      roomCode,
      playerName,
      isSpectator,
      isStreamerMode,
      timestamp: new Date().toISOString()
    });
  }, [roomCode, playerName, isSpectator, isStreamerMode]);

  // Add a useEffect to watch for connection status changes and automatically rejoin
  useEffect(() => {
    // If we've reconnected after a disconnect and we previously had an active room
    if (connectionStatus === 'connected' && previousConnectionStatus.current === 'reconnecting' && roomCode) {
      console.log('[RoomContext] Detected reconnection after disconnect. Attempting to rejoin automatically...');
      // Short delay to ensure server is fully ready
      setTimeout(() => {
        attemptRejoin()
          .then(success => {
            if (success) {
              console.log('[RoomContext] Automatic rejoin after reconnection successful');
            } else {
              console.error('[RoomContext] Automatic rejoin after reconnection failed');
              setErrorMsg('Reconnection failed. The room may no longer exist or your session may have expired.');
            }
          })
          .catch(error => {
            console.error('[RoomContext] Error during automatic rejoin:', error);
            setErrorMsg('An error occurred during reconnection. Please refresh the page and try again.');
          });
      }, 1000);
    }
    
    // Track previous connection status
    previousConnectionStatus.current = connectionStatus;
  }, [connectionStatus, roomCode, attemptRejoin, setErrorMsg]);

  // Add a reference to track previous connection status
  const previousConnectionStatus = useRef<ConnectionStatusType>('disconnected');

  const value: RoomContextType = {
    roomCode,
    playerName,
    isSpectator,
    isLoading,
    errorMsg,
    players,
    copied,
    persistentPlayerId,
    connectionStatus,
    isGameMaster,
    currentSocket,
    isKickedModalOpen,
    kickReason,
    isStreamerMode,
    createRoom,
    setRoomCode,
    setPlayerName,
    setIsLoading,
    setErrorMsg,
    setCopied,
    setIsSpectator,
    setIsStreamerMode,
    joinRoom,
    leaveRoom,
    kickPlayer,
    acknowledgeKick
  };

  return (
    <RoomContext.Provider value={value}>
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