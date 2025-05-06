import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <h1 className="home-title">School Quiz Game</h1>
      <p className="home-subtitle">
        Test your knowledge with questions from the German school system (Class 1-13)
      </p>
      
      <div className="card p-4">
        <h2 className="mb-4">How to Play</h2>
        <ul className="text-start">
          <li>Gamemasters create rooms and set questions</li>
          <li>Players join with a room code and answer on a digital greenboard</li>
          <li>Each player has 3 lives - run out and you're eliminated!</li>
          <li>Gamemasters decide if answers are correct</li>
          <li>Last player standing wins!</li>
        </ul>
      </div>
      
      <div className="home-buttons">
        <button 
          className="btn btn-primary btn-lg"
          onClick={() => navigate('/gamemaster')}
        >
          Be a Gamemaster
        </button>
        <button 
          className="btn btn-success btn-lg"
          onClick={() => navigate('/join')}
        >
          Join as Player
        </button>
      </div>
    </div>
  );
};

export default Home; 