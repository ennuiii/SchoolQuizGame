import React, { useState, useEffect } from 'react';
import { useRoom } from '../../contexts/RoomContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

// Avatar part options
const FACE_SHAPES = [
  { id: 'circle', path: 'M25,50 a25,25 0 1,1 50,0 a25,25 0 1,1 -50,0', color: '#ffb6c1' },
  { id: 'square', path: 'M25,25 h50 v50 h-50 z', color: '#add8e6' },
  { id: 'triangle', path: 'M25,65 L50,20 L75,65 z', color: '#98fb98' },
  { id: 'hexagon', path: 'M35,20 L65,20 L80,50 L65,80 L35,80 L20,50 z', color: '#ffa07a' }
];

const EYES = [
  { id: 'round', paths: ['M35,40 a5,5 0 1,1 10,0 a5,5 0 1,1 -10,0', 'M55,40 a5,5 0 1,1 10,0 a5,5 0 1,1 -10,0'] },
  { id: 'oval', paths: ['M35,40 a7,5 0 1,1 10,0 a7,5 0 1,1 -10,0', 'M55,40 a7,5 0 1,1 10,0 a7,5 0 1,1 -10,0'] },
  { id: 'happy', paths: ['M32,38 a8,8 0 0,1 16,0', 'M52,38 a8,8 0 0,1 16,0'] },
  { id: 'closed', paths: ['M32,40 q8,-5 16,0', 'M52,40 q8,-5 16,0'] }
];

const MOUTHS = [
  { id: 'smile', path: 'M40,60 q10,10 20,0' },
  { id: 'straight', path: 'M40,60 h20' },
  { id: 'sad', path: 'M40,65 q10,-10 20,0' },
  { id: 'surprised', path: 'M50,60 a5,5 0 1,1 0.1,0' }
];

const HAIRS = [
  { id: 'none', path: '' },
  { id: 'short', path: 'M25,30 Q50,0 75,30' },
  { id: 'curly', path: 'M20,30 Q30,10 40,25 Q50,5 60,25 Q70,10 80,30' },
  { id: 'long', path: 'M20,30 L30,70 M70,30 L60,70' }
];

const ACCESSORIES = [
  { id: 'none', path: '' },
  { id: 'glasses', path: 'M30,40 h15 M55,40 h15 M45,40 Q50,35 55,40' },
  { id: 'bowtie', path: 'M40,80 Q50,85 60,80 Q50,90 40,80' },
  { id: 'hat', path: 'M25,25 h50 v-10 h-50' }
];

const COLORS = [
  '#ffb6c1', // Pink
  '#add8e6', // Light Blue
  '#98fb98', // Light Green
  '#ffa07a', // Light Salmon
  '#ffffe0', // Light Yellow
  '#d8bfd8', // Thistle (Light Purple)
  '#f0e68c', // Khaki
  '#a9a9a9', // Dark Gray
  '#ff7f50', // Coral
  '#00ced1'  // Dark Turquoise
];

interface AvatarCreatorProps {
  onSave?: (avatarSvg: string) => void;
  initialAvatarSvg?: string;
}

