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
  onShowAnswer
}) => {
  const context = useGame();
  const { setDrawingEnabled } = useCanvas();
  const { language } = useLanguage();
  const [boardSvgs, setBoardSvgs] = useState<Record<string, string>>({});
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  
  const [localCommunityVotes, setLocalCommunityVotes] = useState<Record<string, { correct: number, incorrect: number }>>({});
  const [localMyVotes, setLocalMyVotes] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const myPersistentId = socketService.getPersistentPlayerId();

  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

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

  return (
    <div className="preview-overlay-v2 classroom-preview-overlay">
      {/* Close button overlays music button */}
      <button className="btn btn-danger classroom-preview-close-btn" onClick={onClose}>
        <i className="bi bi-x-lg"></i>
      </button>
      {/* Chalkboard question at the top, not absolutely positioned */}
      <div className="classroom-chalkboard" style={{ position: 'static', margin: '0 auto', left: 'unset', top: 'unset', width: '100%', maxWidth: 900, marginBottom: 48 }}>
        <div className="classroom-chalkboard-content">
          <div className="classroom-chalkboard-grade">
            {currentQuestion ? <><i className="bi bi-easel me-2"></i>{`${currentQuestion.grade}. ${t('class', language)} – ${currentQuestion.subject}`}</> : ''}
          </div>
          <div className="classroom-chalkboard-question">
            {currentQuestion ? <><i className="bi bi-chat-square-quote me-2"></i>{currentQuestion.text}</> : t('noQuestion', language)}
            {/* Display revealed answer here */}
            {isCommunityVotingMode && revealedAnswer && (
              <div className="mt-2 pt-2 border-top border-light fst-italic">
                <strong>{t('previewOverlay.correctAnswerWas', language)}:</strong> {revealedAnswer}
              </div>
            )}
          </div>
          {/* Show Answer button for community voting */}
          {isCommunityVotingMode && onShowAnswer && (
            <button 
              className="btn btn-sm btn-outline-light mt-2" 
              onClick={onShowAnswer}
              title={t('previewOverlay.showAnswerTitle', language)}
            >
              <i className="bi bi-eye-fill me-1"></i> {t('previewOverlay.showAnswer', language)}
            </button>
          )}
        </div>
        {/* Removed sponge */}
      </div>
      {/* Player boards grid below chalkboard */}
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
        {displayablePlayers.map((player, idx) => { // Iterate over displayablePlayers
          // Use player.id (which is the socket.id) to match PlayerBoard.playerId
          const boardSubmission = context.playerBoards.find(b => b.playerId === player.id);
          const actualBoardData = boardSubmission?.boardData;
          const answer = context.allAnswersThisRound[player.persistentPlayerId]; // Answers are keyed by persistentPlayerId
          const evaluation = context.evaluatedAnswers[player.persistentPlayerId]; // Evaluations are keyed by persistentPlayerId
          const borderColor = boardColors[idx % boardColors.length];
          const tapeColor = getRandomTapeColor(idx);
          return (
            <div
              key={player.persistentPlayerId} // Use player.persistentPlayerId as key
              className="classroom-whiteboard-card"
              style={{ borderColor, minWidth: displayablePlayers.length <= 3 ? 340 : 300, maxWidth: displayablePlayers.length <= 3 ? 420 : 400, minHeight: 260 }}
            >
              <div className="classroom-whiteboard-content">
                {/* Player lives - ensure this is visually separated and above drawing */}
                <div style={{
                  marginBottom: 8, 
                  textAlign: 'left', // Align hearts to the left within their own row
                  width: '100%', // Ensure it takes width for alignment
                  paddingLeft: '5px' // Small padding from left edge of card content
                }}>
                  {[...Array(player?.lives || 0)].map((_, i) => (
                    <span key={i} className="animated-heart" style={{ color: '#ff6b6b', fontSize: '1.3rem', marginRight: 3 }}>❤</span>
                  ))}
                </div>
                
                {/* Drawing Area with Chalkboard Background */}
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
                  {/* Replace direct SVG rendering with FabricJsonToSvg component */}
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
                
                {/* Answer with notepad effect - Show if an answer submission exists, even if text is empty */}
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
                {/* Correct/Incorrect buttons for GameMaster (standard mode) OR for all players (community voting mode) */}
                {((isGameMaster && !isCommunityVotingMode && answer !== undefined && evaluation === undefined && onEvaluate) || 
                  (isCommunityVotingMode && answer !== undefined && onVote && !localMyVotes[player.persistentPlayerId] && evaluation === undefined)) && (
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
                {/* Display vote counts in community voting mode */}
                {isCommunityVotingMode && localCommunityVotes && localCommunityVotes[player.persistentPlayerId] && (
                  <div className="mt-2 text-center small">
                    <span className="badge bg-success me-1">Correct: {localCommunityVotes[player.persistentPlayerId]?.correct || 0}</span>
                    <span className="badge bg-danger">Incorrect: {localCommunityVotes[player.persistentPlayerId]?.incorrect || 0}</span>
                  </div>
                )}
                {/* Show player's own vote in community voting mode if they voted */}
                {isCommunityVotingMode && localMyVotes && localMyVotes[player.persistentPlayerId] && evaluation === undefined && (
                    <div className="mt-1 text-center small fst-italic">
                        You voted: <span className={`fw-bold ${localMyVotes[player.persistentPlayerId] === 'correct' ? 'text-success' : 'text-danger'}`}>{localMyVotes[player.persistentPlayerId]}</span>
                    </div>
                )}
                {/* Show badge if evaluated (standard mode or after community voting tallied) */}
                {evaluation !== undefined && (
                  <span 
                    className={`classroom-whiteboard-badge ${evaluation ? 'correct' : 'incorrect'}`}
                    style={{ 
                      animation: 'fadeInScale 0.3s ease-out'
                    }}
                  >
                    {evaluation ? 
                      <><i className="bi bi-patch-check-fill me-1"></i>{t('correct', language)}</> : 
                      <><i className="bi bi-patch-exclamation-fill me-1"></i>{t('incorrect', language)}</>
                    }
                  </span>
                )}
              </div>
              <div className="classroom-whiteboard-label">
                <span className="classroom-whiteboard-name"><i className="bi bi-person-fill me-2"></i>{player?.name || ''}</span>
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-left" style={{ background: tapeColor }} />
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-right" style={{ background: tapeColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PreviewOverlayV2; 