import React from 'react';
import QuestionManager from './components/QuestionManager';
import './App.css';

function App() {
  return (
    <div className="App">
      <nav className="navbar navbar-dark bg-dark">
        <div className="container">
          <span className="navbar-brand mb-0 h1">School Quiz Game Admin</span>
        </div>
      </nav>
      <QuestionManager />
    </div>
  );
}

export default App; 