import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Home from './pages/Home';
import GameMaster from './pages/GameMaster';
import JoinGame from './pages/JoinGame';
import Player from './pages/Player';
import Spectator from './pages/Spectator';
import { GameProvider } from './contexts/GameContext';
import { RoomProvider } from './contexts/RoomContext';
import { AudioProvider } from './contexts/AudioContext';
import { CanvasProvider } from './contexts/CanvasContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebRTCProvider } from './contexts/WebRTCContext';
import 'bootstrap/dist/css/bootstrap.min.css';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <AudioProvider>
            <RoomProvider>
              <GameProvider>
                <WebRTCProvider>
                  <CanvasProvider>
                    <Container className="py-4">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/gamemaster" element={<GameMaster />} />
                        <Route path="/join" element={<JoinGame />} />
                        <Route path="/player" element={
                          sessionStorage.getItem('isSpectator') === 'true'
                            ? <Spectator />
                            : <Player />
                        } />
                        <Route path="/spectator" element={<Spectator />} />
                      </Routes>
                    </Container>
                  </CanvasProvider>
                </WebRTCProvider>
              </GameProvider>
            </RoomProvider>
          </AudioProvider>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App; 