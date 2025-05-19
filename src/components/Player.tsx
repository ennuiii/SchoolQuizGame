import React, { useEffect } from 'react';
import { useAudio } from '../contexts/AudioContext';

const Player: React.FC = () => {
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
      <h1>Player</h1>
      {/* Add your player content here */}
    </div>
  );
};

export default Player; 