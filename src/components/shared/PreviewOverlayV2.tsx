// Copy of PreviewOverlay for alternate design testing
import React, { useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { fabric } from 'fabric';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
  isSpectator: boolean;
}

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface AnswerSubmission {
  playerId: string;
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
  onEvaluate
}) => {
  const context = useGame();
  const { setDrawingEnabled } = useCanvas();

  if (!context.previewMode.isActive) return null;

  // Iterate over active players, not just those with boards
  const displayablePlayers = context.players.filter(p => p.isActive && !p.isSpectator);

  useEffect(() => {
    setDrawingEnabled(false);
    return () => setDrawingEnabled(true);
  }, [setDrawingEnabled]);

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
            {currentQuestion ? <><i className="bi bi-easel me-2"></i>{`${currentQuestion.grade}. Klasse – ${currentQuestion.subject}`}</> : ''}
          </div>
          <div className="classroom-chalkboard-question">
            {currentQuestion ? <><i className="bi bi-chat-square-quote me-2"></i>{currentQuestion.text}</> : 'No question'}
          </div>
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
          const boardSubmission = context.playerBoards.find(b => b.playerId === player.id);
          const actualBoardData = boardSubmission?.boardData;
          const answer = context.allAnswersThisRound[player.id];
          const evaluation = context.evaluatedAnswers[player.id];
          const borderColor = boardColors[idx % boardColors.length];
          const tapeColor = getRandomTapeColor(idx);
          return (
            <div
              key={player.id} // Use player.id as key
              className="classroom-whiteboard-card"
              style={{ borderColor, minWidth: displayablePlayers.length <= 3 ? 340 : 300, maxWidth: displayablePlayers.length <= 3 ? 420 : 400, minHeight: 260 }}
            >
              <div className="classroom-whiteboard-content">
                {/* Player lives */}
                <div style={{ marginBottom: 6 }}>
                  {[...Array(player?.lives || 0)].map((_, i) => (
                    <span key={i} className="animated-heart" style={{ color: '#ff6b6b', fontSize: '1.3rem', marginRight: 2 }}>❤</span>
                  ))}
                </div>
                <div
                  className="classroom-whiteboard-svg"
                  style={{
                    height: 150,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#314C32',
                  }}
                >
                  {/* Ensure SVG is scaled to fit the container */}
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      dangerouslySetInnerHTML={{ __html: actualBoardData || '' }} // Use actualBoardData or empty string
                    />
                  </div>
                </div>
                {/* Answer with notepad effect */}
                {answer && (
                  <div className="notepad-answer mt-2 mb-2">
                    <span className="notepad-label">
                      <i className="bi bi-card-text me-1"></i>Answer:
                    </span>
                    <span className="notepad-text ms-2">{answer.answer}</span>
                  </div>
                )}
                {/* Correct/Incorrect buttons for GameMaster */}
                {isGameMaster && answer && evaluation === undefined && onEvaluate && (
                  <div className="d-flex gap-2 justify-content-center mt-2">
                    <button className="btn btn-success btn-sm" onClick={() => onEvaluate(player.id, true)}><i className="bi bi-check-circle-fill me-1"></i>Correct</button>
                    <button className="btn btn-danger btn-sm" onClick={() => onEvaluate(player.id, false)}><i className="bi bi-x-circle-fill me-1"></i>Incorrect</button>
                  </div>
                )}
                {/* Show badge if evaluated */}
                {evaluation !== undefined && (
                  <span className={`classroom-whiteboard-badge ${evaluation ? 'correct' : 'incorrect'}`}>
                    {evaluation ? <><i className="bi bi-patch-check-fill me-1"></i>Correct</> : <><i className="bi bi-patch-exclamation-fill me-1"></i>Incorrect</>}
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