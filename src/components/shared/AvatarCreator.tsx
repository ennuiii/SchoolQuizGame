import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRoom } from '../../contexts/RoomContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import socketService from '../../services/socketService';

// DiceBear API styles
const DICEBEAR_STYLES = [
  { id: 'adventurer', name: 'Adventurer' },
  { id: 'adventurer-neutral', name: 'Adventurer Neutral' },
  { id: 'avataaars', name: 'Avataaars' },
  { id: 'big-ears', name: 'Big Ears' },
  { id: 'big-ears-neutral', name: 'Big Ears Neutral' },
  { id: 'bottts', name: 'Bottts' },
  { id: 'croodles', name: 'Croodles' },
  { id: 'fun-emoji', name: 'Fun Emoji' },
  { id: 'lorelei', name: 'Lorelei' },
  { id: 'micah', name: 'Micah' },
  { id: 'miniavs', name: 'Mini Avatars' },
  { id: 'notionists', name: 'Notionists' },
  { id: 'open-peeps', name: 'Open Peeps' },
  { id: 'personas', name: 'Personas' },
  { id: 'pixel-art', name: 'Pixel Art' },
];

// Background colors
const BACKGROUND_COLORS = [
  { id: 'transparent', name: 'Transparent', value: 'transparent' },
  { id: 'light-blue', name: 'Light Blue', value: 'b6e3f4' },
  { id: 'light-pink', name: 'Light Pink', value: 'ffb6c1' },
  { id: 'light-green', name: 'Light Green', value: 'c1e1c1' },
  { id: 'light-purple', name: 'Light Purple', value: 'd8bfd8' },
  { id: 'light-yellow', name: 'Light Yellow', value: 'fff5d4' },
];

interface AvatarCreatorProps {
  onSave?: (avatarSvg: string, persistentPlayerId: string) => void;
  initialAvatarSvg?: string;
  onCancel?: () => void;
  persistentPlayerId?: string;
}

interface AvatarConfig {
  style: string;
  seed: string;
  backgroundColor: string;
  flip: boolean;
  rotate: number;
  scale: number;
}

const DEFAULT_CONFIG: AvatarConfig = {
  style: 'adventurer',
  seed: '',
  backgroundColor: 'transparent',
  flip: false,
  rotate: 0,
  scale: 100,
};

