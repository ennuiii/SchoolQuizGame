import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import socketService from '../services/socketService';
import { useRoom } from './RoomContext';

// Add debounce utility function
function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(...args: Parameters<F>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Configuration
const STUN_SERVER = 'stun:stun.l.google.com:19302';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

// WebRTC Configuration Constants
const ICE_RECOVERY_CONFIG = {
  INITIAL_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 10000,
  MAX_RETRY_ATTEMPTS: 5,
  CONNECTION_TIMEOUT: 15000,
  DISCONNECTED_TIMEOUT: 10000,
  FAILED_TIMEOUT: 5000
};

// Add initialization state tracking
interface InitializationState {
  isStartingStream: boolean;
  isInitializingWebRTC: boolean;
  streamStartAttempts: number;
  webrtcInitAttempts: number;
  lastError: string | null;
}

interface PeerConnectionDetail {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

interface PeerInfo {
  socketId: string;
  persistentPlayerId: string;
  playerName: string;
  isGameMaster: boolean;
}

export const peerNameRegistry = new Map<string, string>();

interface WebRTCError {
  code: string;
  message: string;
  timestamp: number;
  peerId?: string;
}

interface ConnectionState {
  iceState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  connectionState: RTCPeerConnectionState;
  lastStateChange: number;
  errors: WebRTCError[];
}

interface ExtendedRTCPeerConnection extends RTCPeerConnection {
  pendingCandidates?: RTCIceCandidateInit[];
  retryCount?: number;
  lastRetryTime?: number;
  retryTimeout?: NodeJS.Timeout;
}

interface WebRTCContextState {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  peerConnections: Map<string, RTCPeerConnection>;
  isWebcamActive: boolean;
  isMicrophoneActive: boolean;
  toggleWebcam: () => void;
  toggleMicrophone: () => void;
  startLocalStream: () => Promise<void>;
  stopLocalStream: () => void;
  initializeWebRTC: () => Promise<void>; // Changed to return Promise
  closeAllPeerConnections: () => void;
  peerNames: Map<string, string>;
  broadcastWebcamState: (enabled: boolean) => void;
  broadcastMicrophoneState: (enabled: boolean) => void;
  remotePeerStates: Map<string, {webcamEnabled: boolean, micEnabled: boolean}>;
  availableCameras: MediaDeviceInfo[];
  selectedCameraId: string | null;
  refreshDeviceList: () => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  availableMicrophones: MediaDeviceInfo[];
  selectedMicrophoneId: string | null;
  selectMicrophone: (deviceId: string) => Promise<void>;
  connectionStates: Map<string, ConnectionState>;
  errors: WebRTCError[];
  clearErrors: () => void;
  getConnectionStats: (peerId: string) => Promise<RTCStatsReport | null>;
  initializationState: InitializationState; // Add this
  startWebRTCSession: () => Promise<void>; 
  startWebcamWithRetry: () => Promise<void>;
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
  const [connectionStates, setConnectionStates] = useState<Map<string, ConnectionState>>(new Map());
  const [errors, setErrors] = useState<WebRTCError[]>([]);
  
  // Add initialization state
  const [initializationState, setInitializationState] = useState<InitializationState>({
    isStartingStream: false,
    isInitializingWebRTC: false,
    streamStartAttempts: 0,
    webrtcInitAttempts: 0,
    lastError: null
  });

  // Add ref to track if WebRTC is initialized
  const isWebRTCInitialized = useRef(false);

  const { roomCode, persistentPlayerId, players, isGameMaster: currentUserIsGM } = useRoom();

  // ... (keep all the existing utility functions like closePeerConnection, handleError, etc.)

  const closePeerConnection = useCallback((peerSocketId: string) => {
    setPeerConnections(prev => {
      const pc = prev.get(peerSocketId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.oniceconnectionstatechange = null;
        pc.onsignalingstatechange = null;
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

  const handleError = useCallback((error: WebRTCError) => {
    console.error(`[WebRTC] Error: ${error.message}`, error);
    setErrors(prev => [...prev, error]);
    
    if (errors.length > 100) {
      setErrors(prev => prev.slice(-100));
    }
  }, [errors]);

  const updateConnectionState = useCallback((peerId: string, state: Partial<ConnectionState>) => {
    setConnectionStates(prev => {
      const currentState = prev.get(peerId) || {
        iceState: 'new',
        signalingState: 'stable',
        connectionState: 'new',
        lastStateChange: Date.now(),
        errors: []
      };
      
      const newState = {
        ...currentState,
        ...state,
        lastStateChange: Date.now()
      };
      
      return new Map(prev).set(peerId, newState);
    });
  }, []);

  const getConnectionStats = useCallback(async (peerId: string): Promise<RTCStatsReport | null> => {
    const pc = peerConnections.get(peerId);
    if (!pc) return null;
    
    try {
      return await pc.getStats();
    } catch (error) {
      handleError({
        code: 'STATS_ERROR',
        message: `Failed to get connection stats for peer ${peerId}: ${error}`,
        timestamp: Date.now(),
        peerId
      });
      return null;
    }
  }, [peerConnections, handleError]);

  // Modify the createPeerConnection function to handle glare better
  const createPeerConnection = useCallback((peerSocketId: string, selfSocketId: string): RTCPeerConnection => {
    console.log(`[WebRTC] createPeerConnection called for peer: ${peerSocketId}`);
    
    const existingPc = peerConnections.get(peerSocketId);
    if (existingPc) {
      console.log(`[WebRTC] Existing PC found for ${peerSocketId}, state: ${existingPc.signalingState}. Closing it first.`);
      closePeerConnection(peerSocketId);
    }

    console.log(`[WebRTC] Creating new RTCPeerConnection for ${peerSocketId}`);
    const newPc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    }) as ExtendedRTCPeerConnection;

    newPc.retryCount = 0;
    newPc.lastRetryTime = Date.now();
    newPc.pendingCandidates = [];

    // Add connection state monitoring
    let connectionTimeout: NodeJS.Timeout;
    let isConnectionEstablished = false;

    // Add ICE candidate handling
    newPc.onicecandidate = (event) => {
      if (event.candidate && selfSocketId) {
        console.log(`[WebRTC] New ICE candidate for ${peerSocketId}:`, event.candidate);
        if (newPc.remoteDescription && newPc.remoteDescription.type) {
          socketService.sendWebRTCICECandidate(event.candidate, peerSocketId, selfSocketId);
        } else {
          console.log(`[WebRTC] Storing ICE candidate for ${peerSocketId} until remote description is set`);
          (newPc as ExtendedRTCPeerConnection).pendingCandidates?.push(event.candidate);
        }
      }
    };

    newPc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track event from ${peerSocketId}:`, event);
      
      if (!event.streams || !event.streams[0]) {
        handleError({
          code: 'TRACK_ERROR',
          message: `Received track event without streams from ${peerSocketId}`,
          timestamp: Date.now(),
          peerId: peerSocketId
        });
        return;
      }

      const remoteStream = event.streams[0];
      console.log(`[WebRTC] Remote stream for ${peerSocketId}:`, remoteStream);
      
      // Log detailed track information
      remoteStream.getTracks().forEach(track => {
        console.log(`[WebRTC] Remote track (${peerSocketId}): id=${track.id}, kind=${track.kind}, enabled=${track.enabled}, readyState=${track.readyState}`);
        
        track.onended = () => {
          console.log(`[WebRTC] Track ${track.id} ended from peer ${peerSocketId}`);
          handleError({
            code: 'TRACK_ENDED',
            message: `Track ${track.id} ended unexpectedly`,
            timestamp: Date.now(),
            peerId: peerSocketId
          });
        };
        
        track.onmute = () => {
          console.log(`[WebRTC] Track ${track.id} muted from peer ${peerSocketId}`);
        };
        
        track.onunmute = () => {
          console.log(`[WebRTC] Track ${track.id} unmuted from peer ${peerSocketId}`);
        };
      });
      
      // Ensure we're not adding duplicate streams
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(peerSocketId)) {
          console.log(`[WebRTC] Adding new remote stream for ${peerSocketId}`);
          newMap.set(peerSocketId, remoteStream);
        } else {
          console.log(`[WebRTC] Updating existing remote stream for ${peerSocketId}`);
          newMap.set(peerSocketId, remoteStream);
        }
        return newMap;
      });
    };

    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      if (!isConnectionEstablished) {
        console.error(`[WebRTC] Connection to ${peerSocketId} timed out`);
        closePeerConnection(peerSocketId);
      }
    }, ICE_RECOVERY_CONFIG.CONNECTION_TIMEOUT);

    newPc.onsignalingstatechange = () => {
        const state = newPc.signalingState;
        console.log(`[WebRTC] Signaling state change for ${peerSocketId}: ${state}`);
        
        updateConnectionState(peerSocketId, { signalingState: state });
        
        if (newPc.remoteDescription && newPc.remoteDescription.type) {
            const pendingCandidates = (newPc as ExtendedRTCPeerConnection).pendingCandidates || [];
            pendingCandidates.forEach(candidate => {
                if (candidate) {
                    const iceCandidate = new RTCIceCandidate(candidate);
                    socketService.sendWebRTCICECandidate(iceCandidate, peerSocketId, selfSocketId);
                }
            });
            (newPc as ExtendedRTCPeerConnection).pendingCandidates = [];
        }
    };
    
    newPc.onconnectionstatechange = () => {
        const state = newPc.connectionState;
        console.log(`[WebRTC] Connection state change for ${peerSocketId}: ${state}`);
        
        updateConnectionState(peerSocketId, { connectionState: state });
        
        switch (state) {
            case 'connected':
                console.log(`[WebRTC] Connection established with ${peerSocketId}`);
                break;
                
            case 'failed':
                console.warn(`[WebRTC] Connection to ${peerSocketId} failed. Attempting recovery...`);
                if (newPc.signalingState !== 'closed') {
                    try {
                        newPc.restartIce();
                    } catch (e) {
                        console.error(`[WebRTC] Failed to restart connection:`, e);
                        closePeerConnection(peerSocketId);
                    }
                }
                break;
                
            case 'closed':
                console.log(`[WebRTC] Connection to ${peerSocketId} closed.`);
                closePeerConnection(peerSocketId);
                break;
        }
    };

    setTimeout(() => {
      const currentPc = peerConnections.get(peerSocketId) as ExtendedRTCPeerConnection;
      if (currentPc === newPc && 
          newPc.iceConnectionState !== 'connected' && 
          newPc.iceConnectionState !== 'completed') {
        console.warn(`[WebRTC] Connection to ${peerSocketId} timed out. Current state: ${newPc.iceConnectionState}`);
        if (newPc.signalingState !== 'closed') {
          try {
            newPc.restartIce();
            console.log(`[WebRTC] ICE restart initiated for ${peerSocketId}`);
          } catch (e) {
            console.error(`[WebRTC] Failed to restart ICE:`, e);
            closePeerConnection(peerSocketId);
          }
        }
      }
    }, ICE_RECOVERY_CONFIG.CONNECTION_TIMEOUT);

    // Add local tracks if available
    if (localStream) {
      console.log(`[WebRTC] Adding local tracks to peer connection for ${peerSocketId}`);
      localStream.getTracks().forEach(track => {
        if (!newPc.getSenders().find(sender => sender.track === track)) {
          console.log(`[WebRTC] Adding local track to PC for ${peerSocketId}: kind=${track.kind}, id=${track.id}, enabled=${track.enabled}`);
          try {
            newPc.addTrack(track, localStream);
          } catch (e) {
            console.error(`[WebRTC] Error adding track ${track.id} to ${peerSocketId}:`, e);
          }
        } else {
          console.log(`[WebRTC] Track ${track.id} already added to ${peerSocketId}`);
        }
      });
    } else {
      console.warn('[WebRTC] Local stream not available when creating peer connection for', peerSocketId);
    }

    setPeerConnections(prev => new Map(prev).set(peerSocketId, newPc));
    return newPc;
  }, [localStream, peerConnections, closePeerConnection, players, updateConnectionState, handleError]);

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
      currentSocket.emit('microphone-state-change', {
        roomCode,
        enabled,
        fromSocketId: currentSocket.id
      });
    }
  }, [roomCode]);

  const refreshDeviceList = useCallback(async (): Promise<void> => {
    try {
      if (!(refreshDeviceList as any).hasLoggedDevices) {
        console.log('[WebRTC] Refreshing device list...');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      const cameraCountChanged = cameras.length !== availableCameras.length;
      const micCountChanged = microphones.length !== availableMicrophones.length;
      
      if (cameraCountChanged || micCountChanged) {
        if (!(refreshDeviceList as any).hasLoggedDevices || cameraCountChanged || micCountChanged) {
          console.log('[WebRTC] Found camera devices:', cameras.length);
          console.log('[WebRTC] Found microphone devices:', microphones.length);
          (refreshDeviceList as any).hasLoggedDevices = true;
        }
      }
      
      setAvailableCameras(cameras);
      setAvailableMicrophones(microphones);
      
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

  // Keep selectCamera and selectMicrophone as is...
  const selectCamera = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    console.log(`[WebRTC] Selecting camera with deviceId: ${deviceId}`);
    setSelectedCameraId(deviceId);
    
    if (localStream) {
      try {
        localStream.getTracks().forEach(track => {
          console.log(`[WebRTC] Stopping track: ${track.kind} (${track.id})`);
          track.stop();
        });
        
        console.log('[WebRTC] Requesting new stream with selected camera');
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
        
        setLocalStream(newStream);
        setIsWebcamActive(true);
        
        peerConnections.forEach((pc, peerSocketId) => {
          try {
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
            
            const audioTracks = newStream.getAudioTracks();
            if (audioTracks.length > 0) {
              const audioSenders = pc.getSenders().filter(sender => 
                sender.track && sender.track.kind === 'audio'
              );
              
              if (audioSenders.length === 0) {
                audioTracks.forEach(track => {
                  pc.addTrack(track, newStream);
                });
              } else if (audioSenders.length > 0 && audioTracks.length > 0) {
                console.log(`[WebRTC] Replacing audio track for peer ${peerSocketId}`);
                audioSenders[0].replaceTrack(audioTracks[0]);
              }
            }
          } catch (error) {
            console.error(`[WebRTC] Error updating tracks for peer ${peerSocketId}:`, error);
          }
        });
        
        broadcastWebcamState(true);
      } catch (error) {
        console.error('[WebRTC] Error switching camera:', error);
        setIsWebcamActive(false);
        broadcastWebcamState(false);
      }
    } else {
      console.log('[WebRTC] Camera selected, but no stream exists yet. It will be used when starting the stream.');
    }
  }, [localStream, peerConnections, broadcastWebcamState]);

  const selectMicrophone = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    console.log(`[WebRTC] Selecting microphone with deviceId: ${deviceId}`);
    setSelectedMicrophoneId(deviceId);
    
    if (localStream) {
      try {
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
          console.log(`[WebRTC] Stopping audio track: ${track.id}`);
          track.stop();
        });
        
        console.log('[WebRTC] Requesting new audio stream with selected microphone');
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
        
        const newAudioTrack = newAudioStream.getAudioTracks()[0];
        
        const newStream = new MediaStream();
        
        localStream.getVideoTracks().forEach(track => {
          newStream.addTrack(track);
        });
        
        if (newAudioTrack) {
          newStream.addTrack(newAudioTrack);
        }
        
        setLocalStream(newStream);
        setIsMicrophoneActive(true);
        
        peerConnections.forEach((pc, peerSocketId) => {
          try {
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
        
        broadcastMicrophoneState(true);
      } catch (error) {
        console.error('[WebRTC] Error switching microphone:', error);
        setIsMicrophoneActive(false);
        broadcastMicrophoneState(false);
      }
    } else {
      console.log('[WebRTC] Microphone selected, but no stream exists yet. It will be used when starting the stream.');
    }
  }, [localStream, peerConnections, broadcastMicrophoneState]);

  // Modified startLocalStream to ensure video tracks are properly enabled
  const startLocalStream = useCallback(async () => {
    if (initializationState.isStartingStream) {
      console.log('[WebRTC] Stream start already in progress');
      return;
    }

    try {
      setInitializationState(prev => ({ ...prev, isStartingStream: true, lastError: null }));
      console.log('[WebRTC] Starting local media stream...');
      
      // Refresh device list first
      await refreshDeviceList();
      
      const constraints: MediaStreamConstraints = {
        video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
        audio: selectedMicrophoneId ? { deviceId: { exact: selectedMicrophoneId } } : true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[WebRTC] Local stream acquired:', stream);
      
      // Verify stream is valid before setting state
      if (!stream || stream.getTracks().length === 0) {
        throw new Error('Invalid stream received');
      }
      
      // Enable all tracks
      stream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`[WebRTC] ${track.kind} track enabled: id=${track.id}, enabled=${track.enabled}, readyState=${track.readyState}`);
      });
      
      // Set stream state synchronously
      setLocalStream(stream);
      
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify state was updated
      if (!localStream) {
        throw new Error('Stream state not updated');
      }
      
      // Set activity states
      const hasVideoTrack = stream.getVideoTracks().length > 0;
      const hasAudioTrack = stream.getAudioTracks().length > 0;
      
      setIsWebcamActive(hasVideoTrack);
      setIsMicrophoneActive(hasAudioTrack);
      
      console.log('[WebRTC] Local stream started successfully');
    } catch (error) {
      console.error('[WebRTC] Error starting local stream:', error);
      setInitializationState(prev => ({ 
        ...prev, 
        lastError: error instanceof Error ? error.message : 'Failed to start stream'
      }));
      throw error;
    } finally {
      setInitializationState(prev => ({ ...prev, isStartingStream: false }));
    }
  }, [selectedCameraId, selectedMicrophoneId, refreshDeviceList]);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      closeAllPeerConnections();
      setLocalStream(null);
      setIsWebcamActive(false);
      setIsMicrophoneActive(false);
      isWebRTCInitialized.current = false;
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

  // Improved initializeWebRTC with retry logic
  const initializeWebRTC = useCallback(async (): Promise<void> => {
    // Prevent multiple simultaneous initialization attempts
    if (initializationState.isInitializingWebRTC || isWebRTCInitialized.current) {
      console.log('[WebRTC] Already initializing or initialized, skipping duplicate call');
      return;
    }

    if (!roomCode || !localStream) {
      console.log('[WebRTC] Cannot initialize WebRTC: missing roomCode or localStream', {
        hasRoomCode: !!roomCode,
        hasLocalStream: !!localStream
      });
      
      setInitializationState(prev => ({
        ...prev,
        lastError: 'Missing roomCode or localStream'
      }));
      
      throw new Error('Missing prerequisites for WebRTC initialization');
    }

    setInitializationState(prev => ({
      ...prev,
      isInitializingWebRTC: true,
      webrtcInitAttempts: prev.webrtcInitAttempts + 1,
      lastError: null
    }));

    try {
      console.log('[WebRTC] Initializing WebRTC, sending webrtc-ready:', {
        roomCode,
        isGameMaster: currentUserIsGM,
        attempt: initializationState.webrtcInitAttempts + 1
      });
      
      // Ensure socket is connected before sending
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        console.log('[WebRTC] Socket not connected, waiting for connection...');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Socket connection timeout'));
          }, 5000);
          
          if (socket) {
            socket.once('connect', () => {
              clearTimeout(timeout);
              resolve(undefined);
            });
          } else {
            reject(new Error('No socket available'));
          }
        });
      }
      
      await socketService.sendWebRTCReady(roomCode);
      
      isWebRTCInitialized.current = true;
      
      setInitializationState(prev => ({
        ...prev,
        isInitializingWebRTC: false,
        lastError: null
      }));
      
      console.log('[WebRTC] WebRTC initialized successfully');
    } catch (error) {
      console.error('[WebRTC] Error initializing WebRTC:', error);
      
      setInitializationState(prev => ({
        ...prev,
        isInitializingWebRTC: false,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      }));
      
      // Retry logic
      if (initializationState.webrtcInitAttempts < 3) {
        console.log(`[WebRTC] Retrying initialization in 2 seconds... (attempt ${initializationState.webrtcInitAttempts + 1}/3)`);
        setTimeout(() => {
          initializeWebRTC().catch(e => console.error('[WebRTC] Retry failed:', e));
        }, 2000);
      }
      
      throw error;
    }
  }, [roomCode, localStream, currentUserIsGM, initializationState]);

  // New combined method for starting WebRTC session
  const startWebRTCSession = useCallback(async (): Promise<void> => {
    console.log('[WebRTC] Starting complete WebRTC session...');
    
    try {
      // Step 1: Start local stream
      if (!localStream) {
        console.log('[WebRTC] Step 1: Starting local stream...');
        await startLocalStream();
        
        // Wait a bit for stream to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('[WebRTC] Step 1: Local stream already exists');
      }
      
      // Step 2: Initialize WebRTC
      if (!isWebRTCInitialized.current) {
        console.log('[WebRTC] Step 2: Initializing WebRTC...');
        await initializeWebRTC();
      } else {
        console.log('[WebRTC] Step 2: WebRTC already initialized');
      }
      
      console.log('[WebRTC] WebRTC session started successfully');
    } catch (error) {
      console.error('[WebRTC] Failed to start WebRTC session:', error);
      throw error;
    }
  }, [localStream, startLocalStream, initializeWebRTC]);

  const startWebcamWithRetry = useCallback(async () => {
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptStart = async (): Promise<boolean> => {
      try {
        // Check if we have the required room code
        if (!roomCode) {
          console.error('[WebRTC] Cannot start webcam: missing room code');
          throw new Error('Missing room code');
        }

        // Start stream first
        await startLocalStream();
        
        // Get the current stream from state
        const currentStream = localStream;
        
        // Verify stream was created successfully
        if (!currentStream) {
          console.error('[WebRTC] Stream creation failed - no localStream available');
          throw new Error('Stream creation failed');
        }
        
        // Verify stream is still valid
        if (currentStream.getTracks().length === 0) {
          console.error('[WebRTC] Stream became invalid after creation');
          throw new Error('Stream became invalid');
        }
        
        // Then initialize WebRTC
        await initializeWebRTC();
        
        return true; // Success
      } catch (error) {
        console.error(`[WebRTC] Attempt ${retryCount + 1} failed:`, error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[WebRTC] Retrying in 2 seconds... (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptStart();
        }
        
        throw error; // Max retries reached
      }
    };

    try {
      await attemptStart();
    } catch (error) {
      console.error('[WebRTC] All retry attempts failed:', error);
      throw error;
    }
  }, [startLocalStream, initializeWebRTC, roomCode, localStream]);

  useEffect(() => {
    const currentSocket = socketService.getSocket();
    const selfSocketId = currentSocket?.id;

    if (!currentSocket || !roomCode || !selfSocketId) {
      return; 
    }

    const handleNewPeer = async ({ newPeer }: { newPeer: PeerInfo }) => {
      if (newPeer.isGameMaster || peerConnections.size < 3) {
        console.log(`[WebRTC] New peer joined: ${newPeer.socketId} (${newPeer.playerName}), ${newPeer.isGameMaster ? 'GM' : 'Player'}`);
      }
      
      peerNameRegistry.set(newPeer.socketId, newPeer.playerName);
      setPeerNames(prev => new Map(prev).set(newPeer.socketId, newPeer.playerName));
      
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
      if (peers.length < 5) {
        console.log(`[WebRTC] Processing ${peers.length} existing peers.`);
      }
      
      const newPeerNames = new Map<string, string>();
      peers.forEach(peer => {
        if (peer.socketId && peer.playerName) {
          peerNameRegistry.set(peer.socketId, peer.playerName);
          newPeerNames.set(peer.socketId, peer.playerName);
          
          if (peer.isGameMaster || peers.length < 3) {
            console.log(`[WebRTC] Existing peer: ${peer.socketId} -> ${peer.playerName}`);
          }
        }
      });
      
      setPeerNames(prev => {
        const updated = new Map(prev);
        newPeerNames.forEach((name, id) => {
          updated.set(id, name);
        });
        return updated;
      });
      
      peers.forEach(async peer => {
        if (peer.socketId === selfSocketId) return;
        
        const existingPc = peerConnections.get(peer.socketId);
        if (existingPc && existingPc.signalingState !== 'closed' && 
            (existingPc.iceConnectionState === 'connected' || 
             existingPc.iceConnectionState === 'completed')) {
          if (peer.isGameMaster) {
            console.log(`[WebRTC] Already have a good connection to ${peer.socketId}. Skipping offer.`);
          }
          return;
        }
        
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
        pc = createPeerConnection(from, selfSocketId);
      } else if (!pc || pc.signalingState === 'closed') {
        console.log(`[WebRTC] No existing open PC for offer from ${from}, creating one.`);
        pc = createPeerConnection(from, selfSocketId); 
      }
      
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
            if (pc.signalingState !== 'closed') {
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
      
      setPeerNames(prev => {
        const updated = new Map(prev);
        updated.delete(peerSocketId);
        return updated;
      });
      peerNameRegistry.delete(peerSocketId);
    };
    
    const handleWebcamStateChange = ({ fromSocketId, enabled }: { fromSocketId: string, enabled: boolean }) => {
      if (fromSocketId === selfSocketId) return;

      setRemotePeerStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(fromSocketId) || { webcamEnabled: true, micEnabled: true };
        newMap.set(fromSocketId, { ...currentState, webcamEnabled: enabled });
        return newMap;
      });
    };

    const handleMicrophoneStateChange = ({ fromSocketId, enabled }: { fromSocketId: string, enabled: boolean }) => {
      if (fromSocketId === selfSocketId) return;

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
    
    currentSocket.on('webrtc-refresh-states', () => {
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

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

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
    connectionStates,
    errors,
    clearErrors,
    getConnectionStats,
    initializationState,
    startWebRTCSession,
    startWebcamWithRetry,
  };

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>;
};