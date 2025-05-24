// Copy of PreviewOverlay for alternate design testing
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGame } from '../../contexts/GameContext';
import type { Player } from '../../types/game';
import { useCanvas } from '../../contexts/CanvasContext';
import FabricJsonToSvg from '../shared/FabricJsonToSvg';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';
import { fabric } from 'fabric';
import { CHALKBOARD_BACKGROUND_COLOR } from '../../contexts/CanvasContext';
import socketService from '../../services/socketService'; // Import socketService

interface AnswerSubmission {
  persistentPlayerId: string;
  playerName: string;
  answer: string;
  timestamp?: number;
}

interface PreviewModeState {
  isActive: boolean;
  focusedPlayerId: string | null;
}

interface PreviewOverlayProps {
  onFocus: (playerId: string) => void;
  onClose: () => void;
  isGameMaster: boolean;
  onEvaluate?: (playerId: string, isCorrect: boolean) => void;
  isCommunityVotingMode?: boolean;
  onVote?: (answerPersistentPlayerId: string, vote: 'correct' | 'incorrect') => void;
  onShowAnswer?: () => void;
  onForceEndVoting?: () => void;
}

const boardColors = [
  '#1976d2', // blue
  '#d32f2f', // red
  '#fbc02d', // yellow
  '#388e3c', // green
  '#7b1fa2', // purple
  '#f57c00', // orange
  '#0288d1', // cyan
  '#c2185b', // pink
  '#455a64', // gray
];

const tapeColors = [
  '#ffe066', '#ffd6e0', '#b5ead7', '#c7ceea', '#ffdac1', '#e2f0cb', '#f6dfeb', '#f7cac9', '#b5ead7', '#c9c9ff', '#f3ffe3', '#f7d6e0'
];

function getRandomTapeColor(idx: number) {
  // Deterministic per board idx for SSR/CSR consistency
  return tapeColors[idx % tapeColors.length];
}

