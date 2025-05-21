import React, { useEffect, useRef, useState } from 'react';
import { useWebRTC, peerNameRegistry } from '../../contexts/WebRTCContext';
import { useRoom } from '../../contexts/RoomContext'; // To get player names
import socketService from '../../services/socketService'; // Import socketService
// Corrected import path for bootstrap-icons CSS
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import './WebcamDisplay.css'; // Import the new CSS file

// Define a list of distinct border colors for players
const PLAYER_BORDER_COLORS = [
  '#4285F4', // Google Blue
  '#DB4437', // Google Red
  '#F4B400', // Google Yellow
  '#0F9D58', // Google Green
  '#AA00FF', // Purple
  '#FF6D00', // Orange
  '#00ACC1', // Cyan
  '#FF4081', // Pink
];

// Helper to get a consistent color based on an ID
const getColorForId = (id: string, index: number) => {
  if (!id) return PLAYER_BORDER_COLORS[index % PLAYER_BORDER_COLORS.length];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  return PLAYER_BORDER_COLORS[Math.abs(hash) % PLAYER_BORDER_COLORS.length];
};

interface PeerVideoInfo {
  socketId: string;
  stream: MediaStream;
  playerName: string;
  isSelf: boolean;
  isWebcamActive?: boolean; // Only for self or if we get remote status
  isMicrophoneActive?: boolean; // Only for self or if we get remote status
  borderColor?: string;
}

interface WebcamDisplayProps {
  // Removed props related to old layout, will be controlled by parent pages directly
}

// Keep a mapping of socket IDs to player names as server might not relay this in real-time
const socketToNameMap = new Map<string, string>();

// Map for persistent player IDs to names (more stable than socket IDs)
const persistentIdToNameMap = new Map<string, string>();

