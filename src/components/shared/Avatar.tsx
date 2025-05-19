import React, { useEffect, useState } from 'react';

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
  
  useEffect(() => {
    // Try to load the avatar from localStorage
    if (persistentPlayerId) {
      const savedAvatar = localStorage.getItem(`avatar_${persistentPlayerId}`);
      if (savedAvatar) {
        setAvatarSvg(savedAvatar);
      }
    }
  }, [persistentPlayerId]);
  
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
  
  return (
    <div 
      className={`avatar ${className}`}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        display: 'inline-block',
        overflow: 'hidden',
        borderRadius: '50%'
      }}
    >
      {avatarSvg ? (
        <div 
          dangerouslySetInnerHTML={{ 
            __html: avatarSvg.replace('width="100" height="100"', `width="${size}" height="${size}"`) 
          }} 
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: generateDefaultAvatar() }} />
      )}
    </div>
  );
};

export default Avatar; 