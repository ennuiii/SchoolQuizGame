import React, { useEffect, useState } from 'react';
import { useRoom } from '../../contexts/RoomContext';

interface AvatarProps {
  persistentPlayerId: string;
  size?: number;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ 
  persistentPlayerId, 
  size = 40, 
  className = ''
}) => {
  const [avatarSvg, setAvatarSvg] = useState<string | null>(null);
  const { players } = useRoom();
  
  useEffect(() => {
    if (!persistentPlayerId) return;
    
    // First try to get the avatar from the room context (server synced)
    const playerInRoom = players.find(p => p.persistentPlayerId === persistentPlayerId);
    if (playerInRoom?.avatarSvg) {
      setAvatarSvg(playerInRoom.avatarSvg);
      return;
    }
    
    // If not found in room context, try localStorage (client-side storage)
    const savedAvatar = localStorage.getItem(`avatar_${persistentPlayerId}`);
    if (savedAvatar) {
      setAvatarSvg(savedAvatar);
    }
  }, [persistentPlayerId, players]);
  
  // Generate a default avatar based on the player's ID if none exists
  const generateDefaultAvatar = (): string => {
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
  
  // Process the avatar SVG to ensure proper sizing
  const processAvatarSvg = (): string => {
    if (!avatarSvg) return '';
    
    try {
      // Create a temporary DOM parser to modify the SVG
      const parser = new DOMParser();
      const doc = parser.parseFromString(avatarSvg, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');
      
      if (svgElement) {
        // Set explicit width and height attributes
        svgElement.setAttribute('width', `${size}`);
        svgElement.setAttribute('height', `${size}`);
        
        // Make sure the viewBox is preserved if it exists
        if (!svgElement.hasAttribute('viewBox') && svgElement.hasAttribute('width') && svgElement.hasAttribute('height')) {
          const width = svgElement.getAttribute('width')?.replace(/px$/, '') || '100';
          const height = svgElement.getAttribute('height')?.replace(/px$/, '') || '100';
          svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        
        // Return the modified SVG as a string
        return new XMLSerializer().serializeToString(svgElement);
      }
    } catch (error) {
      console.error('Error processing SVG:', error);
    }
    
    // Fallback to basic string replacement if the DOM manipulation fails
    return avatarSvg
      .replace(/<svg([^>]*)width="[^"]*"([^>]*)height="[^"]*"([^>]*)>/g, `<svg$1width="${size}"$2height="${size}"$3>`)
      .replace(/<svg([^>]*)height="[^"]*"([^>]*)width="[^"]*"([^>]*)>/g, `<svg$1width="${size}"$2height="${size}"$3>`);
  };
  
  return (
    <div 
      className={`avatar ${className}`}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        display: 'inline-block',
        overflow: 'hidden',
        borderRadius: '50%',
        position: 'relative'
      }}
    >
      {avatarSvg ? (
        <div 
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          dangerouslySetInnerHTML={{ 
            __html: processAvatarSvg()
          }} 
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: generateDefaultAvatar() }} />
      )}
    </div>
  );
};

export default Avatar; 