const WebcamDisplay: React.FC<WebcamDisplayProps> = () => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [forceRefreshCounter, setForceRefreshCounter] = useState(0);

  const {
    localStream,
    remoteStreams,
    isWebcamActive: selfWebcamActive,
    isMicrophoneActive: selfMicrophoneActive,
    toggleWebcam,
    toggleMicrophone,
    peerNames: contextPeerNames,
    // startLocalStream and initializeWebRTC are called by parent page
  } = useWebRTC();

  const { players: roomPlayers, persistentPlayerId: selfPersistentId, isGameMaster } = useRoom();
  const selfSocketId = socketService.getSocket()?.id; // Get self socket ID here

  // Function to get the best name for a peer
  const getPeerDisplayName = (socketId: string, fallbackName: string): string => {
    // If socket is "self", use special handling
    if (socketId === 'self') {
      if (isGameMaster) {
        return 'GameMaster';
      }
      
      const selfPlayer = roomPlayers.find(p => p.persistentPlayerId === selfPersistentId);
      return selfPlayer?.name || fallbackName;
    }
    
    // Try to get name from our various sources in order of preference:
    
    // 1. First check if the player is in the current room players list
    const playerInRoom = roomPlayers.find(p => p.id === socketId);
    if (playerInRoom) {
      // Handle GameMaster specially
      if (playerInRoom.name === 'GameMaster') {
        return 'GameMaster';
      }
      return playerInRoom.name; 
    }
    
    // 2. Check our registry from WebRTCContext
    const nameFromRegistry = peerNameRegistry.get(socketId);
    if (nameFromRegistry) {
      return nameFromRegistry;
    }
    
    // 3. Check context peer names from WebRTCContext state
    if (contextPeerNames && contextPeerNames.has(socketId)) {
      return contextPeerNames.get(socketId)!;
    }
    
    // 4. Check our global cache by socket ID
    const nameFromCache = socketToNameMap.get(socketId);
    if (nameFromCache) {
      return nameFromCache;
    }
    
    // 5. Try to find this socket in the room players list by checking persistent IDs
    // This helps when socket IDs change but persistent IDs stay the same
    const playerByConnection = roomPlayers.find(p => {
      // If we have a match on persistent ID for any player connected
      const matchingStreamPlayer = Array.from(remoteStreams.keys()).find(streamSocketId => 
        p.persistentPlayerId && 
        persistentIdToNameMap.has(p.persistentPlayerId) &&
        streamSocketId === socketId
      );
      return !!matchingStreamPlayer;
    });
    
    if (playerByConnection) {
      return playerByConnection.name === 'GameMaster' ? 'GameMaster' : playerByConnection.name;
    }
    
    // 6. Check if the socketId matches any persistent ID we know about
    for (const player of roomPlayers) {
      if (player.persistentPlayerId && player.persistentPlayerId.includes(socketId.substring(0, 4))) {
        return player.name === 'GameMaster' ? 'GameMaster' : player.name;
      }
    }
    
    // 7. Fall back to provided name or a generic one with override for GameMaster
    if (socketId.toLowerCase().includes('gamemaster') || socketId.toLowerCase().includes('master')) {
      return 'GameMaster';
    }
    
    // Finally return fallback
    return fallbackName || `Player ${socketId.substring(0, 4)}`;
  };

  // Prepare video feeds array (moved up to be used in the useEffect)
  const getVideoFeeds = (): PeerVideoInfo[] => {
    const feeds: PeerVideoInfo[] = [];
    
    // Add self view
    if (localStream && selfSocketId) {
      const selfDisplayName = getPeerDisplayName('self', 'You');
      
      feeds.push({
        socketId: 'self', // Using 'self' as key to avoid confusion with remote streams
        stream: localStream,
        playerName: selfDisplayName,
        isSelf: true,
        isWebcamActive: selfWebcamActive,
        isMicrophoneActive: selfMicrophoneActive,
        borderColor: '#007bff' // Special border for self
      });
    }

    // Add remote views
    Array.from(remoteStreams.entries()).forEach(([socketId, stream], index) => {
      const displayName = getPeerDisplayName(socketId, `Player ${socketId.substring(0, 4)}`);
      const player = roomPlayers.find(p => p.id === socketId);
      
      // Debug log to check player matching
      if (!player) {
        console.warn(`[WebcamDisplay] Could not find player for socket ${socketId} in roomPlayers. Using name: ${displayName}`);
      } else {
        console.log(`[WebcamDisplay] Found player ${player.name} for socket ${socketId}`);
      }
      
      feeds.push({
        socketId,
        stream,
        playerName: displayName,
        isSelf: false,
        // For remote users, we don't have their direct mic/video status from WebRTCContext yet.
        // We'd need additional signaling for that. For now, icons could be placeholders.
        isWebcamActive: true, // Assume remote video is active if stream exists
        isMicrophoneActive: true, // Assume remote mic is active
        borderColor: getColorForId(player?.persistentPlayerId || socketId, index),
      });
    });
    
    return feeds;
  };

  // Force a refresh of player name mapping every 5 seconds if we have remoteStreams
  useEffect(() => {
    if (remoteStreams.size > 0) {
      const interval = setInterval(() => {
        setForceRefreshCounter(prev => prev + 1);
        console.log('[WebcamDisplay] Force refreshing player name mapping');
        
        // Force refresh players list from server
        if (socketService.getConnectionState() === 'connected') {
          const roomCode = sessionStorage.getItem('roomCode');
          if (roomCode) {
            socketService.requestPlayers(roomCode);
          }
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [remoteStreams.size]);

  // Effect to update the socketToNameMap whenever roomPlayers changes
  useEffect(() => {
    if (roomPlayers.length > 0) {
      console.log('[WebcamDisplay] Processing player list for name mapping:', 
        roomPlayers.map(p => ({
          id: p.id,
          name: p.name,
          persistentId: p.persistentPlayerId,
          isSpectator: p.isSpectator
        }))
      );
      
      // Update our mapping of socket IDs to player names
      roomPlayers.forEach(player => {
        // If player has a name, add it to the mapping
        if (player.id && player.name) {
          // Check if this is a GameMaster
          if (player.name === 'GameMaster') {
            socketToNameMap.set(player.id, 'GameMaster');
          } else {
            socketToNameMap.set(player.id, player.name);
          }
          
          // Also store by persistent ID if available (more stable than socket ID)
          if (player.persistentPlayerId) {
            persistentIdToNameMap.set(player.persistentPlayerId, 
              player.name === 'GameMaster' ? 'GameMaster' : player.name);
          }
        }
      });
    }
  }, [roomPlayers, forceRefreshCounter]);

  // Effect to log remote streams whenever they change
  useEffect(() => {
    console.log("[WebcamDisplay] Remote streams updated:", {
      count: remoteStreams.size,
      streams: Array.from(remoteStreams.entries()).map(([id, stream]) => ({
        id,
        streamActive: stream.active,
        streamId: stream.id,
        knownName: getPeerDisplayName(id, `Player ${id.substring(0, 4)}`),
        tracks: stream.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted
        }))
      }))
    });
    
    // Also log the peer name registry from WebRTContext
    console.log("[WebcamDisplay] Current peer name registry:", 
      Array.from(peerNameRegistry.entries()).map(([id, name]) => ({ id, name }))
    );
    
    // Log our local name maps too
    console.log("[WebcamDisplay] Local name maps:", {
      socketToName: Array.from(socketToNameMap.entries()),
      persistentIdToName: Array.from(persistentIdToNameMap.entries()),
      contextPeerNames: contextPeerNames ? Array.from(contextPeerNames.entries()) : []
    });
  }, [remoteStreams, contextPeerNames, forceRefreshCounter]);

  // Effect to attach streams to video elements
  useEffect(() => {
    // For local stream
    const selfVideoRef = videoRefs.current['self'];
    if (localStream && selfVideoRef) {
      selfVideoRef.srcObject = localStream;
    }

    // For remote streams
    Array.from(remoteStreams.entries()).forEach(([socketId, stream]) => {
      const videoRef = videoRefs.current[socketId];
      if (videoRef) {
        console.log(`[WebcamDisplay] Attaching stream for socket ${socketId} to video element`);
        videoRef.srcObject = stream;
      } else {
        console.warn(`[WebcamDisplay] No video ref found for socket ${socketId}`);
      }
    });
  }, [localStream, remoteStreams]);

  // Get the video feeds for rendering
  const videoFeeds = getVideoFeeds();

  return (
    <div className="webcam-grid">
      {videoFeeds.map((feed) => (
        <div 
          key={feed.socketId}
          className="webcam-item"
          style={{ borderColor: feed.borderColor || '#ccc' }}
        >
          <video
            ref={el => { videoRefs.current[feed.socketId] = el; }}
            autoPlay
            playsInline
            muted={feed.isSelf} // Only mute self view by default
          />
          <div className="video-controls-overlay">
            {feed.isSelf ? (
              <>
                <div 
                  className={`control-icon ${feed.isWebcamActive ? 'active' : 'inactive'}`}
                  onClick={toggleWebcam}
                  title={feed.isWebcamActive ? 'Disable Webcam' : 'Enable Webcam'}
                >
                  <i className={`bi ${feed.isWebcamActive ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`}></i>
                </div>
                <div 
                  className={`control-icon ${feed.isMicrophoneActive ? 'active' : 'inactive'}`}
                  onClick={toggleMicrophone}
                  title={feed.isMicrophoneActive ? 'Mute Mic' : 'Unmute Mic'}
                >
                   <i className={`bi ${feed.isMicrophoneActive ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`}></i>
                </div>
              </>
            ) : (
              <> {/* Placeholder icons for remote users */}
                <div className={`control-icon active`} title="Webcam On">
                  <i className="bi bi-camera-video-fill"></i>
                </div>
                <div className={`control-icon active`} title="Mic On">
                  <i className="bi bi-mic-fill"></i>
                </div>
              </>
            )}
          </div>
          
          {/* Name tag display */}
          <div className="name-tag-container">
            <div className="webcam-name-tag">
              {feed.playerName}
            </div>
          </div>
        </div>
      ))}
      
      {/* Status message section */}
      {localStream && remoteStreams.size === 0 && (
         <p className="text-muted p-2 w-100 text-center small fst-italic">Waiting for other participants...</p>
      )}
      {!localStream && (
         <p className="text-muted p-2 w-100 text-center small fst-italic">Enable your webcam to see participants.</p>
      )}
    </div>
  );
};

export default WebcamDisplay; 