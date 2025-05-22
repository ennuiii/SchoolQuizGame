import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import socketService from '../services/socketService'; // Assuming socketService is correctly set up
import { useRoom } from './RoomContext'; // To get current room and player info

// Configuration
const STUN_SERVER = 'stun:stun.l.google.com:19302';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

interface PeerConnectionDetail {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel; // Optional: if you plan to use data channels
}

interface PeerInfo {
  socketId: string;
  persistentPlayerId: string;
  playerName: string;
  isGameMaster: boolean;
}

// Create a module-scoped map to track peer names
export const peerNameRegistry = new Map<string, string>();

interface WebRTCContextState {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>; // Keyed by peer's socketId
  peerConnections: Map<string, RTCPeerConnection>; // Simplified, just connection
  isWebcamActive: boolean;
  isMicrophoneActive: boolean;
  toggleWebcam: () => void;
  toggleMicrophone: () => void;
  startLocalStream: () => Promise<void>;
  stopLocalStream: () => void;
  initializeWebRTC: () => void;
  closeAllPeerConnections: () => void;
  peerNames: Map<string, string>; // Added to expose peer names
  broadcastWebcamState: (enabled: boolean) => void; // Add new function to broadcast webcam state
  broadcastMicrophoneState: (enabled: boolean) => void; // Add new function to broadcast microphone state
  remotePeerStates: Map<string, {webcamEnabled: boolean, micEnabled: boolean}>; // Add new state to track remote peers' media state
  availableCameras: MediaDeviceInfo[]; // List of available camera devices
  selectedCameraId: string | null; // Currently selected camera device ID
  refreshDeviceList: () => Promise<void>; // Function to refresh the device list
  selectCamera: (deviceId: string) => Promise<void>; // Function to switch to a different camera
  availableMicrophones: MediaDeviceInfo[]; // List of available microphone devices
  selectedMicrophoneId: string | null; // Currently selected microphone device ID
  selectMicrophone: (deviceId: string) => Promise<void>; // Function to switch to a different microphone
}

const WebRTCContext = createContext<WebRTCContextState | undefined>(undefined);

export const useWebRTC = (): WebRTCContextState => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};

interface WebRTCProviderProps {
  children: ReactNode;
}

// Fix for pendingCandidates property
// Add interface extension to augment the RTCPeerConnection type
interface ExtendedRTCPeerConnection extends RTCPeerConnection {
  pendingCandidates?: RTCIceCandidateInit[];
}

