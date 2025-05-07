import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Home from './pages/Home';
import GameMaster from './pages/GameMaster';
import JoinGame from './pages/JoinGame';
import Player from './pages/Player';
import 'bootstrap/dist/css/bootstrap.min.css';

const App: React.FC = () => {
  return (
    <Router>
      <Container className="py-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gamemaster" element={<GameMaster />} />
          <Route path="/join" element={<JoinGame />} />
          <Route path="/player" element={<Player />} />
        </Routes>
      </Container>
    </Router>
  );
};

export default App; 