const AvatarCreator: React.FC<AvatarCreatorProps> = ({ onSave, initialAvatarSvg }) => {
  const { persistentPlayerId } = useRoom();
  const { language } = useLanguage();
  
  // Avatar configuration
  const [faceShape, setFaceShape] = useState(0);
  const [eyes, setEyes] = useState(0);
  const [mouth, setMouth] = useState(0);
  const [hair, setHair] = useState(0);
  const [accessory, setAccessory] = useState(0);
  const [color, setColor] = useState(0);
  
  // Parse initial avatar if provided
  useEffect(() => {
    if (initialAvatarSvg) {
      try {
        // Parse the SVG string to extract configuration
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(initialAvatarSvg, "image/svg+xml");
        
        // Extract data attributes
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
          setFaceShape(Number(svgElement.getAttribute('data-face-shape') || '0'));
          setEyes(Number(svgElement.getAttribute('data-eyes') || '0'));
          setMouth(Number(svgElement.getAttribute('data-mouth') || '0'));
          setHair(Number(svgElement.getAttribute('data-hair') || '0'));
          setAccessory(Number(svgElement.getAttribute('data-accessory') || '0'));
          setColor(Number(svgElement.getAttribute('data-color') || '0'));
        }
      } catch (error) {
        console.error('Error parsing initial avatar SVG:', error);
      }
    }
  }, [initialAvatarSvg]);
  
  // Generate random avatar
  const randomizeAvatar = () => {
    setFaceShape(Math.floor(Math.random() * FACE_SHAPES.length));
    setEyes(Math.floor(Math.random() * EYES.length));
    setMouth(Math.floor(Math.random() * MOUTHS.length));
    setHair(Math.floor(Math.random() * HAIRS.length));
    setAccessory(Math.floor(Math.random() * ACCESSORIES.length));
    setColor(Math.floor(Math.random() * COLORS.length));
  };
  
  // Generate SVG string
  const generateAvatarSvg = (): string => {
    const selectedFace = FACE_SHAPES[faceShape];
    const selectedEyes = EYES[eyes];
    const selectedMouth = MOUTHS[mouth];
    const selectedHair = HAIRS[hair];
    const selectedAccessory = ACCESSORIES[accessory];
    const selectedColor = COLORS[color];
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" 
      data-face-shape="${faceShape}" 
      data-eyes="${eyes}" 
      data-mouth="${mouth}" 
      data-hair="${hair}" 
      data-accessory="${accessory}"
      data-color="${color}">
      <path d="${selectedFace.path}" fill="${selectedColor}" stroke="black" stroke-width="1" />
      <path d="${selectedEyes.paths[0]}" fill="white" stroke="black" stroke-width="1" />
      <path d="${selectedEyes.paths[1]}" fill="white" stroke="black" stroke-width="1" />
      <path d="${selectedMouth.path}" fill="none" stroke="black" stroke-width="1.5" />
      <path d="${selectedHair.path}" fill="none" stroke="black" stroke-width="2" />
      <path d="${selectedAccessory.path}" fill="none" stroke="black" stroke-width="1.5" />
    </svg>`;
  };
  
  const handleSave = () => {
    const avatarSvg = generateAvatarSvg();
    // Store in localStorage for this player
    if (persistentPlayerId) {
      localStorage.setItem(`avatar_${persistentPlayerId}`, avatarSvg);
    }
    // Call the onSave callback if provided
    if (onSave) {
      onSave(avatarSvg);
    }
  };
  
  return (
    <div className="avatar-creator">
      <h5 className="mb-3">{t('avatarCreator.title', language)}</h5>
      
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="avatar-preview mb-3" style={{ width: '150px', height: '150px', margin: '0 auto' }}>
            <div dangerouslySetInnerHTML={{ __html: generateAvatarSvg() }} />
          </div>
          
          <div className="d-flex justify-content-center mb-3">
            <button 
              className="btn btn-outline-primary me-2" 
              onClick={randomizeAvatar}
              title="Generate random avatar"
            >
              <i className="bi bi-shuffle"></i> {t('avatarCreator.randomize', language) || 'Randomize'}
            </button>
            
            <button 
              className="btn btn-primary" 
              onClick={handleSave}
            >
              {t('avatarCreator.save', language) || 'Save Avatar'}
            </button>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="avatar-options">
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.faceShape', language) || 'Face Shape'}</label>
              <div className="btn-group d-flex">
                {FACE_SHAPES.map((face, idx) => (
                  <button 
                    key={face.id}
                    className={`btn btn-sm ${faceShape === idx ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setFaceShape(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.eyes', language) || 'Eyes'}</label>
              <div className="btn-group d-flex">
                {EYES.map((eye, idx) => (
                  <button 
                    key={eye.id}
                    className={`btn btn-sm ${eyes === idx ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setEyes(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.mouth', language) || 'Mouth'}</label>
              <div className="btn-group d-flex">
                {MOUTHS.map((m, idx) => (
                  <button 
                    key={m.id}
                    className={`btn btn-sm ${mouth === idx ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setMouth(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.hair', language) || 'Hair'}</label>
              <div className="btn-group d-flex">
                {HAIRS.map((h, idx) => (
                  <button 
                    key={h.id}
                    className={`btn btn-sm ${hair === idx ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setHair(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.accessory', language) || 'Accessory'}</label>
              <div className="btn-group d-flex">
                {ACCESSORIES.map((acc, idx) => (
                  <button 
                    key={acc.id}
                    className={`btn btn-sm ${accessory === idx ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setAccessory(idx)}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-3">
              <label className="form-label">{t('avatarCreator.color', language) || 'Color'}</label>
              <div className="d-flex flex-wrap">
                {COLORS.map((c, idx) => (
                  <button 
                    key={idx}
                    className="color-option me-2 mb-2"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: color === idx ? '2px solid black' : '1px solid #ddd',
                      cursor: 'pointer'
                    }}
                    onClick={() => setColor(idx)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarCreator; 