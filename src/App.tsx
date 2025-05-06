import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import GameMaster from './pages/GameMaster';
import Player from './pages/Player';
import Join from './pages/Join';
import Admin from './pages/Admin';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gamemaster" element={<GameMaster />} />
        <Route path="/player" element={<Player />} />
        <Route path="/join" element={<Join />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  );
};

export default App; 