import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import socketService from '../services/socketService'; // Assuming socketService is correctly set up
import { useRoom } from './RoomContext'; // To get current room and player info

// Configuration
const STUN_SERVER = 'stun:stun.l.google.com:19302';

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
    const newPc = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVER }] });

    newPc.onicecandidate = (event) => {
      if (event.candidate && selfSocketId) {
        socketService.sendWebRTCICECandidate(event.candidate, peerSocketId, selfSocketId);
      }
    };

    newPc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track event from ${peerSocketId}:`, event);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        console.log(`[WebRTC] Remote stream for ${peerSocketId}:`, remoteStream);
        remoteStream.getTracks().forEach(track => {
          console.log(`[WebRTC] Remote track (${peerSocketId}): id=${track.id}, kind=${track.kind}, label=${track.label}, enabled=${track.enabled}, readyState=${track.readyState}`);
        });
        
        // Check if this peer is a GameMaster and set a property on the stream
        const peerPlayer = players.find(p => p.id === peerSocketId);
        if (peerPlayer) {
          console.log(`[WebRTC] Setting metadata for ${peerSocketId}: name=${peerPlayer.name}, isGameMaster=${peerPlayer.name === 'GameMaster'}`);
          // We can't actually set properties on MediaStream, but we can track them separately
          // and use them in the WebcamDisplay component
        }
        
        setRemoteStreams(prev => new Map(prev).set(peerSocketId, remoteStream));
      } else {
        console.warn(`[WebRTC] Remote track event from ${peerSocketId} did not contain streams or stream[0].`);
      }
    };
    
    newPc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state change for ${peerSocketId}: ${newPc.iceConnectionState}`);
      if (newPc.iceConnectionState === 'failed' || newPc.iceConnectionState === 'disconnected' || newPc.iceConnectionState === 'closed') {
        console.warn(`[WebRTC] ICE connection to ${peerSocketId} is ${newPc.iceConnectionState}. Attempting to clean up.`);
        closePeerConnection(peerSocketId); 
      }
    };
    
    newPc.onsignalingstatechange = () => {
        console.log(`[WebRTC] Signaling state change for ${peerSocketId}: ${newPc.signalingState}`);
    };

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

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[WebRTC] Local stream acquired:', stream);
      stream.getTracks().forEach(track => {
        console.log(`[WebRTC] Local track: id=${track.id}, kind=${track.kind}, label=${track.label}, enabled=${track.enabled}, readyState=${track.readyState}`);
      });
      setLocalStream(stream);
      setIsWebcamActive(true);
      setIsMicrophoneActive(true);
    } catch (error) {
      console.error('[WebRTC] Error starting local stream:', error);
      setIsWebcamActive(false);
      setIsMicrophoneActive(false);
    }
  }, []);

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
    localStream?.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
      setIsWebcamActive(track.enabled);
      console.log(`[WebRTC] Webcam ${track.enabled ? 'enabled' : 'disabled'}`);
    });
  }, [localStream]);

  const toggleMicrophone = useCallback(() => {
    localStream?.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
      setIsMicrophoneActive(track.enabled);
      console.log(`[WebRTC] Microphone ${track.enabled ? 'enabled' : 'disabled'}`);
    });
  }, [localStream]);

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

    if (!currentSocket || !roomCode || !localStream || !selfSocketId) {
      return; 
    }

    const handleNewPeer = async ({ newPeer }: { newPeer: PeerInfo }) => {
      console.log(`[WebRTC] handleNewPeer: I am ${currentUserIsGM ? 'GM' : 'Player'}. New peer is ${newPeer.isGameMaster ? 'GM' : 'Player'} (${newPeer.socketId}) named ${newPeer.playerName}`);
      if (newPeer.socketId === selfSocketId) return;
      
      // Store the player name for this socket ID - this helps the WebcamDisplay component
      // even if the name isn't properly relayed through the PeerInfo object
      if (newPeer.playerName) {
        // Store in our module-scoped registry
        peerNameRegistry.set(newPeer.socketId, newPeer.playerName);
        
        // Also update the state for the context consumers
        setPeerNames(prev => new Map(prev).set(newPeer.socketId, newPeer.playerName));
        
        // Log the peer info for debugging
        console.log(`[WebRTC] Stored peer name mapping: ${newPeer.socketId} -> ${newPeer.playerName}`);
      }

      if (currentUserIsGM && !newPeer.isGameMaster) {
        const existingPc = peerConnections.get(newPeer.socketId);
        if (existingPc && existingPc.signalingState !== 'closed') {
            console.log(`[WebRTC] Connection to new player ${newPeer.socketId} already exists or is in progress (state: ${existingPc.signalingState}).`);
            return;
        }
        console.log(`[WebRTC] GM creating offer for NEW PLAYER ${newPeer.socketId} (${newPeer.playerName})`);
        const pc = createPeerConnection(newPeer.socketId, selfSocketId);
        // pc should always be defined here if createPeerConnection doesn't throw
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketService.sendWebRTCOffer(offer, newPeer.socketId, selfSocketId);
        } catch (error) {
          console.error('[WebRTC] Error creating offer for new peer:', error);
        }
      }
    };

    const handleExistingPeers = ({ peers }: { peers: PeerInfo[] }) => {
      console.log(`[WebRTC] handleExistingPeers: I am ${currentUserIsGM ? 'GM' : 'Player'}. Processing ${peers.length} existing peers.`);
      
      // Update all peer names from the list
      const newPeerNames = new Map<string, string>();
      peers.forEach(peer => {
        if (peer.socketId && peer.playerName) {
          // Update the module-scoped registry
          peerNameRegistry.set(peer.socketId, peer.playerName);
          
          // Also add to our state map
          newPeerNames.set(peer.socketId, peer.playerName);
          
          console.log(`[WebRTC] Existing peer: ${peer.socketId} -> ${peer.playerName}`);
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
      
      peers.forEach(async peer => {
        if (peer.socketId === selfSocketId) return;
        
        const existingPc = peerConnections.get(peer.socketId);
        if (existingPc && existingPc.signalingState !== 'closed') {
            console.log(`[WebRTC] Connection to existing peer ${peer.socketId} already exists or is in progress (state: ${existingPc.signalingState}). Skipping offer.`);
            return;
        }

        if (currentUserIsGM && !peer.isGameMaster) {
          console.log(`[WebRTC] GM creating offer for EXISTING PLAYER ${peer.socketId} (${peer.playerName})`);
          const pc = createPeerConnection(peer.socketId, selfSocketId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketService.sendWebRTCOffer(offer, peer.socketId, selfSocketId);
          } catch (error) {
            console.error('[WebRTC] Error creating offer for existing player:', error);
          }
        }
        else if (!currentUserIsGM && peer.isGameMaster) {
          console.log(`[WebRTC] PLAYER creating offer for EXISTING GM ${peer.socketId}`);
          const pc = createPeerConnection(peer.socketId, selfSocketId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketService.sendWebRTCOffer(offer, peer.socketId, selfSocketId);
          } catch (error) {
            console.error('[WebRTC] Error creating offer for existing GM:', error);
          }
        }
      });
    };

    const handleOffer = async ({ offer, from }: { offer: RTCSessionDescriptionInit, from: string }) => {
      console.log(`[WebRTC] Received offer from ${from} (I am ${selfSocketId}). My role: ${currentUserIsGM ? 'GM' : 'Player'}`);
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
      const pc = peerConnections.get(from);
      if (pc) {
        if (pc.remoteDescription && pc.signalingState !== 'closed') { 
            pc.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(e => console.error('[WebRTC] Error adding ICE candidate:', e));
        } else {
            console.warn(`[WebRTC] Received ICE candidate from ${from}, but remote description not set or PC closed. State: ${pc.signalingState}`);
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

    currentSocket.on('webrtc-new-peer', handleNewPeer);
    currentSocket.on('webrtc-existing-peers', handleExistingPeers);
    currentSocket.on('webrtc-offer', handleOffer);
    currentSocket.on('webrtc-answer', handleAnswer);
    currentSocket.on('webrtc-ice-candidate', handleIceCandidate);
    currentSocket.on('webrtc-user-left', handleUserLeft);

    return () => {
      console.log('[WebRTC] Cleaning up WebRTC listeners');
      currentSocket.off('webrtc-new-peer', handleNewPeer);
      currentSocket.off('webrtc-existing-peers', handleExistingPeers);
      currentSocket.off('webrtc-offer', handleOffer);
      currentSocket.off('webrtc-answer', handleAnswer);
      currentSocket.off('webrtc-ice-candidate', handleIceCandidate);
      currentSocket.off('webrtc-user-left', handleUserLeft);
    };
  }, [roomCode, localStream, createPeerConnection, closePeerConnection, peerConnections, currentUserIsGM]);

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
  };

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>;
}; 