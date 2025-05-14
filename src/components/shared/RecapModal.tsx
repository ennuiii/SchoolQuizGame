import React, { useState } from 'react';
import { Modal, Button, Nav } from 'react-bootstrap';

interface Player {
  id: string;
  name: string;
  finalLives: number;
  isSpectator: boolean;
  isWinner: boolean;
}

interface Submission {
  playerId: string;
  playerName: string;
  answer: string | null;
  drawingData: string | null;
  isCorrect: boolean | null;
  livesAfterRound: number | null;
}

interface Round {
  roundNumber: number;
  question: {
    text: string;
    answer: string;
    grade: string;
    subject: string;
  };
  correctAnswers: number;
  totalAnswers: number;
  submissions: Array<{
    playerId: string;
    answer: string;
    isCorrect: boolean;
  }>;
}

interface GameRecap {
  roomCode: string;
  startTime: Date;
  endTime: Date;
  players: Array<{
    id: string;
    name: string;
    score: number;
    finalLives: number;
    isSpectator: boolean;
    isWinner: boolean;
  }>;
  rounds: Round[];
  correctAnswers: number;
  totalQuestions: number;
  score: number;
}

interface RecapModalProps {
  show: boolean;
  onHide: () => void;
  recap: GameRecap | null;
}

const RecapModal: React.FC<RecapModalProps> = ({ show, onHide, recap }) => {
  const [selectedRound, setSelectedRound] = useState(0);

  if (!show || !recap) return null;

  const currentRound = recap.rounds[selectedRound];

  return (
    <div className="modal show" style={{ display: 'block' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Game Recap - Room {recap.roomCode}</h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          <div className="modal-body">
            <div className="row g-0">
              {/* Left sidebar with round navigation */}
              <div className="col-md-3 border-end">
                <div className="list-group list-group-flush">
                  {recap.rounds.map((round, index) => (
                    <button
                      key={round.roundNumber}
                      className={`list-group-item list-group-item-action ${selectedRound === index ? 'active' : ''}`}
                      onClick={() => setSelectedRound(index)}
                    >
                      Round {round.roundNumber}
                      <div className="small">
                        {round.correctAnswers} / {round.totalAnswers} correct
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Right side with round details */}
              <div className="col-md-9">
                <div className="p-3">
                  <h4>Round {currentRound.roundNumber}</h4>
                  <div className="card mb-3">
                    <div className="card-body">
                      <h5>Question</h5>
                      <p className="lead">{currentRound.question.text}</p>
                      <div className="text-muted">
                        <small>
                          Answer: {currentRound.question.answer}
                          <br />
                          Grade: {currentRound.question.grade}
                          <br />
                          Subject: {currentRound.question.subject}
                        </small>
                      </div>
                    </div>
                  </div>
                  <h5>Submissions</h5>
                  <div className="list-group">
                    {currentRound.submissions.map(submission => (
                      <div
                        key={submission.playerId}
                        className={`list-group-item ${submission.isCorrect ? 'list-group-item-success' : 'list-group-item-danger'}`}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>
                              {recap.players.find(p => p.id === submission.playerId)?.name}
                            </strong>
                            <div>{submission.answer}</div>
                          </div>
                          <span className={`badge ${submission.isCorrect ? 'bg-success' : 'bg-danger'}`}>
                            {submission.isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onHide}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecapModal; 