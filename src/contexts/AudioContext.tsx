import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import audioService from '../services/audioService';

interface AudioContextType {
  isMuted: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  playBackgroundMusic: () => Promise<void>;
  pauseBackgroundMusic: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(audioService.isMusicMuted());
  const [volume, setVolumeState] = useState(audioService.getVolume());

  const setVolume = useCallback((newVolume: number) => {
    try {
      audioService.setVolume(newVolume);
      setVolumeState(newVolume);
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }, []);

  const toggleMute = useCallback(() => {
    try {
      if (volume === 0) {
        setVolume(0.5); // Restore to default volume
      } else {
        setVolume(0); // Mute by setting volume to 0
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }, [volume, setVolume]);

  const playBackgroundMusic = useCallback(async () => {
    try {
      await audioService.playBackgroundMusic();
    } catch (error) {
      console.error('Error playing background music:', error);
    }
  }, []);

  const pauseBackgroundMusic = useCallback(() => {
    try {
      audioService.pauseBackgroundMusic();
    } catch (error) {
      console.error('Error pausing background music:', error);
    }
  }, []);

  // Initialize audio state from service
  useEffect(() => {
    try {
      const currentMuteState = audioService.isMusicMuted();
      const currentVolume = audioService.getVolume();
      setIsMuted(currentMuteState);
      setVolumeState(currentVolume);
    } catch (error) {
      console.error('Error initializing audio state:', error);
    }
  }, []);

  const value = {
    isMuted,
    volume,
    toggleMute,
    setVolume,
    playBackgroundMusic,
    pauseBackgroundMusic
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}; 