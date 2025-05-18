import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MusicControl from '../components/shared/MusicControl';
import { useAudio } from '../contexts/AudioContext';
import socketService from '../services/socketService';
import { toast } from 'react-toastify';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { playBackgroundMusic } = useAudio();
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    playBackgroundMusic();
  }, [playBackgroundMusic]);

  const handleResetConnection = () => {
    socketService.clearPersistentPlayerId();
    toast.success("Connection reset successful. Your player ID has been cleared.");
  };

  return (
    <>
      <MusicControl />
      <div className="home-container d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="card p-4 text-center" style={{ maxWidth: 500, width: '100%' }}>
          <h1 className="home-title mb-2 d-flex align-items-center justify-content-center gap-2">
            <span className="bi bi-mortarboard section-icon" aria-label="School"></span>
            School Quiz Game
          </h1>
          <p className="home-subtitle mb-4 d-flex align-items-center justify-content-center gap-2">
            <span className="bi bi-stars section-icon" aria-label="Stars"></span>
            Test your knowledge with questions from the German school system (Class 1-13)
          </p>
          <div className="card mb-4 p-3" style={{ background: '#ffe066', color: '#2d4739', border: '2px dashed #ffd166' }}>
            <h2 className="mb-3 d-flex align-items-center gap-2">
              <span className="bi bi-lightbulb section-icon" aria-label="How to Play"></span>
              How to Play
            </h2>
            <ul className="text-start" style={{ fontSize: '1.1rem' }}>
              <li>Gamemasters create rooms and set questions</li>
              <li>Players join with a room code and answer on a digital greenboard</li>
              <li>Each player has 3 lives - run out and you're eliminated!</li>
              <li>Gamemasters decide if answers are correct</li>
              <li>Last player standing wins!</li>
            </ul>
          </div>
          <div className="home-buttons d-flex flex-column flex-md-row gap-3 justify-content-center mt-3">
            <button 
              className="btn btn-primary btn-lg d-flex align-items-center gap-2"
              onClick={() => navigate('/gamemaster')}
            >
              <span className="bi bi-person-gear"></span>
              Be a Gamemaster
            </button>
            <button 
              className="btn btn-success btn-lg d-flex align-items-center gap-2"
              onClick={() => navigate('/join')}
            >
              <span className="bi bi-emoji-smile"></span>
              Join as Player
            </button>
          </div>
          
          <div className="mt-5">
            <button 
              className="btn btn-link text-muted"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
            </button>
            
            {showAdvanced && (
              <div className="card p-3 mt-2 border-danger">
                <h6 className="mb-3">Advanced Options</h6>
                <button 
                  className="btn btn-outline-danger"
                  onClick={handleResetConnection}
                >
                  <span className="bi bi-arrow-repeat me-2"></span>
                  Reset Connection
                </button>
                <small className="d-block mt-2 text-muted">
                  Use this if you're having issues with connections or player identification.
                </small>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Home; 