const AvatarCreator: React.FC<AvatarCreatorProps> = ({ onSave, initialAvatarSvg, onCancel, persistentPlayerId }) => {
  const { language } = useLanguage();
  const [config, setConfig] = useState<AvatarConfig>({ ...DEFAULT_CONFIG });
  const [avatarSvg, setAvatarSvg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedConfigRef = useRef<string>('');
  
  // Initialize avatar config with player ID as seed
  useEffect(() => {
    if (persistentPlayerId && !isInitialized) {
      setConfig(prev => ({
        ...prev,
        seed: persistentPlayerId
      }));
      setIsInitialized(true);
    }
  }, [persistentPlayerId, isInitialized]);
  
  // Parse initial avatar if provided
  useEffect(() => {
    if (initialAvatarSvg && !isInitialized) {
      try {
        // Check if the SVG contains DiceBear data attributes
        if (initialAvatarSvg.includes('data-dicebear-')) {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(initialAvatarSvg, "image/svg+xml");
          const svgElement = svgDoc.querySelector('svg');
          
          if (svgElement) {
            const style = svgElement.getAttribute('data-dicebear-style') || 'adventurer';
            const seed = svgElement.getAttribute('data-dicebear-seed') || '';
            const backgroundColor = svgElement.getAttribute('data-dicebear-bgcolor') || 'transparent';
            const flip = svgElement.getAttribute('data-dicebear-flip') === 'true';
            const rotate = parseInt(svgElement.getAttribute('data-dicebear-rotate') || '0', 10);
            const scale = parseInt(svgElement.getAttribute('data-dicebear-scale') || '100', 10);
            
            setConfig({
              style,
              seed,
              backgroundColor,
              flip,
              rotate,
              scale
            });
            
            setAvatarSvg(initialAvatarSvg);
            setIsInitialized(true);
          }
        } else {
          // If it's not a DiceBear SVG, we'll use a random style
          randomizeAvatar();
        }
      } catch (error) {
        console.error('Error parsing initial avatar SVG:', error);
        randomizeAvatar();
      }
    } else if (!initialAvatarSvg && !isInitialized && persistentPlayerId) {
      // No initial avatar, let's create a random one
      randomizeAvatar();
    }
  }, [initialAvatarSvg, isInitialized, persistentPlayerId]);
  
  // Generate random avatar
  const randomizeAvatar = useCallback(() => {
    // Create a random seed if none exists
    const seed = config.seed || persistentPlayerId || Math.random().toString(36).substring(2, 10);
    
    const newConfig = {
      style: DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)].id,
      seed,
      backgroundColor: BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)].value,
      flip: Math.random() > 0.8, // 20% chance to flip
      rotate: Math.floor(Math.random() * 6) * 5, // 0, 5, 10, 15, 20, 25 degrees
      scale: 90 + Math.floor(Math.random() * 3) * 5 // 90, 95, or 100%
    };
    
    setConfig(newConfig);
    setIsInitialized(true);
    fetchAvatar(newConfig);
  }, [config.seed, persistentPlayerId]);
  
  // Update a specific property in the config
  const updateConfig = useCallback((key: keyof AvatarConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);
  
  // Fetch avatar from DiceBear API with debouncing
  const fetchAvatar = useCallback(async (avatarConfig = config) => {
    const configString = JSON.stringify(avatarConfig);
    
    // Prevent duplicate API calls
    if (configString === lastFetchedConfigRef.current) {
      console.log('[AvatarCreator] Skipping duplicate API call for same config');
      return;
    }
    
    setIsLoading(true);
    try {
      const { style, seed, backgroundColor, flip, rotate, scale } = avatarConfig;
      
      const params = new URLSearchParams({
        seed,
        backgroundColor,
        flip: flip.toString(),
        rotate: rotate.toString(),
        scale: scale.toString()
      });
      
      // Create URL for the DiceBear API
      const url = `https://api.dicebear.com/7.x/${style}/svg?${params.toString()}`;
      
      console.log('[AvatarCreator] Fetching avatar from DiceBear:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch avatar: ${response.statusText}`);
      }
      
      let svgText = await response.text();
      
      // Add our custom data attributes to the SVG
      svgText = svgText.replace('<svg ', `<svg data-dicebear-style="${style}" data-dicebear-seed="${seed}" data-dicebear-bgcolor="${backgroundColor}" data-dicebear-flip="${flip}" data-dicebear-rotate="${rotate}" data-dicebear-scale="${scale}" `);
      
      setAvatarSvg(svgText);
      lastFetchedConfigRef.current = configString;
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching avatar:', error);
      setIsLoading(false);
    }
  }, [config]);
  
  // Debounced fetch avatar when config changes
  useEffect(() => {
    // Only fetch if we have a style and seed and component is initialized
    if (config.style && config.seed && isInitialized) {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set new timer with 500ms debounce
      debounceTimerRef.current = setTimeout(() => {
        fetchAvatar();
      }, 500);
    }
    
    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [config, isInitialized, fetchAvatar]);
  
  const handleSave = () => {
    // Store in localStorage for this player
    if (persistentPlayerId && avatarSvg) {
      localStorage.setItem(`avatar_${persistentPlayerId}`, avatarSvg);
      
      // Broadcast avatar update to room - this was removed but is needed for synchronization
      const roomCode = sessionStorage.getItem('roomCode') || localStorage.getItem('roomCode');
      if (roomCode && socketService.getConnectionState() === 'connected') {
        console.log('[AvatarCreator] Broadcasting avatar update to room', roomCode);
        socketService.emit('update_avatar', { 
          roomCode, 
          persistentPlayerId, 
          avatarSvg 
        });
      } else {
        console.warn('[AvatarCreator] Cannot broadcast avatar - no room connection:', {
          roomCode,
          connectionState: socketService.getConnectionState()
        });
      }
    }
    
    // Call the onSave callback if provided
    if (onSave && persistentPlayerId) {
      onSave(avatarSvg, persistentPlayerId);
    } else if (onSave) {
      console.warn('[AvatarCreator] onSave called but persistentPlayerId is missing. Avatar might not save correctly on server.');
    }
  };
  
  return (
    <div className="avatar-creator">
      <h5 className="mb-3">{t('avatarCreator.title', language)}</h5>
      
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="avatar-preview mb-3" style={{ width: '150px', height: '150px', margin: '0 auto' }}>
            {isLoading ? (
              <div className="d-flex justify-content-center align-items-center h-100">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : avatarSvg ? (
              <div dangerouslySetInnerHTML={{ __html: avatarSvg }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <div className="bg-light d-flex justify-content-center align-items-center h-100 border rounded">
                <span className="text-muted">No Avatar</span>
              </div>
            )}
          </div>
          
          <div className="d-flex justify-content-center mb-3">
            <button 
              className="btn btn-outline-primary me-2" 
              onClick={randomizeAvatar}
              disabled={isLoading}
              title="Generate random avatar"
            >
              <i className="bi bi-shuffle"></i> {t('avatarCreator.randomize', language) || 'Randomize'}
            </button>
            
            <button 
              className="btn btn-primary me-2" 
              onClick={handleSave}
              disabled={isLoading || !avatarSvg}
            >
              {t('avatarCreator.save', language) || 'Save Avatar'}
            </button>

            {onCancel && (
              <button 
                className="btn btn-secondary" 
                onClick={onCancel}
                disabled={isLoading}
              >
                {t('avatarCreator.cancel', language) || 'Cancel'}
              </button>
            )}
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="avatar-options">
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.style', language) || 'Style'}</label>
              <select 
                className="form-select" 
                value={config.style}
                onChange={e => updateConfig('style', e.target.value)}
                disabled={isLoading}
              >
                {DICEBEAR_STYLES.map(style => (
                  <option key={style.id} value={style.id}>{style.name}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.seed', language) || 'Seed'}</label>
              <div className="input-group">
                <input 
                  type="text" 
                  className="form-control"
                  value={config.seed}
                  onChange={e => updateConfig('seed', e.target.value)}
                  placeholder="Enter seed for consistent avatar"
                  disabled={isLoading}
                />
                <button 
                  className="btn btn-outline-secondary" 
                  type="button"
                  onClick={() => updateConfig('seed', Math.random().toString(36).substring(2, 10))}
                  disabled={isLoading}
                >
                  <i className="bi bi-dice-5"></i>
                </button>
              </div>
              <small className="form-text text-muted">
                {t('avatarCreator.seedHelp', language) || 'Different seeds create different avatars'}
              </small>
            </div>
            
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.backgroundColor', language) || 'Background Color'}</label>
              <select 
                className="form-select" 
                value={config.backgroundColor}
                onChange={e => updateConfig('backgroundColor', e.target.value)}
                disabled={isLoading}
              >
                {BACKGROUND_COLORS.map(color => (
                  <option key={color.id} value={color.value}>{color.name}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-3">
              <div className="form-check form-switch">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="flipSwitch"
                  checked={config.flip}
                  onChange={e => updateConfig('flip', e.target.checked)}
                  disabled={isLoading}
                />
                <label className="form-check-label" htmlFor="flipSwitch">
                  {t('avatarCreator.flip', language) || 'Flip Horizontally'}
                </label>
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">
                {t('avatarCreator.rotate', language) || 'Rotation'}: {config.rotate}°
              </label>
              <input 
                type="range" 
                className="form-range" 
                min="0" 
                max="25" 
                step="5"
                value={config.rotate}
                onChange={e => updateConfig('rotate', parseInt(e.target.value, 10))}
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-3">
              <label className="form-label">
                {t('avatarCreator.scale', language) || 'Scale'}: {config.scale}%
              </label>
              <input 
                type="range" 
                className="form-range" 
                min="80" 
                max="100" 
                step="5"
                value={config.scale}
                onChange={e => updateConfig('scale', parseInt(e.target.value, 10))}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarCreator; 