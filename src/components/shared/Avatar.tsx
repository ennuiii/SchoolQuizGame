import React, { useEffect, useState } from 'react';
import { useRoom } from '../../contexts/RoomContext';
import socketService from '../../services/socketService';

interface AvatarProps {
  persistentPlayerId?: string;
  size?: number;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ 
  persistentPlayerId = '',
  size = 40, 
  className = ''
}) => {
  const [avatarSvg, setAvatarSvg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { players } = useRoom();
  
  useEffect(() => {
    if (!persistentPlayerId) {
      console.log('[Avatar] No persistentPlayerId provided, skipping avatar load');
      setIsLoading(false);
      return;
    }
    
    let mounted = true;
    
    const loadAvatar = async () => {
      console.log('[Avatar] Starting avatar load:', {
        persistentPlayerId,
        timestamp: new Date().toISOString()
      });

      try {
        setError(null);
        
        // First try to get the avatar from the room context (server synced)
        const playerInRoom = players.find(p => p.persistentPlayerId === persistentPlayerId);
        if (playerInRoom?.avatarSvg) {
          console.log('[Avatar] Found avatar in room context:', {
            persistentPlayerId,
            avatarLength: playerInRoom.avatarSvg.length,
            timestamp: new Date().toISOString()
          });
          if (mounted) {
            setAvatarSvg(playerInRoom.avatarSvg);
            // Also update localStorage to keep it in sync
            localStorage.setItem(`avatar_${persistentPlayerId}`, playerInRoom.avatarSvg);
            setIsLoading(false);
          }
          return;
        }
        
        // If not found in room context, try localStorage (client-side storage)
        const savedAvatar = localStorage.getItem(`avatar_${persistentPlayerId}`);
        if (savedAvatar && mounted) {
          console.log('[Avatar] Found avatar in localStorage:', {
            persistentPlayerId,
            avatarLength: savedAvatar.length,
            timestamp: new Date().toISOString()
          });
          setAvatarSvg(savedAvatar);
          setIsLoading(false);
          return;
        }
        
        // If no avatar found, generate default
        console.log('[Avatar] No avatar found, generating default:', {
          persistentPlayerId,
          timestamp: new Date().toISOString()
        });
        if (mounted) {
          setAvatarSvg(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[Avatar] Error loading avatar:', {
          error,
          persistentPlayerId,
          timestamp: new Date().toISOString()
        });
        if (mounted) {
          setError('Failed to load avatar');
          setAvatarSvg(null);
          setIsLoading(false);
        }
      }
    };
    
    loadAvatar();

    // Listen for avatar updates from the server
    const handleAvatarUpdate = (data: { persistentPlayerId: string, avatarSvg: string }) => {
      console.log('[Avatar] Received avatar update from server:', {
        persistentPlayerId,
        receivedPersistentPlayerId: data.persistentPlayerId,
        hasAvatar: !!data.avatarSvg,
        timestamp: new Date().toISOString()
      });
      
      if (data.persistentPlayerId === persistentPlayerId) {
        setAvatarSvg(data.avatarSvg);
        // Also update localStorage to keep it in sync
        localStorage.setItem(`avatar_${persistentPlayerId}`, data.avatarSvg);
        setIsLoading(false);
        setError(null);
      }
    };

    // Listen for avatar update errors
    const handleAvatarError = (data: { message: string }) => {
      console.error('[Avatar] Received avatar update error:', {
        error: data.message,
        persistentPlayerId,
        timestamp: new Date().toISOString()
      });
      if (mounted) {
        setError(data.message);
      }
    };

    socketService.on('avatar_updated', handleAvatarUpdate);
    socketService.on('avatar_update_error', handleAvatarError);
    
    return () => {
      mounted = false;
      socketService.off('avatar_updated', handleAvatarUpdate);
      socketService.off('avatar_update_error', handleAvatarError);
    };
  }, [persistentPlayerId, players]);
  
  // Generate a default avatar based on the player's ID if none exists
  const generateDefaultAvatar = (): string => {
    // Make sure persistentPlayerId exists and is a string before calling split
    // This prevents crashes when old clients without avatar logic connect
    if (!persistentPlayerId) {
      // Fallback for undefined or null persistentPlayerId
      const fallbackColor = `hsl(200, 70%, 80%)`;
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
          <circle cx="50" cy="50" r="45" fill="${fallbackColor}" stroke="#666" stroke-width="2" />
          <text x="50" y="65" font-family="Arial" font-size="45" text-anchor="middle" fill="#333">?</text>
        </svg>
      `;
    }
    
    // Use the persistent player ID to generate consistent colors
    const hash = persistentPlayerId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Generate a color from the hash
    const hue = Math.abs(hash) % 360;
    const color = `hsl(${hue}, 70%, 80%)`;
    
    // First letter of the ID (after the prefix)
    const letter = persistentPlayerId.substring(2, 3).toUpperCase();
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
        <circle cx="50" cy="50" r="45" fill="${color}" stroke="#666" stroke-width="2" />
        <text x="50" y="65" font-family="Arial" font-size="45" text-anchor="middle" fill="#333">${letter}</text>
      </svg>
    `;
  };
  
  // Process SVG to ensure proper sizing
  const processAvatarSvg = (): string => {
    if (!avatarSvg) return '';
    
    // Add width and height attributes if not present
    let processedSvg = avatarSvg;
    if (!processedSvg.includes('width=')) {
      processedSvg = processedSvg.replace('<svg', `<svg width="${size}" height="${size}"`);
    }
    return processedSvg;
  };

  if (error) {
    return (
      <div 
        className={`avatar-error ${className}`}
        style={{ 
          width: size, 
          height: size, 
          borderRadius: '50%', 
          backgroundColor: '#ffebee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#d32f2f',
          fontSize: '12px',
          textAlign: 'center',
          padding: '4px'
        }}
        title={error}
      >
        <i className="bi bi-exclamation-triangle"></i>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div 
        className={`avatar-loading ${className}`} 
        style={{ 
          width: size, 
          height: size, 
          borderRadius: '50%', 
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`avatar ${className}`}
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0'
      }}
      dangerouslySetInnerHTML={{ 
        __html: avatarSvg ? processAvatarSvg() : generateDefaultAvatar() 
      }}
    />
  );
};

export default Avatar; 