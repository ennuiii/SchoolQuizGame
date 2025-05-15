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

const PreviewOverlayV2: React.FC<PreviewOverlayProps> = ({
  onFocus,
  onClose,
  isGameMaster
}) => {
  const context = useGame();
  const { setDrawingEnabled } = useCanvas();

  if (!context.previewMode.isActive) return null;

  const activePlayerBoards = context.playerBoards.filter(board => {
    const player = context.players.find(p => p.id === board.playerId);
    return player && !player.isSpectator;
  });

  useEffect(() => {
    setDrawingEnabled(false);
    return () => setDrawingEnabled(true);
  }, [setDrawingEnabled]);

  const currentQuestion = context.currentQuestion;

  return (
    <div className="preview-overlay-v2 classroom-preview-overlay">
      {/* Close button overlays music button */}
      <button className="btn btn-danger classroom-preview-close-btn" onClick={onClose}>
        ×
      </button>
      {/* Chalkboard question at the top, not absolutely positioned */}
      <div className="classroom-chalkboard" style={{ position: 'static', margin: '0 auto', left: 'unset', top: 'unset', width: '100%', maxWidth: 900, marginBottom: 48 }}>
        <div className="classroom-chalkboard-content">
          <div className="classroom-chalkboard-grade">
            {currentQuestion ? `${currentQuestion.grade}. Klasse – ${currentQuestion.subject}` : ''}
          </div>
          <div className="classroom-chalkboard-question">
            {currentQuestion ? currentQuestion.text : 'No question'}
          </div>
        </div>
        {/* Removed sponge */}
      </div>
      {/* Player boards grid below chalkboard */}
      <div
        className="classroom-whiteboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${activePlayerBoards.length <= 3 ? 380 : 320}px, 1fr))`,
          gap: activePlayerBoards.length <= 3 ? 48 : 36,
          marginTop: 0,
          justifyItems: 'center',
          width: '100%',
          maxWidth: 1400,
        }}
      >
        {activePlayerBoards.map((board, idx) => {
          const player = context.players.find(p => p.id === board.playerId);
          const answer = context.allAnswersThisRound[board.playerId];
          const evaluation = context.evaluatedAnswers[board.playerId];
          const borderColor = boardColors[idx % boardColors.length];
          return (
            <div
              key={board.playerId}
              className="classroom-whiteboard-card"
              style={{ borderColor, minWidth: activePlayerBoards.length <= 3 ? 340 : 300, maxWidth: activePlayerBoards.length <= 3 ? 420 : 400, minHeight: 260 }}
            >
              <div className="classroom-whiteboard-content">
                <div
                  className="classroom-whiteboard-svg"
                  style={{ minHeight: 120, maxHeight: 180, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {/* Ensure SVG is scaled to fit the container */}
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      dangerouslySetInnerHTML={{ __html: board.boardData || '' }}
                    />
                  </div>
                </div>
                {answer && (
                  <div className="classroom-whiteboard-answer">
                    {answer.answer}
                  </div>
                )}
                {evaluation !== undefined && (
                  <span className={`className-whiteboard-badge ${evaluation ? 'correct' : 'incorrect'}`}>{evaluation ? 'Correct' : 'Incorrect'}</span>
                )}
              </div>
              <div className="classroom-whiteboard-label">
                <span className="classroom-whiteboard-name">{player?.name || ''}</span>
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-left" />
                <span className="classroom-whiteboard-tape classroom-whiteboard-tape-right" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PreviewOverlayV2; 