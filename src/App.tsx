import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import GameMaster from './pages/GameMaster';
import PlayerComponent from './pages/PlayerComponent';
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
            <Route path="/gamemaster/:roomCode" element={<GameMaster />} />
            <Route path="/player/:roomCode" element={<PlayerComponent />} />
            <Route path="/spectator/:roomCode" element={<Spectator />} />
          </Routes>
        </div>
      </Router>
    </GameProvider>
  );
};

export default App; 