export const WebRTCProvider: React.FC<WebRTCProviderProps> = ({ children }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState<boolean>(false);
  const [peerNames, setPeerNames] = useState<Map<string, string>>(new Map());
  const [remotePeerStates, setRemotePeerStates] = useState<Map<string, {webcamEnabled: boolean, micEnabled: boolean}>>(new Map());
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string | null>(null);

  const { roomCode, persistentPlayerId, players, isGameMaster: currentUserIsGM } = useRoom();

  const closePeerConnection = useCallback((peerSocketId: string) => {
    setPeerConnections(prev => {
      const pc = prev.get(peerSocketId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.oniceconnectionstatechange = null;
        pc.onsignalingstatechange = null;
        // Check if already closed to avoid errors, though pc.close() is idempotent
        if (pc.signalingState !== 'closed') {
            pc.close();
        }
        console.log(`[WebRTC] Closed peer connection to ${peerSocketId}`);
        const newMap = new Map(prev);
        newMap.delete(peerSocketId);
        return newMap;
      }
      return prev;
    });
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      if (newMap.has(peerSocketId)) {
        newMap.delete(peerSocketId);
        console.log(`[WebRTC] Removed remote stream for ${peerSocketId}`);
      }
      return newMap;
    });
  }, []);

  const createPeerConnection = useCallback((peerSocketId: string, selfSocketId: string): RTCPeerConnection => {
    console.log(`[WebRTC] createPeerConnection called for peer: ${peerSocketId}`);
    // Ensure any existing connection is properly closed before creating a new one
    const existingPc = peerConnections.get(peerSocketId);
    if (existingPc) {
      console.log(`[WebRTC] Existing PC found for ${peerSocketId}, state: ${existingPc.signalingState}. Closing it first.`);
      // Use the closePeerConnection to ensure proper cleanup of listeners and map entries
      closePeerConnection(peerSocketId); 
    }

    console.log(`[WebRTC] Creating new RTCPeerConnection for ${peerSocketId}`);
    // Use multiple STUN servers for better connectivity
    const newPc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      // Enable trickle ICE for faster connectivity
      iceCandidatePoolSize: 10
    });

    newPc.onicecandidate = (event) => {
      if (event.candidate && selfSocketId) {
        socketService.sendWebRTCICECandidate(event.candidate, peerSocketId, selfSocketId);
      }
    };

    newPc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state change for ${peerSocketId}: ${newPc.iceConnectionState}`);
      if (newPc.iceConnectionState === 'connected' || newPc.iceConnectionState === 'completed') {
        console.log(`[WebRTC] ICE connection established with ${peerSocketId}.`);
        // Force a refresh of the UI when connected to ensure stream is displayed
        setRemoteStreams(prev => {
          const stream = prev.get(peerSocketId);
          if (stream) {
            // Clone the map to trigger a re-render
            return new Map(prev);
          }
          return prev;
        });
      } else if (newPc.iceConnectionState === 'failed' || newPc.iceConnectionState === 'disconnected' || newPc.iceConnectionState === 'closed') {
        console.warn(`[WebRTC] ICE connection to ${peerSocketId} is ${newPc.iceConnectionState}. Attempting to clean up or restart.`);
        
        // Try to restart ICE if it's just failed (not closed)
        if (newPc.iceConnectionState === 'failed' && newPc.signalingState !== 'closed') {
          try {
            console.log(`[WebRTC] Attempting to restart ICE connection with ${peerSocketId}`);
            newPc.restartIce();
          } catch (e) {
            console.error(`[WebRTC] Failed to restart ICE:`, e);
            closePeerConnection(peerSocketId);
          }
        } else {
          closePeerConnection(peerSocketId); 
        }
      }
    };
    
    newPc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state change for ${peerSocketId}: ${newPc.signalingState}`);
    };
    
    newPc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state change for ${peerSocketId}: ${newPc.connectionState}`);
      if (newPc.connectionState === 'connected') {
        console.log(`[WebRTC] Connection established with ${peerSocketId}`);
      } else if (newPc.connectionState === 'failed' || newPc.connectionState === 'closed') {
        console.warn(`[WebRTC] Connection to ${peerSocketId} ${newPc.connectionState}`);
      }
    };

    // Improved track handling
    newPc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track event from ${peerSocketId}:`, event);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        console.log(`[WebRTC] Remote stream for ${peerSocketId}:`, remoteStream);
        
        // Log all tracks
        remoteStream.getTracks().forEach(track => {
          console.log(`[WebRTC] Remote track (${peerSocketId}): id=${track.id}, kind=${track.kind}, enabled=${track.enabled}`);
          
          // Setup listeners for track ended events
          track.onended = () => {
            console.log(`[WebRTC] Track ${track.id} ended from peer ${peerSocketId}`);
          };
          
          track.onmute = () => {
            console.log(`[WebRTC] Track ${track.id} muted from peer ${peerSocketId}`);
          };
          
          track.onunmute = () => {
            console.log(`[WebRTC] Track ${track.id} unmuted from peer ${peerSocketId}`);
          };
        });
        
        // Store the stream immediately
        setRemoteStreams(prev => new Map(prev).set(peerSocketId, remoteStream));
      } else {
        console.warn(`[WebRTC] Remote track event from ${peerSocketId} did not contain streams or stream[0].`);
      }
    };

    // Add a timeout to ensure connection is established or closed
    setTimeout(() => {
      // Check if the connection is still in the peerConnections state
      const currentPc = peerConnections.get(peerSocketId);
      if (currentPc === newPc && 
          newPc.iceConnectionState !== 'connected' && 
          newPc.iceConnectionState !== 'completed') {
        console.warn(`[WebRTC] Connection to ${peerSocketId} timed out. Current state: ${newPc.iceConnectionState}`);
        if (newPc.signalingState !== 'closed') {
          // Try to restart ICE if connection didn't establish
          try {
            newPc.restartIce();
            console.log(`[WebRTC] ICE restart initiated for ${peerSocketId}`);
          } catch (e) {
            console.error(`[WebRTC] Failed to restart ICE:`, e);
            closePeerConnection(peerSocketId);
          }
        }
      }
    }, 15000); // 15 seconds timeout

    if (localStream) {
      localStream.getTracks().forEach(track => {
        // Check if a sender with this track kind already exists to avoid duplicates if re-adding to existing PC
        if (!newPc.getSenders().find(sender => sender.track === track)) {
          console.log(`[WebRTC] Adding local track to PC for ${peerSocketId}: kind=${track.kind}, id=${track.id}, enabled=${track.enabled}`);
          try {
            newPc.addTrack(track, localStream);
          } catch (e) {
            console.error(`[WebRTC] Error adding track ${track.id} to ${peerSocketId}:`, e);
          }
        }
      });
    } else {
      console.warn('[WebRTC] Local stream not available when creating peer connection for', peerSocketId);
    }

    setPeerConnections(prev => new Map(prev).set(peerSocketId, newPc));
    return newPc;
  }, [localStream, peerConnections, closePeerConnection, players]);

  const closeAllPeerConnections = useCallback(() => {
    console.log('[WebRTC] Closing all peer connections.');
    const peerIds = Array.from(peerConnections.keys());
    peerIds.forEach(peerSocketId => {
      closePeerConnection(peerSocketId);
    });
  }, [peerConnections, closePeerConnection]);

  const broadcastWebcamState = useCallback((enabled: boolean) => {
    const currentSocket = socketService.getSocket();
    if (currentSocket && roomCode) {
      // Send to server, which will forward to all peers in the room
      currentSocket.emit('webcam-state-change', {
        roomCode,
        enabled,
        fromSocketId: currentSocket.id
      });
    }
  }, [roomCode]);

  const broadcastMicrophoneState = useCallback((enabled: boolean) => {
    const currentSocket = socketService.getSocket();
    if (currentSocket && roomCode) {
      // Send to server, which will forward to all peers in the room
      currentSocket.emit('microphone-state-change', {
        roomCode,
        enabled,
        fromSocketId: currentSocket.id
      });
    }
  }, [roomCode]);

  const refreshDeviceList = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      // Reduce log frequency - only log once per session or when count changes
      if (cameras.length !== availableCameras.length || 
          microphones.length !== availableMicrophones.length) {
        console.log('[WebRTC] Found camera devices (may not have labels yet):', cameras);
        console.log('[WebRTC] Found microphone devices (may not have labels yet):', microphones);
      }
      
      setAvailableCameras(cameras);
      setAvailableMicrophones(microphones);
      
      // If we have a local stream but don't have a selected camera/mic,
      // try to identify which devices we're using from the current stream
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && !selectedCameraId && cameras.length > 0) {
          const settings = videoTrack.getSettings();
          if (settings.deviceId) {
            setSelectedCameraId(settings.deviceId);
          }
        }
        
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack && !selectedMicrophoneId && microphones.length > 0) {
          const settings = audioTrack.getSettings();
          if (settings.deviceId) {
            setSelectedMicrophoneId(settings.deviceId);
          }
        }
      }
    } catch (error) {
      console.error('[WebRTC] Error refreshing device list:', error);
    }
  }, [localStream, availableCameras.length, availableMicrophones.length, selectedCameraId, selectedMicrophoneId]);

  const selectCamera = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    console.log(`[WebRTC] Selecting camera with deviceId: ${deviceId}`);
    setSelectedCameraId(deviceId);
    
    // If we already have a stream, we need to restart it with the new device
    if (localStream) {
      try {
        // Stop all existing tracks first
        localStream.getTracks().forEach(track => {
          console.log(`[WebRTC] Stopping track: ${track.kind} (${track.id})`);
          track.stop();
        });
        
        console.log('[WebRTC] Requesting new stream with selected camera');
        // Request a new stream with the selected device
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 24, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            sampleSize: 16,
            channelCount: 1
          }
        });
        
        console.log('[WebRTC] New stream acquired with selected camera:', newStream);
        
        // Replace local stream
        setLocalStream(newStream);
        setIsWebcamActive(true);
        
        // Update all peer connections with the new stream
        peerConnections.forEach((pc, peerSocketId) => {
          try {
            // Find video senders
            const videoSenders = pc.getSenders().filter(sender => 
              sender.track && sender.track.kind === 'video'
            );
            
            const videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack && videoSenders.length > 0) {
              console.log(`[WebRTC] Replacing video track for peer ${peerSocketId}`);
              videoSenders[0].replaceTrack(videoTrack);
            } else if (videoTrack) {
              console.log(`[WebRTC] Adding new video track for peer ${peerSocketId}`);
              pc.addTrack(videoTrack, newStream);
            }
            
            // Keep audio tracks from the old stream or add from new stream
            const audioTracks = newStream.getAudioTracks();
            if (audioTracks.length > 0) {
              const audioSenders = pc.getSenders().filter(sender => 
                sender.track && sender.track.kind === 'audio'
              );
              
              if (audioSenders.length === 0) {
                // Add audio track if none exists
                audioTracks.forEach(track => {
                  pc.addTrack(track, newStream);
                });
              } else if (audioSenders.length > 0 && audioTracks.length > 0) {
                // Replace existing audio track
                console.log(`[WebRTC] Replacing audio track for peer ${peerSocketId}`);
                audioSenders[0].replaceTrack(audioTracks[0]);
              }
            }
          } catch (error) {
            console.error(`[WebRTC] Error updating tracks for peer ${peerSocketId}:`, error);
          }
        });
        
        // Broadcast webcam state
        broadcastWebcamState(true);
      } catch (error) {
        console.error('[WebRTC] Error switching camera:', error);
        setIsWebcamActive(false);
        broadcastWebcamState(false);
      }
    } else {
      // If no stream exists yet, just update the selected camera ID
      // The next call to startLocalStream will use this ID
      console.log('[WebRTC] Camera selected, but no stream exists yet. It will be used when starting the stream.');
    }
  }, [localStream, peerConnections, broadcastWebcamState]);

  const selectMicrophone = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    console.log(`[WebRTC] Selecting microphone with deviceId: ${deviceId}`);
    setSelectedMicrophoneId(deviceId);
    
    // If we already have a stream, we need to restart it with the new device
    if (localStream) {
      try {
        // Find and stop only audio tracks
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
          console.log(`[WebRTC] Stopping audio track: ${track.id}`);
          track.stop();
        });
        
        console.log('[WebRTC] Requesting new audio stream with selected microphone');
        // Request a new audio stream with the selected device
        const newAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            sampleSize: 16,
            channelCount: 1
          }
        });
        
        console.log('[WebRTC] New audio stream acquired with selected microphone:', newAudioStream);
        
        // Get the audio track from the new stream
        const newAudioTrack = newAudioStream.getAudioTracks()[0];
        
        // Create a new stream with existing video tracks and new audio track
        const newStream = new MediaStream();
        
        // Add existing video tracks if any
        localStream.getVideoTracks().forEach(track => {
          newStream.addTrack(track);
        });
        
        // Add the new audio track
        if (newAudioTrack) {
          newStream.addTrack(newAudioTrack);
        }
        
        // Replace local stream
        setLocalStream(newStream);
        setIsMicrophoneActive(true);
        
        // Update all peer connections with the new stream
        peerConnections.forEach((pc, peerSocketId) => {
          try {
            // Find audio senders
            const audioSenders = pc.getSenders().filter(sender => 
              sender.track && sender.track.kind === 'audio'
            );
            
            if (newAudioTrack && audioSenders.length > 0) {
              console.log(`[WebRTC] Replacing audio track for peer ${peerSocketId}`);
              audioSenders[0].replaceTrack(newAudioTrack);
            } else if (newAudioTrack) {
              console.log(`[WebRTC] Adding new audio track for peer ${peerSocketId}`);
              pc.addTrack(newAudioTrack, newStream);
            }
          } catch (error) {
            console.error(`[WebRTC] Error updating audio track for peer ${peerSocketId}:`, error);
          }
        });
        
        // Broadcast microphone state
        broadcastMicrophoneState(true);
      } catch (error) {
        console.error('[WebRTC] Error switching microphone:', error);
        setIsMicrophoneActive(false);
        broadcastMicrophoneState(false);
      }
    } else {
      // If no stream exists yet, just update the selected microphone ID
      // The next call to startLocalStream will use this ID
      console.log('[WebRTC] Microphone selected, but no stream exists yet. It will be used when starting the stream.');
    }
  }, [localStream, peerConnections, broadcastMicrophoneState]);

  const startLocalStream = useCallback(async (): Promise<void> => {
    try {
      console.log('[WebRTC] Starting local media stream...');
      
      // If we don't have a list of devices yet, refresh it
      if (availableCameras.length === 0 || availableMicrophones.length === 0) {
        await refreshDeviceList();
      }
      
      // Configure video constraints based on selected camera
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 480, max: 640 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: 'user',
        aspectRatio: { ideal: 1.333333 }
      };
      
      // Add deviceId constraint if we have a selected camera
      if (selectedCameraId) {
        videoConstraints.deviceId = { exact: selectedCameraId };
        console.log(`[WebRTC] Using selected camera device ID: ${selectedCameraId}`);
      } else {
        console.log('[WebRTC] No camera selected, using default');
      }
      
      // Configure audio constraints based on selected microphone
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        sampleSize: 16,
        channelCount: 1
      };
      
      // Add deviceId constraint if we have a selected microphone
      if (selectedMicrophoneId) {
        audioConstraints.deviceId = { exact: selectedMicrophoneId };
        console.log(`[WebRTC] Using selected microphone device ID: ${selectedMicrophoneId}`);
      } else {
        console.log('[WebRTC] No microphone selected, using default');
      }
      
      // Request both video and audio with optimized constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints
        });
      } catch (initialError) {
        console.error('[WebRTC] Error with initial getUserMedia:', initialError);
        
        // Try without deviceId constraints as fallback
        console.log('[WebRTC] Trying fallback without deviceId constraints');
        const fallbackVideoConstraints = { ...videoConstraints };
        delete fallbackVideoConstraints.deviceId;
        
        const fallbackAudioConstraints = { ...audioConstraints };
        delete fallbackAudioConstraints.deviceId;
        
        stream = await navigator.mediaDevices.getUserMedia({
          video: fallbackVideoConstraints,
          audio: fallbackAudioConstraints
        });
        
        // Since we got devices but not with our preferred deviceIds,
        // let's refresh the device list and try to identify which devices we got
        await refreshDeviceList();
      }
      
      console.log('[WebRTC] Local stream acquired:', stream);
      
      // Once we have the stream, force a refresh of the device list to get labels
      if (availableCameras.some(device => !device.label) || availableMicrophones.some(device => !device.label)) {
        console.log('[WebRTC] Refreshing device list to get device labels now that we have permissions');
        await refreshDeviceList();
      }
      
      // Log all tracks that were acquired
      stream.getTracks().forEach(track => {
        console.log(`[WebRTC] Local track acquired: id=${track.id}, kind=${track.kind}, enabled=${track.enabled}`);
        
        // Add event listeners to track when devices are disconnected
        track.addEventListener('ended', () => {
          console.log(`[WebRTC] Track ${track.id} ended unexpectedly. Device may have been disconnected.`);
          
          // Notify the user that a track ended
          if (track.kind === 'video') {
            setIsWebcamActive(false);
          } else if (track.kind === 'audio') {
            setIsMicrophoneActive(false);
          }
          
          // Attempt to restart the stream after a short delay
          setTimeout(() => {
            if (!localStream) return; // Don't restart if user has closed the stream
            console.log('[WebRTC] Attempting to restart local stream after track ended...');
            startLocalStream().catch(e => console.error('[WebRTC] Failed to restart stream:', e));
          }, 2000);
        });
      });
      
      // Try to identify which devices we're using and update selectedIds
      if (!selectedCameraId && availableCameras.length > 0) {
        // Get the video track settings
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.deviceId) {
            console.log(`[WebRTC] Auto-selecting camera deviceId: ${settings.deviceId}`);
            setSelectedCameraId(settings.deviceId);
          }
        }
      }
      
      // Try to identify which microphone we're using
      if (!selectedMicrophoneId && availableMicrophones.length > 0) {
        // Get the audio track settings
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const settings = audioTrack.getSettings();
          if (settings.deviceId) {
            console.log(`[WebRTC] Auto-selecting microphone deviceId: ${settings.deviceId}`);
            setSelectedMicrophoneId(settings.deviceId);
          }
        }
      }
      
      // Set the local stream in state
      setLocalStream(stream);
      
      // Set initial track states based on the tracks we have
      const hasVideoTrack = stream.getVideoTracks().length > 0;
      const hasAudioTrack = stream.getAudioTracks().length > 0;
      
      setIsWebcamActive(hasVideoTrack);
      setIsMicrophoneActive(hasAudioTrack);
      
      // If we have existing peer connections, add this stream to all of them
      if (peerConnections.size > 0) {
        console.log(`[WebRTC] Adding new local stream to ${peerConnections.size} existing peer connections...`);
        
        peerConnections.forEach((pc, peerSocketId) => {
          try {
            // Only add tracks that don't exist in the connection
            stream.getTracks().forEach(track => {
              const senders = pc.getSenders();
              const existingSender = senders.find(sender => 
                sender.track && sender.track.kind === track.kind
              );
              
              if (existingSender) {
                // Replace the track in the existing sender
                console.log(`[WebRTC] Replacing ${track.kind} track in connection to ${peerSocketId}`);
                existingSender.replaceTrack(track).catch(e => 
                  console.error(`[WebRTC] Error replacing track for ${peerSocketId}:`, e)
                );
              } else {
                // Add new track to the connection
                console.log(`[WebRTC] Adding ${track.kind} track to connection with ${peerSocketId}`);
                pc.addTrack(track, stream);
              }
            });
          } catch (error) {
            console.error(`[WebRTC] Error updating tracks for peer ${peerSocketId}:`, error);
          }
        });
      }
      
      // Broadcast our initial webcam/mic state to all peers
      if (hasVideoTrack) broadcastWebcamState(true);
      if (hasAudioTrack) broadcastMicrophoneState(true);
    } catch (error) {
      console.error('[WebRTC] Error starting local stream:', error);
      
      // Set states to reflect the error
      setIsWebcamActive(false);
      setIsMicrophoneActive(false);
      
      // Try fallback to just audio if video fails
      try {
        console.log('[WebRTC] Attempting fallback to audio-only');
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        });
        
        console.log('[WebRTC] Audio-only stream acquired:', audioStream);
        audioStream.getTracks().forEach(track => {
          console.log(`[WebRTC] Audio track: id=${track.id}, kind=${track.kind}, enabled=${track.enabled}`);
        });
        
        setLocalStream(audioStream);
        setIsMicrophoneActive(true);
        
        // Broadcast audio-only state
        broadcastMicrophoneState(true);
        broadcastWebcamState(false);
      } catch (audioError) {
        console.error('[WebRTC] Audio-only fallback also failed:', audioError);
      }
    }
  }, [peerConnections, broadcastWebcamState, broadcastMicrophoneState, availableCameras, availableMicrophones, selectedCameraId, selectedMicrophoneId, refreshDeviceList]);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      closeAllPeerConnections();
      setLocalStream(null);
      setIsWebcamActive(false);
      setIsMicrophoneActive(false);
      console.log('[WebRTC] Local stream stopped, all peer connections closed.');
    }
  }, [localStream, closeAllPeerConnections]);

  const toggleWebcam = useCallback(() => {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    const currentState = videoTracks.length > 0 && videoTracks[0].enabled;
    const newState = !currentState;
    
    videoTracks.forEach(track => {
      track.enabled = newState;
    });
    
    setIsWebcamActive(newState);
    broadcastWebcamState(newState);
  }, [localStream, broadcastWebcamState]);

  const toggleMicrophone = useCallback(() => {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    const currentState = audioTracks.length > 0 && audioTracks[0].enabled;
    const newState = !currentState;
    
    audioTracks.forEach(track => {
      track.enabled = newState;
    });
    
    setIsMicrophoneActive(newState);
    broadcastMicrophoneState(newState);
  }, [localStream, broadcastMicrophoneState]);

  const initializeWebRTC = useCallback(() => {
    if (roomCode && localStream) {
      console.log('[WebRTC] Initializing WebRTC, sending webrtc-ready:', {
        roomCode,
        isGameMaster: currentUserIsGM
      });
      socketService.sendWebRTCReady(roomCode);
    } else {
      console.log('[WebRTC] Cannot initialize WebRTC: missing roomCode or localStream');
    }
  }, [roomCode, localStream, currentUserIsGM]);

  // Signaling logic
  useEffect(() => {
    const currentSocket = socketService.getSocket();
    const selfSocketId = currentSocket?.id;

    if (!currentSocket || !roomCode || !selfSocketId) {
      return; 
    }

    // Modified handleNewPeer to always create connections in both directions
    const handleNewPeer = async ({ newPeer }: { newPeer: PeerInfo }) => {
      // Only log for GM or if total peers are small to reduce spam
      if (newPeer.isGameMaster || peerConnections.size < 3) {
        console.log(`[WebRTC] New peer joined: ${newPeer.socketId} (${newPeer.playerName}), ${newPeer.isGameMaster ? 'GM' : 'Player'}`);
      }
      
      // Update peer names
      peerNameRegistry.set(newPeer.socketId, newPeer.playerName);
      setPeerNames(prev => new Map(prev).set(newPeer.socketId, newPeer.playerName));
      
      // Create peer connection and send offer
      try {
        const pc = createPeerConnection(newPeer.socketId, selfSocketId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);
        socketService.sendWebRTCOffer(offer, newPeer.socketId, selfSocketId);
      } catch (error) {
        console.error('[WebRTC] Error creating offer for new peer:', error);
      }
    };

    const handleExistingPeers = ({ peers }: { peers: PeerInfo[] }) => {
      // Only log if there are not too many peers to reduce spam
      if (peers.length < 5) {
        console.log(`[WebRTC] Processing ${peers.length} existing peers.`);
      }
      
      // Update all peer names from the list
      const newPeerNames = new Map<string, string>();
      peers.forEach(peer => {
        if (peer.socketId && peer.playerName) {
          // Update the module-scoped registry
          peerNameRegistry.set(peer.socketId, peer.playerName);
          
          // Also add to our state map
          newPeerNames.set(peer.socketId, peer.playerName);
          
          // Only log for GM or if total peers are small
          if (peer.isGameMaster || peers.length < 3) {
            console.log(`[WebRTC] Existing peer: ${peer.socketId} -> ${peer.playerName}`);
          }
        }
      });
      
      // Update state with all peer names at once
      setPeerNames(prev => {
        const updated = new Map(prev);
        newPeerNames.forEach((name, id) => {
          updated.set(id, name);
        });
        return updated;
      });
      
      // Process each existing peer
      peers.forEach(async peer => {
        if (peer.socketId === selfSocketId) return;
        
        // Check if we already have a good connection to this peer
        const existingPc = peerConnections.get(peer.socketId);
        if (existingPc && existingPc.signalingState !== 'closed' && 
            (existingPc.iceConnectionState === 'connected' || 
             existingPc.iceConnectionState === 'completed')) {
          // Only log for GM connections to reduce spam
          if (peer.isGameMaster) {
            console.log(`[WebRTC] Already have a good connection to ${peer.socketId}. Skipping offer.`);
          }
          return;
        }
        
        // Only log for GM connections or if total peers are small
        if (peer.isGameMaster || peers.length < 3) {
          console.log(`[WebRTC] Creating connection with EXISTING PEER ${peer.socketId} (${peer.playerName})`);
        }
        
        try {
          const pc = createPeerConnection(peer.socketId, selfSocketId);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await pc.setLocalDescription(offer);
          socketService.sendWebRTCOffer(offer, peer.socketId, selfSocketId);
        } catch (error) {
          console.error(`[WebRTC] Error creating offer for existing peer ${peer.socketId}:`, error);
        }
      });
    };

    const handleOffer = async ({ offer, from }: { offer: RTCSessionDescriptionInit, from: string }) => {
      console.log(`[WebRTC] Received offer from ${from} (I am ${selfSocketId}).`);
      if (from === selfSocketId) return;

      let pc = peerConnections.get(from);
      if (pc && (pc.signalingState !== 'stable' && pc.signalingState !== 'closed')) {
        console.warn(`[WebRTC] Received offer from ${from}, but PC is in state ${pc.signalingState}. Potential glare. Recreating PC.`);
        pc = createPeerConnection(from, selfSocketId); // Recreate to ensure clean state for incoming offer
      } else if (!pc || pc.signalingState === 'closed') {
        console.log(`[WebRTC] No existing open PC for offer from ${from}, creating one.`);
        pc = createPeerConnection(from, selfSocketId); 
      }
      
      // At this point, pc should be a valid, open RTCPeerConnection instance
      try {
        console.log(`[WebRTC] Setting remote offer from ${from}. Current signalingState: ${pc.signalingState}`);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log(`[WebRTC] Remote offer set. New signalingState: ${pc.signalingState}. Creating answer for ${from}.`);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`[WebRTC] Local answer created and set. New signalingState: ${pc.signalingState}. Sending answer to ${from}.`);
        socketService.sendWebRTCAnswer(answer, from, selfSocketId);
      } catch (error) {
        console.error(`[WebRTC] Error handling offer from ${from} and creating answer:`, error);
      }
    };

    const handleAnswer = async ({ answer, from }: { answer: RTCSessionDescriptionInit, from: string }) => {
      console.log(`[WebRTC] Received answer from ${from}.`);
      const pc = peerConnections.get(from);
      if (pc) {
        if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer') {
          try {
            console.log(`[WebRTC] Setting remote answer from ${from}. Current signalingState: ${pc.signalingState}`);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`[WebRTC] Remote answer set. New signalingState: ${pc.signalingState}`);
          } catch (error) {
            console.error(`[WebRTC] Error setting remote description from answer from ${from}:`, error);
          }
        } else {
          console.warn(`[WebRTC] Received answer from ${from}, but PC signalingState is ${pc.signalingState}. Ignoring answer.`);
        }
      } else {
        console.warn(`[WebRTC] Received answer from ${from}, but no peer connection found.`);
      }
    };

    const handleIceCandidate = ({ candidate, from }: { candidate: RTCIceCandidateInit, from: string }) => {
      const pc = peerConnections.get(from) as ExtendedRTCPeerConnection | undefined;
      if (pc) {
        if (pc.remoteDescription && pc.signalingState !== 'closed') { 
            pc.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(e => console.error('[WebRTC] Error adding ICE candidate:', e));
        } else {
            console.warn(`[WebRTC] Received ICE candidate from ${from}, but remote description not set or PC closed. State: ${pc.signalingState}`);
            // Store candidates to add them later when we have a remote description
            if (pc.signalingState !== 'closed') {
              // Create an array to store pending candidates
              if (!pc.pendingCandidates) {
                pc.pendingCandidates = [];
              }
              pc.pendingCandidates.push(candidate);
            }
        }
      } 
    };

    const handleUserLeft = ({ socketId: peerSocketId }: { socketId: string }) => {
      console.log(`[WebRTC] Peer ${peerSocketId} left`);
      closePeerConnection(peerSocketId);
      
      // Remove from peer names
      setPeerNames(prev => {
        const updated = new Map(prev);
        updated.delete(peerSocketId);
        return updated;
      });
      // Also remove from module-scoped registry
      peerNameRegistry.delete(peerSocketId);
    };
    
    // Add handlers for webcam and microphone state changes
    const handleWebcamStateChange = ({ fromSocketId, enabled }: { fromSocketId: string, enabled: boolean }) => {
      if (fromSocketId === selfSocketId) return; // Ignore own broadcasts

      // We don't need to log these state changes anymore as they can be very frequent
      setRemotePeerStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(fromSocketId) || { webcamEnabled: true, micEnabled: true };
        newMap.set(fromSocketId, { ...currentState, webcamEnabled: enabled });
        return newMap;
      });
    };

    const handleMicrophoneStateChange = ({ fromSocketId, enabled }: { fromSocketId: string, enabled: boolean }) => {
      if (fromSocketId === selfSocketId) return; // Ignore own broadcasts

      // We don't need to log these state changes anymore as they can be very frequent
      setRemotePeerStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(fromSocketId) || { webcamEnabled: true, micEnabled: true };
        newMap.set(fromSocketId, { ...currentState, micEnabled: enabled });
        return newMap;
      });
    };

    currentSocket.on('webrtc-new-peer', handleNewPeer);
    currentSocket.on('webrtc-existing-peers', handleExistingPeers);
    currentSocket.on('webrtc-offer', handleOffer);
    currentSocket.on('webrtc-answer', handleAnswer);
    currentSocket.on('webrtc-ice-candidate', handleIceCandidate);
    currentSocket.on('webrtc-user-left', handleUserLeft);
    currentSocket.on('webcam-state-change', handleWebcamStateChange);
    currentSocket.on('microphone-state-change', handleMicrophoneStateChange);
    
    // Handle refresh states event - broadcast our current states when asked
    currentSocket.on('webrtc-refresh-states', () => {
      // No need to log this as it can happen frequently
      if (localStream) {
        const videoEnabled = localStream.getVideoTracks().some(track => track.enabled);
        const audioEnabled = localStream.getAudioTracks().some(track => track.enabled);
        broadcastWebcamState(videoEnabled);
        broadcastMicrophoneState(audioEnabled);
      }
    });

    return () => {
      console.log('[WebRTC] Cleaning up WebRTC listeners');
      currentSocket.off('webrtc-new-peer', handleNewPeer);
      currentSocket.off('webrtc-existing-peers', handleExistingPeers);
      currentSocket.off('webrtc-offer', handleOffer);
      currentSocket.off('webrtc-answer', handleAnswer);
      currentSocket.off('webrtc-ice-candidate', handleIceCandidate);
      currentSocket.off('webrtc-user-left', handleUserLeft);
      currentSocket.off('webcam-state-change', handleWebcamStateChange);
      currentSocket.off('microphone-state-change', handleMicrophoneStateChange);
      currentSocket.off('webrtc-refresh-states');
    };
  }, [roomCode, localStream, createPeerConnection, closePeerConnection, peerConnections, currentUserIsGM, broadcastWebcamState, broadcastMicrophoneState]);

  // Initialize device list when component mounts
  useEffect(() => {
    // Initial device list refresh
    refreshDeviceList();
    
    // Try to get basic device info without starting stream
    // This helps populate device list with better info
    if (availableCameras.length === 0 || availableMicrophones.length === 0 || 
        !availableCameras.some(cam => cam.label) || !availableMicrophones.some(mic => mic.label)) {
      console.log('[WebRTC] Attempting to get media permissions to populate device list');
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(tempStream => {
          // Immediately stop the temporary stream
          tempStream.getTracks().forEach(track => track.stop());
          // Refresh the device list now that we have permissions
          refreshDeviceList();
        })
        .catch(err => {
          console.warn('[WebRTC] Could not get media permission for initial device list:', err);
          // Still refresh device list - we might get deviceIds without labels
          refreshDeviceList();
        });
    }
    
    // Also listen for devicechange events to update the list
    const handleDeviceChange = () => {
      console.log('[WebRTC] Device change detected, refreshing device list');
      refreshDeviceList();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDeviceList, availableCameras, availableMicrophones]);

  const value = {
    localStream,
    remoteStreams,
    peerConnections,
    isWebcamActive,
    isMicrophoneActive,
    toggleWebcam,
    toggleMicrophone,
    startLocalStream,
    stopLocalStream,
    initializeWebRTC, 
    closeAllPeerConnections,
    peerNames,
    broadcastWebcamState,
    broadcastMicrophoneState,
    remotePeerStates,
    availableCameras,
    selectedCameraId,
    refreshDeviceList,
    selectCamera,
    availableMicrophones,
    selectedMicrophoneId,
    selectMicrophone,
  };

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>;
}; 