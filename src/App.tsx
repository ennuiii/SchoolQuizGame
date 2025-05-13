import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import GameMaster from './pages/GameMaster';
import Player from './pages/Player';
import Spectator from './pages/Spectator';
import JoinGame from './pages/JoinGame';
import './App.css';

const App: React.FC = () => {
  return (
    <GameProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/join" />} />
            <Route path="/join" element={<JoinGame />} />
            <Route path="/gamemaster" element={<GameMaster />} />
            <Route path="/player" element={<Player />} />
            <Route path="/spectator" element={<Spectator />} />
          </Routes>
        </div>
      </Router>
    </GameProvider>
  );
};

export default App; 