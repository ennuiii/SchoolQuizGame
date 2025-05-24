import React, { useState, useCallback } from 'react';
import { Modal, Button, Nav, Tab, ListGroup, Tabs } from 'react-bootstrap';
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

const EnlargedDrawingModal: React.FC<{
  show: boolean;
  onHide: () => void;
  svgData: string | null;
  playerName: string;
}> = ({ show, onHide, svgData, playerName }) => {
  const { language } = useLanguage();

  if (!show || !svgData) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{playerName}'s Drawing</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex justify-content-center">
          <FabricJsonToSvg jsonData={svgData} className="enlarged-svg" />
        </div>
      </Modal.Body>
    </Modal>
  );
};

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
  const [enlargedDrawing, setEnlargedDrawing] = useState<{ svgData: string; playerName: string } | null>(null);

  if (!show || !recap) return null;

  const handleSelectTab = (k: string | null) => {
    if (k && onTabChange) {
      onTabChange(k);
    }
  };
  
  // Determine the winner for display
  const winner = recap.players.find(p => p.isWinner);

  // Check if this is a points mode game
  const isPointsMode = recap.isPointsMode || false;

  // Filter out players who were only ever spectators and didn't actively participate or get eliminated
  const participatingPlayers = recap.players.filter(player => 
    player.isWinner || // Always show the winner
    (player.isActive && (isPointsMode ? true : player.finalLives > 0)) || // Show active players (all in points mode, or with lives in standard mode)
    (!player.isActive && (isPointsMode ? true : player.finalLives === 0) && !player.joinedAsSpectator) // Show eliminated players who didn't join as spectators initially
  );

  const handleEnlargeDrawing = (svgData: string, playerName: string) => {
    setEnlargedDrawing({ svgData, playerName });
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>{t('recapModal.title', language)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          activeKey={activeTabKey}
          onSelect={handleSelectTab}
          className="mb-3"
        >
          <Tab eventKey="overallResults" title={t('recapModal.overallResults', language)}>
            <div className="p-3">
              <h4>{t('recapModal.winners', language)}</h4>
              <div className="list-group mb-4">
                {recap.players
                  .filter(player => player.isWinner)
                  .map((player, index) => (
                    <div key={player.persistentPlayerId} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <span>{player.name}</span>
                        {isPointsMode ? (
                          <span className="badge bg-success">
                            {player.finalScore?.toLocaleString()} {t('points', language)}
                          </span>
                        ) : (
                          <span className="badge bg-success">
                            {player.finalLives} {t('lives', language)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              <h4>{t('recapModal.participants', language)}</h4>
              <div className="list-group">
                {recap.players
                  .filter(player => !player.isWinner)
                  .map((player, index) => (
                    <div key={player.persistentPlayerId} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <span>{player.name}</span>
                        {isPointsMode ? (
                          <span className="badge bg-secondary">
                            {player.finalScore?.toLocaleString()} {t('points', language)}
                          </span>
                        ) : (
                          <span className="badge bg-secondary">
                            {player.finalLives} {t('lives', language)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </Tab>
          <Tab eventKey="roundDetails" title={t('recapModal.roundDetails', language)}>
            <RoundDetailsContent
              recap={recap}
              currentSelectedRoundIndex={selectedRoundIndex}
              onSelectRound={onRoundChange}
              isControllable={isControllable}
              isPointsMode={recap.isPointsMode}
            />
          </Tab>
        </Tabs>
      </Modal.Body>
      {enlargedDrawing && (
        <EnlargedDrawingModal
          show={!!enlargedDrawing}
          onHide={() => setEnlargedDrawing(null)}
          svgData={enlargedDrawing.svgData}
          playerName={enlargedDrawing.playerName}
        />
      )}
    </Modal>
  );
};

interface RoundDetailsContentProps {
  recap: GameRecapData;
  currentSelectedRoundIndex: number;
  onSelectRound?: (index: number) => void;
  isControllable: boolean;
  isPointsMode?: boolean; // Add points mode prop
}

const RoundDetailsContent: React.FC<RoundDetailsContentProps> = ({ 
  recap, 
  currentSelectedRoundIndex, 
  onSelectRound, 
  isControllable,
  isPointsMode = false // Add points mode parameter with default
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
                      {isPointsMode ? (
                        // Show points info in points mode
                        <div className="d-flex gap-3 align-items-center">
                          {submission.pointsAwarded !== undefined && submission.pointsAwarded > 0 && (
                            <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold' }}>
                              +{submission.pointsAwarded.toLocaleString()} pts
                            </span>
                          )}
                          {playerDetails?.finalScore !== undefined && (
                            <span style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                              {t('total', language)}: {playerDetails.finalScore.toLocaleString()}
                            </span>
                          )}
                          {playerDetails?.finalStreak !== undefined && playerDetails.finalStreak > 0 && (
                            <span style={{ color: '#ffc107', fontSize: '0.9rem' }}>
                              🔥 {playerDetails.finalStreak}
                            </span>
                          )}
                        </div>
                      ) : (
                        // Show lives in standard mode
                        <>
                          {[...Array(playerLives)].map((_, i) => (
                            <span key={i} className="animated-heart" style={{ color: '#ff6b6b', fontSize: '1.3rem', marginRight: 3 }}>❤</span>
                          ))}
                          {playerDetails && playerDetails.finalLives === 0 && !playerDetails.isWinner && (
                            <span style={{color: '#888', fontSize: '0.9rem' }}>{t('recapModal.eliminated', language)}</span>
                          )}
                        </>
                      )}
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
                          <i className="bi bi-card-text me-1"></i>{t('recapModal.answer', language)}:
                        </span>
                        <span className="notepad-text ms-2">
                          {submission.hasDrawing && !submission.answer && submission.drawingData ? "(Drawing Only)" : (submission.answer || "-")}
                        </span>
                      </div>
                    )}
                     {!submission.answer && !submission.hasDrawing && (
                         <div className="mt-1 fst-italic text-muted mb-2"><small>{t('recapModal.noAnswer', language)}</small></div>
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
                            <><i className="bi bi-patch-check-fill me-1"></i>{t('recapModal.correct', language)}</> : 
                            <><i className="bi bi-patch-exclamation-fill me-1"></i>{t('recapModal.incorrect', language)}</>
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