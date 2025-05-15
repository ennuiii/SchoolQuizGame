import React, { useState } from 'react';
import { Modal, Button, Nav } from 'react-bootstrap';
import type { GameRecapData, RoundInRecap, PlayerInRecap, SubmissionInRecap, QuestionInRecap } from '../../types/recap'; // Adjusted import path
import QuestionDisplayCard from './QuestionDisplayCard'; // Import the new component

// Removed local interface definitions for Player, Submission, Round, GameRecap

interface RecapModalProps {
  show: boolean;
  onHide: () => void;
  recap: GameRecapData | null; // Updated type
}

const RecapModal: React.FC<RecapModalProps> = ({ show, onHide, recap }) => {
  const [selectedRound, setSelectedRound] = useState(0);

  if (!show || !recap) return null;

  // Ensure rounds exist and selectedRound is valid
  if (!recap.rounds || recap.rounds.length === 0 || !recap.rounds[selectedRound]) {
    // Optionally, handle this case, e.g., show a message or select first available round
    return (
      <div className="modal show" style={{ display: 'block' }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Game Recap - Room {recap.roomCode}</h5>
              <button type="button" className="btn-close" onClick={onHide}></button>
            </div>
            <div className="modal-body">
              <p>No round data available to display.</p>
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
  }

  const currentRound: RoundInRecap = recap.rounds[selectedRound];
  // const currentQuestion: QuestionInRecap = currentRound.question; // If needed directly

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
                  {recap.rounds.map((round: RoundInRecap, index: number) => (
                    <button
                      key={round.roundNumber}
                      className={`list-group-item list-group-item-action ${selectedRound === index ? 'active' : ''}`}
                      onClick={() => setSelectedRound(index)}
                    >
                      Round {round.roundNumber}
                      {/* TODO: Add correctAnswers/totalAnswers to RoundInRecap type and server data */}
                      {/* <div className="small">
                        {round.correctAnswers} / {round.totalAnswers} correct
                      </div> */}
                    </button>
                  ))}
                </div>
              </div>
              {/* Right side with round details */}
              <div className="col-md-9">
                <div className="p-3">
                  <h4>Round {currentRound.roundNumber}</h4>
                  <QuestionDisplayCard question={currentRound.question} showAnswer={true} title="Question Details" />
                  <h5>Submissions</h5>
                  <div className="list-group">
                    {currentRound.submissions.map((submission: SubmissionInRecap) => (
                      <div
                        key={submission.playerId}
                        className={`list-group-item ${submission.isCorrect === true ? 'list-group-item-success' : submission.isCorrect === false ? 'list-group-item-danger' : ''}`}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div style={{ flexGrow: 1 }}> {/* Allow this div to take available space */}
                            <strong>
                              {submission.playerName}
                            </strong>
                            {submission.answer && (
                              <div className="mt-1">
                                <small className="text-muted">Submitted: </small>{submission.answer}
                              </div>
                            )}
                            {!submission.answer && !submission.hasDrawing && (
                               <div className="mt-1 fst-italic text-muted">
                                 <small>No text answer submitted.</small>
                               </div>
                            )}
                            {currentRound.question.answer && (
                              <div className="mt-1">
                                <small className="text-primary">Correct: </small>{currentRound.question.answer}
                              </div>
                            )}
                            {submission.hasDrawing && submission.drawingData && (
                              <div className="mt-2">
                                <small className="text-muted d-block mb-1">Submitted Drawing:</small>
                                <div className="recap-drawing-preview" style={{ width: '200px', height: '150px', border: '1px solid #ccc', overflow: 'hidden' }}>
                                  <div dangerouslySetInnerHTML={{ __html: submission.drawingData }} />
                                </div>
                              </div>
                            )}
                          </div>
                          {submission.isCorrect !== null && (
                            <span className={`badge fs-6 ms-3 ${submission.isCorrect ? 'bg-success' : 'bg-danger'}`}>
                              {submission.isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          )}
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