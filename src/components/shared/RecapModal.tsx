import React, { useState } from 'react';
import { Modal, Button, Nav, Tab, ListGroup } from 'react-bootstrap';
import type { GameRecapData, RoundInRecap, PlayerInRecap, SubmissionInRecap, QuestionInRecap } from '../../types/recap'; // Adjusted import path
import QuestionDisplayCard from './QuestionDisplayCard'; // Import the new component

// Removed local interface definitions for Player, Submission, Round, GameRecap

interface RecapModalProps {
  show: boolean;
  onHide: () => void;
  recap: GameRecapData | null;
  // Props for synchronized round navigation
  selectedRoundIndex?: number; // Current selected round from context/parent
  onRoundChange?: (index: number) => void; // Callback to notify parent (GM) of round change selection
  isControllable?: boolean; // True if this modal instance can control navigation (i.e., GM's view)
  // Props for synchronized tab navigation
  activeTabKey?: string; // Current active tab key from context/parent
  onTabChange?: (tabKey: string) => void; // Callback to notify parent (GM) of tab change
}

const RecapModal: React.FC<RecapModalProps> = ({ 
  show, 
  onHide, 
  recap, 
  selectedRoundIndex = 0, // Default to 0 if not provided
  onRoundChange, 
  isControllable = false, 
  activeTabKey = 'overallResults', // Default to 'overallResults' if not provided
  onTabChange
}) => {
  // const [activeTab, setActiveTab] = useState<string>('overallResults'); // Remove local state

  if (!show || !recap) return null;

  const handleSelectTab = (k: string | null) => {
    if (k) {
      // setActiveTab(k); // Remove local state update
      if (isControllable && onTabChange) {
        onTabChange(k);
      }
    }
  };
  
  // Determine the winner for display
  const winner = recap.players.find(p => p.isWinner);

  return (
    <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}> {/* Added tabIndex and background */}
      <div className="modal-dialog modal-xl"> {/* Changed to modal-xl for more space */}
        <div className="modal-content">
          <Modal.Header closeButton onHide={onHide}> {/* Used Modal.Header for consistency */}
            <Modal.Title>Game Recap - Room {recap.roomCode}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Tab.Container id="recap-tabs" activeKey={activeTabKey} onSelect={isControllable ? handleSelectTab : undefined}>
              <Nav variant="tabs" className="mb-3">
                <Nav.Item>
                  <Nav.Link eventKey="overallResults" disabled={!isControllable && activeTabKey !== 'overallResults'}>
                    Overall Results
                  </Nav.Link>
                </Nav.Item>
                {recap.rounds && recap.rounds.length > 0 && (
                  <Nav.Item>
                    <Nav.Link eventKey="roundDetails" disabled={!isControllable && activeTabKey !== 'roundDetails'}>
                      Round Details
                    </Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
              <Tab.Content>
                <Tab.Pane eventKey="overallResults">
                  <h4>Game Summary</h4>
                  {winner && (
                    <div className="alert alert-success">
                      <h5><span role="img" aria-label="trophy">🏆</span> Winner: {winner.name} <span role="img" aria-label="trophy">🏆</span></h5>
                      <p>Congratulations to {winner.name} for winning the game!</p>
                    </div>
                  )}
                  {!winner && recap.players.filter(p => p.isActive && p.finalLives > 0).length > 1 && (
                     <div className="alert alert-info">
                       <h5>Game Concluded</h5>
                       <p>The game ended with multiple players still active.</p>
                     </div>
                  )}
                   {!winner && recap.players.filter(p => p.isActive && p.finalLives > 0).length === 0 && (
                     <div className="alert alert-warning">
                       <h5>Game Over</h5>
                       <p>All players were eliminated.</p>
                     </div>
                   )}
                  <h5>Player Standings:</h5>
                  <ListGroup>
                    {recap.players.map((player, index) => (
                      <ListGroup.Item key={player.id} variant={player.isWinner ? 'success' : player.isActive && player.finalLives > 0 ? 'light' : player.finalLives === 0 ? 'danger' : 'secondary'}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>{index + 1}. {player.name}</strong>
                            {player.isWinner && <span className="badge bg-warning ms-2">Winner</span>}
                          </div>
                          <div>
                            <span>Lives: {player.finalLives}</span>
                            <span className="ms-3">
                              Status: 
                              {player.isWinner ? " Won" : 
                               player.isActive && player.finalLives > 0 ? " Active" :
                               !player.isActive && player.isSpectator && player.finalLives === 0 ? " Eliminated" :
                               player.isSpectator ? " Spectator" : " Unknown"}
                            </span>
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Tab.Pane>
                {recap.rounds && recap.rounds.length > 0 && (
                  <Tab.Pane eventKey="roundDetails">
                    <RoundDetailsContent 
                      recap={recap} 
                      currentSelectedRoundIndex={selectedRoundIndex} // Pass the synchronized index
                      onSelectRound={onRoundChange} // Pass the callback
                      isControllable={isControllable} // Pass controllability
                    />
                  </Tab.Pane>
                )}
              </Tab.Content>
            </Tab.Container>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={onHide}>
              Close
            </Button>
          </Modal.Footer>
        </div>
      </div>
    </div>
  );
};

interface RoundDetailsContentProps {
  recap: GameRecapData;
  currentSelectedRoundIndex: number;
  onSelectRound?: (index: number) => void;
  isControllable: boolean;
}

// Define EnlargedDrawingModal here as it's closely tied to RecapModal's functionality
const EnlargedDrawingModal: React.FC<{
  show: boolean;
  onHide: () => void;
  svgData: string | null;
  playerName: string;
}> = ({ show, onHide, svgData, playerName }) => {
  if (!show || !svgData) return null;

  return (
    <div className="modal show enlarged-drawing-modal-backdrop" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="enlargedDrawingModalTitle">
      <div className="modal-dialog modal-xl enlarged-drawing-modal-dialog">
        <div className="modal-content enlarged-drawing-modal-content">
          <Modal.Header closeButton onHide={onHide} className="enlarged-drawing-modal-header">
            <Modal.Title id="enlargedDrawingModalTitle">Drawing by: {playerName}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="enlarged-drawing-modal-body">
            <div
              className="enlarged-drawing-svg-container"
              dangerouslySetInnerHTML={{ __html: svgData }}
            />
          </Modal.Body>
          <Modal.Footer className="enlarged-drawing-modal-footer">
            <Button variant="secondary" onClick={onHide} className="btn-schoolquiz-default">
              Close
            </Button>
          </Modal.Footer>
        </div>
      </div>
    </div>
  );
};

const RoundDetailsContent: React.FC<RoundDetailsContentProps> = ({ 
  recap, 
  currentSelectedRoundIndex, 
  onSelectRound, 
  isControllable 
}) => {
  const [enlargedDrawing, setEnlargedDrawing] = useState<{ svg: string; playerName: string } | null>(null);

  if (!recap.rounds || recap.rounds.length === 0 || !recap.rounds[currentSelectedRoundIndex]) {
    return <p>No round data available to display or selected round is invalid.</p>;
  }
  
  const currentRoundData: RoundInRecap = recap.rounds[currentSelectedRoundIndex];

  return (
    <div className="row g-0">
      <div className="col-md-3 border-end">
        <div className="list-group list-group-flush">
          {recap.rounds.map((round: RoundInRecap, index: number) => (
            <button
              key={round.roundNumber}
              className={`list-group-item list-group-item-action ${currentSelectedRoundIndex === index ? 'active' : ''}`}
              onClick={() => {
                if (isControllable && onSelectRound) {
                  onSelectRound(index);
                }
              }}
              disabled={!isControllable} // Disable if not controllable
            >
              Round {round.roundNumber}
            </button>
          ))}
        </div>
      </div>
      <div className="col-md-9">
        <div className="p-3">
          <h4>Round {currentRoundData.roundNumber}</h4>
          <QuestionDisplayCard question={currentRoundData.question} showAnswer={true} title="Question Details" />
          <h5>Submissions</h5>
          <div className="list-group">
            {currentRoundData.submissions.map((submission: SubmissionInRecap) => {
              // Log submission data just before rendering
              if (submission.hasDrawing) {
                console.log(`[RecapModal DEBUG] Player ${submission.playerName}: Rendering submission. HasDrawing: ${submission.hasDrawing}, DrawingData Length: ${submission.drawingData?.length}`);
                if (submission.drawingData && submission.drawingData.length < 200) { // Log short SVGs
                    console.log(`[RecapModal DEBUG] Player ${submission.playerName}: DrawingData content (short): ${submission.drawingData}`);
                }
              } else if (submission.answer && !submission.hasDrawing) {
                console.log(`[RecapModal DEBUG] Player ${submission.playerName}: Rendering submission. HasDrawing: false, Answer: "${submission.answer}"`);
              }

              return (
                <div
                  key={submission.playerId}
                  className={`list-group-item ${submission.isCorrect === true ? 'list-group-item-success' : submission.isCorrect === false ? 'list-group-item-danger' : ''}`}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div style={{ flexGrow: 1 }}>
                      <strong>{submission.playerName}</strong>
                      {submission.answer && (
                        <div className="mt-1"><small className="text-muted">Submitted: </small>{submission.answer}</div>
                      )}
                      {!submission.answer && !submission.hasDrawing && (
                         <div className="mt-1 fst-italic text-muted"><small>No text answer submitted.</small></div>
                      )}
                      {submission.hasDrawing && submission.drawingData && (
                        <div className="mt-2">
                          <small className="text-muted d-block mb-1">Submitted Drawing:</small>
                          <div 
                            className="recap-drawing-preview"
                            onClick={() => setEnlargedDrawing({ svg: submission.drawingData!, playerName: submission.playerName })}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setEnlargedDrawing({ svg: submission.drawingData!, playerName: submission.playerName }); }}
                            aria-label={`View drawing by ${submission.playerName}`}
                          >
                            <div className="recap-drawing-preview-inner-html" dangerouslySetInnerHTML={{ __html: submission.drawingData }} />
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
              );
            })}
          </div>
        </div>
      </div>
      <EnlargedDrawingModal
        show={!!enlargedDrawing}
        onHide={() => setEnlargedDrawing(null)}
        svgData={enlargedDrawing?.svg || null}
        playerName={enlargedDrawing?.playerName || ''}
      />
    </div>
  );
};

export default RecapModal; 