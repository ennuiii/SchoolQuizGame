import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC, peerNameRegistry } from '../../contexts/WebRTCContext';
import { useRoom } from '../../contexts/RoomContext'; // To get player names
import socketService from '../../services/socketService'; // Import socketService
// Corrected import path for bootstrap-icons CSS
import '../../../node_modules/bootstrap-icons/font/bootstrap-icons.css';
import './WebcamDisplay.css'; // Import the new CSS file
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

// Define a list of chalk colors for player borders
const PLAYER_BORDER_COLORS = [
  '#7BDFF2', // Blue chalk
  '#FF6B6B', // Red chalk
  '#B1E77B', // Green chalk
  '#FFE66D', // Yellow chalk
  '#F7AEF8', // Pink chalk
  '#FFFFFF', // White chalk
  '#FFB347', // Orange chalk
  '#CFCFC4', // Light gray chalk
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

// Helper to format device names for better display
const formatDeviceName = (label: string) => {
  if (!label) return '';
  
  // Remove text in parentheses
  let formatted = label.split('(')[0].trim();
  
  // Shorten if too long
  if (formatted.length > 25) {
    formatted = formatted.substring(0, 22) + '...';
  }
  
  return formatted;
};

interface PeerVideoInfo {
  socketId: string;
  stream: MediaStream;
  playerName: string;
  isSelf: boolean;
  isWebcamActive?: boolean; 
  isMicrophoneActive?: boolean;
  borderColor?: string;
}

interface WebcamDisplayProps {
  // Removed props related to old layout, will be controlled by parent pages directly
}

// Keep a mapping of socket IDs to player names as server might not relay this in real-time
const socketToNameMap = new Map<string, string>();

// Map for persistent player IDs to names (more stable than socket IDs)
const persistentIdToNameMap = new Map<string, string>();

// Store user preferences for each peer's camera/mic visibility
const peerPreferences = new Map<string, {
  webcamHidden: boolean;
  micMuted: boolean;
}>();

const WebcamDisplay: React.FC<WebcamDisplayProps> = () => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [forceRefreshCounter, setForceRefreshCounter] = useState(0);
  // Track user preferences for remote peers' media
  const [hiddenWebcams, setHiddenWebcams] = useState<Set<string>>(new Set());
  const [mutedMics, setMutedMics] = useState<Set<string>>(new Set());
  const { language } = useLanguage();

  const {
    localStream,
    remoteStreams,
    isWebcamActive: selfWebcamActive,
    isMicrophoneActive: selfMicrophoneActive,
    toggleWebcam,
    toggleMicrophone,
    peerNames: contextPeerNames,
    availableCameras,
    selectedCameraId,
    availableMicrophones,
    selectedMicrophoneId,
    // startLocalStream and initializeWebRTC are called by parent page
  } = useWebRTC();

  const { players: roomPlayers, persistentPlayerId: selfPersistentId, isGameMaster } = useRoom();
  const selfSocketId = socketService.getSocket()?.id; // Get self socket ID here

  // Toggle webcam visibility for a remote peer
  const togglePeerWebcam = useCallback((socketId: string) => {
    setHiddenWebcams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(socketId)) {
        newSet.delete(socketId);
      } else {
        newSet.add(socketId);
      }
      return newSet;
    });
  }, []);

  // Toggle microphone for a remote peer
  const togglePeerMicrophone = useCallback((socketId: string) => {
    setMutedMics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(socketId)) {
        newSet.delete(socketId);
      } else {
        newSet.add(socketId);
      }
      return newSet;
    });
  }, []);

  // Function to get the best name for a peer
  const getPeerDisplayName = (socketId: string, fallbackName: string): string => {
    // If socket is "self", use special handling
    if (socketId === 'self') {
      if (isGameMaster) {
        return t('gamemaster', language) || 'GameMaster';
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
        return t('gamemaster', language) || 'GameMaster';
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
      return playerByConnection.name === 'GameMaster' ? (t('gamemaster', language) || 'GameMaster') : playerByConnection.name;
    }
    
    // 6. Check if the socketId matches any persistent ID we know about
    for (const player of roomPlayers) {
      if (player.persistentPlayerId && player.persistentPlayerId.includes(socketId.substring(0, 4))) {
        return player.name === 'GameMaster' ? (t('gamemaster', language) || 'GameMaster') : player.name;
      }
    }
    
    // 7. Fall back to provided name or a generic one with override for GameMaster
    if (socketId.toLowerCase().includes('gamemaster') || socketId.toLowerCase().includes('master')) {
      return t('gamemaster', language) || 'GameMaster';
    }
    
    // Finally return fallback
    return fallbackName || t('player', language) + ` ${socketId.substring(0, 4)}`;
  };

  // Get camera name based on selected camera ID
  const getSelectedCameraName = useCallback(() => {
    if (!selectedCameraId) return t('noCameraSelected', language) || 'No camera selected';
    
    const camera = availableCameras.find(c => c.deviceId === selectedCameraId);
    if (!camera) return t('unknownCamera', language) || 'Unknown camera';
    
    // Format the label to be more readable
    if (camera.label) {
      return formatDeviceName(camera.label);
    }
    
    return `${t('camera', language)} ${camera.deviceId.substring(0, 6)}...`;
  }, [selectedCameraId, availableCameras, language]);

  // Get microphone name based on selected microphone ID
  const getSelectedMicrophoneName = useCallback(() => {
    if (!selectedMicrophoneId) return t('noMicrophoneSelected', language) || 'No microphone selected';
    
    const mic = availableMicrophones.find(m => m.deviceId === selectedMicrophoneId);
    if (!mic) return t('unknownMicrophone', language) || 'Unknown microphone';
    
    // Format the label to be more readable
    if (mic.label) {
      return formatDeviceName(mic.label);
    }
    
    return `${t('microphone', language)} ${mic.deviceId.substring(0, 6)}...`;
  }, [selectedMicrophoneId, availableMicrophones, language]);

  // Prepare video feeds array (moved up to be used in the useEffect)
  const getVideoFeeds = (): PeerVideoInfo[] => {
    const feeds: PeerVideoInfo[] = [];
    
    // Add self view
    if (localStream && selfSocketId) {
      const selfDisplayName = getPeerDisplayName('self', t('you', language) || 'You');
      
      feeds.push({
        socketId: 'self', // Using 'self' as key to avoid confusion with remote streams
        stream: localStream,
        playerName: selfDisplayName,
        isSelf: true,
        isWebcamActive: selfWebcamActive,
        isMicrophoneActive: selfMicrophoneActive,
        borderColor: '#FFFFFF' // White chalk for self
      });
    }

    // Add remote views
    Array.from(remoteStreams.entries()).forEach(([socketId, stream], index) => {
      const displayName = getPeerDisplayName(socketId, `${t('player', language)} ${socketId.substring(0, 4)}`);
      const player = roomPlayers.find(p => p.id === socketId);
      
      feeds.push({
        socketId,
        stream,
        playerName: displayName,
        isSelf: false,
        isWebcamActive: !hiddenWebcams.has(socketId), // Use our UI state for webcam visibility
        isMicrophoneActive: !mutedMics.has(socketId), // Use our UI state for mic muting
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
        
        // Force refresh players list from server
        if (socketService.getConnectionState() === 'connected') {
          const roomCode = sessionStorage.getItem('roomCode');
          if (roomCode) {
            socketService.requestPlayers(roomCode);
          }
        }
      }, 15000);
      
      return () => clearInterval(interval);
    }
  }, [remoteStreams.size]);

  // Effect to update the socketToNameMap whenever roomPlayers changes
  useEffect(() => {
    if (roomPlayers.length > 0) {
      // Update our mapping of socket IDs to player names
      roomPlayers.forEach(player => {
        // If player has a name, add it to the mapping
        if (player.id && player.name) {
          // Check if this is a GameMaster
          if (player.name === 'GameMaster') {
            socketToNameMap.set(player.id, t('gamemaster', language) || 'GameMaster');
          } else {
            socketToNameMap.set(player.id, player.name);
          }
          
          // Also store by persistent ID if available (more stable than socket ID)
          if (player.persistentPlayerId) {
            persistentIdToNameMap.set(player.persistentPlayerId, 
              player.name === 'GameMaster' ? (t('gamemaster', language) || 'GameMaster') : player.name);
          }
        }
      });
    }
  }, [roomPlayers, language]);

  // Effect to log remote streams whenever they change
  useEffect(() => {
    // Only run this effect when remote streams actually change (not on every force refresh)
  }, [remoteStreams]);

  // Effect to attach streams to video elements
  useEffect(() => {
    // For local stream
    const selfVideoRef = videoRefs.current['self'];
    if (localStream && selfVideoRef) {
      // Only set srcObject if it's not already set or if camera changed
      if (selfVideoRef.srcObject !== localStream) {
        selfVideoRef.srcObject = localStream;
      }
    }

    // For remote streams, immediately attach streams
    Array.from(remoteStreams.entries()).forEach(([socketId, stream]) => {
      const videoRef = videoRefs.current[socketId];
      if (videoRef) {
        // Only set srcObject if it's not already set to avoid flickering
        if (videoRef.srcObject !== stream) {
          videoRef.srcObject = stream;
          
          // Force play to fix the double-click issue
          videoRef.play().catch(e => {
            // Keep this error log as it's important for debugging
            console.log(`[WebcamDisplay] Autoplay prevented: ${e}`);
          });
        }
      } else {
        // Keep this warning as it's important for debugging
        console.warn(`[WebcamDisplay] No video ref found for socket ${socketId}`);
      }
    });
  }, [localStream, remoteStreams, selectedCameraId]);

  // Get the video feeds for rendering
  const videoFeeds = getVideoFeeds();

  return (
    <div className="webcam-grid">
      {videoFeeds.map((feed) => (
        <div 
          key={feed.socketId}
          className={`webcam-item ${feed.isSelf ? 'self' : ''} ${feed.isWebcamActive ? 'active' : 'inactive'}`}
          style={{ borderColor: feed.borderColor || '#ccc' }}
        >
          <video
            ref={el => { videoRefs.current[feed.socketId] = el; }}
            autoPlay
            playsInline
            muted={feed.isSelf || mutedMics.has(feed.socketId)} // Mute self and remotely muted users
            style={{ 
              display: feed.isSelf ? (selfWebcamActive ? 'block' : 'none') : 
                     (hiddenWebcams.has(feed.socketId) ? 'none' : 'block') 
            }}
            onClick={() => {
              // Force play on click to fix autoplay issues
              const videoEl = videoRefs.current[feed.socketId];
              if (videoEl) videoEl.play().catch(e => console.log(`[WebcamDisplay] Play on click failed: ${e}`));
            }}
          />
          
          {/* Camera disabled indicator with chalk effect */}
          {((feed.isSelf && !selfWebcamActive) || 
            (!feed.isSelf && hiddenWebcams.has(feed.socketId))) && (
            <div className="camera-disabled-indicator">
              <i className="bi bi-camera-video-off-fill"></i>
              <span>{t('cameraOff', language) || 'Camera Off'}</span>
              {feed.isSelf && selectedCameraId && (
                <small className="d-block mt-2">
                  {t('selected', language) || 'Selected'}: {getSelectedCameraName()}
                </small>
              )}
            </div>
          )}
          
          {/* Video controls with chalk design */}
          <div className="video-controls-overlay">
            {feed.isSelf ? (
              <>
                <div 
                  className={`control-icon ${feed.isWebcamActive ? 'active' : 'inactive'}`}
                  onClick={toggleWebcam}
                  title={feed.isWebcamActive ? t('disableWebcam', language) || 'Disable Webcam' : t('enableWebcam', language) || 'Enable Webcam'}
                >
                  <i className={`bi ${feed.isWebcamActive ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`}></i>
                </div>
                <div 
                  className={`control-icon ${feed.isMicrophoneActive ? 'active' : 'inactive'}`}
                  onClick={toggleMicrophone}
                  title={feed.isMicrophoneActive ? t('muteMic', language) || 'Mute Mic' : t('unmuteMic', language) || 'Unmute Mic'}
                >
                   <i className={`bi ${feed.isMicrophoneActive ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`}></i>
                </div>
                {/* Camera selection hint - chalk style - show even if webcam is off */}
                
              </>
            ) : (
              <> {/* Controls for remote users */}
                <div 
                  className={`control-icon ${!hiddenWebcams.has(feed.socketId) ? 'active' : 'inactive'}`}
                  onClick={() => togglePeerWebcam(feed.socketId)}
                  title={!hiddenWebcams.has(feed.socketId) ? t('hideCamera', language) || 'Hide Camera' : t('showCamera', language) || 'Show Camera'}
                >
                  <i className={`bi ${!hiddenWebcams.has(feed.socketId) ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`}></i>
                </div>
                <div 
                  className={`control-icon ${!mutedMics.has(feed.socketId) ? 'active' : 'inactive'}`}
                  onClick={() => togglePeerMicrophone(feed.socketId)}
                  title={!mutedMics.has(feed.socketId) ? t('mute', language) || 'Mute' : t('unmute', language) || 'Unmute'}
                >
                  <i className={`bi ${!mutedMics.has(feed.socketId) ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`}></i>
                </div>
              </>
            )}
          </div>
          
          {/* Chalk-style name tag display */}
          <div className="name-tag-container">
            <div className="webcam-name-tag">
              {feed.playerName}
              {feed.isSelf && (
                <span className="ms-1 small">
                  {/* Display device info when available */}
                  {selfWebcamActive && selectedCameraId && (
                    <span title={getSelectedCameraName()}>• 📹</span>
                  )}
                  {selfMicrophoneActive && selectedMicrophoneId && (
                    <span title={getSelectedMicrophoneName()}> • 🎤</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {/* Status message section with chalk effect */}
      {localStream && remoteStreams.size === 0 && (
         <p className="text-muted p-2 w-100 text-center fst-italic">
           {t('waitingForParticipants', language) || 'Waiting for other participants...'}
         </p>
      )}
      {!localStream && (
         <p className="text-muted p-2 w-100 text-center fst-italic">
           {selectedCameraId ? 
             `${t('camera', language) || 'Camera'} "${getSelectedCameraName()}" ${t('selectedEnableToStart', language) || 'selected - enable camera to start.'}` : 
             t('selectCameraToStart', language) || 'Select a camera in settings to get started.'}
         </p>
      )}
    </div>
  );
};

export default WebcamDisplay; 