const PreviewOverlayV2: React.FC<PreviewOverlayProps> = ({
  onFocus,
  onClose,
  isGameMaster,
  onEvaluate,
  isCommunityVotingMode = false,
  onVote,
  onShowAnswer,
  onForceEndVoting
}) => {
  const context = useGame();
  const { setDrawingEnabled } = useCanvas();
  const { language } = useLanguage();
  const [boardSvgs, setBoardSvgs] = useState<Record<string, string>>({});
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [showCorrectionConfirm, setShowCorrectionConfirm] = useState(false);
  const [pendingCorrection, setPendingCorrection] = useState<{ playerId: string, newStatus: boolean } | null>(null);
  const [localCommunityVotes, setLocalCommunityVotes] = useState<Record<string, { correct: number, incorrect: number }>>({});
  const [localMyVotes, setLocalMyVotes] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const myPersistentId = socketService.getPersistentPlayerId();
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  // Define correction functions first
  const handleCorrection = useCallback((playerId: string, currentStatus: boolean) => {
    console.log('[DEBUG] handleCorrection called with:', { playerId, currentStatus });
    // Find the player in the context
    const player = context.players.find(p => p.persistentPlayerId === playerId);
    if (!player) {
      console.error('[DEBUG] Player not found for correction:', playerId);
      return;
    }
    console.log('[DEBUG] Found player for correction:', player);
    console.log('[DEBUG] Setting pendingCorrection and showCorrectionConfirm');
    setPendingCorrection({ playerId: player.persistentPlayerId, newStatus: !currentStatus });
    setShowCorrectionConfirm(true);
    console.log('[DEBUG] State after setting:', { showCorrectionConfirm: true, pendingCorrection: { playerId: player.persistentPlayerId, newStatus: !currentStatus } });
  }, [context.players]);

  const confirmCorrection = useCallback(() => {
    console.log('[DEBUG] confirmCorrection called with pendingCorrection:', pendingCorrection);
    if (pendingCorrection) {
      console.log('[DEBUG] Confirming correction', pendingCorrection);
      if (onEvaluate) {
        console.log('[DEBUG] Calling onEvaluate with:', pendingCorrection.playerId, pendingCorrection.newStatus);
        onEvaluate(pendingCorrection.playerId, pendingCorrection.newStatus);
      } else {
        console.warn('[DEBUG] onEvaluate is undefined when confirming correction');
        const win = window as any;
        if (win && win.toast) {
          win.toast.error('Correction failed: onEvaluate is not defined.');
        } else if (win && win.ReactToastify && win.ReactToastify.toast) {
          win.ReactToastify.toast.error('Correction failed: onEvaluate is not defined.');
        } else {
          alert('Correction failed: onEvaluate is not defined.');
        }
      }
    } else {
      console.warn('[DEBUG] confirmCorrection called but pendingCorrection is null');
    }
    setShowCorrectionConfirm(false);
    setPendingCorrection(null);
  }, [pendingCorrection, onEvaluate]);

  const cancelCorrection = useCallback(() => {
    console.log('[DEBUG] cancelCorrection called');
    setShowCorrectionConfirm(false);
    setPendingCorrection(null);
  }, []);

  const renderEvaluationBadge = useCallback((evaluation: boolean | null, playerId: string) => {
    if (evaluation === null) return null;
    
    // Find the player in the context to ensure we have the correct ID
    const player = context.players.find(p => p.persistentPlayerId === playerId);
    if (!player) {
      console.error('[DEBUG] Player not found for evaluation badge:', playerId);
      return null;
    }

    // Get the answer data for points information
    const answerData = context.allAnswersThisRound[playerId];
    const isPointsMode = context.isPointsMode || false;
    
    return (
      <div className="d-flex flex-column align-items-center justify-content-center gap-2">
        <div className="d-flex align-items-center justify-content-center gap-2">
          <span 
            className={`classroom-whiteboard-badge ${evaluation ? 'correct' : 'incorrect'}`}
            style={{ animation: 'fadeInScale 0.3s ease-out' }}
          >
            {evaluation ? 
              <><i className="bi bi-patch-check-fill me-1"></i>{t('correct', language)}</> : 
              <><i className="bi bi-patch-exclamation-fill me-1"></i>{t('incorrect', language)}</>
            }
          </span>
          {isGameMaster && !isCommunityVotingMode && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                console.log('[DEBUG] Correction button clicked for player:', player.name, 'with ID:', player.persistentPlayerId, 'current evaluation:', evaluation);
                handleCorrection(player.persistentPlayerId, evaluation);
              }}
              title={t('previewOverlay.correctAnswer', language)}
            >
              <i className="bi bi-pencil-fill"></i>
            </button>
          )}
        </div>
        
        {/* Show points information in points mode */}
        {isPointsMode && answerData && answerData.pointsAwarded !== undefined && (
          <div className="d-flex flex-column align-items-center gap-1 mt-2">
            <div className="badge bg-info text-white">
              <i className="bi bi-star-fill me-1"></i>
              {answerData.pointsAwarded > 0 ? `+${answerData.pointsAwarded.toLocaleString()}` : '0'} {t('points', language)}
            </div>
            {answerData.pointsBreakdown && answerData.pointsAwarded > 0 && (
              <div className="text-center" style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                {answerData.pointsBreakdown.base > 0 && <span className="me-2">Base: {answerData.pointsBreakdown.base}</span>}
                {answerData.pointsBreakdown.time > 0 && <span className="me-2">Time: {answerData.pointsBreakdown.time}</span>}
                {answerData.pointsBreakdown.position > 0 && <span className="me-2">Position: {answerData.pointsBreakdown.position}</span>}
                {answerData.pointsBreakdown.streakMultiplier > 1 && <span>×{answerData.pointsBreakdown.streakMultiplier}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [isGameMaster, isCommunityVotingMode, handleCorrection, language, context.players, context.allAnswersThisRound, context.isPointsMode]);

  const generateSvg = useCallback(async (jsonData: string, answerPersistentPlayerId: string) => {
    if (!fabricCanvasRef.current) {
      const tempCanvasEl = document.createElement('canvas');
      fabricCanvasRef.current = new fabric.Canvas(tempCanvasEl);
    }
    const canvas = fabricCanvasRef.current;
    const bgColor = CHALKBOARD_BACKGROUND_COLOR;
    canvas.backgroundColor = bgColor;
    canvas.renderAll();

    try {
      await new Promise<void>((resolve, reject) => {
        canvas.loadFromJSON(jsonData, () => {
          canvas.renderAll();
          // Store the original JSON data instead of converting to SVG
          setBoardSvgs(prev => ({ ...prev, [answerPersistentPlayerId]: jsonData }));
          resolve();
        });
      });
    } catch (error) {
      console.error('Error loading board data to generate SVG:', error);
    }
  }, [setBoardSvgs]);

  useEffect(() => {
    const answersToProcess = Object.entries(context.allAnswersThisRound || {});
    if (answersToProcess.length > 0) {
      answersToProcess.forEach(([persistentPlayerId, answerData]) => {
        if (answerData && answerData.drawingData && !boardSvgs[persistentPlayerId]) { 
           generateSvg(answerData.drawingData, persistentPlayerId);
        }
      });
    }
  }, [context.allAnswersThisRound, generateSvg, boardSvgs]);

  // Effect to derive localMyVotes from context.currentVotes
  useEffect(() => {
    if (context.currentVotes && myPersistentId) {
      const newMyVotes: Record<string, 'correct' | 'incorrect'> = {};
      for (const answerId in context.currentVotes) {
        if (context.currentVotes[answerId]?.[myPersistentId]) {
          newMyVotes[answerId] = context.currentVotes[answerId][myPersistentId];
        }
      }
      setLocalMyVotes(newMyVotes);
    } else {
      setLocalMyVotes({});
    }
  }, [context.currentVotes, myPersistentId]);

  // Derive localCommunityVotes (tallied counts) from context.currentVotes
  useEffect(() => {
    if (context.currentVotes) {
      const newCommunityVoteCounts: Record<string, { correct: number, incorrect: number }> = {};
      for (const answerId in context.currentVotes) {
        const votesForAnswer = context.currentVotes[answerId];
        const counts = { correct: 0, incorrect: 0 };
        if (votesForAnswer) {
            for (const voterId in votesForAnswer) {
                if (votesForAnswer[voterId] === 'correct') {
                counts.correct++;
                } else if (votesForAnswer[voterId] === 'incorrect') {
                counts.incorrect++;
                }
            }
        }
        newCommunityVoteCounts[answerId] = counts;
      }
      setLocalCommunityVotes(newCommunityVoteCounts);
    } else {
      setLocalCommunityVotes({});
    }
  }, [context.currentVotes]);

  useEffect(() => {
    // Reset revealed answer if preview becomes inactive or question is cleared (e.g., game restart)
    if (!context.previewMode.isActive || !context.currentQuestion) {
      setRevealedAnswer(null);
    }

    const handleCorrectAnswerRevealed = (data: { questionId: string, correctAnswer: string }) => {
      if (context.currentQuestion?.id === data.questionId) {
        setRevealedAnswer(data.correctAnswer);
      }
    };

    const handleAnswerVoted = (data: { answerId: string, voterId: string, vote: 'correct' | 'incorrect', voteCounts: {correct: number, incorrect: number} }) => {
      console.log('[PreviewOverlayV2] Received answer_voted:', data, 'My PID:', socketService.getPersistentPlayerId());
      setLocalCommunityVotes(prevVotes => ({
        ...prevVotes,
        [data.answerId]: data.voteCounts
      }));
      if (data.voterId === socketService.getPersistentPlayerId()) {
        setLocalMyVotes(prevMyVotes => ({
          ...prevMyVotes,
          [data.answerId]: data.vote
        }));
      }
    };

    socketService.on('correct_answer_revealed', handleCorrectAnswerRevealed);
    socketService.on('answer_voted', handleAnswerVoted);

    return () => {
      socketService.off('correct_answer_revealed', handleCorrectAnswerRevealed);
      socketService.off('answer_voted', handleAnswerVoted);
    };
  }, [context.currentQuestion]);

  // Add new effect to reset voting states when question changes
  useEffect(() => {
    // Clear local voting states when question changes
    setLocalCommunityVotes({});
    setLocalMyVotes({});
    setRevealedAnswer(null);
  }, [context.currentQuestion?.id]); // Dependency on question ID ensures this runs only when question changes

  // Add effect to monitor state changes
  useEffect(() => {
    console.log('[DEBUG] Modal state changed:', { showCorrectionConfirm, pendingCorrection });
  }, [showCorrectionConfirm, pendingCorrection]);

  if (!context.previewMode.isActive) return null;

  const displayablePlayers = context.players.filter(p => p.isActive && !p.isSpectator);

  useEffect(() => {
    setDrawingEnabled(false);
    return () => setDrawingEnabled(true);
  }, [setDrawingEnabled]);

  // Reset revealedAnswer when the currentQuestion changes (e.g. next question or game restart)
  useEffect(() => {
    setRevealedAnswer(null);
  }, [context.currentQuestion]);

  const currentQuestion = context.currentQuestion;
  
  // Handle toggling answer visibility
  const toggleAnswerVisibility = () => {
    if (revealedAnswer && onShowAnswer) {
      setRevealedAnswer(null);
    } else if (onShowAnswer) {
      onShowAnswer();
    }
  };

  // --- Focus Mode Logic ---
  const focusedIdx = context.previewMode.focusedPlayerId
    ? displayablePlayers.findIndex(p => p.persistentPlayerId === context.previewMode.focusedPlayerId)
    : -1;
  const isFocusMode = focusedIdx !== -1;

  // GM controls focus
  const handleFocusPlayer = (idx: number) => {
    if (!isGameMaster) return;
    const player = displayablePlayers[idx];
    if (player) onFocus(player.persistentPlayerId);
  };
  const handleUnfocus = () => {
    if (!isGameMaster) return;
    onFocus('');
  };
  const handleNext = () => {
    if (!isGameMaster) return;
    if (displayablePlayers.length === 0) return;
    const nextIdx = (focusedIdx + 1) % displayablePlayers.length;
    handleFocusPlayer(nextIdx);
  };
  const handlePrev = () => {
    if (!isGameMaster) return;
    if (displayablePlayers.length === 0) return;
    const prevIdx = (focusedIdx - 1 + displayablePlayers.length) % displayablePlayers.length;
    handleFocusPlayer(prevIdx);
  };
  // --- End Focus Mode Logic ---

  // --- Focused View ---
  if (isFocusMode && focusedIdx !== -1) {
    const player = displayablePlayers[focusedIdx];
    const boardSubmission = context.playerBoards.find(b => b.playerId === player.id);
    const actualBoardData = boardSubmission?.boardData;
    const answer = context.allAnswersThisRound[player.persistentPlayerId];
    const evaluation = context.evaluatedAnswers[player.persistentPlayerId];
    const borderColor = boardColors[focusedIdx % boardColors.length];
    const tapeColor = getRandomTapeColor(focusedIdx);
    return (
      <>
        <div className="preview-overlay-v2 classroom-preview-overlay">
          <button className="btn btn-danger classroom-preview-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
          <div className="classroom-chalkboard" style={{ position: 'static', margin: '0 auto', left: 'unset', top: 'unset', width: '100%', maxWidth: 900, marginBottom: 48 }}>
            <div className="classroom-chalkboard-content">
              <div className="classroom-chalkboard-grade">
                {context.currentQuestion ? <><i className="bi bi-easel me-2"></i>{`${context.currentQuestion.grade}. ${t('class', language)} – ${context.currentQuestion.subject}`}</> : ''}
              </div>
              <div className="classroom-chalkboard-question">
                {context.currentQuestion ? <><i className="bi bi-chat-square-quote me-2"></i>{context.currentQuestion.text}</> : t('noQuestion', language)}
                {isCommunityVotingMode && revealedAnswer && (
                  <div className="mt-2 pt-2 border-top border-light fst-italic">
                    <strong>{t('previewOverlay.correctAnswerWas', language)}:</strong> {revealedAnswer}
                  </div>
                )}
              </div>
              {isCommunityVotingMode && onShowAnswer && (
                <button 
                  className={`btn btn-sm ${revealedAnswer ? 'btn-outline-warning' : 'btn-outline-light'} mt-2`} 
                  onClick={toggleAnswerVisibility}
                  title={revealedAnswer ? t('previewOverlay.hideAnswerTitle', language) || 'Hide the correct answer' : t('previewOverlay.showAnswerTitle', language)}
                >
                  <i className={`bi ${revealedAnswer ? 'bi-eye-slash-fill' : 'bi-eye-fill'} me-1`}></i> 
                  {revealedAnswer ? t('previewOverlay.hideAnswer', language) || 'Hide Answer' : t('previewOverlay.showAnswer', language)}
                </button>
              )}
              {isGameMaster && isCommunityVotingMode && onForceEndVoting && (
                <button 
                  className="btn btn-sm btn-danger ms-2 mt-2" 
                  onClick={onForceEndVoting}
                  title={t('previewOverlay.forceEndVotingTitle', language) || 'End voting and evaluate answers based on current votes'}
                >
                  <i className="bi bi-flag-fill me-1"></i> 
                  {t('previewOverlay.forceEndVoting', language) || 'Force End Voting'}
                </button>
              )}
            </div>
          </div>
          <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: 500 }}>
            <div className="classroom-whiteboard-card" style={{ borderColor, minWidth: 600, maxWidth: 1200, minHeight: 400 }}>
              <div className="classroom-whiteboard-content">
                <div style={{ marginBottom: 8, textAlign: 'left', width: '100%', paddingLeft: '5px' }}>
                  {[...Array(player?.lives || 0)].map((_, i) => (
                    <span key={i} className="animated-heart" style={{ color: '#ff6b6b', fontSize: '1.3rem', marginRight: 3 }}>❤</span>
                  ))}
                </div>
                <div className="classroom-whiteboard-svg" style={{ width: '100%', aspectRatio: '2/1', minHeight: '350px', maxHeight: '700px', backgroundColor: CHALKBOARD_BACKGROUND_COLOR, border: '4px solid #8B4513', borderRadius: '8px', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.25)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                  {boardSvgs[player.persistentPlayerId] ? (
                    <FabricJsonToSvg 
                      jsonData={boardSvgs[player.persistentPlayerId]}
                      className="scaled-svg-preview" 
                      targetWidth={1200}
                      targetHeight={600}
                    />
                  ) : (
                    <div className="svg-display-wrapper" style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <svg viewBox="0 0 1200 600"><rect width="100%" height="100%" fill={CHALKBOARD_BACKGROUND_COLOR} /></svg>
                    </div>
                  )}
                </div>
                {answer !== undefined && (
                  <div className="notepad-answer mt-2 mb-2">
                    <span className="notepad-label">
                      <i className="bi bi-card-text me-1"></i>{t('answer', language)}:
                    </span>
                    <span className="notepad-text ms-2">
                      {answer.hasDrawing && !answer.answer ? t('drawingOnly', language) : (answer.answer || "-")}
                    </span>
                  </div>
                )}
                {evaluation !== undefined && renderEvaluationBadge(evaluation, player.persistentPlayerId)}
              </div>
              <div className="classroom-whiteboard-label">
                <span className="classroom-whiteboard-name"><i className="bi bi-person-fill me-2"></i>{player?.name || ''}</span>
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-left" style={{ background: tapeColor }} />
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-right" style={{ background: tapeColor }} />
              </div>
            </div>
            {isGameMaster && (
              <div className="d-flex gap-2 mt-4">
                <button className="btn btn-outline-primary" onClick={handlePrev}><i className="bi bi-arrow-left"></i> Prev</button>
                <button className="btn btn-outline-secondary" onClick={handleUnfocus}><i className="bi bi-grid"></i> Grid View</button>
                <button className="btn btn-outline-primary" onClick={handleNext}>Next <i className="bi bi-arrow-right"></i></button>
              </div>
            )}
          </div>
        </div>

        {/* Correction Confirmation Modal */}
        {showCorrectionConfirm && pendingCorrection && (
          <div 
            className="modal fade show" 
            style={{ 
              display: 'block', 
              backgroundColor: 'rgba(0,0,0,0.5)', 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              zIndex: 9999,
              overflow: 'auto'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cancelCorrection();
              }
            }}
          >
            <div 
              className="modal-dialog modal-dialog-centered" 
              style={{ 
                margin: '1.75rem auto',
                maxWidth: '500px',
                width: '90%'
              }}
            >
              <div 
                className="modal-content" 
                style={{ 
                  background: '#fffbe7',
                  border: '3px dashed #ffe066',
                  borderRadius: '18px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
                  position: 'relative',
                  zIndex: 10000
                }}
              >
                <div 
                  className="modal-header" 
                  style={{ 
                    background: 'linear-gradient(90deg, #ffe066 80%, #ffd166 100%)',
                    borderBottom: '2px solid #ffd166',
                    borderRadius: '15px 15px 0 0',
                    padding: '1rem'
                  }}
                >
                  <h5 className="modal-title" style={{ margin: 0 }}>{t('previewOverlay.confirmCorrection', language)}</h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={cancelCorrection}
                    style={{ marginLeft: 'auto' }}
                  ></button>
                </div>
                <div className="modal-body" style={{ padding: '1.5rem' }}>
                  <p>{t('previewOverlay.correctionConfirmation', language)}</p>
                  <p className="mb-0">
                    {t('previewOverlay.correctionDetails', language)}
                  </p>
                  <ul>
                    <li>{t('previewOverlay.correctionEffect1', language)}</li>
                    <li>{t('previewOverlay.correctionEffect2', language)}</li>
                    <li>{t('previewOverlay.correctionEffect3', language)}</li>
                  </ul>
                </div>
                <div 
                  className="modal-footer" 
                  style={{ 
                    borderTop: '2px solid #ffd166',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem'
                  }}
                >
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={cancelCorrection}
                    style={{ minWidth: '100px' }}
                  >
                    {t('cancel', language)}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={confirmCorrection}
                    style={{ minWidth: '100px' }}
                  >
                    {t('confirm', language)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  // --- End Focused View ---

  // --- Grid View ---
  return (
    <>
      <div className="preview-overlay-v2 classroom-preview-overlay">
        <button className="btn btn-danger classroom-preview-close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
        <div className="classroom-chalkboard" style={{ position: 'static', margin: '0 auto', left: 'unset', top: 'unset', width: '100%', maxWidth: 900, marginBottom: 48 }}>
          <div className="classroom-chalkboard-content">
            <div className="classroom-chalkboard-grade">
              {currentQuestion ? <><i className="bi bi-easel me-2"></i>{`${currentQuestion.grade}. ${t('class', language)} – ${currentQuestion.subject}`}</> : ''}
            </div>
            <div className="classroom-chalkboard-question">
              {currentQuestion ? <><i className="bi bi-chat-square-quote me-2"></i>{currentQuestion.text}</> : t('noQuestion', language)}
              {isCommunityVotingMode && revealedAnswer && (
                <div className="mt-2 pt-2 border-top border-light fst-italic">
                  <strong>{t('previewOverlay.correctAnswerWas', language)}:</strong> {revealedAnswer}
                </div>
              )}
            </div>
            {isCommunityVotingMode && onShowAnswer && (
              <button 
                className={`btn btn-sm ${revealedAnswer ? 'btn-outline-warning' : 'btn-outline-light'} mt-2`} 
                onClick={toggleAnswerVisibility}
                title={revealedAnswer ? t('previewOverlay.hideAnswerTitle', language) || 'Hide the correct answer' : t('previewOverlay.showAnswerTitle', language)}
              >
                <i className={`bi ${revealedAnswer ? 'bi-eye-slash-fill' : 'bi-eye-fill'} me-1`}></i> 
                {revealedAnswer ? t('previewOverlay.hideAnswer', language) || 'Hide Answer' : t('previewOverlay.showAnswer', language)}
              </button>
            )}
            {isGameMaster && isCommunityVotingMode && onForceEndVoting && (
              <button 
                className="btn btn-sm btn-danger ms-2 mt-2" 
                onClick={onForceEndVoting}
                title={t('previewOverlay.forceEndVotingTitle', language) || 'End voting and evaluate answers based on current votes'}
              >
                <i className="bi bi-flag-fill me-1"></i> 
                {t('previewOverlay.forceEndVoting', language) || 'Force End Voting'}
              </button>
            )}
          </div>
        </div>
        <div
          className="classroom-whiteboard-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${displayablePlayers.length <= 3 ? 380 : 320}px, 1fr))`,
            gap: displayablePlayers.length <= 3 ? 48 : 36,
            marginTop: 0,
            justifyItems: 'center',
            width: '100%',
            maxWidth: 1400,
          }}
        >
          {displayablePlayers.map((player, idx) => {
            const boardSubmission = context.playerBoards.find(b => b.playerId === player.id);
            const actualBoardData = boardSubmission?.boardData;
            const answer = context.allAnswersThisRound[player.persistentPlayerId];
            const evaluation = context.evaluatedAnswers[player.persistentPlayerId];
            const borderColor = boardColors[idx % boardColors.length];
            const tapeColor = getRandomTapeColor(idx);
            
            // Check if this is the current user's answer (to prevent voting for own answer)
            const isOwnAnswer = player.persistentPlayerId === myPersistentId;
            
            return (
              <div
                key={player.persistentPlayerId}
                className="classroom-whiteboard-card"
                style={{ borderColor: boardColors[idx % boardColors.length], minWidth: displayablePlayers.length <= 3 ? 340 : 300, maxWidth: displayablePlayers.length <= 3 ? 420 : 400, minHeight: 260 }}
              >
                <div className="classroom-whiteboard-content">
                  <div style={{ marginBottom: 8, textAlign: 'left', width: '100%', paddingLeft: '5px' }}>
                    {[...Array(player?.lives || 0)].map((_, i) => (
                      <span key={i} className="animated-heart" style={{ color: '#ff6b6b', fontSize: '1.3rem', marginRight: 3 }}>❤</span>
                    ))}
                  </div>
                  
                  <div
                    className="classroom-whiteboard-svg" 
                    style={{
                      width: '100%',
                      aspectRatio: '2/1',
                      minHeight: '180px',
                      maxHeight: '400px',
                      backgroundColor: CHALKBOARD_BACKGROUND_COLOR,
                      border: '4px solid #8B4513',
                      borderRadius: '8px',
                      boxShadow: 'inset 0 0 15px rgba(0,0,0,0.25)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {boardSvgs[player.persistentPlayerId] ? (
                      <FabricJsonToSvg 
                        jsonData={boardSvgs[player.persistentPlayerId]}
                        className="scaled-svg-preview" 
                        targetWidth={800}
                        targetHeight={400}
                      />
                    ) : (
                      <div 
                        className="svg-display-wrapper" 
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <svg viewBox="0 0 800 400"><rect width="100%" height="100%" fill={CHALKBOARD_BACKGROUND_COLOR} /></svg>
                      </div>
                    )}
                  </div>
                  
                  {answer !== undefined && (
                    <div className="notepad-answer mt-2 mb-2">
                      <span className="notepad-label">
                        <i className="bi bi-card-text me-1"></i>{t('answer', language)}:
                      </span>
                      <span className="notepad-text ms-2">
                        {answer.hasDrawing && !answer.answer ? t('drawingOnly', language) : (answer.answer || "-")}
                      </span>
                    </div>
                  )}
                  
                  {((isGameMaster && !isCommunityVotingMode && answer !== undefined && evaluation === undefined && onEvaluate) || 
                    (isCommunityVotingMode && answer !== undefined && onVote && !localMyVotes[player.persistentPlayerId] && evaluation === undefined && !isOwnAnswer)) && (
                    <div className="d-flex gap-2 justify-content-center mt-2">
                      <button 
                          className="btn btn-success btn-sm" 
                          onClick={() => {
                            console.log(`[PreviewOverlayV2] Voting 'correct' on ${player.persistentPlayerId}. My current vote for this:`, localMyVotes[player.persistentPlayerId]);
                            if (isCommunityVotingMode && onVote) { 
                              onVote(player.persistentPlayerId, 'correct');
                            } else if (onEvaluate) { 
                              onEvaluate(player.persistentPlayerId, true);
                            }
                          }} 
                          title={isCommunityVotingMode ? t('previewOverlay.voteCorrect', language) : t('markAsCorrect', language)}
                          disabled={isCommunityVotingMode && !!localMyVotes[player.persistentPlayerId]}
                      >
                          <i className="bi bi-check-circle-fill me-1"></i>{isCommunityVotingMode ? t('correct', language) : t('correct', language)}
                      </button>
                      <button 
                          className="btn btn-danger btn-sm" 
                          onClick={() => {
                            console.log(`[PreviewOverlayV2] Voting 'incorrect' on ${player.persistentPlayerId}. My current vote for this:`, localMyVotes[player.persistentPlayerId]);
                            if (isCommunityVotingMode && onVote) { 
                              onVote(player.persistentPlayerId, 'incorrect');
                            } else if (onEvaluate) { 
                              onEvaluate(player.persistentPlayerId, false);
                            }
                          }} 
                          title={isCommunityVotingMode ? t('previewOverlay.voteIncorrect', language) : t('markAsIncorrect', language)}
                          disabled={isCommunityVotingMode && !!localMyVotes[player.persistentPlayerId]}
                      >
                          <i className="bi bi-x-circle-fill me-1"></i>{isCommunityVotingMode ? t('incorrect', language) : t('incorrect', language)}
                      </button>
                    </div>
                  )}
                  
                  {isCommunityVotingMode && isOwnAnswer && answer !== undefined && evaluation === undefined && (
                    <div className="mt-2 text-center small fst-italic">
                      <span className="text-muted">{t('previewOverlay.cannotVoteOwn', language) || "You cannot vote for your own answer"}</span>
                    </div>
                  )}
                  
                  {isCommunityVotingMode && localCommunityVotes && localCommunityVotes[player.persistentPlayerId] && (
                    <div className="mt-2 text-center small">
                      <span className="badge bg-success me-1">Correct: {localCommunityVotes[player.persistentPlayerId]?.correct || 0}</span>
                      <span className="badge bg-danger">Incorrect: {localCommunityVotes[player.persistentPlayerId]?.incorrect || 0}</span>
                    </div>
                  )}
                  {isCommunityVotingMode && localMyVotes && localMyVotes[player.persistentPlayerId] && evaluation === undefined && (
                      <div className="mt-1 text-center small fst-italic">
                        You voted: <span className={`fw-bold ${localMyVotes[player.persistentPlayerId] === 'correct' ? 'text-success' : 'text-danger'}`}>{localMyVotes[player.persistentPlayerId]}</span>
                      </div>
                  )}
                  {evaluation !== undefined && renderEvaluationBadge(evaluation, player.persistentPlayerId)}
                </div>
                <div className="classroom-whiteboard-label">
                  <span className="classroom-whiteboard-name"><i className="bi bi-person-fill me-2"></i>{player?.name || ''}</span>
                  <span className="classroom-whiteboard-tape classroom-whiteboard-tape-left" style={{ background: tapeColor }} />
                  <span className="classroom-whiteboard-tape classroom-whiteboard-tape-right" style={{ background: tapeColor }} />
                </div>
                {isGameMaster && (
                  <button
                    className="btn btn-sm btn-outline-primary mt-2"
                    style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}
                    onClick={() => handleFocusPlayer(idx)}
                    title="Focus this answer"
                  >
                    <i className="bi bi-search"></i> Focus
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Correction Confirmation Modal */}
      {showCorrectionConfirm && pendingCorrection && (
        <div 
          className="modal fade show" 
          style={{ 
            display: 'block', 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: 9999,
            overflow: 'auto'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelCorrection();
            }
          }}
        >
          <div 
            className="modal-dialog modal-dialog-centered" 
            style={{ 
              margin: '1.75rem auto',
              maxWidth: '500px',
              width: '90%'
            }}
          >
            <div 
              className="modal-content" 
              style={{ 
                background: '#fffbe7',
                border: '3px dashed #ffe066',
                borderRadius: '18px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
                position: 'relative',
                zIndex: 10000
              }}
            >
              <div 
                className="modal-header" 
                style={{ 
                  background: 'linear-gradient(90deg, #ffe066 80%, #ffd166 100%)',
                  borderBottom: '2px solid #ffd166',
                  borderRadius: '15px 15px 0 0',
                  padding: '1rem'
                }}
              >
                <h5 className="modal-title" style={{ margin: 0 }}>{t('previewOverlay.confirmCorrection', language)}</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={cancelCorrection}
                  style={{ marginLeft: 'auto' }}
                ></button>
              </div>
              <div className="modal-body" style={{ padding: '1.5rem' }}>
                <p>{t('previewOverlay.correctionConfirmation', language)}</p>
                <p className="mb-0">
                  {t('previewOverlay.correctionDetails', language)}
                </p>
                <ul>
                  <li>{t('previewOverlay.correctionEffect1', language)}</li>
                  <li>{t('previewOverlay.correctionEffect2', language)}</li>
                  <li>{t('previewOverlay.correctionEffect3', language)}</li>
                </ul>
              </div>
              <div 
                className="modal-footer" 
                style={{ 
                  borderTop: '2px solid #ffd166',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem'
                }}
              >
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={cancelCorrection}
                  style={{ minWidth: '100px' }}
                >
                  {t('cancel', language)}
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={confirmCorrection}
                  style={{ minWidth: '100px' }}
                >
                  {t('confirm', language)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PreviewOverlayV2; 