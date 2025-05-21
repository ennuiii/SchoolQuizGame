import React, { useState, useCallback } from 'react';
import { Modal, Button, Nav, Tab, ListGroup } from 'react-bootstrap';
import type { GameRecapData, RoundInRecap, PlayerInRecap, SubmissionInRecap, QuestionInRecap } from '../../types/recap'; // Adjusted import path
import QuestionDisplayCard from './QuestionDisplayCard'; // Import the new component
import FabricJsonToSvg from '../shared/FabricJsonToSvg'; // Import the FabricJsonToSvg component
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

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
  const { language } = useLanguage();

  if (!show || !recap) return null;

  const handleSelectTab = (k: string | null) => {
    if (k) {
      if (isControllable && onTabChange) {
        onTabChange(k);
      }
    }
  };
  
  // Determine the winner for display
  const winner = recap.players.find(p => p.isWinner);

  // Filter out players who were only ever spectators and didn't actively participate or get eliminated
  const participatingPlayers = recap.players.filter(player => 
    player.isWinner || // Always show the winner
    (player.isActive && player.finalLives > 0) || // Show active players with lives
    (!player.isActive && player.finalLives === 0 && !player.joinedAsSpectator) // Show eliminated players who didn't join as spectators initially
  );

  return (
    <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}> {/* Added tabIndex and background */}
      <div className="modal-dialog modal-xl"> {/* Changed to modal-xl for more space */}
        <div className="modal-content">
          <Modal.Header closeButton onHide={onHide}> {/* Used Modal.Header for consistency */}
            <Modal.Title>{t('gameRecap', language)} - {t('room', language)} {recap.roomCode}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Tab.Container id="recap-tabs" activeKey={activeTabKey} onSelect={isControllable ? handleSelectTab : undefined}>
              <Nav variant="tabs" className="mb-3">
                <Nav.Item>
                  <Nav.Link eventKey="overallResults" disabled={!isControllable && activeTabKey !== 'overallResults'}>
                    {t('overallResults', language)}
                  </Nav.Link>
                </Nav.Item>
                {recap.rounds && recap.rounds.length > 0 && (
                  <Nav.Item>
                    <Nav.Link eventKey="roundDetails" disabled={!isControllable && activeTabKey !== 'roundDetails'}>
                      {t('roundDetails', language)}
                    </Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
              <Tab.Content>
                <Tab.Pane eventKey="overallResults">
                  <h4>{t('gameSummary', language)}</h4>
                  {winner && (
                    <div className="alert alert-success">
                      <h5><span role="img" aria-label="trophy">🏆</span> {t('winner', language)}: {winner.name} <span role="img" aria-label="trophy">🏆</span></h5>
                      <p>{t('congratulations', language).replace('{name}', winner.name)}</p>
                    </div>
                  )}
                  {!winner && recap.players.filter(p => p.isActive && p.finalLives > 0).length > 1 && (
                     <div className="alert alert-info">
                       <h5>{t('gameConcluded', language)}</h5>
                       <p>{t('multiplePlayersActive', language)}</p>
                     </div>
                  )}
                   {!winner && recap.players.filter(p => p.isActive && p.finalLives > 0).length === 0 && (
                     <div className="alert alert-warning">
                       <h5>{t('gameOver', language)}</h5>
                       <p>{t('allPlayersEliminated', language)}</p>
                     </div>
                   )}
                  <h5>{t('playerStandings', language)}:</h5>
                  <ListGroup>
                    {participatingPlayers.map((player, index) => (
                      <ListGroup.Item key={player.id} variant={player.isWinner ? 'success' : player.isActive && player.finalLives > 0 ? 'light' : player.finalLives === 0 ? 'danger' : 'secondary'}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>{index + 1}. {player.name}</strong>
                            {player.isWinner && <span className="badge bg-warning ms-2">{t('winner', language)}</span>}
                          </div>
                          <div>
                            <span>{t('lives', language)}: {player.finalLives}</span>
                            <span className="ms-3">
                              {t('status', language)}: 
                              {player.isWinner ? ` ${t('won', language)}` : 
                               player.isActive && player.finalLives > 0 ? ` ${t('active', language)}` :
                               !player.isActive && player.isSpectator && player.finalLives === 0 ? ` ${t('eliminated', language)}` :
                               player.isSpectator ? ` ${t('spectator', language)}` : ` ${t('unknown', language)}`}
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
              {t('close', language)}
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
  const { language } = useLanguage();

  if (!show || !svgData) return null;

  return (
    <div className="modal show enlarged-drawing-modal-backdrop" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="enlargedDrawingModalTitle">
      <div className="modal-dialog modal-xl enlarged-drawing-modal-dialog">
        <div className="modal-content enlarged-drawing-modal-content">
          <Modal.Header closeButton onHide={onHide} className="enlarged-drawing-modal-header">
            <Modal.Title id="enlargedDrawingModalTitle">{t('drawingBy', language)}: {playerName}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="enlarged-drawing-modal-body">
            <div className="drawing-board-container" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
              <div className="classroom-whiteboard-svg" style={{ aspectRatio: '2/1', maxHeight: '400px' }}>
                <FabricJsonToSvg 
                  jsonData={svgData}
                  className="scaled-svg-preview" 
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="enlarged-drawing-modal-footer">
            <Button variant="secondary" onClick={onHide} className="btn-schoolquiz-default">
              {t('close', language)}
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
  const { language } = useLanguage();
  const [enlargedDrawing, setEnlargedDrawing] = useState<{ svg: string; playerName: string } | null>(null);

  console.log(`[RecapModal] RoundDetailsContent rendering. Selected Round Index: ${currentSelectedRoundIndex}`); // Added log

  if (!recap.rounds || recap.rounds.length === 0 || !recap.rounds[currentSelectedRoundIndex]) {
    console.warn("[RecapModal] RoundDetailsContent: No round data or invalid round index."); // Added log
    return <p>{t('noRoundData', language)}</p>;
  }
  
  const currentRoundData: RoundInRecap = recap.rounds[currentSelectedRoundIndex];

  const getPlayerDetails = useCallback((persistentId: string) => {
    return recap.players.find(p => p.persistentPlayerId === persistentId);
  }, [recap.players]);

  // Filter submissions to exclude those from players who were only ever spectators
  const filteredSubmissions = currentRoundData.submissions.filter(submission => {
    const playerDetail = getPlayerDetails(submission.persistentPlayerId);
    // Show submission if player detail exists and they didn't join as a pure spectator,
    // or if player detail couldn't be found (fallback to show, though unlikely).
    return playerDetail ? !playerDetail.joinedAsSpectator : true;
  });

  console.log(`[RecapModal] Round ${currentRoundData.roundNumber}: Filtered Submissions Count: ${filteredSubmissions.length}`, filteredSubmissions); // Added log

  const handleEnlargeDrawing = (svgData: string, playerName: string) => {
    setEnlargedDrawing({ svg: svgData, playerName });
  };

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
              disabled={!isControllable}
            >
              {t('round', language)} {round.roundNumber}
            </button>
          ))}
        </div>
      </div>
      <div className="col-md-9">
        <div className="p-3">
          <h4>{t('round', language)} {currentRoundData.roundNumber}</h4>
          <QuestionDisplayCard question={currentRoundData.question} showAnswer={true} title={t('questionDetails', language)} />
          <h5>{t('submissions', language)}</h5>
          <div className="list-group">
            {filteredSubmissions.map((submission: SubmissionInRecap, idx: number) => { // Use filteredSubmissions
              const playerDetails = getPlayerDetails(submission.persistentPlayerId);
              const playerLives = playerDetails?.finalLives ?? 0;
              const playerName = submission.playerName || playerDetails?.name || 'Unknown Player';

              // Logging for drawing data
              if (submission.hasDrawing) {
                if (submission.drawingData && submission.drawingData.length > 0) {
                  console.log(`[RecapModal] Player: ${playerName}, Round: ${currentRoundData.roundNumber}, Submission hasDrawing=true. DrawingData (first 100 chars):`, submission.drawingData.substring(0,100));
                } else {
                  console.warn(`[RecapModal] Player: ${playerName}, Round: ${currentRoundData.roundNumber}, Submission hasDrawing=true, BUT drawingData is NULL or EMPTY.`);
                }
              }

              return (
                <div 
                  key={submission.persistentPlayerId || idx}
                  className="classroom-whiteboard-card list-group-item mb-3"
                  style={{ borderColor: '#ccc', minWidth: 300, maxWidth: 420, minHeight: 260 }}
                >
                  <div className="classroom-whiteboard-content p-2">
                    <div style={{
                      marginBottom: 8, 
                      textAlign: 'left',
                      width: '100%',
                      paddingLeft: '5px'
                    }}>
                      {[...Array(playerLives)].map((_, i) => (
                        <span key={i} className="animated-heart" style={{ color: '#ff6b6b', fontSize: '1.3rem', marginRight: 3 }}>❤</span>
                      ))}
                      {playerDetails && playerDetails.finalLives === 0 && !playerDetails.isWinner && <span style={{color: '#888', fontSize: '0.9rem' }}>(Eliminated)</span>}
                    </div>
                    
                    {submission.hasDrawing && submission.drawingData && (
                      <div 
                        className="classroom-whiteboard-svg" 
                        onClick={() => handleEnlargeDrawing(submission.drawingData!, playerName)}
                        style={{ cursor: 'pointer', marginBottom: '10px' }}
                      >
                        <FabricJsonToSvg 
                          jsonData={submission.drawingData}
                          className="scaled-svg-preview" 
                        />
                      </div>
                    )}
                    
                    {submission.answer !== undefined && (
                      <div className="notepad-answer mt-2 mb-2">
                        <span className="notepad-label">
                          <i className="bi bi-card-text me-1"></i>Answer:
                        </span>
                        <span className="notepad-text ms-2">
                          {submission.hasDrawing && !submission.answer && submission.drawingData ? "(Drawing Only)" : (submission.answer || "-")}
                        </span>
                      </div>
                    )}
                     {!submission.answer && !submission.hasDrawing && (
                         <div className="mt-1 fst-italic text-muted mb-2"><small>No answer or drawing submitted.</small></div>
                      )}

                    {submission.isCorrect !== null && (
                      <div className="d-flex justify-content-center">
                        <span 
                          className={`classroom-whiteboard-badge ${submission.isCorrect ? 'correct' : 'incorrect'}`}
                          style={{ 
                            animation: 'fadeInScale 0.3s ease-out',
                            marginTop: '10px'
                          }}
                        >
                          {submission.isCorrect ? 
                            <><i className="bi bi-patch-check-fill me-1"></i>Correct</> : 
                            <><i className="bi bi-patch-exclamation-fill me-1"></i>Incorrect</>
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="classroom-whiteboard-label" style={{ background: '#f0f0f0', borderTop: '1px solid #ddd' }}>
                    <span className="classroom-whiteboard-name"><i className="bi bi-person-fill me-2"></i>{playerName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {enlargedDrawing && (
        <EnlargedDrawingModal
          show={!!enlargedDrawing}
          onHide={() => setEnlargedDrawing(null)}
          svgData={enlargedDrawing.svg}
          playerName={enlargedDrawing.playerName}
        />
      )}
    </div>
  );
};

export default RecapModal; 