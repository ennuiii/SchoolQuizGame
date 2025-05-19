import React, { useEffect } from 'react';
import { useAudio } from '../contexts/AudioContext';

const Spectator: React.FC = () => {
  const { playBackgroundMusic, pauseBackgroundMusic } = useAudio();

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await playBackgroundMusic();
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };
    initializeAudio();
    return () => {
      pauseBackgroundMusic();
    };
  }, [playBackgroundMusic, pauseBackgroundMusic]);

  return (
    <div>
      <h1>Spectator</h1>
      {/* Add your spectator content here */}
    </div>
  );
};

export default Spectator; 