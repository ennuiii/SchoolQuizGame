import React, { useEffect, useState } from 'react';
import { useAudio } from '../contexts/AudioContext';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { GameState } from '../types/game';

interface Notification {
  type: 'info' | 'error' | 'success';
  message: string;
}

const GameMaster: React.FC = () => {
  const { playBackgroundMusic, pauseBackgroundMusic } = useAudio();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);

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

  useEffect(() => {
    socketService.setOnGameStateUpdate((gameState: GameState) => {
      setGameState(gameState);
    });

    socketService.setOnPlayerKicked((data) => {
      const { playerName, wasDisconnected } = data;
      const message = wasDisconnected 
        ? `Disconnected player ${playerName} has been kicked from the room.`
        : `Player ${playerName} has been kicked from the room.`;
      setNotification({ type: 'info', message });
    });

    return () => {
      socketService.setOnGameStateUpdate(null);
      socketService.setOnPlayerKicked(null);
    };
  }, []);

  const handleLeaveGame = () => {
    // Add any cleanup logic here
    navigate('/');
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{t('gameControls.title', language)}</h1>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-primary"
            onClick={() => {/* Add start game logic */}}
          >
            {t('navigation.startGame', language)}
          </button>
          <button 
            className="btn btn-danger"
            onClick={handleLeaveGame}
          >
            {t('navigation.leaveGame', language)}
          </button>
        </div>
      </div>
      {/* Add your game master content here */}
    </div>
  );
};

export default GameMaster; 