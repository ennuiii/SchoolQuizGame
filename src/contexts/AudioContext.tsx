import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import audioService from '../services/audioService';

interface AudioContextType {
  isMuted: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  playBackgroundMusic: () => void;
  pauseBackgroundMusic: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(audioService.isMusicMuted());
  const [volume, setVolumeState] = useState(audioService.getVolume());

  const toggleMute = useCallback(() => {
    const newMuteState = audioService.toggleMute();
    setIsMuted(newMuteState);
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    audioService.setVolume(newVolume);
    setVolumeState(newVolume);
  }, []);

  const playBackgroundMusic = useCallback(() => {
    audioService.playBackgroundMusic();
  }, []);

  const pauseBackgroundMusic = useCallback(() => {
    audioService.pauseBackgroundMusic();
  }, []);

  // Initialize audio state from service
  useEffect(() => {
    const currentMuteState = audioService.isMusicMuted();
    const currentVolume = audioService.getVolume();
    setIsMuted(currentMuteState);
    setVolumeState(currentVolume);
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