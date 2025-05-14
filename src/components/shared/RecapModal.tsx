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
    answer?: string;
    subject: string;
    grade: number;
  };
  submissions: Submission[];
}

interface GameRecap {
  roomCode: string;
  startTime: Date;
  endTime: Date;
  players: Player[];
  rounds: Round[];
}

interface RecapModalProps {
  show: boolean;
  onHide: () => void;
  recap: GameRecap | null;
}

const RecapModal: React.FC<RecapModalProps> = ({ show, onHide, recap }) => {
  const [selectedRound, setSelectedRound] = useState(0);

  if (!recap) return null;

  const currentRound = recap.rounds[selectedRound];

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>Game Recap - Room {recap.roomCode}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        <div className="row g-0">
          {/* Left sidebar with round navigation */}
          <div className="col-md-3 border-end">
            <div className="p-3 bg-light">
              <h5>Rounds</h5>
              <Nav className="flex-column">
                {recap.rounds.map((round, index) => (
                  <Nav.Link
                    key={round.roundNumber}
                    className={`rounded ${selectedRound === index ? 'bg-primary text-white' : ''}`}
                    onClick={() => setSelectedRound(index)}
                  >
                    Round {round.roundNumber}
                  </Nav.Link>
                ))}
              </Nav>
            </div>
            
            {/* Player summary */}
            <div className="p-3">
              <h5>Players</h5>
              <div className="list-group">
                {recap.players.map(player => (
                  <div key={player.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        {player.name}
                        {player.isWinner && (
                          <span className="ms-2 badge bg-success">Winner!</span>
                        )}
                      </div>
                      <div>
                        {Array.from({ length: player.finalLives }, (_, i) => (
                          <span key={i} className="text-danger me-1">❤</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="col-md-9">
            <div className="p-4">
              {currentRound && (
                <>
                  <div className="mb-4">
                    <h4>Question {currentRound.roundNumber}</h4>
                    <div className="card mb-3">
                      <div className="card-body">
                        <h5>{currentRound.question.text}</h5>
                        {currentRound.question.answer && (
                          <p className="text-muted mb-0">
                            <strong>Answer:</strong> {currentRound.question.answer}
                          </p>
                        )}
                        <div className="mt-2">
                          <span className="badge bg-info me-2">
                            Grade {currentRound.question.grade}
                          </span>
                          <span className="badge bg-secondary">
                            {currentRound.question.subject}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="submissions">
                    <h5>Submissions</h5>
                    <div className="row g-3">
                      {currentRound.submissions.map((submission, index) => (
                        <div key={`${submission.playerId}-${index}`} className="col-md-6">
                          <div className={`card ${
                            submission.isCorrect === true ? 'border-success' :
                            submission.isCorrect === false ? 'border-danger' : ''
                          }`}>
                            <div className="card-header d-flex justify-content-between align-items-center">
                              <span>{submission.playerName}</span>
                              {submission.isCorrect !== null && (
                                <span className={`badge ${
                                  submission.isCorrect ? 'bg-success' : 'bg-danger'
                                }`}>
                                  {submission.isCorrect ? 'Correct' : 'Incorrect'}
                                </span>
                              )}
                            </div>
                            <div className="card-body">
                              {submission.answer && (
                                <p className="mb-3">
                                  <strong>Answer:</strong> {submission.answer}
                                </p>
                              )}
                              {submission.drawingData && (
                                <div className="drawing-container border rounded p-2">
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: submission.drawingData
                                    }}
                                    style={{
                                      width: '100%',
                                      height: '200px',
                                      background: 'transparent'
                                    }}
                                  />
                                </div>
                              )}
                              {submission.livesAfterRound !== null && (
                                <div className="mt-2">
                                  <strong>Lives:</strong>{' '}
                                  {Array.from(
                                    { length: submission.livesAfterRound },
                                    (_, i) => (
                                      <span
                                        key={i}
                                        className="text-danger me-1"
                                      >
                                        ❤
                                      </span>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RecapModal; 